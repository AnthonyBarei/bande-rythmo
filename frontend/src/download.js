export function filenameFromDisposition(cd) {
  if (!cd) return null
  const star = /filename\*\s*=\s*utf-8''([^;]+)/i.exec(cd)
  if (star) {
    try { return decodeURIComponent(star[1].trim()) } catch { /* malformed → plain filename */ }
  }
  const plain = /filename\s*=\s*"?([^";]+)"?/i.exec(cd)
  return plain ? plain[1].trim() : null
}

export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || 'export'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Fetch first so a purged file (410/404) surfaces as an error instead of
// silently saving the JSON error body under the export's name.
export async function downloadUrl(url, fallbackName) {
  const res = await fetch(url)
  if (!res.ok) {
    if (res.status === 410 || res.status === 404) throw new Error('Fichier introuvable sur le disque — relancez l\'export')
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  const blob = await res.blob()
  saveBlob(blob, filenameFromDisposition(res.headers.get('content-disposition')) || fallbackName)
}
