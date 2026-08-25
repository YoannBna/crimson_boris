import { powerMonitor } from 'electron'
import type { TriggerSource } from '@shared/types'

/**
 * Detection de la reprise d'activite.
 *
 * macOS emet plusieurs signaux pour un seul reveil : `resume` (sortie de
 * veille systeme), `unlock-screen` (deverrouillage), puis
 * `user-did-become-active`. Ils arrivent en rafale sur quelques secondes.
 * Un dedoublonnage est donc obligatoire, sans quoi Boris lance trois cycles
 * et se rappelle trois fois a l'ecran pour un seul retour de l'operateur.
 *
 * Le battement d'horloge est le filet de securite : si l'ecart entre deux
 * battements depasse largement leur periode, la machine a dormi sans que le
 * moindre evenement ne soit parvenu jusqu'ici.
 */

const DEBOUNCE_MS = 10_000
const HEARTBEAT_MS = 60_000

/*
 * Tolerance du battement d'horloge : dix minutes.
 *
 * Elle etait a 90 s. Sur trois jours d'usage reel, cela a produit 176
 * declenchements « saut d'horloge » pour 5 cycles reguliers : macOS
 * ralentit les minuteurs d'une application en arriere-plan, le battement
 * arrivait avec plus d'une minute de retard, et Boris y lisait une sortie
 * de veille. Chaque faux positif relancait un cycle complet et repoussait
 * le cycle regulier, qui n'arrivait donc jamais a echeance.
 *
 * Un ralentissement macOS depasse rarement la minute ; une vraie mise en
 * veille se compte en minutes. Dix minutes separent les deux sans risque
 * de manquer un reveil — d'autant que `resume` et `unlock-screen` restent
 * les detecteurs principaux, ce filet ne servant qu'a leur defaut.
 */
const JUMP_TOLERANCE_MS = 600_000

export type WakeHandler = (trigger: TriggerSource) => void

let lastWakeAt = 0
let heartbeat: NodeJS.Timeout | null = null
let lastBeat = Date.now()

export function watchPower(onWake: WakeHandler): void {
  const fire = (trigger: TriggerSource): void => {
    const now = Date.now()
    if (now - lastWakeAt < DEBOUNCE_MS) return
    lastWakeAt = now
    onWake(trigger)
  }

  powerMonitor.on('resume', () => fire('resume'))
  powerMonitor.on('unlock-screen', () => fire('unlock'))

  // Specifique macOS : l'operateur revient devant sa machine.
  powerMonitor.on('user-did-become-active', () => fire('active'))

  // Marque l'endormissement pour ne pas confondre veille et simple inactivite.
  powerMonitor.on('suspend', () => { lastBeat = Date.now() })
  powerMonitor.on('lock-screen', () => { lastBeat = Date.now() })

  lastBeat = Date.now()
  heartbeat = setInterval(() => {
    const now = Date.now()
    const drift = now - lastBeat
    lastBeat = now
    if (drift <= JUMP_TOLERANCE_MS) return

    // Une veille reelle laisse une trace : le systeme a ete inactif aussi
    // longtemps que le battement a manque. Sans cette confirmation, le
    // saut n'est qu'un minuteur ralenti par le systeme.
    const idleMs = powerMonitor.getSystemIdleTime() * 1000
    if (idleMs < JUMP_TOLERANCE_MS / 2) return

    fire('clock-jump')
  }, HEARTBEAT_MS)
}

export function stopWatchingPower(): void {
  if (heartbeat) clearInterval(heartbeat)
  heartbeat = null
  powerMonitor.removeAllListeners()
}
