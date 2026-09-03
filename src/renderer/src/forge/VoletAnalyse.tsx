import { useMemo } from 'react'
import type { ResolvedDeck, SimResult } from '@shared/mtg'
import type { Advice, AdviceGrade } from '@shared/forge'
import { forces } from './lecture'

const RANG: Record<AdviceGrade, string> = {
  critique: 'g-crit',
  important: 'g-hot',
  mineur: 'g-warm'
}

/* ============================================================
   Volet ANALYSE — ce qui va, ce qui ne va pas. Rien d'autre.
   ============================================================ */

/**
 * Le volet ne propose rien, volontairement.
 *
 * Les constats du moteur savent tous ecrire la modification qui les
 * corrige, mais ce bouton appartient a Construction. Melanger le
 * diagnostic et l'ordonnance pousse a corriger avant d'avoir lu — et
 * une liste se lit d'abord en entier.
 */
export function VoletAnalyse({
  deck,
  run,
  advice,
  busy,
  onRelire
}: {
  deck: ResolvedDeck | null
  run: SimResult | null
  advice: Advice[]
  busy: string | null
  onRelire: () => void
}) {
  const bons = useMemo(() => (deck ? forces(deck, run) : []), [deck, run])

  if (!deck) return <Attente texte="Charge une liste : l'analyse porte sur ce qu'elle contient." />

  const defauts = advice
  const mesures = run ? run.findings.filter((f) => f.grade !== 'nominal') : []

  return (
    <div className="vp">
      <Bloc titre={`Forces · ${bons.length}`} ton="ok">
        {bons.length === 0 ? (
          <p className="j-body">
            Rien ne franchit encore les seuils de reference. Ce n'est pas un verdict : une liste
            peut gagner en jouant contre ses propres statistiques.
          </p>
        ) : (
          bons.map((f) => (
            <div className="vp-item vp-ok" key={f.label}>
              <div className="vp-t">{f.label}</div>
              <div className="vp-m">{f.measure}</div>
            </div>
          ))
        )}
      </Bloc>

      <Bloc titre={`Defauts de composition · ${defauts.length}`} ton="chaud">
        {defauts.length === 0 ? (
          <p className="j-body">
            La lecture statique ne releve rien. Elle regarde ce que la liste CONTIENT — le banc
            d'essai, lui, mesure ce qu'elle PRODUIT.
          </p>
        ) : (
          defauts.map((a) => (
            <div className={`vp-item ${RANG[a.grade]}`} key={`${a.id}-${a.title}`}>
              <div className="vp-t">
                <span className="vp-g">{a.grade}</span>
                {a.title}
              </div>
              <div className="vp-m">{a.measure}</div>
              <div className="vp-r">{a.reading}</div>
              {a.cards.length > 0 && (
                <div className="vp-cartes">
                  {a.cards.slice(0, 8).map((n) => (
                    <span key={n}>{n}</span>
                  ))}
                  {a.cards.length > 8 && <span className="vp-plus">+{a.cards.length - 8}</span>}
                </div>
              )}
            </div>
          ))
        )}
        <button className="bouton" onClick={onRelire} disabled={Boolean(busy)}>
          {busy ?? 'Relire la liste'}
        </button>
      </Bloc>

      <Bloc titre={`Defauts mesures en partie · ${mesures.length}`} ton="chaud">
        {run === null ? (
          <p className="j-body">
            Aucune campagne jouee. Le volet Simulation en lance une : ce qui s'y revele ne se
            lit pas sur la liste.
          </p>
        ) : mesures.length === 0 ? (
          <p className="j-body">
            La campagne du {new Date(run.runAt).toLocaleString('fr-FR')} n'a rien signale.
          </p>
        ) : (
          mesures.map((f) => (
            <div className={`vp-item ${RANG[f.grade === 'critique' ? 'critique' : f.grade === 'desequilibre' ? 'important' : 'mineur']}`} key={f.id}>
              <div className="vp-t">
                <span className="vp-g">{f.grade}</span>
                {f.title}
              </div>
              <div className="vp-m">{f.measure}</div>
              <div className="vp-r">{f.reading}</div>
            </div>
          ))
        )}
      </Bloc>

      <p className="vp-note j-dim">
        Ce volet ne corrige rien. Les remedes de chaque constat sont dans Construction.
      </p>
    </div>
  )
}

export function Attente({ texte }: { texte: string }) {
  return (
    <div className="vp">
      <p className="j-body vp-attente">{texte}</p>
    </div>
  )
}

export function Bloc({
  titre,
  ton,
  children
}: {
  titre: string
  ton: 'ok' | 'chaud' | 'froid'
  children: React.ReactNode
}) {
  return (
    <section className={`vp-bloc vpb-${ton}`}>
      <h3 className="vp-bloc-t">{titre}</h3>
      {children}
    </section>
  )
}
