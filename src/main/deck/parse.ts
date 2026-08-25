import type { ParsedLine, ParseResult, Slot } from '@shared/mtg'

/*
 * Parseur d'exports de listes de cartes.
 *
 * Les trois formats vises partagent la meme colonne vertebrale
 * « quantite + nom », et divergent sur les suffixes :
 *
 *   Archidekt : 1x Edgar Markov (VOW) 234 [Commander{top}]
 *   Moxfield  : 1 Edgar Markov (VOW) 234
 *   MTGO/.dec : 1 Edgar Markov
 *
 * Aucune ligne n'est ecartee en silence : ce qui n'est pas compris
 * ressort dans `rejected` avec son motif.
 */

const QTY = /^\s*(\d+)\s*[xX]?\s+(.+?)\s*$/
const SET_NUM = /\s*\(([A-Za-z0-9]{2,6})\)\s*([A-Za-z0-9\-★]+)?\s*$/
const BRACKET_TAGS = /\s*\[([^\]]*)\]\s*$/
/* Archidekt suffixe les finitions : « ... (f10) 11 *F* ». Non retire, ce
 * marqueur reste colle au nom et la carte devient introuvable. */
const FINISH = /(\s*\*[A-Za-z-]+\*)+\s*$/
const SECTION = /^\s*(?:\/\/\s*)?(commander|commandant|deck|main(?:board)?|side(?:board)?|maybe(?:board)?|considering)\b[:\s]*$/i

export function parseDeck(text: string): ParseResult {
  const lines: ParsedLine[] = []
  const rejected: { raw: string; reason: string }[] = []
  let section: Slot | null = null
  let sawBrackets = false
  let sawXQty = false
  let sawSetCode = false

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()

    if (line === '' || line.startsWith('#')) continue

    const sec = SECTION.exec(line)
    if (sec) {
      section = sectionToSlot(sec[1])
      continue
    }

    const m = QTY.exec(line)
    if (!m) {
      // Une ligne sans quantite est presque toujours un en-tete decoratif.
      rejected.push({ raw, reason: 'aucune quantite en tete de ligne' })
      continue
    }

    const quantity = Number(m[1])
    if (!Number.isFinite(quantity) || quantity < 1) {
      rejected.push({ raw, reason: 'quantite invalide' })
      continue
    }
    if (/^\d+\s*[xX]\s/.test(line)) sawXQty = true

    let rest = m[2]
    const tags: string[] = []

    const brackets = BRACKET_TAGS.exec(rest)
    if (brackets) {
      sawBrackets = true
      rest = rest.slice(0, brackets.index)
      for (const t of brackets[1].split(',')) {
        // Archidekt suffixe ses categories : "Commander{top}", "Vampires{noDeck}"
        const clean = t.trim().replace(/\{[^}]*\}/g, '').trim()
        if (clean) tags.push(clean)
        const flags = t.match(/\{([^}]*)\}/g) ?? []
        for (const f of flags) tags.push(f.slice(1, -1).trim())
      }
    }

    // La finition se retire avant le set : elle se place apres lui.
    const finish = FINISH.exec(rest)
    if (finish) {
      // Conservee comme etiquette : `styleCandidatesFrom` s'en sert pour ne
      // pas proposer de variante d'une carte deja possedee en finition speciale.
      tags.push('foil')
      rest = rest.slice(0, finish.index)
    }

    let setCode: string | undefined
    let collectorNumber: string | undefined
    const sn = SET_NUM.exec(rest)
    if (sn) {
      setCode = sn[1].toUpperCase()
      collectorNumber = sn[2]
      sawSetCode = true
      rest = rest.slice(0, sn.index)
    }

    const name = normalizeName(rest)
    if (name === '') {
      rejected.push({ raw, reason: 'nom de carte vide apres nettoyage' })
      continue
    }

    lines.push({
      quantity,
      name,
      setCode,
      collectorNumber,
      tags,
      slot: slotFor(tags, section),
      raw
    })
  }

  const counts: Record<Slot, number> = {
    deck: 0,
    commander: 0,
    sideboard: 0,
    maybeboard: 0,
    excluded: 0
  }
  for (const l of lines) counts[l.slot] += l.quantity

  return {
    // Archidekt seul emploie les crochets ; Moxfield seul cite set et numero
    // sans crochets ; un .dec generique ne porte ni l'un ni l'autre.
    format: sawBrackets
      ? 'archidekt'
      : sawSetCode || sawXQty
        ? 'moxfield'
        : lines.length > 0
          ? 'dec'
          : 'inconnu',
    lines,
    rejected,
    counts
  }
}

/**
 * Un tag decide seul du sort d'une carte ; la section ne sert que de
 * repli. C'est l'ordre inverse qui produirait l'anomalie relevee dans
 * le dossier v1 : des cartes marquees Sideboard mais comptees en deck.
 */
function slotFor(tags: string[], section: Slot | null): Slot {
  const low = tags.map((t) => t.toLowerCase())

  if (low.some((t) => t === 'nodeck')) return 'excluded'
  if (low.some((t) => t === 'commander' || t === 'commandant')) return 'commander'
  if (low.some((t) => t.startsWith('maybe'))) return 'maybeboard'
  if (low.some((t) => t.startsWith('side'))) return 'sideboard'
  // Categorie libre d'Archidekt employee comme rebut dans l'export de reference.
  if (low.some((t) => t === 'pas terrible')) return 'excluded'

  return section ?? 'deck'
}

function sectionToSlot(word: string): Slot {
  const w = word.toLowerCase()
  if (w.startsWith('command')) return 'commander'
  if (w.startsWith('side')) return 'sideboard'
  if (w.startsWith('maybe') || w.startsWith('consider')) return 'maybeboard'
  return 'deck'
}

/** Retire les suffixes de face et normalise les apostrophes. */
export function normalizeName(raw: string): string {
  return raw
    .replace(/\s*\/\/.*$/, '')
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}
