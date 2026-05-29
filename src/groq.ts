export type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export async function streamGroqCompletion(
  apiKey: string,
  messages: ChatMessage[],
  mode: 'balanced' | 'precise' | 'exhaustive',
  onChunk: (chunk: string) => void
): Promise<string> {
  const systemMap = {
    balanced: `You are Axiom, a sophisticated research intelligence. Provide clear, well-structured, authoritative responses. Use markdown formatting—headers, lists, code blocks—where it genuinely improves clarity. Be thorough but not verbose. Prioritize accuracy and insight.`,
    precise: `You are Axiom, a precise research intelligence. Give concise, factual, direct answers. Minimize preamble. Use formatting sparingly. Every sentence must earn its place.`,
    exhaustive: `You are Axiom, a deep research intelligence. Provide comprehensive, multi-faceted analysis. Explore historical context, theoretical foundations, competing perspectives, implications, and open questions. Use rich markdown structure with clear hierarchy. Leave no important angle unexplored.`,
  };

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemMap[mode] },
        ...messages,
      ],
      stream: true,
      temperature: mode === 'exhaustive' ? 0.75 : 0.55,
      max_tokens: mode === 'precise' ? 1024 : mode === 'exhaustive' ? 8192 : 4096,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${res.status}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body');

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
        onChunk(full);
      } catch (_) {}
    }
  }

  return full;
}
