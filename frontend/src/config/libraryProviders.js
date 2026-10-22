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

export function writeLibraryProvider(id) {
  try {
    localStorage.setItem(PROVIDER_KEY, id)
  } catch (e) {
    console.warn('Médiathèque : choix non mémorisé', e)
  }
}
