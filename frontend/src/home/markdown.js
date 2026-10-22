// Minimal Markdown → HTML for the legal pages (docs/*.md): headings, paragraphs,
// lists, **bold**, *italic*, `code` and [links](url). Text is escaped first.

const escapeHtml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function inline(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/\*([^*]+)\*/g, '<i>$1</i>')
    .replace(/\[([^\]]+)\]\(((?:https?:\/\/|\/|#|mailto:)[^)\s]*)\)/g, '<a href="$2">$1</a>')
}

export function renderMarkdown(src) {
  const out = []
  let para = []
  let list = []
  const flushPara = () => { if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`); para = [] }
  const flushList = () => { if (list.length) out.push(`<ul>${list.map(i => `<li>${inline(i)}</li>`).join('')}</ul>`); list = [] }
  for (const raw of src.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim()
    const heading = /^(#{1,3})\s+(.*)$/.exec(line)
    const item = /^[-*]\s+(.*)$/.exec(line)
    if (!line) { flushPara(); flushList() }
    else if (heading) { flushPara(); flushList(); out.push(`<h${heading[1].length + 1}>${inline(heading[2])}</h${heading[1].length + 1}>`) }
    else if (item) { flushPara(); list.push(item[1]) }
    else { flushList(); para.push(line) }
  }
  flushPara()
  flushList()
  return out.join('\n')
}
