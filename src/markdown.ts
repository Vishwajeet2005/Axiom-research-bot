export function renderMarkdown(raw: string): string {
  const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  let html = '';
  const lines = raw.split('\n');
  let i = 0;
  let inList: 'ul' | 'ol' | null = null;

  function closelist() {
    if (inList) {
      html += `</${inList}>`;
      inList = null;
    }
  }

  function inlineFormat(s: string) {
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
