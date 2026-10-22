// Hosted media libraries usable as an import source (Importer › Médiathèque,
// Réglages › Médiathèques). Each backend route exposes the same API shape.

export const LIBRARY_PROVIDERS = [
  {
    id: 'plex',
    label: 'Plex',
    api: '/api/plex',
    defaultUrl: 'http://localhost:32400',
    tokenLabel: 'TOKEN PLEX',
    tokenPlaceholder: 'X-Plex-Token',
    tokenHint: 'Plex Web → Paramètres → XML → attribut',
    tokenHintCode: 'X-Plex-Token',
  },
  {
    id: 'jellyfin',
    label: 'Jellyfin',
    api: '/api/jellyfin',
    defaultUrl: 'http://localhost:8096',
    tokenLabel: 'CLÉ API JELLYFIN',
    tokenPlaceholder: 'Clé API',
    tokenHint: 'Tableau de bord → Clés API → +',
    tokenHintCode: null,
  },
]

export const providerById = id => LIBRARY_PROVIDERS.find(p => p.id === id) || LIBRARY_PROVIDERS[0]

const PROVIDER_KEY = 'br-library-provider'

export function readLibraryProvider() {
  try {
    return providerById(localStorage.getItem(PROVIDER_KEY)).id
  } catch {
    return LIBRARY_PROVIDERS[0].id   // storage unavailable — default
  }
}

// Which providers have a saved server, remembered from the last status/connect:
// an unconfigured one shows its form at once instead of waiting on a check.
const CONFIGURED_KEY = 'br-library-configured'

function readConfiguredMap() {
  try {
    return JSON.parse(localStorage.getItem(CONFIGURED_KEY) || '{}') || {}
  } catch {
    return {}   // storage unavailable or corrupt — nothing known
  }
}

export function readLibraryConfigured(id) {
  return !!readConfiguredMap()[id]
}

export function writeLibraryConfigured(id, configured) {
  try {
    localStorage.setItem(CONFIGURED_KEY, JSON.stringify({ ...readConfiguredMap(), [id]: !!configured }))
  } catch (e) {
    console.warn('Médiathèque : état non mémorisé', e)
  }
}

export function writeLibraryProvider(id) {
  try {
    localStorage.setItem(PROVIDER_KEY, id)
  } catch (e) {
    console.warn('Médiathèque : choix non mémorisé', e)
  }
}
