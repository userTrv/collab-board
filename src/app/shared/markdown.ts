/**
 * Tiny, safe "markdown-ish" renderer for card descriptions: paragraphs, **bold**, *italic*,
 * `code`, - lists and https links. Everything is HTML-escaped first; the output only
 * contains the tags produced here (Angular's sanitizer runs on top as defence in depth).
 */
const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function inline(text: string): string {
  return escape(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/\bhttps:\/\/[^\s<]+[^\s<.,;:!?)]/g, (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`);
}

export function renderMarkdown(source: string): string {
  const blocks = source.replace(/\r\n/g, '\n').split(/\n{2,}/);
  return blocks
    .map((block) => {
      const lines = block.split('\n').filter((l) => l.trim() !== '');
      if (!lines.length) return '';
      if (lines.every((l) => /^\s*[-*] /.test(l))) return `<ul>${lines.map((l) => `<li>${inline(l.replace(/^\s*[-*] /, ''))}</li>`).join('')}</ul>`;
      const heading = /^(#{1,3}) (.*)$/.exec(lines[0]);
      if (heading && lines.length === 1) return `<h4>${inline(heading[2])}</h4>`;
      return `<p>${lines.map(inline).join('<br>')}</p>`;
    })
    .join('');
}
