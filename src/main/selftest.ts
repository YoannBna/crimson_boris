import { app } from 'electron'

/*
 * Suite de verification du noyau.
 *
 * Elle s'execute dans l'application reelle — SQLite, trousseau, reseau
 * compris — parce que c'est la que les defauts se logent. Les bugs les
 * plus couteux de ce projet (autoUpdater indefini, terrains comptes sur
 * les noms distincts, plan qui ne modifiait pas le deck) ont tous passe
 * la compilation sans broncher.
 *
 *   BORIS_TESTS=1 npx electron out/main/index.js --hidden
 *
 * `BORIS_TESTS=hors-ligne` saute les epreuves qui touchent au reseau.
 */

interface Case {
  group: string
  name: string
  run: () => Promise<void> | void
  /** Depend d'un acces reseau */
  online?: boolean
}

let passed = 0
let failed = 0
const failures: string[] = []

/** Derniere version de deck existant avant les epreuves qui en ecrivent. */
let repereDecks = -1

function assert(cond: unknown, message: string): void {
  if (!cond) throw new Error(message)
}

function eq<T>(got: T, want: T, what: string): void {
  if (got !== want) throw new Error(`${what} : attendu ${String(want)}, obtenu ${String(got)}`)
}

export async function runSelfTests(): Promise<void> {
  const offline = process.env['BORIS_TESTS'] === 'hors-ligne'
  const cases = await buildCases()

  console.log('\n===== VERIFICATION DU NOYAU =====')
  if (offline) console.log('(mode hors ligne : epreuves reseau ignorees)\n')

  let group = ''
  for (const c of cases) {
    if (c.online && offline) continue
    if (c.group !== group) {
      group = c.group
      console.log(`\n── ${group}`)
    }
    try {
      await c.run()
      passed++
      console.log(`   ✓ ${c.name}`)
    } catch (err) {
      failed++
      const msg = err instanceof Error ? err.message : String(err)
      failures.push(`${c.group} › ${c.name} : ${msg}`)
      console.log(`   ✗ ${c.name}`)
      console.log(`     ${msg}`)
    }
  }

  console.log(`\n===== ${passed} reussies, ${failed} echouees =====`)
  if (failed > 0) {
    console.log('\nEchecs :')
    for (const f of failures) console.log(`  ${f}`)
  }
  console.log('')
}

