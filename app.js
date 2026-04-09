/* ═══════════════════════════════════════════════════════════════════════════
   AXIOM — Research Intelligence
   app.js — Full application logic
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';

/* ─── IndexedDB ──────────────────────────────────────────────────────────── */
const DB = (() => {
  const NAME    = 'axiom_db';
  const VERSION = 1;
  let _db = null;

  async function open() {
    if (_db) return _db;
    return new Promise((res, rej) => {
      const req = indexedDB.open(NAME, VERSION);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('sessions')) {
          const s = db.createObjectStore('sessions', { keyPath: 'id' });
          s.createIndex('createdAt', 'createdAt');
        }
        if (!db.objectStoreNames.contains('messages')) {
          const m = db.createObjectStore('messages', { keyPath: 'id' });
          m.createIndex('sessionId', 'sessionId');
        }
        if (!db.objectStoreNames.contains('kv')) {
          db.createObjectStore('kv', { keyPath: 'k' });
        }
      };
      req.onsuccess = () => { _db = req.result; res(_db); };
      req.onerror   = () => rej(req.error);
    });
  }

  async function tx(store, mode, fn) {
    const db  = await open();
    const t   = db.transaction(store, mode);
    const s   = t.objectStore(store);
    return new Promise((res, rej) => {
      const r = fn(s);
      r.onsuccess = () => res(r.result);
      r.onerror   = () => rej(r.error);
    });
  }

  async function get(store, key)          { return tx(store, 'readonly',  s => s.get(key)); }
  async function put(store, val)          { return tx(store, 'readwrite', s => s.put(val)); }
  async function del(store, key)          { return tx(store, 'readwrite', s => s.delete(key)); }
  async function getAll(store)            { return tx(store, 'readonly',  s => s.getAll()); }
  async function getAllByIndex(store, idx, val) {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction(store, 'readonly');
      const r = t.objectStore(store).index(idx).getAll(val);
      r.onsuccess = () => res(r.result);
      r.onerror   = () => rej(r.error);
    });
  }
  async function kvGet(k)      { const r = await get('kv', k);    return r ? r.v : null; }
  async function kvSet(k, v)   { return put('kv', { k, v }); }

  async function clearAll() {
    const db = await open();
    return new Promise((res) => {
      const t = db.transaction(['sessions','messages','kv'], 'readwrite');
      t.objectStore('sessions').clear();
      t.objectStore('messages').clear();
      t.objectStore('kv').clear();
      t.oncomplete = res;
    });
  }

  return { get, put, del, getAll, getAllByIndex, kvGet, kvSet, clearAll };
})();

