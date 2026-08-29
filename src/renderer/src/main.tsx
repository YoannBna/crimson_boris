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
 * La coquille en constellations est desormais l'interface de Boris.
 *
 * L'ancienne reste atteignable derriere `?legacy`, et le restera le
 * temps de quelques versions : elle a tourne des mois, la nouvelle
 * quelques jours. Une porte de sortie coute une ligne ; s'en passer
 * coute une reinstallation le jour ou quelque chose manque.
 */
const ancienne =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).has('legacy')

createRoot(document.getElementById('root')!).render(
  <StrictMode>{ancienne ? <App /> : <JarvisShell />}</StrictMode>
)
