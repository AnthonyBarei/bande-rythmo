// FIXES_R5 §11: raw job/HTTP/ffmpeg errors → one French sentence. The raw text
// stays available as `detail` (shown behind a "Détails" toggle).

export const NO_AUDIO = "Ce clip n'a pas de piste audio."
export const GENERIC = 'Une erreur inattendue est survenue.'

// First match wins: the most specific causes come first.
const RULES = [
  { re: /n'a pas de piste audio|flux audio introuvable|-map 0:a|stream map '0:a[^']*' matches no streams|matches no streams.*0:a|does not contain any audio|no audio stream/i,
    text: NO_AUDIO },
  { re: /failed to fetch|networkerror|network request failed|load failed|err_connection|econnrefused|connection refused|serveur injoignable/i,
    text: 'Serveur injoignable : vérifiez que le backend est lancé.' },
  { re: /tâche introuvable|job not found/i,
    text: 'Tâche introuvable : le serveur a sans doute redémarré.' },
  { re: /no space left on device|winerror 112|disque plein/i,
    text: "Disque plein : libérez de l'espace puis réessayez." },
  { re: /permission denied|access is denied|winerror (5|32)\b|being used by another process/i,
    text: 'Fichier verrouillé ou inaccessible : fermez les autres applications qui l’utilisent.' },
  { re: /invalid data found when processing input|moov atom not found|could not find codec parameters|error while decoding|corrupt/i,
    text: 'Le fichier vidéo est illisible ou corrompu.' },
  { re: /no such file or directory|segment not found|file missing on disk|fichier introuvable|introuvable sur le disque|\bhttp 410\b/i,
    text: 'Fichier source introuvable : le clip a peut-être été supprimé ou déplacé.' },
  { re: /does not contain any stream|output file .* does not contain/i,
    text: 'La source ne contient aucun flux exploitable.' },
  { re: /\bhttp 413\b|payload too large|request entity too large/i,
    text: 'Fichier trop volumineux.' },
  { re: /\bhttp 503\b|service unavailable/i,
    text: 'Service indisponible pour le moment : réessayez plus tard.' },
  { re: /\bhttp 404\b|not found/i,
    text: 'Ressource introuvable sur le serveur.' },
  { re: /\bhttp 5\d\d\b|internal server error|bad gateway|gateway timeout/i,
    text: 'Erreur du serveur : réessayez.' },
  { re: /\bhttp 4\d\d\b/i,
    text: 'Requête refusée par le serveur.' },
  { re: /ffmpeg|ffprobe|palette|encodage gif|returned -?\d+|code -?\d+\)|conversion failed|error opening (input|output)/i,
    text: 'Le traitement vidéo (ffmpeg) a échoué.' },
]

// Text that reads as a sentence for a person (backend HTTPException details
// are written that way) rather than a stack trace or tool output.
const TECHNICAL = /[{}[\]<>|\\]|error|exception|traceback|errno|\.py\b|0x[0-9a-f]+|^\w+:\s|\bnone\b|\bnull\b|undefined/i

export function rawErrorText(raw) {
  if (raw == null) return ''
  if (typeof raw === 'string') return raw.trim()
  if (typeof raw.message === 'string') return raw.message.trim()
  if (typeof raw.detail === 'string') return raw.detail.trim()
  if (Array.isArray(raw.detail)) return raw.detail.map(d => d?.msg ?? String(d)).join(' · ').trim()
  return String(raw).trim()
}

// "Erreur GIF : …" wrappers added by callers carry no information.
function unwrap(text) {
  return text.replace(/^erreur(\s+[^:]{1,24})?\s*:\s*/i, '')
}

function sentence(text) {
  const t = text.charAt(0).toUpperCase() + text.slice(1)
  return /[.!?…]$/.test(t) ? t : `${t}.`
}

// raw: string | Error | { detail } | null → { text, detail }.
// detail is the raw text, or null when it adds nothing to `text`.
export function friendlyError(raw) {
  const full = rawErrorText(raw)
  if (!full) return { text: GENERIC, detail: null }
  const core = unwrap(full)
  const rule = RULES.find(r => r.re.test(core))
  if (rule) return { text: rule.text, detail: rule.text === full ? null : full }
  const singleLine = !/[\r\n]/.test(core)
  if (singleLine && core.length <= 140 && !TECHNICAL.test(core)) {
    return { text: sentence(core), detail: core === full ? null : full }
  }
  return { text: GENERIC, detail: full }
}

// Identity used to group identical failures (toasts, Activité rows).
export function errorKey(raw) {
  return rawErrorText(raw)
}