async function buildCases(): Promise<Case[]> {
  const { parseDeck } = await import('./deck/parse')
  const { parseCost, canPay, allocate } = await import('./sim/mana')
  const { mulberry32, shuffle } = await import('./sim/rng')
  const { classify, manaProduced, plainNotesProbe } = await probes()
  const { parseDirectives } = await import('./forge/directives')
  const { compareVersions } = await import('@shared/version')

  const cases: Case[] = []
  const add = (group: string, name: string, run: Case['run'], online = false): void => {
    cases.push({ group, name, run, online })
  }

  /* ---------- Parseur d'exports ---------- */
  add('Parseur d’exports', 'reconnait les trois formats', () => {
    eq(parseDeck('1x Sol Ring (C17) 221 [Ramp]').format, 'archidekt', 'format Archidekt')
    eq(parseDeck('1 Sol Ring (C17) 221').format, 'moxfield', 'format Moxfield')
    eq(parseDeck('1 Sol Ring').format, 'dec', 'format .dec')
  })

  add('Parseur d’exports', 'les etiquettes decident du sort de la carte', () => {
    const r = parseDeck(
      [
        '1x Edgar Markov (VOW) 234 [Commander{top}]',
        '1x Skullclamp (DST) 140 [pas terrible]',
        '1x Sanctum Seeker (XLN) 122 [Maybeboard]',
        '1x Qarsi Revenant (KTK) 82 [Sideboard]',
        '1x Ruinous Ultimatum (RNA) 199 [Wraths{noDeck}]',
        '9x Swamp (VOW) 275 [Terrains]'
      ].join('\n')
    )
    eq(r.counts.commander, 1, 'commandant')
    eq(r.counts.deck, 9, 'deck principal')
    eq(r.counts.maybeboard, 1, 'maybeboard')
    eq(r.counts.sideboard, 1, 'sideboard')
    eq(r.counts.excluded, 2, 'exclues (noDeck + pas terrible)')
  })

  /*
   * Les categories de l'export sont ce qui range le deck a l'ecran. Sans
   * ce tri, « Commander », « noDeck » ou « foil » remonteraient comme
   * des rayons de rangement a cote de « Vampires ».
   */
  add('Parseur d’exports', 'separe les categories des etiquettes de structure', async () => {
    const { categoriesOf } = await import('./deck/resolve')
    // Ordre reel d'un export Archidekt : finition avant les crochets.
    const r = parseDeck('1x Gatekeeper of Malakir (f10) 11 *F* [Commander{top}{noPrice},Vampires]')
    const tags = r.lines[0].tags
    assert(tags.includes('Vampires'), `categorie lue — obtenu ${tags.join('|')}`)
    assert(tags.includes('top') && tags.includes('foil'), `drapeaux lus — ${tags.join('|')}`)
    const cats = categoriesOf(tags)
    eq(cats.join('|'), 'Vampires', 'seule la categorie survit au tri')
  })

  add('Parseur d’exports', 'rejette sans avaler en silence', () => {
    const r = parseDeck('ceci n’est pas une carte\n0 Broken\n1x Sol Ring')
    eq(r.lines.length, 1, 'lignes retenues')
    eq(r.rejected.length, 2, 'lignes rejetees')
    assert(
      r.rejected.every((x) => x.reason.length > 8),
      'chaque rejet porte un motif explicite'
    )
  })

  add('Parseur d’exports', 'retire le marqueur de finition', () => {
    const r = parseDeck('1x Ruinous Ultimatum (fic) 329 *F* [Wrath]')
    eq(r.lines[0].name, 'Ruinous Ultimatum', 'nom nettoye du marqueur foil')
    assert(r.lines[0].tags.includes('foil'), 'finition conservee comme etiquette')
  })

  /* ---------- Solveur de mana ---------- */
  add('Solveur de mana', 'lit un cout complexe', () => {
    const c = parseCost('{3}{W}{W}{B}')
    eq(c.generic, 3, 'part generique')
    eq(c.colored.length, 3, 'symboles colores')
    eq(c.cmc, 6, 'cout converti')
  })

  add('Solveur de mana', 'refuse une base insuffisante', () => {
    const cost = parseCost('{3}{W}{W}{W}{B}{B}{R}{R}')
    assert(canPay(cost, [['W'], ['W'], ['W'], ['B'], ['B'], ['R'], ['R'], ['C'], ['C'], ['C']]), 'base juste')
    assert(
      !canPay(cost, [['W'], ['W'], ['W'], ['B'], ['B'], ['R'], ['C'], ['C'], ['C'], ['C']]),
      'un rouge manquant doit bloquer'
    )
  })

  add('Solveur de mana', 'ne brule pas une couleur rare pour du generique', () => {
    assert(canPay(parseCost('{2}{R}'), [['R'], ['C'], ['C']]), 'le rouge doit rester au symbole colore')
  })

  add('Solveur de mana', 'repartit les bi-terres', () => {
    assert(canPay(parseCost('{W}{B}'), [['W', 'B'], ['W', 'B']]), 'deux bi-terres suffisent')
    assert(!canPay(parseCost('{W}{B}'), [['W', 'B'], ['C']]), 'une seule ne suffit pas')
  })

  add('Solveur de mana', 'n’affecte jamais deux fois la meme source', () => {
    const a = allocate(parseCost('{2}{R}{W}'), [['R'], ['W'], ['C'], ['C']], [false, false, false, false])
    assert(a !== null, 'cout payable')
    eq(new Set(a as number[]).size, (a as number[]).length, 'indices uniques')
  })

  /* ---------- Generateur ---------- */
  add('Generateur', 'une meme graine rejoue la meme suite', () => {
    const a = Array.from({ length: 6 }, mulberry32(42))
    const b = Array.from({ length: 6 }, mulberry32(42))
    eq(JSON.stringify(a), JSON.stringify(b), 'suites identiques')
    const c = Array.from({ length: 6 }, mulberry32(43))
    assert(JSON.stringify(a) !== JSON.stringify(c), 'graine differente, suite differente')
  })

  add('Generateur', 'le melange conserve tous les elements', () => {
    const src = [1, 2, 3, 4, 5, 6, 7, 8]
    const out = shuffle([...src], mulberry32(7))
    eq(out.length, src.length, 'longueur')
    eq(
      JSON.stringify([...out].sort((x, y) => x - y)),
      JSON.stringify(src),
      'memes elements'
    )
  })

  /* ---------- Classement des cartes ---------- */
  add('Classement', 'reconnait les familles d’interaction', () => {
    assert(classify('Instant', 'Destroy target creature.').includes('removal'), 'removal cible')
    assert(classify('Sorcery', 'Destroy all creatures.').includes('wrath'), 'balayage')
    assert(
      classify('Creature — Vampire', 'Each opponent sacrifices a creature.').includes('removal'),
      'edit (sacrifice force)'
    )
    assert(classify('Sorcery', 'Gain control of target creature.').includes('removal'), 'vol')
  })

  add('Classement', 'reconnait la pioche, y compris conjuguee', () => {
    assert(classify('Sorcery', 'Draw two cards.').includes('draw'), 'draw')
    assert(
      classify('Sorcery', 'Target player draws two cards and loses 2 life.').includes('draw'),
      '« draws » avec un s'
    )
  })

  add('Classement', 'ne prend pas le pillage de cimetiere pour du removal', () => {
    assert(
      !classify('Land', "When this land enters, exile target player's graveyard.").includes('removal'),
      'exil de cimetiere'
    )
  })

  add('Classement', 'deduit les sources de mana', () => {
    eq(manaProduced('', 'Basic Land — Swamp').join(''), 'B', 'terrain basique')
    eq(manaProduced('{T}: Add one mana of any color.', 'Artifact').length, 5, 'source universelle')
  })

  /* ---------- Directives ---------- */
  add('Directives', 'interprete la grammaire', () => {
    const r = parseDirectives(
      [
        'ajoute 3 pioche cmc<=2 budget<5',
        'coupe 2 cartes qui dorment',
        'remplace Ruinous Ultimatum par un wrath budget<10',
        'ajoute 4 sources rouges'
      ].join('\n')
    )
    eq(r.understood.length, 4, 'directives comprises')
    eq(r.rejected.length, 0, 'aucun rejet')
    eq(r.understood[0].target, 'pioche', 'categorie')
    eq(r.understood[0].constraints.maxCmc, 2, 'contrainte de cout')
    eq(r.understood[0].constraints.maxPrice, 5, 'contrainte de prix')
    assert(r.understood[1].dormant === true, 'cartes qui dorment')
    eq(r.understood[2].verb, 'remplace', 'verbe remplace')
    eq(r.understood[3].constraints.color, 'R', 'couleur')
  })

  add('Directives', 'rejette avec un motif plutot que de deviner', () => {
    const r = parseDirectives('fais moi un cafe\najoute 3\ncoupe 99 pioche')
    eq(r.understood.length, 0, 'rien compris')
    eq(r.rejected.length, 3, 'trois rejets')
    assert(r.rejected[0].reason.includes('verbe'), 'motif du verbe inconnu')
    assert(r.rejected[2].reason.includes('quantite'), 'motif de la quantite')
  })

  add('Directives', 'ne confond pas engage et degage', () => {
    const a = parseDirectives('ajoute 4 terrains degages').understood[0]
    const b = parseDirectives('retire les terrains qui entrent engages').understood[0]
    eq(a.constraints.entersTapped, false, 'degages')
    eq(b.constraints.entersTapped, true, 'engages')
  })

  /* ---------- Versions ---------- */
  add('Versions', 'compare correctement', () => {
    assert(compareVersions('2.1.0', '2.0.9') > 0, '2.1.0 > 2.0.9')
    assert(compareVersions('v2.1.0', '2.1.0') === 0, 'le prefixe v est ignore')
    assert(compareVersions('2.1.0', '2.10.0') < 0, 'comparaison numerique, pas lexicale')
  })

  add('Versions', 'reduit les notes distantes en texte', () => {
    const out = plainNotesProbe('<h3>Titre</h3><ul><li>Un</li><li>Deux</li></ul>')
    assert(!out?.includes('<'), 'aucune balise ne subsiste')
    assert(out?.includes('• Un'), 'les elements de liste deviennent des puces')
  })

  /* ---------- Persistance ---------- */
  add('Persistance', 'la base s’ouvre et porte ses tables', async () => {
    const { getDb } = await import('./store/db')
    const rows = getDb()
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as { name: string }[]
    const names = rows.map((r) => r.name)
    for (const t of ['settings', 'tasks', 'cycles', 'quotes', 'cards', 'decks', 'sim_runs']) {
      assert(names.includes(t), `table ${t} presente`)
    }
  })

  add('Persistance', 'les reglages font l’aller-retour', async () => {
    const { readSettings, writeSettings } = await import('./store/settings')
    const before = readSettings().intervalMinutes
    writeSettings({ intervalMinutes: 45 })
    eq(readSettings().intervalMinutes, 45, 'valeur ecrite')
    writeSettings({ intervalMinutes: before })
  })

  add('Persistance', 'un secret est chiffre, jamais lisible en base', async () => {
    const { setSecret, getSecret, clearConnector, secureAvailable } = await import('./config')
    if (!secureAvailable()) throw new Error('trousseau indisponible sur cette session')
    const value = 'phrase-secrete-de-verification'
    setSecret('mail', 'IMAP_PASSWORD', value)
    eq(getSecret('mail', 'IMAP_PASSWORD'), value, 'dechiffrement')

    const { getDb } = await import('./store/db')
    const row = getDb()
      .prepare('SELECT cipher FROM secrets WHERE connector = ? AND key = ?')
      .get('mail', 'IMAP_PASSWORD') as { cipher: Buffer }
    assert(
      !row.cipher.toString('latin1').includes(value),
      'la valeur ne doit jamais apparaitre en clair'
    )
    clearConnector('mail')
    eq(getSecret('mail', 'IMAP_PASSWORD'), null, 'effacement')
  })

  /* ---------- Gravite ---------- */
  add('Gravite', 'un seuil deja franchi n’est pas un evenement', async () => {
    const { evaluate } = await import('./severity')
    const snapshot = {
      fetchedAt: new Date().toISOString(),
      ok: 1,
      total: 1,
      quotes: [
        {
          id: 'cac40',
          category: 'core' as const,
          label: 'CAC 40',
          symbol: '^FCHI',
          price: 8000,
          previousClose: 8100,
          changePercent: -1.2,
          currency: 'EUR',
          asOf: new Date().toISOString()
        }
      ]
    }
    const r = evaluate({ trigger: 'interval', markets: snapshot })
    const shock = r.hits.find((h) => h.rule === 'market-shock')
    assert(shock !== undefined, 'le seuil franchi est signale')
    eq(shock?.severity, 'watch', 'sans historique : surveillance, pas critique')
  })

  /* ---------- Forge : etabli et historique ----------
   * Ce groupe couvre le defaut le plus couteux rencontre : valider un
   * plan n'ecrivait qu'un fichier, sans jamais modifier le deck charge.
   */
  add('Forge — etabli', 'accepte, retire et vide les modifications', async () => {
    const wb = await import('./forge/workbench')
    const deck = fauxDeck()
    wb.clearChanges()
    wb.addChange({ kind: 'cut', cardName: 'Alpha', card: null, because: 't', source: 'manuel' })
    wb.addChange({ kind: 'add', cardName: 'Beta', card: null, because: 't', source: 'manuel' })
    eq(wb.snapshot(deck)?.changes.length, 2, 'deux modifications')
    wb.dropChange('cut-alpha')
    eq(wb.snapshot(deck)?.changes.length, 1, 'une apres retrait')
    wb.clearChanges()
    eq(wb.snapshot(deck)?.changes.length, 0, 'vide')
  })

  add('Forge — etabli', 'une carte ne compte jamais deux fois', async () => {
    const wb = await import('./forge/workbench')
    wb.clearChanges()
    wb.addChange({ kind: 'cut', cardName: 'Alpha', card: null, because: 'a', source: 'directive' })
    wb.addChange({ kind: 'cut', cardName: 'Alpha', card: null, because: 'b', source: 'directive' })
    eq(wb.snapshot(fauxDeck())?.changes.length, 1, 'deduplication par nom')
    wb.clearChanges()
  })

  add('Forge — etabli', 'rend un verdict de format honnete', async () => {
    const wb = await import('./forge/workbench')
    const deck = fauxDeck(101)
    wb.clearChanges()
    let v = wb.snapshot(deck)
    eq(v?.verdict.ok, false, '102 cartes : hors format')
    eq(v?.verdict.delta, 2, 'ecart annonce')
    wb.addChange({ kind: 'cut', cardName: 'c0', card: null, because: 't', source: 'manuel' })
    wb.addChange({ kind: 'cut', cardName: 'c1', card: null, because: 't', source: 'manuel' })
    v = wb.snapshot(deck)
    eq(v?.projectedTotal, 100, 'total projete')
    eq(v?.verdict.ok, true, 'plan conforme')
    wb.clearChanges()
  })

  add('Forge — etabli', 'appliquer un plan modifie reellement le deck', async () => {
    const wb = await import('./forge/workbench')
    const { latestDeck, saveDeck, lastDeckId } = await import('./store/decks')

    // Repere pose avant la premiere ecriture : la derniere epreuve du
    // groupe rendra la pile a cet etat.
    if (repereDecks < 0) repereDecks = lastDeckId()

    const deck = fauxDeck(10)
    saveDeck(deck)
    wb.clearChanges()
    wb.addChange({ kind: 'cut', cardName: 'c0', card: null, because: 't', source: 'manuel' })
    wb.addChange({
      kind: 'add',
      cardName: 'Nouvelle',
      card: fauxCarte('Nouvelle'),
      because: 't',
      source: 'manuel'
    })

    const res = wb.applyPlan(deck)
    eq(res.removed, 1, 'une sortie')
    eq(res.added, 1, 'une entree')
    eq(res.cards, 10, 'le compte se conserve')

    const apres = latestDeck()
    assert(apres !== null, 'une version a ete enregistree')
    eq(apres?.main.length, 10, 'deck relu depuis la base')
    assert(
      apres?.main.some((c) => c.name === 'Nouvelle'),
      'la carte ajoutee figure dans le deck'
    )
    assert(
      !apres?.main.some((c) => c.name === 'c0'),
      'la carte retiree a disparu'
    )
    eq(wb.snapshot(apres)?.changes.length, 0, 'l’etabli est consomme')
  })

  add('Forge — etabli', 'l’historique permet de revenir en arriere', async () => {
    const wb = await import('./forge/workbench')
    const { saveDeck, latestDeck } = await import('./store/decks')

    saveDeck(fauxDeck(20))
    const pile = wb.history()
    assert(pile.length >= 2, 'au moins deux versions')
    assert(pile[0].current, 'la premiere est la version courante')

    const cible = pile.find((v) => v.cards !== pile[0].cards)
    if (cible) {
      wb.revertTo(cible.id)
      eq(latestDeck()?.main.length, cible.cards, 'version rechargee')
      assert(wb.history().length > pile.length, 'rien n’est efface : la pile grandit')
    }
  })

  /*
   * Les epreuves tournent sur la vraie base. Sans cette derniere marche,
   * un deck d'essai de dix cartes restait en tete de pile et remplacait
   * la liste de l'operateur a l'ecran — constate, pas suppose.
   */
  add('Forge — etabli', 'les epreuves rendent la pile intacte', async () => {
    const { dropDeckVersionsAfter, lastDeckId, deckVersions } = await import('./store/decks')
    assert(repereDecks >= 0, 'un repere a bien ete pose')
    assert(deckVersions()[0]?.name === 'epreuve', 'la tete de pile est bien un deck d’essai')
    dropDeckVersionsAfter(repereDecks)
    eq(lastDeckId(), repereDecks, 'la pile revient a son repere')
    assert(
      !deckVersions().some((v) => v.id > repereDecks),
      'aucune version d’essai ne subsiste'
    )
    repereDecks = -1
  })

  /* ---------- Forge : illustrations ----------
   * L'art est range hors du deck : revenir a une version anterieure ne
   * doit pas defaire un choix graphique.
   */
  add('Forge — arts', 'un art choisi survit au changement de version', async () => {
    const { allArts, chooseArt, clearArt } = await import('./store/arts')
    const { saveDeck, latestDeck, dropDeckVersionsAfter, lastDeckId } = await import('./store/decks')
    const nom = '__epreuve-art__'

    clearArt(nom)
    const repere = lastDeckId()
    chooseArt({
      cardName: nom,
      scryfallId: 's-1',
      setCode: 'XYZ',
      setName: 'Epreuve',
      collectorNumber: '42',
      artist: 'Personne',
      imageNormal: null,
      priceEur: 1.5
    })

    saveDeck(fauxDeck(12))
    assert(latestDeck()?.main.length === 12, 'nouvelle version chargee')
    eq(allArts()[nom]?.setCode, 'XYZ', 'l’art survit a l’empilement d’une version')

    dropDeckVersionsAfter(repere)
    eq(allArts()[nom]?.collectorNumber, '42', 'et au retour en arriere')

    clearArt(nom)
    assert(allArts()[nom] === undefined, 'le retrait rend la carte a son impression d’origine')
  })

  add('Forge — arts', 'l’export porte l’impression retenue', async () => {
    const { readFile, unlink } = await import('node:fs/promises')
    const { tmpdir } = await import('node:os')
    const wb = await import('./forge/workbench')
    const { chooseArt, clearArt } = await import('./store/arts')

    const deck = fauxDeck(3)
    chooseArt({
      cardName: 'c1',
      scryfallId: 's-2',
      setCode: 'XYZ',
      setName: 'Epreuve',
      collectorNumber: '77',
      artist: null,
      imageNormal: null,
      priceEur: null
    })

    wb.clearChanges()
    const { path } = await wb.exportPlan(deck, tmpdir())
    const texte = await readFile(path, 'utf8')
    await unlink(path)
    clearArt('c1')

    assert(texte.includes('1x c1 (XYZ) 77'), `impression absente de l’export :\n${texte}`)
    assert(texte.includes('1x c0\n') || texte.includes('1x c0\r'), 'les autres lignes restent nues')
  })

  /* ---------- Simulation ---------- */
  add('Simulation', 'produit des parties exploitables', async () => {
    const { simulate } = await import('./sim/engine')
    const deck = fauxDeckJouable()
    const games = simulate(deck, { opponents: 3, games: 40, maxTurns: 10, seed: 99 })
    eq(games.length, 40, 'nombre de parties')
    assert(games.every((g) => g.turns.length === 10), 'chaque partie va au bout')
    assert(games.some((g) => g.turns.some((t) => t.spellsCast.length > 0)), 'des sorts sont lances')
    assert(
      games.every((g) => g.turns.every((t) => t.manaWasted >= 0)),
      'aucun mana negatif'
    )
  })

  add('Simulation', 'la graine rend la campagne reproductible', async () => {
    const { simulate } = await import('./sim/engine')
    const deck = fauxDeckJouable()
    const cfg = { opponents: 3 as const, games: 15, maxTurns: 8, seed: 4242 }
    const a = simulate(deck, cfg)
    const b = simulate(deck, cfg)
    eq(
      JSON.stringify(a.map((g) => g.turns.map((t) => t.spellsCast))),
      JSON.stringify(b.map((g) => g.turns.map((t) => t.spellsCast))),
      'deux campagnes identiques'
    )
  })

  add('Simulation', 'l’analyse rend des constats gradues', async () => {
    const { simulate } = await import('./sim/engine')
    const { analyze } = await import('./sim/analyze')
    const deck = fauxDeckJouable()
    const games = simulate(deck, { opponents: 3, games: 60, maxTurns: 10, seed: 7 })
    const findings = analyze(games, deck)
    assert(findings.length >= 6, 'au moins six constats')
    assert(
      findings.every((f) => f.measure.length > 10 && f.reading.length > 10),
      'chaque constat separe mesure et lecture'
    )
    const grades = ['critique', 'desequilibre', 'tension', 'nominal']
    assert(findings.every((f) => grades.includes(f.grade)), 'grades connus')
  })

  /* ---------- Reseau ---------- */
  add(
    'Reseau',
    'les cotations repondent',
    async () => {
      const { fetchMarkets } = await import('./providers/markets')
      const snap = await fetchMarkets()
      assert(snap.ok > 0, `aucune cotation obtenue sur ${snap.total}`)
      assert(snap.quotes.some((q) => q.category === 'asymmetry'), 'volet asymetries present')
    },
    true
  )

  add(
    'Reseau',
    'Scryfall resout une carte et ses impressions',
    async () => {
      const { cardByName, printings } = await import('./providers/scryfall')
      const card = await cardByName('Sol Ring')
      eq(card.name, 'Sol Ring', 'nom')
      eq(card.cmc, 1, 'cout converti')
      assert(card.roles.includes('ramp'), 'classee comme rampe')
      const p = await printings('Sol Ring')
      assert(p.length > 3, 'plusieurs impressions')
    },
    true
  )

  add(
    'Reseau',
    'les categories de l’export survivent a la resolution',
    async () => {
      const { resolveDeck } = await import('./deck/resolve')
      const parsed = parseDeck(
        ['1x Edgar Markov (VOW) 234 [Commander{top}]', '1x Sol Ring (C17) 221 [Rampe]'].join('\n')
      )
      const deck = await resolveDeck(parsed, { name: 'epreuve', sourceFile: null })
      // Indexees sur le nom resolu : c'est celui que l'interface affiche.
      eq(deck.categories?.['Sol Ring']?.[0], 'Rampe', 'categorie de la carte du deck')
      assert(
        deck.categories?.['Edgar Markov'] === undefined,
        'le commandant ne porte que des etiquettes de structure'
      )
    },
    true
  )

  add(
    'Reseau',
    'les impressions arrivent de la moins chere a la plus chere',
    async () => {
      const { printings } = await import('./providers/scryfall')
      const p = await printings('Sol Ring')
      const prix = p.map((x) => x.priceEur).filter((x): x is number => x !== null)
      assert(prix.length > 2, 'plusieurs impressions cotees')
      // La vue d'inspection presente la liste telle quelle : si l'ordre
      // se perdait, le choix « le moins cher » ne serait plus en tete.
      assert(
        prix.every((v, i) => i === 0 || prix[i - 1] <= v),
        `ordre rompu : ${prix.slice(0, 8).join(', ')}`
      )
    },
    true
  )

  add(
    'Reseau',
    'les cartes recto-verso se retrouvent par chaque face',
    async () => {
      const { collection } = await import('./providers/scryfall')
      const { putCards, getCached } = await import('./store/cards')
      const { found } = await collection(['Fell Mire', 'Bartolome del Presidio'])
      putCards(found)
      const { misses } = getCached(['Fell Mire', 'Bartolome del Presidio'])
      eq(misses.length, 0, 'face arriere et diacritiques resolus')
    },
    true
  )

  return cases
}

