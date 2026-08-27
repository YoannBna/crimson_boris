import { useState } from 'react'
import type { ConnectorId, ConnectorStatus } from '@shared/config'
import { CONNECTOR_FIELDS } from '@shared/config'

/*
 * Formulaire d'un connecteur, partage par l'ecran d'accueil et le panneau
 * de parametres.
 *
 * Un seul endroit ou la saisie d'un secret est ecrite : le jour ou cette
 * mecanique change, elle change partout. Deux copies auraient fini par
 * diverger, et c'est precisement le genre de divergence qui finit par
 * poser un mot de passe en clair quelque part.
 *
 * La valeur saisie part vers le process principal a la perte du focus et
 * n'est jamais conservee dans l'etat une fois transmise.
 */
export function ConnectorFields({
  id,
  status,
  onSecret,
  onClear,
  busy,
  editable
}: {
  id: ConnectorId
  status: ConnectorStatus | undefined
  onSecret: (c: ConnectorId, key: string, value: string) => void
  onClear?: (c: ConnectorId) => void
  busy: boolean
  /** true = champs toujours ouverts, meme connecteur deja relie */
  editable: boolean
}) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [open, setOpen] = useState(false)

  const state = status?.state ?? 'absent'
  const linked = state === 'configure'
  const showFields = editable ? open || !linked : !linked

  const commit = (key: string): void => {
    const v = values[key]
    if (!v || v.trim() === '') return
    onSecret(id, key, v)
    // La valeur ne reste pas en memoire de l'interface une fois transmise.
    setValues((s) => ({ ...s, [key]: '' }))
  }

  return (
    <>
      {linked && editable && !open && (
        <div className="cf-linked">
          <span className="cf-account">{status?.account ?? 'compte relie'}</span>
          <button className="btn ghost" onClick={() => setOpen(true)} disabled={busy}>
            Modifier
          </button>
          {onClear && (
            <button className="btn ghost cf-cut" onClick={() => onClear(id)} disabled={busy}>
              Deconnecter
            </button>
          )}
        </div>
      )}

      {showFields && (
        <>
          {CONNECTOR_FIELDS[id].map((f) => (
            <label className="onb-field" key={f.key}>
              <span>
                {f.label}
                {f.optional && <i> — facultatif</i>}
              </span>
              <input
                type={/password|token/i.test(f.key) ? 'password' : 'text'}
                className="onb-input"
                placeholder={linked ? '•••••• — saisir pour remplacer' : f.hint}
                autoComplete="off"
                spellCheck={false}
                value={values[f.key] ?? ''}
                onChange={(e) => setValues((s) => ({ ...s, [f.key]: e.target.value }))}
                onBlur={() => commit(f.key)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commit(f.key)
                }}
              />
            </label>
          ))}
          {editable && linked && (
            <div className="onb-actions">
              <button className="btn ghost" onClick={() => setOpen(false)} disabled={busy}>
                Fermer
              </button>
            </div>
          )}
        </>
      )}
    </>
  )
}
