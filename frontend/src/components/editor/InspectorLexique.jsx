import React from 'react'
import LexiconPanel from '../LexiconPanel'

export default function InspectorLexique({ project, translateAvailable, translateTarget }) {
  return <LexiconPanel project={project || ''} translateAvailable={translateAvailable} translateTarget={translateTarget} />
}
