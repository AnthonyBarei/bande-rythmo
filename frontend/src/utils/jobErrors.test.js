import { describe, expect, it } from 'vitest'
import { GENERIC, NO_AUDIO, errorKey, friendlyError, rawErrorText } from './jobErrors'

describe('friendlyError', () => {
  it('maps a missing audio stream to one sentence and keeps the raw line as detail', () => {
    const raw = 'ffmpeg : flux audio introuvable (-map 0:a)'
    expect(friendlyError(raw)).toEqual({ text: NO_AUDIO, detail: raw })
  })

  it('maps the backend no-audio 422 detail without a redundant detail', () => {
    expect(friendlyError("Ce clip n'a pas de piste audio")).toEqual({ text: NO_AUDIO, detail: "Ce clip n'a pas de piste audio" })
    expect(friendlyError(NO_AUDIO)).toEqual({ text: NO_AUDIO, detail: null })
  })

  it('recognises ffmpeg stderr about unmatched audio maps', () => {
    const raw = "Stream map '0:a' matches no streams.\nTo ignore this, add a trailing '?' to the map."
    expect(friendlyError(raw).text).toBe(NO_AUDIO)
  })

  it('maps missing files', () => {
    expect(friendlyError('[Errno 2] No such file or directory: segments/x.mp4').text).toMatch(/^Fichier source introuvable/)
    expect(friendlyError('Segment not found').text).toMatch(/^Fichier source introuvable/)
  })

  it('maps network errors (fetch TypeError)', () => {
    expect(friendlyError(new TypeError('Failed to fetch')).text).toMatch(/^Serveur injoignable/)
    expect(friendlyError('NetworkError when attempting to fetch resource.').text).toMatch(/^Serveur injoignable/)
  })

  it('maps HTTP status strings', () => {
    expect(friendlyError('HTTP 500').text).toBe('Erreur du serveur : réessayez.')
    expect(friendlyError('HTTP 503').text).toMatch(/^Service indisponible/)
    expect(friendlyError('HTTP 404').text).toBe('Ressource introuvable sur le serveur.')
    expect(friendlyError('HTTP 400').text).toBe('Requête refusée par le serveur.')
  })

  it('maps generic ffmpeg failures and job return codes', () => {
    expect(friendlyError('Encodage GIF échoué (ffmpeg code 1)').text).toBe('Le traitement vidéo (ffmpeg) a échoué.')
    expect(friendlyError('ffmpeg returned 1').text).toBe('Le traitement vidéo (ffmpeg) a échoué.')
    expect(friendlyError('encode pass returned 234').text).toBe('Le traitement vidéo (ffmpeg) a échoué.')
  })

  it('maps a vanished job after a server restart', () => {
    expect(friendlyError('Tâche introuvable (serveur redémarré ?)').text).toMatch(/^Tâche introuvable/)
  })

  it('keeps a readable French backend detail as the sentence', () => {
    expect(friendlyError('Aucune prise sélectionnée')).toEqual({ text: 'Aucune prise sélectionnée.', detail: null })
    expect(friendlyError('Mixage échoué — vérifiez les prises sélectionnées')).toEqual({ text: 'Mixage échoué — vérifiez les prises sélectionnées.', detail: null })
  })

  it('strips a caller prefix but keeps the original as detail', () => {
    expect(friendlyError('Erreur GIF : Aucune prise sélectionnée')).toEqual({ text: 'Aucune prise sélectionnée.', detail: 'Erreur GIF : Aucune prise sélectionnée' })
    expect(friendlyError('Erreur GIF : HTTP 500').text).toBe('Erreur du serveur : réessayez.')
  })

  it('falls back to a generic sentence for technical noise', () => {
    const raw = "KeyError: 'width'"
    expect(friendlyError(raw)).toEqual({ text: GENERIC, detail: raw })
  })

  it('handles empty input', () => {
    expect(friendlyError(null)).toEqual({ text: GENERIC, detail: null })
    expect(friendlyError('  ')).toEqual({ text: GENERIC, detail: null })
  })

  it('accepts { detail } bodies from FastAPI', () => {
    expect(friendlyError({ detail: 'Segment not found' }).text).toMatch(/^Fichier source introuvable/)
    expect(rawErrorText({ detail: [{ msg: 'field required' }] })).toBe('field required')
  })
})

describe('errorKey', () => {
  it('is the trimmed raw text', () => {
    expect(errorKey(' HTTP 500 ')).toBe('HTTP 500')
    expect(errorKey(new Error('HTTP 500'))).toBe('HTTP 500')
  })
})
