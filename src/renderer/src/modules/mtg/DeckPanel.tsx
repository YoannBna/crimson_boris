import type { ResolvedDeck } from '@shared/mtg'
import { Card, Note, Tag } from '@/components/primitives'
import { DistBars } from '@/components/DistBars'
import type { DistRow } from '@/data/deck'

const ROLE_FR: Record<string, string> = {
  land: 'Terrains',
  ramp: 'Ramp',
  draw: 'Pioche',
  removal: 'Removal',
  wrath: 'Wraths',
  'sacrifice-outlet': 'Exutoires',
  'token-maker': 'Jetons',
  drain: 'Drain',
  anthem: 'Anthems',
  recursion: 'Recursion',
  protection: 'Protection',
  creature: 'Creatures',
  other: 'Autres'
}

const COLOR_FR: Record<string, string> = {
  W: 'Blanc',
  U: 'Bleu',
  B: 'Noir',
  R: 'Rouge',
  G: 'Vert',
  C: 'Incolore'
}

function roleDistribution(deck: ResolvedDeck): DistRow[] {
  const counts = new Map<string, number>()
  for (const c of deck.main) {
    for (const r of c.roles) counts.set(r, (counts.get(r) ?? 0) + 1)
  }
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1])
  const max = rows[0]?.[1] ?? 1
  return rows.map(([role, n]) => ({
    label: ROLE_FR[role] ?? role,
    value: n,
    width: Math.round((n / max) * 100),
    land: role === 'land'
  }))
}

function manaSources(deck: ResolvedDeck): DistRow[] {
  const counts = new Map<string, number>()
  let basics = 0
  let nonBasics = 0

  for (const c of deck.main) {
    if (!c.roles.includes('land')) continue
    if (/Basic Land/i.test(c.typeLine)) basics++
    else nonBasics++
  }
  for (const c of deck.main) {
    for (const col of c.producesMana) {
      counts.set(col, (counts.get(col) ?? 0) + 1)
    }
  }

  const colored = [...counts.entries()]
    .filter(([col]) => col !== 'C')
    .sort((a, b) => b[1] - a[1])
  const max = Math.max(1, colored[0]?.[1] ?? 1, basics)

  return [
    ...colored.map(([col, n]) => ({
      label: COLOR_FR[col] ?? col,
      value: n,
      width: Math.round((n / max) * 100)
    })),
    { label: 'Basiques', value: basics, width: Math.round((basics / max) * 100), land: true },
    {
      label: 'Non-basiques',
      value: nonBasics,
      width: Math.round((nonBasics / max) * 100),
      land: true
    }
  ]
}

function curve(deck: ResolvedDeck): DistRow[] {
  const buckets = new Map<number, number>()
  for (const c of deck.main) {
    if (c.roles.includes('land')) continue
    const b = Math.min(7, Math.floor(c.cmc))
    buckets.set(b, (buckets.get(b) ?? 0) + 1)
  }
  const max = Math.max(1, ...buckets.values())
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([b, n]) => ({
      label: b >= 7 ? '7 et plus' : `Cout ${b}`,
      value: n,
      width: Math.round((n / max) * 100)
    }))
}

export function DeckPanel({ deck }: { deck: ResolvedDeck }) {
  const nonLands = deck.main.filter((c) => !c.roles.includes('land'))
  const avgCmc =
    nonLands.length === 0 ? 0 : nonLands.reduce((n, c) => n + c.cmc, 0) / nonLands.length
  const lands = deck.main.length - nonLands.length
  const total = deck.main.length + deck.commander.length
  const legal = total <= 100

  const priced = deck.main.filter((c) => c.priceEur !== null)
  const value = priced.reduce((n, c) => n + (c.priceEur ?? 0), 0)

  return (
    <>
      <Card full title={`♲ Identite — ${deck.name}`}>
        <div className="item">
          <div className="t">
            <Tag kind="crit">Commandant</Tag>
            {deck.commander.map((c) => c.name).join(' · ') || 'aucun commandant declare'}
          </div>
          <div className="d">
            {deck.commander[0]?.typeLine ?? '—'} · Identite couleur{' '}
            <em>{deck.colorIdentity.join('') || '—'}</em> · importe le{' '}
            {new Date(deck.importedAt).toLocaleString('fr-FR')}
          </div>
        </div>

        <div className="kpi">
          <div>
            <b>TOTAL FORMAT</b>
            <span className={legal ? 'ok' : ''}>{total}</span>
            <i>{legal ? `${100 - total} place(s) libre(s)` : `Ecart : +${total - 100}`}</i>
          </div>
          <div>
            <b>EN DECK</b>
            <span className="ok">{deck.main.length}</span>
            <i>hors commandant</i>
          </div>
          <div>
            <b>EN RESERVE</b>
            <span className="ok">{deck.reserve.length}</span>
            <i>sideboard + maybeboard</i>
          </div>
          <div>
            <b>TERRAINS</b>
            <span className="ok">{lands}</span>
            <i>{((lands / Math.max(1, deck.main.length)) * 100).toFixed(0)} % du deck</i>
          </div>
          <div>
            <b>MANA MOYEN</b>
            <span className="ok">{avgCmc.toFixed(2)}</span>
            <i>hors terrains, calcule</i>
          </div>
          <div>
            <b>VALEUR</b>
            <span className="ok">{value.toFixed(0)} €</span>
            <i>{priced.length} cartes cotees</i>
          </div>
        </div>

        {deck.unresolved.length > 0 && (
          <Note>
            <b>{deck.unresolved.length} carte(s) non resolue(s)</b> :{' '}
            {deck.unresolved.map((u) => u.name).join(' · ')}. Elles sont exclues de la simulation.
          </Note>
        )}
      </Card>

      <Card title="▤ Repartition fonctionnelle — calculee sur le deck resolu">
        <DistBars rows={roleDistribution(deck)} />
        <Note>
          Classement deduit du texte oracle de chaque carte. Une carte peut compter dans
          plusieurs categories : la somme depasse donc le nombre de cartes.
        </Note>
      </Card>

      <Card title="▥ Courbe de mana — enfin disponible">
        <DistBars rows={curve(deck)} />
        <Note>
          L'export ne contient aucun cout de mana : cette courbe vient de la resolution
          Scryfall carte par carte. C'est la donnee que le dossier v1 declarait{' '}
          <b>non disponible</b>.
        </Note>
      </Card>

      <Card title="▥ Base de mana — sources par couleur">
        <DistBars rows={manaSources(deck)} />
        <Note>
          Une source bicolore compte pour chacune de ses couleurs. Le simulateur, lui,
          resout l'affectation source par source : une bi-terre ne paie qu'un seul symbole.
        </Note>
      </Card>
    </>
  )
}
