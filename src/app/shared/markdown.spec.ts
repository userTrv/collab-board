import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
  it('renders the supported subset', () => {
    expect(renderMarkdown('Hello **bold** and *it* and `code`')).toBe('<p>Hello <strong>bold</strong> and <em>it</em> and <code>code</code></p>');
    expect(renderMarkdown('- one\n- two')).toBe('<ul><li>one</li><li>two</li></ul>');
    expect(renderMarkdown('a\nb\n\nc')).toBe('<p>a<br>b</p><p>c</p>');
    expect(renderMarkdown('see https://example.com/x.')).toContain('<a href="https://example.com/x" target="_blank" rel="noopener noreferrer">');
  });

  it('escapes HTML so descriptions cannot inject markup', () => {
    const out = renderMarkdown('<img src=x onerror=alert(1)> **<b>x</b>**');
    expect(out).not.toContain('<img');
    expect(out).toContain('&lt;img');
    expect(renderMarkdown('javascript:alert(1)')).not.toContain('<a');
  });
});
