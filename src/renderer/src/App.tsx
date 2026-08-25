import { useEffect, useState } from 'react'
import type { CoreStatus, Severity, TriggerSource } from '@shared/types'
import type { AppConfig, ConnectorId } from '@shared/config'
import { DEFAULT_PROFILE } from '@shared/config'
import { hasBridge, useCoreStatus } from './lib/useBoris'
import { SyncBadge } from './components/SyncBadge'
import { Onboarding } from './Onboarding'
import { M01Actualites } from './modules/M01Actualites'
import { M02Radar } from './modules/M02Radar'
import { M03Courrier } from './modules/M03Courrier'
import { M04Arsenal } from './modules/M04Arsenal'

const TRIGGER_LABEL: Record<TriggerSource, string> = {
  boot: 'DEMARRAGE',
  interval: 'CYCLE',
  resume: 'SORTIE DE VEILLE',
  unlock: 'DEVERROUILLAGE',
  active: 'RETOUR OPERATEUR',
  'clock-jump': 'SAUT D’HORLOGE',
  manual: 'MANUEL'
}

const SEVERITY_LABEL: Record<Severity, string> = {
  nominal: 'NOMINALE',
  watch: 'SURVEILLANCE',
  critical: 'CRITIQUE'
}

function useClock(): string {
  const [t, setT] = useState('--:--:--')
  useEffect(() => {
    const tick = (): void =>
      setT(new Date().toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour12: false }))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return t
}

function hhmm(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function SignalBar({ status }: { status: CoreStatus }) {
  if (status.hits.length === 0) return null
  return (
    <div className={`signals sev-${status.severity}`}>
      <div className="signals-h">
        {status.severity === 'critical' ? '⚠ SIGNAUX CRITIQUES' : '◈ SIGNAUX EN SURVEILLANCE'}
      </div>
      {status.hits.map((h) => (
        <div className="signal" key={`${h.rule}-${h.label}`}>
          <span className="signal-r">{h.rule}</span>
          <span className="signal-l">{h.label}</span>
          <span className="signal-d">{h.detail}</span>
        </div>
      ))}
    </div>
  )
}

/**
 * Charge la configuration et barre le tableau de bord tant que l'accueil
 * n'a pas ete valide. Hors coquille Electron, on considere l'accueil
 * comme passe : il n'y a alors ni secret ni connecteur a regler.
 */
function useConfig() {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!hasBridge) return
    void window.boris.config.get().then(setConfig)
  }, [])

  const run = async (fn: () => Promise<AppConfig | void>): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const next = await fn()
      if (next) setConfig(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return { config, busy, error, setConfig, run }
}

export default function App() {
  const clock = useClock()
  const status = useCoreStatus()
  const active = status?.active ?? true
  const { config, busy, error, run } = useConfig()

  // Tant que la configuration n'est pas lue, on n'affiche rien : mieux
  // vaut un instant vide qu'un tableau de bord qui clignote avant de
  // ceder la place a l'ecran d'accueil.
  if (hasBridge && !config) return null

  if (hasBridge && config && !config.onboarded) {
    return (
      <Onboarding
        config={config}
        busy={busy}
        error={error}
        onSecret={(c: ConnectorId, key, value) =>
          void run(() => window.boris.config.setSecret(c, key, value))
        }
        onSkip={(c) => void run(() => window.boris.config.skipConnector(c))}
        onProfile={(displayName) =>
          void run(() => window.boris.config.saveProfile({ displayName }))
        }
        onComplete={() => void run(() => window.boris.config.complete())}
      />
    )
  }

  const profile = config?.profile ?? DEFAULT_PROFILE
  const mailConnector = config?.connectors.find((c) => c.id === 'mail')

  const today = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  })

  return (
    <div className="wrap">
      <header>
        <div className="sigil">
          <h1>CRIMSON BORIS</h1>
          <span className="sub">// Noyau Analytique &amp; Executif — v2.0</span>
          {hasBridge && (
            <button
              className="btn ghost hdr-btn"
              disabled={!active || status?.running}
              onClick={() => void window.boris.refreshNow()}
            >
              {status?.running ? 'Cycle en cours…' : 'Rafraichir'}
            </button>
          )}
        </div>
        <div className="hdr-meta">
          <span>
            <span className={`pulse${active ? '' : ' idle'}`} />
            SYSTEME <b className={active ? 'ok' : 'crit'}>{active ? 'ACTIF' : 'SUSPENDU'}</b>
          </span>
          <span>
            CYCLE <b>{clock}</b> CEST
          </span>
          <span>
            DATE <b>{today.toUpperCase()}</b>
          </span>
          {profile.displayName !== '' && (
            <span>
              OPERATEUR <b>{profile.displayName.toUpperCase()}</b>
            </span>
          )}
          <span>
            MODULES <b>{status?.modulesFed ?? 4} / {status?.modulesTotal ?? 4} ALIMENTES</b>
          </span>
          <span>
            DERNIER PASSAGE <b>{hhmm(status?.lastCycle ?? null)}</b>
            {status?.lastTrigger ? ` · ${TRIGGER_LABEL[status.lastTrigger]}` : ''}
          </span>
          <span>
            PROCHAIN <b>{hhmm(status?.nextCycle ?? null)}</b>
          </span>
          <span>
            GRAVITE{' '}
            <b className={status?.severity === 'critical' ? 'crit' : status?.severity === 'watch' ? '' : 'ok'}>
              {SEVERITY_LABEL[status?.severity ?? 'nominal']}
            </b>
          </span>
          <span>
            FORGE <b>EDGAR MARKOV</b>
          </span>
        </div>
      </header>

      {status && <SignalBar status={status} />}

      <M01Actualites profile={profile} />
      <M02Radar />
      <M03Courrier connector={mailConnector} />
      <M04Arsenal />

      <footer>
        CRIMSON BORIS — NOYAU ANALYTIQUE &amp; EXECUTIF
        <br />
        DONNEES LOCALES · AUCUNE COLLECTE · AUCUNE TRANSMISSION A UN TIERS
        <br />
        DONNEES DE MARCHE INDICATIVES — AUCUNE RECOMMANDATION D'INVESTISSEMENT
      </footer>

      <SyncBadge />
    </div>
  )
}
