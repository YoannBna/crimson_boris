import type {
  Directive,
  DirectiveConstraints,
  DirectiveIssue,
  DirectiveTarget,
  DirectiveVerb
} from '@shared/forge'

/*
 * Interprete des directives ecrites en francais.
 *
 * Ce n'est PAS un modele de langage : c'est une grammaire fermee, et
 * c'est un choix. Un analyseur deterministe fait exactement ce qu'il
 * annonce, se verifie ligne a ligne, et ne coute rien. En echange, il
 * ne comprend que ce qu'il connait — d'ou la regle absolue de ce
 * module : toute ligne non comprise ressort dans `rejected` avec son
 * motif, jamais interpretee de travers ni ignoree en silence.
 *
 * Grammaire reconnue :
 *
 *   ajoute 3 pioche cmc<=2 budget<5
 *   ajoute 4 sources rouges
 *   coupe 2 cartes qui dorment
 *   coupe Ruinous Ultimatum
 *   retire les terrains qui entrent engages
 *   remplace Ruinous Ultimatum par un wrath budget<10
 */

const VERBS: Record<string, DirectiveVerb> = {
  ajoute: 'ajoute',
  ajouter: 'ajoute',
  add: 'ajoute',
  integre: 'ajoute',
  coupe: 'coupe',
  couper: 'coupe',
  retire: 'coupe',
  retirer: 'coupe',
  enleve: 'coupe',
  supprime: 'coupe',
  remplace: 'remplace',
  remplacer: 'remplace',
  substitue: 'remplace'
}

/** Synonymes acceptes pour chaque categorie fonctionnelle. */
const TARGETS: [DirectiveTarget, RegExp][] = [
  ['pioche', /\b(pioche|pioches|draw|cartes?\s+suppl)/i],
  ['wrath', /\b(wrath|wraths|balayage|balayages|reset)/i],
  ['removal', /\b(removal|interaction|interactions|reponse|reponses|destruction)/i],
  ['ramp', /\b(ramp|rampe|acceleration|mana\s+rock|rocks?)/i],
  ['exutoire', /\b(exutoire|exutoires|sac\s*outlet|sacrifice)/i],
  ['drain', /\b(drain|drains|aristocrate|aristocrates)/i],
  ['jetons', /\b(jeton|jetons|token|tokens)/i],
  ['anthem', /\b(anthem|anthems|seigneur|seigneurs|lord)/i],
  ['recursion', /\b(recursion|recursions|retour)/i],
  ['protection', /\b(protection|protections)/i],
  ['terrain', /\b(terrain|terrains|land|lands|source|sources)/i],
  ['creature', /\b(creature|creatures)/i]
]

const COLORS: [string, RegExp][] = [
  ['W', /\b(blanc|blanches?|white)\b/i],
  ['U', /\b(bleu|bleues?|blue)\b/i],
  ['B', /\b(noir|noires?|black)\b/i],
  ['R', /\b(rouge|rouges?|red)\b/i],
  ['G', /\b(vert|vertes?|green)\b/i]
]

/** Mot-cle designant les cartes que la simulation a vues dormir en main. */
export const DORMANT = /\b(dorment|dormantes?|mortes?|inutiles?|jamais\s+jouees?)\b/i

export function parseDirectives(text: string): {
  understood: Directive[]
  rejected: DirectiveIssue[]
} {
  const understood: Directive[] = []
  const rejected: DirectiveIssue[] = []

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (line === '' || line.startsWith('#') || line.startsWith('//')) continue

    const parsed = parseLine(line)
    if ('reason' in parsed) rejected.push({ raw: line, reason: parsed.reason })
    else understood.push(parsed)
  }

  return { understood, rejected }
}

