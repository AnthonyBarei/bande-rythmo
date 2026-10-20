// Studio take settings (Réglages › Studio and the stage popover share these).
export const STUDIO_COUNTS = [{ v: 0, l: 'Aucun' }, { v: 3, l: '3 s' }, { v: 5, l: '5 s' }]
export const STUDIO_LEADS = [0, 1, 2, 3].map(v => ({ v, l: `${v} s` }))
export const STUDIO_CHAINS = [
  { v: 'manuel', l: 'Manuel', desc: 'La réplique suivante attend R' },
  { v: 'auto', l: 'Auto après 3 s', desc: 'Le décompte repart seul après Valider' },
]
