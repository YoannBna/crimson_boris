import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { JarvisShell } from './JarvisShell'
import './styles/base.css'
import './styles/modules.css'
import './styles/jarvis.css'
import './styles/forge.css'
import './styles/shell.css'

/*
 * Refonte en cours : la nouvelle coquille se monte a la place de
 * l'ancienne quand `BORIS_JARVIS` est defini. Tant que les etapes ne
 * sont pas toutes livrees, l'application en service reste intacte.
 */
const refonte =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).has('jarvis')

createRoot(document.getElementById('root')!).render(
  <StrictMode>{refonte ? <JarvisShell /> : <App />}</StrictMode>
)
