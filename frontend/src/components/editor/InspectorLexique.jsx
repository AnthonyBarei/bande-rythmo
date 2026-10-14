import React from 'react'
import LexiconPanel from '../LexiconPanel'

export default function InspectorLexique({ project }) {
  return <LexiconPanel project={project || ''} />
}