/* ---------- Fabriques de donnees d'epreuve ---------- */

function fauxCarte(name: string, roles: string[] = ['creature'], cmc = 2): never {
  return {
    oracleId: `o-${name}`,
    scryfallId: `s-${name}`,
    name,
    manaCost: '{1}{B}',
    cmc,
    typeLine: 'Creature — Vampire',
    oracleText: '',
    colors: ['B'],
    colorIdentity: ['B'],
    power: '2',
    toughness: '2',
    producesMana: [],
    imageSmall: null,
    imageNormal: null,
    priceEur: 1,
    priceUsd: 1,
    roles,
    layout: 'normal',
    setCode: 'TST',
    collectorNumber: '1'
  } as never
}

function fauxTerrain(i: number): never {
  return {
    ...(fauxCarte(`Swamp${i}`, ['land'], 0) as unknown as Record<string, unknown>),
    typeLine: 'Basic Land — Swamp',
    manaCost: null,
    producesMana: ['B'],
    roles: ['land']
  } as never
}

/** Deck minimal, suffisant pour l'etabli et l'historique. */
function fauxDeck(cards = 99): never {
  return {
    name: 'epreuve',
    importedAt: new Date().toISOString(),
    sourceFile: null,
    commander: [fauxCarte('Commandant')],
    main: Array.from({ length: cards }, (_, i) => fauxCarte(`c${i}`)),
    reserve: [],
    unresolved: [],
    foils: [],
    colorIdentity: ['B']
  } as never
}

