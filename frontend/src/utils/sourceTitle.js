// Importer title for a loaded source (FIXES F4.2).

export const UNTITLED = 'Vidéo sans titre'

const BASE = 'http://localhost'

// Last path segment of a URL (absolute or relative), percent-decoded; '' when none.
export function urlFilename(u) {
  if (!u) return ''
  let seg
  try {
    seg = new URL(u, BASE).pathname.split('/').filter(Boolean).pop() || ''
  } catch (e) {
    console.warn('URL illisible, nom brut utilisé', e)
    seg = String(u).split(/[?#]/)[0].split('/').filter(Boolean).pop() || ''
  }
  try {
    return decodeURIComponent(seg)
  } catch (e) {
    console.warn('Segment d’URL mal encodé, nom brut utilisé', e)
    return seg
  }
}

const clean = s => (typeof s === 'string' ? s.trim() : '')

// Original filename → Plex title → last URL path segment → "Vidéo sans titre".
export function sourceTitle(video) {
  if (!video) return UNTITLED
  return clean(video.filename)
    || clean(video.plexTitle)
    || clean(urlFilename(video.url || video.sourcePath))
    || UNTITLED
}
