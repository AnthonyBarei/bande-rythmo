import React from 'react'
import LexiconPanel from '../LexiconPanel'

export default function InspectorLexique({ projectId, projectName, translateAvailable, translateTarget }) {
  return <LexiconPanel projectId={projectId} projectName={projectName} translateAvailable={translateAvailable} translateTarget={translateTarget} />
}
