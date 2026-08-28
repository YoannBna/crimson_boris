import { useState, type ReactNode } from 'react'
import { ModuleSection } from '@/components/ModuleSection'
import { Card, Item, Tag, Em, Note, Alert } from '@/components/primitives'
import { DistBars } from '@/components/DistBars'
import { DECK_IDENTITY, DECK_KPI, FUNCTION_DIST, MANA_DIST, KEY_CARDS } from '@/data/deck'
import { useMtg } from '@/lib/useMtg'
import { hasBridge } from '@/lib/useBoris'
import { ImportPanel } from './mtg/ImportPanel'
import { DeckPanel } from './mtg/DeckPanel'
import { SimPanel } from './mtg/SimPanel'
import { FindingsPanel } from './mtg/FindingsPanel'
import { StylePanel } from './mtg/StylePanel'
import { useForge } from '@/lib/useForge'
import { WorkbenchPanel } from './forge/WorkbenchPanel'
import { AdvicePanel } from './forge/AdvicePanel'
import { PoolPanel } from './forge/PoolPanel'
import { DirectivePanel } from './forge/DirectivePanel'

type Tab = 'atelier' | 'banc' | 'dossier'

const TABS: { id: Tab; label: string; hint: string }[] = [
  { id: 'atelier', label: 'ATELIER', hint: 'composer, chercher, dicter' },
  { id: 'banc', label: 'BANC D’ESSAI', hint: 'simuler et mesurer' },
  { id: 'dossier', label: 'DOSSIER', hint: 'lecture editoriale et variantes' }
]

/** Met en exergue les segments declares dans `strong`. */
function highlight(body: string, strong: string[] = []) {
  if (strong.length === 0) return body
  let parts: ReactNode[] = [body]
  strong.forEach((needle, k) => {
    parts = parts.flatMap((part): ReactNode[] => {
      if (typeof part !== 'string') return [part]
      const i = part.indexOf(needle)
      if (i === -1) return [part]
      return [part.slice(0, i), <b key={`${k}-${i}`}>{needle}</b>, part.slice(i + needle.length)]
    })
  })
  return parts
}

export function M04Arsenal() {
  const { state, importFolder, importDialog, runSim, loadSuggestions, loadStyles, reloadDeck } =
    useMtg()
  const { deck, run, suggestions, styles, busy, error } = state
  const forge = useForge(deck ? `${deck.name}-${deck.importedAt}` : null)
  const [tab, setTab] = useState<Tab>('atelier')

  /** Depose une directive dans l'atelier depuis n'importe quel volet. */
  const dictate = (text: string): void => {
    setTab('atelier')
    void forge.planDirectives(text)
  }

  return (
    <ModuleSection id="m4" num="04" title="FORGE MTG — MAGIC : THE GATHERING">
      <div className="forge-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`forge-tab${tab === t.id ? ' on' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            <span className="forge-tab-h">{t.hint}</span>
          </button>
        ))}
      </div>

      <div className="grid g2">
        {tab === 'atelier' && (
          <>
            {hasBridge && (
              <ImportPanel
                onFolder={importFolder}
                onDialog={importDialog}
                busy={busy}
                error={error}
                hasDeck={Boolean(deck)}
              />
            )}

            {deck ? <DeckPanel deck={deck} /> : <LegacyProfile />}

            {/*
              * Les outils restent VISIBLES sans deck, et annoncent leur
              * etat d'attente. Les masquer laissait croire qu'ils
              * n'existaient pas : on ne decouvre pas une fonction
              * invisible. Seul le pool fonctionne pleinement a vide —
              * chercher une carte n'exige aucune liste.
              */}
            {hasBridge && (
              <>
                <WorkbenchPanel
                  bench={forge.state.bench}
                  hasDeck={Boolean(deck)}
                  onDrop={forge.drop}
                  onClear={forge.clear}
                  onExport={forge.exportPlan}
                  onApply={() => void forge.applyPlan(() => void reloadDeck())}
                  exported={forge.state.exported}
                  applied={forge.state.applied}
                  busy={forge.state.busy}
                />
                <AdvicePanel
                  advice={forge.state.advice}
                  hasDeck={Boolean(deck)}
                  onDirective={dictate}
                  onRefresh={forge.refreshAdvice}
                  busy={forge.state.busy}
                />
                <DirectivePanel
                  plan={forge.state.plan}
                  hasDeck={Boolean(deck)}
                  onPlan={(t) => void forge.planDirectives(t)}
                  onCommit={forge.commit}
                  busy={forge.state.busy}
                />
                <PoolPanel
                  pool={forge.state.pool}
                  hasDeck={Boolean(deck)}
                  onSearch={forge.searchPool}
                  onCommit={forge.commit}
                  busy={forge.state.busy}
                />
              </>
            )}

            {forge.state.error && (
              <Card full title="⚠ Forge — incident">
                <div className="finding-m">{forge.state.error}</div>
              </Card>
            )}
          </>
        )}

        {tab === 'banc' && (
          <>
            {hasBridge && <SimPanel onRun={runSim} busy={busy} disabled={!deck} />}
            {run && (
              <FindingsPanel
                run={run}
                suggestions={suggestions}
                onLoadSuggestions={loadSuggestions}
                onCommit={forge.commit}
                busy={busy}
              />
            )}
            {!run && (
              <Card full title="◈ Banc d'essai">
                <p className="hint">
                  Aucune campagne n'a encore tourne sur cette liste. Lance-en une : les constats
                  alimentent ensuite les recommandations de l'atelier, notamment les cartes qui
                  dorment en main.
                </p>
              </Card>
            )}
          </>
        )}

        {tab === 'dossier' && (
          <>
            {hasBridge && deck && (
              <StylePanel styles={styles} onLoad={loadStyles} busy={busy} />
            )}
            <KeyCards />
            <EditorialDiagnostic />
          </>
        )}
      </div>
    </ModuleSection>
  )
}

