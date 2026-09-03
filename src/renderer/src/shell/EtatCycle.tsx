import { useState } from 'react'
import type { CoreStatus, Severity, TriggerSource } from '@shared/types'
import { hasBridge } from '@/lib/useBoris'

/* ============================================================
   Etat du noyau — pastille de la barre haute
   ============================================================ */

/**
 * Ce que l'ancienne interface affichait en permanence dans son bandeau :
 * si Boris tourne, quand il est passe, ce qu'il a releve. La coquille ne
 * peut pas s'en passer — un assistant dont on ne sait pas s'il tourne
 * n'inspire rien, et « suspendu » doit se voir sans aller le chercher.
 */

const GRAVITE: Record<Severity, string> = {
  nominal: 'nominale',
  watch: 'surveillance',
  critical: 'critique'
}

const DECLENCHEUR: Record<TriggerSource, string> = {
  boot: 'demarrage',
  interval: 'cycle',
  resume: 'sortie de veille',
  unlock: 'deverrouillage',
  active: 'retour operateur',
  'clock-jump': 'saut d’horloge',
  manual: 'manuel'
}

export function EtatCycle({ status }: { status: CoreStatus | null }) {
  const [ouvert, setOuvert] = useState(false)
  const [busy, setBusy] = useState(false)

  if (!status) return null

  const ton = !status.active ? 'e-off' : `e-${status.severity}`

  const relancer = async (): Promise<void> => {
    if (!hasBridge) return
    setBusy(true)
    try {
      await window.boris.refreshNow()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`jv-etat-cycle ${ton}`} onClick={(e) => e.stopPropagation()}>
      <button
        className="jv-relance"
        onClick={() => void relancer()}
        disabled={busy || status.running}
        title="Relancer un cycle maintenant"
      >
        <span className={busy || status.running ? 'tourne' : ''}>⟳</span>
      </button>

      <button
        className="jv-pill"
        onClick={() => setOuvert((v) => !v)}
        title={
          status.active
            ? `Gravite ${GRAVITE[status.severity]} — ${status.hits.length} signal(aux)`
            : 'Boris est suspendu depuis la barre de menus'
        }
      >
        <span className="jv-dot" />
        <span className="jv-num">
          {status.active ? GRAVITE[status.severity] : 'suspendu'}
        </span>
        {status.hits.length > 0 && <span className="jv-pct">{status.hits.length}</span>}
      </button>

      {ouvert && (
        <div className="jv-detail cadre cadre-s">
          <div className="jv-ligne">
            <span>Dernier passage</span>
            <b>
              {heure(status.lastCycle)}
              {status.lastTrigger ? ` · ${DECLENCHEUR[status.lastTrigger]}` : ''}
            </b>
          </div>
          <div className="jv-ligne">
            <span>Prochain</span>
            <b>{heure(status.nextCycle)}</b>
          </div>
          <div className="jv-ligne">
            <span>Modules alimentes</span>
            <b>
              {status.modulesFed} / {status.modulesTotal}
            </b>
          </div>

          {status.hits.length === 0 ? (
            <div className="jv-note">Aucun signal au dernier cycle.</div>
          ) : (
            status.hits.map((h) => (
              <div className={`jv-signal s-${h.severity}`} key={`${h.rule}-${h.label}`}>
                <b>{h.label}</b>
                <span>{h.detail}</span>
              </div>
            ))
          )}

          {!status.active && (
            <div className="jv-note jv-bloque">
              Boris est suspendu. Il se relance depuis la barre de menus du systeme.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function heure(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}