/* ─── Canvas Background ──────────────────────────────────────────────────── */
function initBackground() {
  const canvas = document.getElementById('bg-canvas');
  const ctx    = canvas.getContext('2d');
  let W, H, raf;

  const nodes = [];
  const NODES = 14;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function initNodes() {
    nodes.length = 0;
    for (let i = 0; i < NODES; i++) {
      nodes.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        r: Math.random() * 1.8 + 0.8,
      });
    }
  }

  let t = 0;
  function draw() {
    ctx.clearRect(0, 0, W, H);

    /* deep background */
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#07080d');
    bg.addColorStop(1, '#050609');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    /* subtle aurora – 2 drifting radial blobs */
    const blobs = [
      { x: W * 0.15 + Math.sin(t * 0.00045) * 160, y: H * 0.25 + Math.cos(t * 0.0006) * 100, c: '200,169,110' },
      { x: W * 0.82 + Math.cos(t * 0.00038) * 130, y: H * 0.7  + Math.sin(t * 0.00052) * 110, c: '78,205,196'  },
    ];
    blobs.forEach(b => {
      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, 340);
      g.addColorStop(0,   `rgba(${b.c},0.055)`);
      g.addColorStop(0.5, `rgba(${b.c},0.018)`);
      g.addColorStop(1,   `rgba(${b.c},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 340, 0, Math.PI * 2);
      ctx.fill();
    });

    /* update nodes */
    nodes.forEach(n => {
      n.x += n.vx; n.y += n.vy;
      if (n.x < 0 || n.x > W) n.vx *= -1;
      if (n.y < 0 || n.y > H) n.vy *= -1;
    });

    /* edges */
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx   = nodes[i].x - nodes[j].x;
        const dy   = nodes[i].y - nodes[j].y;
        const dist = Math.hypot(dx, dy);
        if (dist < 220) {
          const a = (1 - dist / 220) * 0.12;
          ctx.strokeStyle = `rgba(200,169,110,${a})`;
          ctx.lineWidth   = 0.6;
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.stroke();
        }
      }
    }

    /* node dots */
    nodes.forEach(n => {
      ctx.fillStyle = 'rgba(200,169,110,0.25)';
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fill();
    });

    t++;
    raf = requestAnimationFrame(draw);
  }

  window.addEventListener('resize', () => { resize(); initNodes(); });
  resize();
  initNodes();
  draw();
}

/* ─── Markdown Renderer ──────────────────────────────────────────────────── */
function renderMarkdown(raw) {
  const escape = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  let html  = '';
  const lines = raw.split('\n');
  let i = 0;
  let inList = null;   // 'ul' | 'ol' | null

  function closelist() {
    if (inList) { html += `</${inList}>`; inList = null; }
  }

  function inlineFormat(s) {
    return escape(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  }

  while (i < lines.length) {
    const line = lines[i];

    /* fenced code block */
    if (line.startsWith('```')) {
      closelist();
      const lang = line.slice(3).trim();
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(escape(lines[i]));
        i++;
      }
      html += `<pre>${lang ? `<span class="code-lang">${lang}</span>` : ''}<code>${codeLines.join('\n')}</code></pre>`;
      i++; continue;
    }

    /* hr */
    if (/^---+$/.test(line.trim())) {
      closelist(); html += '<hr>'; i++; continue;
    }

    /* blockquote */
    if (line.startsWith('> ')) {
      closelist(); html += `<blockquote>${inlineFormat(line.slice(2))}</blockquote>`; i++; continue;
    }

    /* headings */
    const hMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (hMatch) {
      closelist();
      const lvl = hMatch[1].length;
      html += `<h${lvl}>${inlineFormat(hMatch[2])}</h${lvl}>`;
      i++; continue;
    }

    /* unordered list */
    if (/^[-*]\s+/.test(line)) {
      if (inList !== 'ul') { closelist(); html += '<ul>'; inList = 'ul'; }
      html += `<li>${inlineFormat(line.replace(/^[-*]\s+/, ''))}</li>`;
      i++; continue;
    }

    /* ordered list */
    if (/^\d+\.\s+/.test(line)) {
      if (inList !== 'ol') { closelist(); html += '<ol>'; inList = 'ol'; }
      html += `<li>${inlineFormat(line.replace(/^\d+\.\s+/, ''))}</li>`;
      i++; continue;
    }

    /* blank line */
    if (line.trim() === '') {
      closelist(); i++; continue;
    }

    /* paragraph */
    closelist();
    html += `<p>${inlineFormat(line)}</p>`;
    i++;
  }

  closelist();
  return html;
}

/* ─── State ──────────────────────────────────────────────────────────────── */
let apiKey       = '';
let sessions     = [];
let activeId     = null;
let messages     = [];
let isStreaming  = false;
let currentMode  = 'balanced';

/* ─── DOM refs ───────────────────────────────────────────────────────────── */
const $ = id => document.getElementById(id);

const gate          = $('gate');
const app           = $('app');
const apiKeyInput   = $('api-key-input');
const keyToggle     = $('key-toggle');
const gateSubmit    = $('gate-submit');
const gateError     = $('gate-error');

const sidebar       = $('sidebar');
const sidebarToggle = $('sidebar-toggle');
const sessionsList  = $('sessions-list');
const newSessionBtn = $('new-session-btn');
const settingsBtn   = $('settings-btn');

