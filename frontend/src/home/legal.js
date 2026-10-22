// /conditions.html — the text lives in docs/conditions.md so it can be edited
// without touching the page.
import conditions from '../../docs/conditions.md?raw'
import { renderMarkdown } from './markdown'

document.getElementById('legal-body').innerHTML = renderMarkdown(conditions)