/* ============================================================
   Repli : profil fige de la v1, tant qu'aucun deck n'est resolu
   ============================================================ */

function LegacyProfile() {
  return (
    <>
      <Card full title={`♲ Profil de reference — ${DECK_IDENTITY.source}`}>
        <Item
          title={
            <>
              <Tag kind="crit">Commandant</Tag>
              {DECK_IDENTITY.commander} — {DECK_IDENTITY.typeLine}
            </>
          }
        >
          Identite couleur <Em>{DECK_IDENTITY.colorIdentity}</Em>. Archetype :{' '}
          <Em>{DECK_IDENTITY.archetype}</Em>. L'axe strategique repose sur l'<Em>eminence</Em> :
          chaque sort de vampire lance genere un jeton Vampire 1/1{' '}
          <Em>depuis la zone de commandement</Em>. Le moteur central n'exige jamais la presence
          d'Edgar sur le champ de bataille — resistance structurelle au removal cible.
        </Item>
        <div className="kpi">
          {DECK_KPI.map((k) => (
            <div key={k.label}>
              <b>{k.label}</b>
              <span>{k.value}</span>
              <i>{k.sub}</i>
            </div>
          ))}
        </div>
        <Note>
          Archetype de demonstration, livre avec l'application. Ces chiffres seront remplaces
          par des valeurs calculees des qu'une liste sera importee — la tienne.
        </Note>
      </Card>

      <Card title="▤ Repartition fonctionnelle — 104 cartes en deck">
        <DistBars rows={FUNCTION_DIST} />
        <Note>
          <b>Courbe de mana : donnee non disponible.</b> L'export ne contient ni cout de mana
          ni type de carte. La resolution Scryfall leve cette limite — importe la liste.
        </Note>
      </Card>

      <Card title="▥ Base de mana — sources par couleur">
        <DistBars rows={MANA_DIST} />
        <Alert heading="⚠ POINT DE RUPTURE — PENURIE DE ROUGE">
          Le rouge ne dispose que de <b>12 sources</b> sur 36 terrains — le seuil de fiabilite
          communement retenu se situe autour de 18. Or le deck embarque{' '}
          <b>Ruinous Ultimatum</b>, dont le cout exige deux mana rouges en plus de trois blancs
          et deux noirs. <b>Cette carte est structurellement injouable avec cette base.</b>
        </Alert>
      </Card>
    </>
  )
}

/* ============================================================
   Analyses editoriales — la simulation ne les produit pas
   ============================================================ */

function KeyCards() {
  return (
    <Card title="⚔ Cartes maitresses — 7 pieces critiques">
      {KEY_CARDS.map((c) => (
        <div className="key" key={c.name}>
          <div className="key-h">
            <span className={`key-r ${c.roleCls}`}>{c.role}</span>
            <span className="key-n">{c.name}</span>
          </div>
          <div className="key-d">{highlight(c.body, c.strong)}</div>
        </div>
      ))}
      <Note>
        Lecture editoriale des interactions : elle repose sur des capacites declenchees que le
        simulateur ne resout pas. Les deux analyses sont complementaires, pas redondantes.
      </Note>
    </Card>
  )
}

function EditorialDiagnostic() {
  return (
    <Card title="▼ Arbitrages de reserve — a reevaluer">
      <Item title={<><Tag kind="crit">Erreur de classement</Tag>Skullclamp — classee "pas terrible"</>}>
        Dans un deck qui produit des jetons Vampire <Em>1/1</Em>, Skullclamp equipe pour un
        mana, tue le jeton et pioche deux cartes.{' '}
        <Em>C'est le meilleur moteur de pioche du fichier entier</Em>, et il est sur le banc.
      </Item>
      <Item title={<><Tag kind="hot">Maybeboard</Tag>Sanctum Seeker</>}>
        Drain tribal declenche a chaque attaque de vampire — reference absolue de l'archetype
        Edgar Markov. Sa place est en deck, pas en reserve.
      </Item>
      <Item title={<><Tag kind="hot">Maybeboard</Tag>Shared Animosity</>}>
        Dans un deck qui gagne en allant large, chaque vampire attaquant amplifie tous les
        autres. <Em>Condition de victoire a part entiere</Em> sur un plateau de jetons.
      </Item>
      <Item title={<><Tag kind="hot">Maybeboard</Tag>Bloodthirsty Conqueror</>}>
        Convertit chaque gain de vie adverse subi et chaque drain en degats supplementaires.
        Combine directement avec la triade d'aristocrates.
      </Item>
      <Item title={<><Tag kind="cold">Arbitrage</Tag>Trois Talismans ecartes</>}>
        Talisman of Conviction, of Hierarchy et of Indulgence sont classes "pas terrible".{' '}
        <Em>Compte tenu de la penurie de sources rouges, cet arbitrage merite reexamen</Em> :
        ce sont des fixateurs de couleur a deux mana.
      </Item>
      <Note>
        Les cartes marquees <b>noDeck</b>, <b>Sideboard</b> ou <b>pas terrible</b> sont
        desormais exclues du deck a l'import : l'ecart <b>104 / 100</b> releve dans le dossier
        se resorbe mecaniquement.
      </Note>
    </Card>
  )
}