function parseLine(line: string): Directive | { reason: string } {
  const words = line.split(/\s+/)
  const verb = VERBS[strip(words[0])]
  if (!verb) {
    return {
      reason: `verbe inconnu « ${words[0]} » — attendus : ajoute, coupe, retire, remplace`
    }
  }

  const constraints = parseConstraints(line)

  /* --- remplace X par Y ---------------------------------- */
  if (verb === 'remplace') {
    const m = /remplace[rz]?\s+(.+?)\s+par\s+(.+)$/i.exec(line)
    if (!m) return { reason: 'forme attendue : « remplace <carte> par <categorie ou carte> »' }

    const left = m[1].trim()
    const right = m[2].trim()
    return {
      raw: line,
      verb,
      quantity: 1,
      cardName: cleanCardName(left),
      replacement: {
        target: detectTarget(right) ?? undefined,
        cardName: detectTarget(right) ? undefined : cleanCardName(right)
      },
      constraints: parseConstraints(right)
    }
  }

  /* --- quantite ------------------------------------------ */
  const qtyMatch = /\b(\d+)\b/.exec(line)
  const quantity = qtyMatch ? Number(qtyMatch[1]) : 1
  if (quantity < 1 || quantity > 30) {
    return { reason: `quantite hors bornes : ${quantity} (attendu entre 1 et 30)` }
  }

  const target = detectTarget(line)

  /* --- coupe -------------------------------------------- */
  if (verb === 'coupe') {
    if (DORMANT.test(line)) {
      return { raw: line, verb, quantity, dormant: true, constraints }
    }
    if (target) {
      return { raw: line, verb, quantity, target, constraints }
    }
    // Sans categorie ni mot-cle, le reste de la ligne nomme une carte.
    const name = cleanCardName(line.replace(new RegExp(`^${words[0]}`, 'i'), ''))
    if (name.length < 3) {
      return { reason: 'ni categorie ni nom de carte reconnaissable apres le verbe' }
    }
    return { raw: line, verb, quantity, cardName: name, constraints }
  }

  /* --- ajoute ------------------------------------------- */
  if (!target && !constraints.color) {
    return {
      reason:
        'categorie manquante — precise par exemple : pioche, removal, ramp, exutoire, terrain'
    }
  }
  return { raw: line, verb, quantity, target: target ?? undefined, constraints }
}

function detectTarget(text: string): DirectiveTarget | null {
  for (const [target, re] of TARGETS) if (re.test(text)) return target
  return null
}

function parseConstraints(text: string): DirectiveConstraints {
  const c: DirectiveConstraints = {}

  const cmc = /\b(?:cmc|cout|cmv)\s*(?:<=|=<|<|max|inferieur\s+a)\s*(\d+)/i.exec(text)
  if (cmc) c.maxCmc = Number(cmc[1])

  const price =
    /\b(?:budget|prix|moins\s+de)\s*(?:<=|=<|<)?\s*(\d+(?:[.,]\d+)?)\s*(?:€|eur|euros?)?/i.exec(
      text
    )
  if (price) c.maxPrice = Number(price[1].replace(',', '.'))

  for (const [code, re] of COLORS) {
    if (re.test(text)) {
      c.color = code
      break
    }
  }

  // Attribut recherche : « degages » et « engages » sont deux valeurs
  // opposees du meme critere, quel que soit le verbe de la directive.
  if (/\bdegag/i.test(text)) c.entersTapped = false
  else if (/\bengag/i.test(text)) c.entersTapped = true

  return c
}

/** Nettoie un fragment de ligne pour en extraire un nom de carte. */
function cleanCardName(fragment: string): string {
  return fragment
    .replace(/^\s*(?:les?|la|un|une|des|du)\s+/i, '')
    .replace(/\b\d+\b/g, '')
    .replace(/\b(?:cmc|cout|budget|prix)\s*(?:<=|=<|<)?\s*\d+(?:[.,]\d+)?\s*(?:€|eur|euros?)?/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function strip(word: string): string {
  return word
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '')
}

/** Vocabulaire reconnu — sert a l'aide affichee dans l'interface. */
export const VOCABULARY = {
  verbs: ['ajoute', 'coupe', 'retire', 'remplace'],
  targets: TARGETS.map(([t]) => t),
  constraints: ['cmc<=N', 'budget<N', 'rouge / noir / blanc / bleu / vert', 'degages'],
  examples: [
    'ajoute 3 pioche cmc<=2 budget<5',
    'ajoute 4 sources rouges',
    'coupe 2 cartes qui dorment',
    'remplace Ruinous Ultimatum par un wrath budget<10',
    'retire les terrains qui entrent engages'
  ]
}
