import { createContext, useContext } from 'react'

// The editor owns <ExportPanel> (it holds the live render params: px/s, band
// offset, canvas size, font, playhead, loop) but the Export screen is an App
// screen under the top bar. App provides the screen slot + close action;
// ExportPanel portals into the slot. Without a provider it renders inline.
export const ExportScreenContext = createContext(null)

export const useExportScreen = () => useContext(ExportScreenContext)
