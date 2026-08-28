import type { ModeDef, NodeDef } from './map'
import { nodePosition } from './map'

/*
 * Constellation d'un mode.
 *
 * Toutes les sous-categories sont posees d'un coup, en miniature : rien
 * n'est cache derriere un menu. Les liens sont traces en SVG plutot
 * qu'en bordures CSS — une ligne entre deux points arbitraires n'a pas
 * de forme rectangulaire.
 *
 * Le meme composant sert au premier plan et au fond reduit : c'est
 * `scale` qui les distingue, si bien que la constellation ne se
 * reconstruit pas quand une categorie s'ouvre. Elle retrecit.
 */
export function Constellation({
  mode,
  focus,
  reduced,
  onPick
}: {
  mode: ModeDef
  /** Categorie ouverte, mise en avant dans le trace */
  focus: string | null
  /** Rendu en fond, tres reduit */
  reduced: boolean
  onPick: (nodeId: string) => void
}) {
  const positions = mode.nodes.map((n) => ({ node: n, ...nodePosition(n) }))

  return (
    <div className={`cst${reduced ? ' cst-reduced' : ''} cst-${mode.tone}`}>
      <svg className="cst-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        {positions.map(({ node, x, y }) => (
          <line
            key={node.id}
            x1="50"
            y1="56"
            x2={x}
            y2={y}
            className={`cst-link${focus === node.id ? ' on' : ''}`}
          />
        ))}
      </svg>

      {positions.map(({ node, x, y }) => (
        <NodeChip
          key={node.id}
          node={node}
          x={x}
          y={y}
          active={focus === node.id}
          dimmed={focus !== null && focus !== node.id}
          reduced={reduced}
          onPick={onPick}
        />
      ))}
    </div>
  )
}

function NodeChip({
  node,
  x,
  y,
  active,
  dimmed,
  reduced,
  onPick
}: {
  node: NodeDef
  x: number
  y: number
  active: boolean
  dimmed: boolean
  reduced: boolean
  onPick: (id: string) => void
}) {
  return (
    <button
      className={`cst-node${active ? ' on' : ''}${dimmed ? ' off' : ''}`}
      style={{ left: `${x}%`, top: `${y}%` }}
      onClick={(e) => {
        // Sans quoi le clic remonterait au vide, qui sert de retour.
        e.stopPropagation()
        onPick(node.id)
      }}
      // En fond reduit, la constellation n'est plus qu'un repere : elle
      // ne doit pas capter le pointeur ni le clavier.
      tabIndex={reduced ? -1 : 0}
      aria-hidden={reduced}
    >
      <span className="cst-node-label">{node.label}</span>
      {!reduced && <span className="cst-node-role">{node.role}</span>}
    </button>
  )
}
