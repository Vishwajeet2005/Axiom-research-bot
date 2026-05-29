import { useEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent, MouseEvent } from 'react';
import { Globe, ArrowRight, Menu, X, Trash2, Settings, MessageSquare } from 'lucide-react';
import { dbPut, dbDel, dbGetAll, kvGet, kvSet, clearAllDB, dbGetAllByIndex } from './db';
import type { Session, Message } from './db';
import { streamGroqCompletion } from './groq';
import { renderMarkdown } from './markdown';

const Github = ({ size = 24, className = "" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.03c3.18-.35 6.5-1.5 6.5-7.1a5.2 5.2 0 0 0-1.5-3.8 4.9 4.9 0 0 0 .15-3.7s-1.2-.38-3.9 1.4a13.3 13.3 0 0 0-7 0C5.6 1.6 4.4 2 4.4 2a4.9 4.9 0 0 0 .15 3.8A5.2 5.2 0 0 0 3 9.6c0 5.6 3.3 6.75 6.5 7.1a4.8 4.8 0 0 0-1 3.03v4"/>
    <path d="M9 21c-3 1-4-2-4-2"/>
  </svg>
);

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fadingOutRef = useRef<boolean>(false);
  const animFrameRef = useRef<number>(0);

  // State
  const [apiKey, setApiKey] = useState('');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentMode, setCurrentMode] = useState<'balanced' | 'precise' | 'exhaustive'>('balanced');
  
  // UI State
  const [showSettings, setShowSettings] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [settingsKeyInput, setSettingsKeyInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Background Video Effect
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.style.opacity = '0';
    
    const setOpacity = (val: number) => {
      video.style.opacity = val.toString();
    };

    const getOpacity = () => {
      return parseFloat(video.style.opacity) || 0;
    };

    const fade = (targetOpacity: number, duration: number, onComplete?: () => void) => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      
      const startOpacity = getOpacity();
      const startTime = performance.now();
      
      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        const currentOpacity = startOpacity + (targetOpacity - startOpacity) * progress;
        setOpacity(currentOpacity);
        
        if (progress < 1) {
          animFrameRef.current = requestAnimationFrame(animate);
        } else {
          if (onComplete) onComplete();
        }
      };
      
      animFrameRef.current = requestAnimationFrame(animate);
    };

    const handlePlay = () => {
      fadingOutRef.current = false;
      fade(1, 500);
    };

    const handleTimeUpdate = () => {
      if (!video.duration) return;
      const timeLeft = video.duration - video.currentTime;
      
      if (timeLeft <= 0.55 && !fadingOutRef.current) {
        fadingOutRef.current = true;
        fade(0, 500);
      }
    };

    const handleEnded = () => {
      setOpacity(0);
      setTimeout(() => {
        video.currentTime = 0;
        video.play().catch(() => {});
        handlePlay();
      }, 100);
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);

    video.play().catch(() => {});

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Boot
  useEffect(() => {
    async function boot() {
      const savedKey = await kvGet('apiKey');
      if (savedKey) setApiKey(savedKey);

      const all = await dbGetAll<Session>('sessions');
      all.sort((a, b) => b.createdAt - a.createdAt);
      setSessions(all);
      if (all.length > 0) {
        await loadSession(all[0].id);
      }
    }
    boot();
  }, []);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  async function createSession() {
    const id = crypto.randomUUID();
    const ses: Session = { id, title: 'New Research Session', createdAt: Date.now(), msgCount: 0 };
    await dbPut('sessions', ses);
    setSessions(prev => [ses, ...prev]);
    await loadSession(id);
    setShowSidebar(false);
  }

  async function loadSession(id: string) {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
    }
    setActiveId(id);
    const msgs = await dbGetAllByIndex<Message>('messages', 'sessionId', id);
    msgs.sort((a, b) => a.ts - b.ts);
    setMessages(msgs);
  }

  async function deleteSession(id: string, e: MouseEvent) {
    e.stopPropagation();
    await dbDel('sessions', id);
    const msgs = await dbGetAllByIndex<Message>('messages', 'sessionId', id);
    for (const m of msgs) await dbDel('messages', m.id);
    
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeId === id) {
      setMessages([]);
      setActiveId(null);
    }
  }

  async function handleSend(e?: FormEvent) {
    if (e) e.preventDefault();
    const text = input.trim();
    if (!text || isStreaming) return;
    if (!apiKey) {
      setShowSettings(true);
      return;
    }

    let currentSessionId = activeId;
    if (!currentSessionId) {
      currentSessionId = crypto.randomUUID();
      const ses: Session = { id: currentSessionId, title: 'New Research Session', createdAt: Date.now(), msgCount: 0 };
      await dbPut('sessions', ses);
      setSessions(prev => [ses, ...prev]);
      setActiveId(currentSessionId);
    }

    const uMsgId = crypto.randomUUID();
    const uMsg: Message = { id: uMsgId, sessionId: currentSessionId, role: 'user', content: text, ts: Date.now() };
    await dbPut('messages', uMsg);
    
    // Optimistic update
    setMessages(prev => [...prev, uMsg]);
    setInput('');
    setIsStreaming(true);

    // Update title
    setSessions(prev => prev.map(s => {
      if (s.id === currentSessionId && s.title === 'New Research Session') {
        const newTitle = text.length > 58 ? text.slice(0, 55) + '…' : text;
        const updated = { ...s, title: newTitle };
        dbPut('sessions', updated);
        return updated;
      }
      return s;
    }));

    const aMsgId = crypto.randomUUID();
    const aiMsg: Message = { id: aMsgId, sessionId: currentSessionId, role: 'assistant', content: '', ts: Date.now() + 1 };
    setMessages(prev => [...prev, aiMsg]);

    const historyMsgs = messages.concat(uMsg).map(m => ({ role: m.role as 'user'|'assistant', content: m.content }));

    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    try {
      const fullResponse = await streamGroqCompletion(apiKey, historyMsgs, currentMode, abortControllerRef.current.signal, (chunk) => {
        setMessages(prev => prev.map(m => m.id === aMsgId ? { ...m, content: chunk } : m));
      });

      const finalMsg = { ...aiMsg, content: fullResponse };
      await dbPut('messages', finalMsg);
      setMessages(prev => prev.map(m => m.id === aMsgId ? finalMsg : m));

      // Update count
      setSessions(prev => prev.map(s => {
        if (s.id === currentSessionId) {
          const updated = { ...s, msgCount: (s.msgCount || 0) + 2 };
          dbPut('sessions', updated);
          return updated;
        }
        return s;
      }));
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      const errContent = `**Error:** ${err.message}\n\nPlease check your Groq API key in Settings.`;
      const errMsgId = crypto.randomUUID();
      const errMsg: Message = { id: errMsgId, sessionId: currentSessionId, role: 'assistant', content: errContent, ts: Date.now() + 2 };
      await dbPut('messages', errMsg);
      setMessages(prev => {
        // remove the streaming placeholder
        const filtered = prev.filter(m => m.id !== aMsgId);
        return [...filtered, errMsg];
      });
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleSaveSettings() {
    const val = settingsKeyInput.trim();
    if (!val.startsWith('gsk_')) return;
    setApiKey(val);
    await kvSet('apiKey', val);
    setShowSettings(false);
  }

  async function handleClearData() {
    if (!confirm('This will permanently delete all sessions, messages, and your API key. Continue?')) return;
    await clearAllDB();
    setApiKey('');
    setSessions([]);
    setMessages([]);
    setActiveId(null);
    setShowSettings(false);
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="min-h-screen bg-black overflow-hidden flex flex-col relative font-sans">
      <style>{`
        .msg-bubble h1, .msg-bubble h2, .msg-bubble h3 { font-family: 'Instrument Serif', serif; font-weight: 400; color: #e8e6df; margin: 20px 0 8px; }
        .msg-bubble h1 { font-size: 20px; }
        .msg-bubble h2 { font-size: 17px; }
        .msg-bubble h3 { font-size: 14.5px; color: #6b6a72; }
        .msg-bubble p { margin: 0 0 12px; }
        .msg-bubble p:last-child { margin-bottom: 0; }
        .msg-bubble strong { color: #fff; font-weight: 600; }
        .msg-bubble em { color: #6b6a72; font-style: italic; }
        .msg-bubble ul, .msg-bubble ol { margin: 8px 0 12px; padding-left: 20px; list-style: disc; }
        .msg-bubble code { font-family: 'DM Mono', monospace; font-size: 12.5px; background: rgba(255,255,255,0.05); color: #4ecdc4; padding: 2px 6px; border-radius: 4px; }
        .msg-bubble pre { background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 16px; overflow-x: auto; margin: 12px 0; }
        .msg-bubble pre code { background: none; color: #b8c7d9; padding: 0; }
        .msg-bubble a { color: #c8a96e; text-decoration: underline; }
        
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
      `}</style>

      {/* Background Video */}
      <video
        ref={videoRef}
        src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_115001_bcdaa3b4-03de-47e7-ad63-ae3e392c32d4.mp4"
        muted
        playsInline
        autoPlay
        className="absolute inset-0 w-full h-full object-cover translate-y-[17%]"
      />

      {/* Navigation */}
      <nav className="relative z-20 pl-6 pr-6 py-6">
        <div className="rounded-full px-6 py-3 flex items-center justify-between max-w-5xl mx-auto">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-4">
              <button onClick={() => setShowSidebar(true)} className="text-white/80 hover:text-white transition-colors">
                <Menu size={24} />
              </button>
              <div className="flex items-center gap-2">
                <Globe size={24} className="text-white" />
                <span className="text-white font-semibold text-lg">Axiom</span>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-8">
              <button onClick={() => setCurrentMode('balanced')} className={`transition-colors text-sm font-medium ${currentMode === 'balanced' ? 'text-white' : 'text-white/60 hover:text-white/80'}`}>Balanced</button>
              <button onClick={() => setCurrentMode('precise')} className={`transition-colors text-sm font-medium ${currentMode === 'precise' ? 'text-white' : 'text-white/60 hover:text-white/80'}`}>Precise</button>
              <button onClick={() => setCurrentMode('exhaustive')} className={`transition-colors text-sm font-medium ${currentMode === 'exhaustive' ? 'text-white' : 'text-white/60 hover:text-white/80'}`}>Exhaustive</button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="text-white text-sm font-medium hover:text-white/80 transition-colors" onClick={() => { setActiveId(null); setMessages([]); }}>New Chat</button>
            <button onClick={() => { setSettingsKeyInput(apiKey); setShowSettings(true); }} className="liquid-glass rounded-full px-6 py-2 text-white text-sm font-medium hover:bg-white/5 transition-colors flex items-center gap-2">
              <Settings size={16} />
              Settings
            </button>
          </div>
        </div>
      </nav>

      {/* Sidebar Overlay */}
      {showSidebar && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowSidebar(false)}></div>
          <div className="liquid-glass w-80 h-full relative z-10 flex flex-col p-6 animate-in slide-in-from-left duration-300">
            <div className="flex items-center justify-between mb-8">
              <span className="text-white font-semibold text-lg">Sessions</span>
              <button onClick={() => setShowSidebar(false)} className="text-white/60 hover:text-white">
                <X size={20} />
              </button>
            </div>
            
            <button onClick={createSession} className="liquid-glass rounded-full py-3 px-4 flex items-center justify-center gap-2 text-white text-sm font-medium hover:bg-white/5 mb-6">
              <MessageSquare size={16} />
              New Session
            </button>

            <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2">
              {sessions.map(s => (
                <div key={s.id} onClick={() => loadSession(s.id)} className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors ${activeId === s.id ? 'bg-white/10' : 'hover:bg-white/5'}`}>
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="text-white text-sm truncate">{s.title}</div>
                    <div className="text-white/40 text-xs mt-1">{new Date(s.createdAt).toLocaleDateString()} · {s.msgCount || 0} msgs</div>
                  </div>
                  <button onClick={(e) => deleteSession(s.id, e)} className="text-white/40 hover:text-red-400 p-2 opacity-0 hover:bg-red-400/10 rounded-lg group-hover:opacity-100 transition-all">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowSettings(false)}></div>
          <div className="liquid-glass rounded-3xl p-8 max-w-md w-full mx-4 relative z-10 animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-2xl text-white font-semibold mb-6" style={{ fontFamily: "'Instrument Serif', serif" }}>Settings</h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-white/60 text-xs font-medium uppercase tracking-wider mb-2">Groq API Key</label>
                <div className="liquid-glass rounded-full p-1 flex items-center">
                  <input 
                    type="password"
                    value={settingsKeyInput}
                    onChange={(e) => setSettingsKeyInput(e.target.value)}
                    placeholder="gsk_..."
                    className="bg-transparent flex-1 outline-none text-white px-4 py-2 text-sm"
                  />
                </div>
                {settingsKeyInput && !settingsKeyInput.startsWith('gsk_') && (
                  <p className="text-red-400 text-xs mt-2 ml-4">Key must start with gsk_</p>
                )}
              </div>

              <div className="flex items-center gap-3 pt-4">
                <button onClick={handleClearData} className="flex-1 liquid-glass rounded-full py-3 text-red-400 text-sm font-medium hover:bg-red-400/10 transition-colors">
                  Clear Data
                </button>
                <button onClick={handleSaveSettings} className="flex-1 bg-white rounded-full py-3 text-black text-sm font-medium hover:bg-white/90 transition-colors">
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hero / Chat Interface */}
      <main className={`relative z-10 flex-1 flex flex-col items-center px-6 transition-all duration-700 max-w-5xl mx-auto w-full ${isEmpty ? 'justify-center py-12 -translate-y-[15%]' : 'justify-end pb-8 pt-4'}`}>
        
        {/* Messages Area (Hidden if empty) */}
        {!isEmpty && (
          <div className="flex-1 w-full overflow-y-auto custom-scrollbar mb-8 flex flex-col gap-6 pr-4">
            {messages.map((m) => (
              <div key={m.id} className={`flex w-full ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] ${m.role === 'user' ? 'liquid-glass rounded-2xl rounded-tr-sm px-5 py-3' : 'px-2'}`}>
                  {m.role === 'assistant' && (
                    <div className="text-[#c8a96e] text-xs font-bold tracking-wider uppercase mb-2">Axiom</div>
                  )}
                  {m.role === 'user' ? (
                    <div className="text-white text-[15px] leading-relaxed whitespace-pre-wrap">{m.content}</div>
                  ) : (
                    <div className="msg-bubble text-white/90 text-[15px] leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) + (isStreaming && m.content.length > 0 && m.id.endsWith('_a') ? '<span class="inline-block w-1.5 h-4 ml-1 bg-[#c8a96e] animate-pulse align-middle"></span>' : '') }} />
                  )}
                  {m.role === 'assistant' && isStreaming && m.content === '' && m.id.endsWith('_a') && (
                    <div className="flex gap-1.5 mt-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Empty State Overlay */}
        {isEmpty && (
          <div className="w-full flex flex-col items-center animate-in fade-in zoom-in-95 duration-700">
            <h1 
              className="text-5xl md:text-6xl lg:text-7xl text-white mb-8 tracking-tight whitespace-nowrap"
              style={{ fontFamily: "'Instrument Serif', serif" }}
            >
              Built for the curious
            </h1>
          </div>
        )}

        {/* Input Dock */}
        <div className="max-w-2xl w-full space-y-4 shrink-0 transition-all duration-700 relative z-20">
          <div className="liquid-glass rounded-full pl-6 pr-2 py-2 flex items-center gap-3">
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isEmpty ? "What are you researching?" : "Ask a follow-up question..."} 
              className="bg-transparent flex-1 outline-none text-white placeholder:text-white/40 text-base"
              disabled={isStreaming}
            />
            <button 
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
              className={`rounded-full p-3 transition-colors shrink-0 ${input.trim() && !isStreaming ? 'bg-white text-black hover:bg-white/90' : 'bg-white/10 text-white/40'}`}
            >
              <ArrowRight size={20} />
            </button>
          </div>
          
          {isEmpty && (
            <>
              <p className="text-white/80 text-sm leading-relaxed px-4 text-center">
                Stay updated with the latest news and insights. Ask a question, explore a hypothesis, or request a deep analysis. Axiom synthesizes knowledge across all domains.
              </p>
              
              <div className="pt-2 text-center">
                <button onClick={() => setInput('Explain the mechanism of CRISPR-Cas9 and its ethical implications')} className="liquid-glass rounded-full px-8 py-3 text-white text-sm font-medium hover:bg-white/5 transition-colors">
                  Example: CRISPR Ethics
                </button>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Social icons footer */}
      {isEmpty && (
        <footer className="relative z-10 flex justify-center gap-4 pb-12 animate-in fade-in duration-1000 delay-300">
          <a href="https://github.com/Vishwajeet2005/Axiom-research-bot" target="_blank" rel="noopener noreferrer" aria-label="GitHub" className="liquid-glass rounded-full p-4 text-white/80 hover:text-white hover:bg-white/5 transition-all">
            <Github size={20} />
          </a>
        </footer>
      )}
    </div>
  );
}

export default App;