const messagesDiv   = $('messages');
const emptyState    = $('empty-state');
const sessionTitle  = $('session-title');

const userInput     = $('user-input');
const inputShell    = $('input-shell');
const sendBtn       = $('send-btn');
const modeIndicator = $('mode-indicator');

const settingsModal     = $('settings-modal');
const modalClose        = $('modal-close');
const settingsKeyInput  = $('settings-key-input');
const settingsKeyToggle = $('settings-key-toggle');
const saveSettingsBtn   = $('save-settings-btn');
const clearDataBtn      = $('clear-data-btn');
const modalStats        = $('modal-stats');

/* ─── Boot ───────────────────────────────────────────────────────────────── */
async function boot() {
  initBackground();

  const savedKey = await DB.kvGet('apiKey');
  if (savedKey) {
    apiKey = savedKey;
    showApp();
  }

  /* load sessions */
  const all = await DB.getAll('sessions');
  all.sort((a, b) => b.createdAt - a.createdAt);
  sessions = all;
  renderSessions();
  if (sessions.length) await loadSession(sessions[0].id);
}

/* ─── Gate ───────────────────────────────────────────────────────────────── */
gateSubmit.addEventListener('click', handleKeySubmit);
apiKeyInput.addEventListener('keydown', e => { if (e.key === 'Enter') handleKeySubmit(); });

function handleKeySubmit() {
  const val = apiKeyInput.value.trim();
  if (!val.startsWith('gsk_')) { gateError.classList.remove('hidden'); return; }
  gateError.classList.add('hidden');
  apiKey = val;
  DB.kvSet('apiKey', val);
  showApp();
}

function showApp() {
  gate.classList.add('hidden');
  app.classList.remove('hidden');
}

keyToggle.addEventListener('click', () => {
  apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
});

/* ─── Sidebar toggle ─────────────────────────────────────────────────────── */
sidebarToggle.addEventListener('click', () => sidebar.classList.toggle('collapsed'));

/* ─── Sessions ───────────────────────────────────────────────────────────── */
newSessionBtn.addEventListener('click', createSession);

async function createSession() {
  const id  = `s_${Date.now()}`;
  const ses = { id, title: 'New Research Session', createdAt: Date.now(), msgCount: 0 };
  await DB.put('sessions', ses);
  sessions.unshift(ses);
  renderSessions();
  await loadSession(id);
}

async function loadSession(id) {
  activeId = id;
  const msgs = await DB.getAllByIndex('messages', 'sessionId', id);
  msgs.sort((a, b) => a.ts - b.ts);
  messages = msgs;
  const ses = sessions.find(s => s.id === id);
  sessionTitle.textContent = ses ? ses.title : 'Research Session';
  renderSessions();
  renderMessages();
}

async function deleteSession(id) {
  await DB.del('sessions', id);
  const msgs = await DB.getAllByIndex('messages', 'sessionId', id);
  for (const m of msgs) await DB.del('messages', m.id);
  sessions = sessions.filter(s => s.id !== id);
  renderSessions();
  if (activeId === id) {
    if (sessions.length) await loadSession(sessions[0].id);
    else { activeId = null; messages = []; sessionTitle.textContent = 'New Research Session'; renderMessages(); }
  }
}

function renderSessions() {
  sessionsList.innerHTML = '';
  sessions.forEach(ses => {
    const el = document.createElement('div');
    el.className = 'session-item' + (ses.id === activeId ? ' active' : '');
    el.innerHTML = `
      <span class="session-icon"></span>
      <div class="session-info">
        <div class="session-name">${htmlEsc(ses.title)}</div>
        <div class="session-meta">${formatDate(ses.createdAt)} · ${ses.msgCount || 0} messages</div>
      </div>
      <button class="session-del" title="Delete session">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>`;
    el.querySelector('.session-del').addEventListener('click', e => {
      e.stopPropagation();
      deleteSession(ses.id);
    });
    el.addEventListener('click', () => loadSession(ses.id));
    sessionsList.appendChild(el);
  });
}

