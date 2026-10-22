// Visitor's desktop OS for the download cards — windows | macos | linux | null.
// Android reports « Linux » in its UA, so it is ruled out first.
export function detectOs(nav = navigator) {
  const s = `${nav.userAgentData?.platform || ''} ${nav.platform || ''} ${nav.userAgent || ''}`.toLowerCase()
  if (s.includes('android')) return null
  if (s.includes('win')) return 'windows'
  if (s.includes('mac') || s.includes('iphone') || s.includes('ipad')) return 'macos'
  if (s.includes('linux') || s.includes('x11')) return 'linux'
  return null
}
