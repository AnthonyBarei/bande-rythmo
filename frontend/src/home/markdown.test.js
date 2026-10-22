import { describe, it, expect } from 'vitest'
import { renderMarkdown } from './markdown'

describe('renderMarkdown', () => {
  it('renders headings one level down (the page owns the h1)', () => {
    expect(renderMarkdown('# Titre\n## Sous-titre')).toBe('<h2>Titre</h2>\n<h3>Sous-titre</h3>')
  })
  it('joins paragraph lines and splits on blank lines', () => {
    expect(renderMarkdown('un\ndeux\n\ntrois')).toBe('<p>un deux</p>\n<p>trois</p>')
  })
  it('renders lists and inline marks', () => {
    expect(renderMarkdown('- **gras** et *italique*\n- `code` et [lien](/confidentialite.html)'))
      .toBe('<ul><li><b>gras</b> et <i>italique</i></li><li><code>code</code> et <a href="/confidentialite.html">lien</a></li></ul>')
  })
  it('escapes HTML and refuses javascript: links', () => {
    expect(renderMarkdown('<script>x</script> [a](javascript:alert(1))'))
      .toBe('<p>&lt;script&gt;x&lt;/script&gt; [a](javascript:alert(1))</p>')
  })
})