/* ─── Messages ───────────────────────────────────────────────────────────── */
function renderMessages() {
  /* remove all message rows */
  const rows = messagesDiv.querySelectorAll('.msg-row');
  rows.forEach(r => r.remove());

  if (messages.length === 0) {
    emptyState.style.display = '';
    return;
  }
  emptyState.style.display = 'none';
  messages.forEach(m => messagesDiv.appendChild(buildRow(m.role, m.content)));
  scrollBottom();
}

function buildRow(role, content, streaming = false) {
  const row  = document.createElement('div');
  row.className = `msg-row ${role}`;

  const label = document.createElement('div');
  label.className = 'msg-role';
  label.textContent = role === 'user' ? 'You' : 'Axiom';

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';

  if (role === 'user') {
    bubble.textContent = content;
  } else {
    bubble.innerHTML = renderMarkdown(content) + (streaming ? '<span class="stream-cursor"></span>' : '');
  }

  row.appendChild(label);
  row.appendChild(bubble);
  return row;
}

function scrollBottom() {
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

/* ─── Send ───────────────────────────────────────────────────────────────── */
userInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

userInput.addEventListener('input', () => {
  userInput.style.height = 'auto';
  userInput.style.height = Math.min(userInput.scrollHeight, 180) + 'px';
});

sendBtn.addEventListener('click', sendMessage);

async function sendMessage() {
  const text = userInput.value.trim();
  if (!text || isStreaming) return;

  /* ensure session */
  if (!activeId) await createSession();

  emptyState.style.display = 'none';

  /* persist user message */
  const uMsg = { id: `m_${Date.now()}`, sessionId: activeId, role: 'user', content: text, ts: Date.now() };
  await DB.put('messages', uMsg);
  messages.push(uMsg);
  messagesDiv.appendChild(buildRow('user', text));

  /* update session title if first message */
  const ses = sessions.find(s => s.id === activeId);
  if (ses && ses.title === 'New Research Session') {
    ses.title = text.length > 58 ? text.slice(0, 55) + '…' : text;
    await DB.put('sessions', ses);
    sessionTitle.textContent = ses.title;
    renderSessions();
  }

  userInput.value = '';
  userInput.style.height = 'auto';
  isStreaming = true;
  sendBtn.disabled = true;

  /* thinking row */
  const thinkRow = document.createElement('div');
  thinkRow.className = 'msg-row assistant';
  thinkRow.innerHTML = `<div class="msg-role">Axiom</div><div class="thinking"><span></span><span></span><span></span></div>`;
  messagesDiv.appendChild(thinkRow);
  scrollBottom();

  /* system prompts by mode */
  const systemMap = {
    balanced: `You are Axiom, a sophisticated research intelligence. Provide clear, well-structured, authoritative responses. Use markdown formatting—headers, lists, code blocks—where it genuinely improves clarity. Be thorough but not verbose. Prioritize accuracy and insight.`,
    precise:  `You are Axiom, a precise research intelligence. Give concise, factual, direct answers. Minimize preamble. Use formatting sparingly. Every sentence must earn its place.`,
    exhaustive: `You are Axiom, a deep research intelligence. Provide comprehensive, multi-faceted analysis. Explore historical context, theoretical foundations, competing perspectives, implications, and open questions. Use rich markdown structure with clear hierarchy. Leave no important angle unexplored.`,
  };

  const historyMsgs = messages.map(m => ({ role: m.role, content: m.content }));

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemMap[currentMode] },
          ...historyMsgs,
        ],
        stream: true,
        temperature: currentMode === 'exhaustive' ? 0.75 : 0.55,
        max_tokens: currentMode === 'precise' ? 1024 : currentMode === 'exhaustive' ? 8192 : 4096,
      }),
    });

    thinkRow.remove();

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${res.status}`);
    }

    /* streaming response row */
    const aiRow    = document.createElement('div');
    aiRow.className = 'msg-row assistant';
    const aiLabel  = document.createElement('div');
    aiLabel.className = 'msg-role';
    aiLabel.textContent = 'Axiom';
    const aiBubble = document.createElement('div');
    aiBubble.className = 'msg-bubble';
    aiRow.appendChild(aiLabel);
    aiRow.appendChild(aiBubble);
    messagesDiv.appendChild(aiRow);

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let full = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;
        try {
          const delta = JSON.parse(data).choices?.[0]?.delta?.content || '';
          full += delta;
          aiBubble.innerHTML = renderMarkdown(full) + '<span class="stream-cursor"></span>';
          scrollBottom();
        } catch (_) {}
      }
    }

    /* finalize */
    aiBubble.innerHTML = renderMarkdown(full);

    const aMsg = { id: `m_${Date.now()}_a`, sessionId: activeId, role: 'assistant', content: full, ts: Date.now() };
    await DB.put('messages', aMsg);
    messages.push(aMsg);

    /* update message count */
    if (ses) {
      ses.msgCount = (ses.msgCount || 0) + 2;
      await DB.put('sessions', ses);
      renderSessions();
    }

  } catch (err) {
    thinkRow.remove();
    const errContent = `**Error:** ${err.message}\n\nPlease check your Groq API key in Settings.`;
    const errRow = buildRow('assistant', errContent);
    messagesDiv.appendChild(errRow);
    const errMsg = { id: `m_${Date.now()}_e`, sessionId: activeId, role: 'assistant', content: errContent, ts: Date.now() };
    await DB.put('messages', errMsg);
    messages.push(errMsg);
  }

  isStreaming = false;
  sendBtn.disabled = false;
  scrollBottom();
}

/* ─── Mode selector ──────────────────────────────────────────────────────── */
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentMode = btn.dataset.mode;
    modeIndicator.textContent = currentMode;
  });
});

/* ─── Prompt chips ───────────────────────────────────────────────────────── */
document.querySelectorAll('.prompt-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    userInput.value = chip.dataset.prompt;
    userInput.dispatchEvent(new Event('input'));
    userInput.focus();
  });
});

/* ─── Settings modal ─────────────────────────────────────────────────────── */
settingsBtn.addEventListener('click', openSettings);
modalClose.addEventListener('click', closeSettings);
settingsModal.addEventListener('click', e => { if (e.target === settingsModal) closeSettings(); });

settingsKeyToggle.addEventListener('click', () => {
  settingsKeyInput.type = settingsKeyInput.type === 'password' ? 'text' : 'password';
});

function openSettings() {
  settingsKeyInput.value = apiKey;
  const totalMsgs = sessions.reduce((a, s) => a + (s.msgCount || 0), 0);
  modalStats.innerHTML = `
    <div class="stat-card"><div class="stat-label">Sessions</div><div class="stat-value">${sessions.length}</div></div>
    <div class="stat-card"><div class="stat-label">Messages</div><div class="stat-value">${totalMsgs}</div></div>
  `;
  settingsModal.classList.remove('hidden');
}

function closeSettings() { settingsModal.classList.add('hidden'); }

saveSettingsBtn.addEventListener('click', async () => {
  const val = settingsKeyInput.value.trim();
  if (!val.startsWith('gsk_')) return;
  apiKey = val;
  await DB.kvSet('apiKey', val);
  closeSettings();
});

clearDataBtn.addEventListener('click', async () => {
  if (!confirm('This will permanently delete all sessions, messages, and your API key. Continue?')) return;
  await DB.clearAll();
  apiKey = ''; sessions = []; messages = []; activeId = null;
  renderSessions();
  renderMessages();
  closeSettings();
  app.classList.add('hidden');
  gate.classList.remove('hidden');
});

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function htmlEsc(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* ─── Start ──────────────────────────────────────────────────────────────── */
boot();
