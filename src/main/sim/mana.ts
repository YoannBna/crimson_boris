/**
 * Paiement d'un cout de mana par un ensemble de sources.
 *
 * Le probleme est un couplage biparti : chaque symbole colore doit
 * trouver une source distincte capable de le produire. L'approche
 * gloutonne « le plus contraint d'abord » — traiter en premier les
 * couleurs ayant le moins de sources disponibles, et les servir avec
 * les sources les moins polyvalentes — est exacte pour les tailles en
 * jeu ici (une dizaine de sources, cinq couleurs au plus).
 *
 * Sans cette modelisation, une base de mana a trois couleurs paraitrait
 * aussi fiable qu'une mono-couleur, et la simulation ne dirait rien.
 */

export interface ManaCost {
  generic: number
  /** Symboles colores, un par occurrence : "{R}{R}" donne ['R','R'] */
  colored: string[]
  /** Cout converti */
  cmc: number
}

const SYMBOL = /\{([^}]+)\}/g

export function parseCost(manaCost: string | null): ManaCost {
  const cost: ManaCost = { generic: 0, colored: [], cmc: 0 }
  if (!manaCost) return cost

  for (const m of manaCost.matchAll(SYMBOL)) {
    const sym = m[1].toUpperCase()

    if (/^\d+$/.test(sym)) {
      cost.generic += Number(sym)
      cost.cmc += Number(sym)
      continue
    }
    if (sym === 'X') continue // X vaut zero a defaut de contexte
    if (sym === 'C') {
      cost.colored.push('C')
      cost.cmc += 1
      continue
    }
    // Hybride et phyrexian : on retient la premiere couleur payable.
    if (sym.includes('/')) {
      const parts = sym.split('/').filter((p) => /^[WUBRG]$/.test(p))
      if (parts.length > 0) cost.colored.push(parts[0])
      else cost.generic += 1
      cost.cmc += 1
      continue
    }
    if (/^[WUBRG]$/.test(sym)) {
      cost.colored.push(sym)
      cost.cmc += 1
    }
  }

  return cost
}

/**
 * `sources` : une entree par source disponible, listant les couleurs
 * qu'elle sait produire. Une source incolore porte ['C'].
 *
 * Retourne les indices des sources reellement consommees, ou null si le
 * cout n'est pas payable. Rendre l'allocation plutot qu'un simple booleen
 * est indispensable : sans elle, le moteur risquerait de depenser une
 * source de couleur rare pour du mana generique, et un deck a trois
 * couleurs paraitrait plus fiable qu'il ne l'est.
 */
export function allocate(
  cost: ManaCost,
  sources: string[][],
  used: boolean[]
): number[] | null {
  const free: number[] = []
  for (let i = 0; i < sources.length; i++) if (!used[i]) free.push(i)
  if (free.length < cost.generic + cost.colored.length) return null

  const taken: number[] = []
  const claimed = new Set<number>()

  // Traiter d'abord les couleurs les plus rares parmi les sources libres.
  const order = [...cost.colored].sort(
    (a, b) => countProviders(a, free, sources) - countProviders(b, free, sources)
  )

  for (const color of order) {
    let pick = -1
    let pickBreadth = Infinity
    for (const i of free) {
      if (claimed.has(i)) continue
      if (!sources[i].includes(color)) continue
      // Preferer la source la moins polyvalente : garder les jokers pour la suite.
      if (sources[i].length < pickBreadth) {
        pick = i
        pickBreadth = sources[i].length
      }
    }
    if (pick === -1) return null
    claimed.add(pick)
    taken.push(pick)
  }

  // Le generique se sert ensuite, en commencant par les sources les plus etroites.
  const rest = free
    .filter((i) => !claimed.has(i))
    .sort((a, b) => sources[a].length - sources[b].length)

  if (rest.length < cost.generic) return null
  for (let k = 0; k < cost.generic; k++) taken.push(rest[k])

  return taken
}

/** Commodite : le cout est-il payable, sans se soucier de l'allocation ? */
export function canPay(cost: ManaCost, sources: string[][]): boolean {
  return allocate(cost, sources, new Array<boolean>(sources.length).fill(false)) !== null
}

function countProviders(color: string, free: number[], sources: string[][]): number {
  return free.reduce((n, i) => n + (sources[i].includes(color) ? 1 : 0), 0)
}