/** Deck jouable : assez de terrains pour que la simulation avance. */
function fauxDeckJouable(): never {
  const main = [
    ...Array.from({ length: 38 }, (_, i) => fauxTerrain(i)),
    ...Array.from({ length: 61 }, (_, i) => fauxCarte(`sort${i}`))
  ]
  return {
    name: 'epreuve-jouable',
    importedAt: new Date().toISOString(),
    sourceFile: null,
    commander: [fauxCarte('Commandant', ['creature'], 4)],
    main,
    reserve: [],
    unresolved: [],
    foils: [],
    colorIdentity: ['B']
  } as never
}

/** Expose deux fonctions internes pour la verification. */
async function probes(): Promise<{
  classify: (t: string, o: string) => string[]
  manaProduced: (o: string, t: string) => string[]
  plainNotesProbe: (n: unknown) => string | null
}> {
  const sc = await import('./providers/scryfall')
  const up = await import('./updater')
  return {
    classify: (t, o) => sc.classify(t, o) as unknown as string[],
    manaProduced: (o, t) => sc.manaProduced(o, t),
    plainNotesProbe: (n) => up.plainNotes(n)
  }
}

export function testsRequested(): boolean {
  return Boolean(process.env['BORIS_TESTS'])
}

export function finish(): void {
  app.exit(failed > 0 ? 1 : 0)
}
