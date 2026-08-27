import { app, ipcMain, session } from 'electron'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import type {
  CoreStatus,
  MarketSnapshot,
  Settings,
  TriggerSource
} from '@shared/types'
import type { SimConfig, StyleFind, Suggestion } from '@shared/mtg'
import type { Change, PoolQuery } from '@shared/forge'
import type { ConnectorId, OperatorProfile } from '@shared/config'
import { broadcast, createWindow, getWindow, markQuitting, revealWindow } from './window'
import { applyLaunchAtLogin, createTray, destroyTray, updateTray } from './tray'
import { watchPower, stopWatchingPower } from './power'
import { Scheduler } from './scheduler'
import { evaluate } from './severity'
import { fetchMarkets } from './providers/markets'
import { closeDb, getDb } from './store/db'
import { readSettings, writeSettings } from './store/settings'
import { readTasks, setTaskDone } from './store/tasks'
import { alreadyRevealedFor, logCycle, recordQuote } from './store/journal'

/* ============================================================
   Etat vivant du noyau
   ============================================================ */

let status: CoreStatus
let markets: MarketSnapshot | null = null
let scheduler: Scheduler
let lastRevealDecision = '—'

/** Boris a-t-il ete lance masque, au demarrage de la session ? */
function startedHidden(): boolean {
  return (
    process.argv.includes('--hidden') ||
    app.getLoginItemSettings().wasOpenedAsHidden === true
  )
}

/* ============================================================
   Cycle
   ============================================================ */

async function runCycle(trigger: TriggerSource): Promise<void> {
  if (!status.active || status.running) return

  const startedAt = new Date()
  status.running = true
  status.lastTrigger = trigger
  publish()

  try {
    markets = await fetchMarkets()
    for (const q of markets.quotes) {
      recordQuote(q.id, markets.fetchedAt, q.price, q.changePercent)
    }
    broadcast('core:markets', markets)
  } catch (err) {
    // Une passe de marche ratee ne doit jamais interrompre le cycle :
    // les regles de taches et d'echeances restent evaluables hors ligne.
    console.error('[boris] collecte des marches en echec :', err)
  }

  const { severity, hits } = evaluate({ trigger, markets })

  /*
   * Empreinte des signaux critiques du cycle. Identique d'un cycle a l'autre,
   * elle signale une situation durable plutot qu'un evenement neuf : Boris
   * garde alors sa pastille et sa gravite, mais ne rouvre pas sa fenetre.
   */
  const fingerprint = hits
    .filter((h) => h.severity === 'critical')
    .map((h) => `${h.rule}|${h.label}`)
    .sort()
    .join(';')

  lastRevealDecision =
    severity !== 'critical'
      ? 'non — cycle non critique'
      : !status.settings.revealOnCritical
        ? 'non — reglage desactive'
        : alreadyRevealedFor(fingerprint, status.settings.revealCooldownMinutes)
          ? `non — deja signale pour ces memes signaux (< ${status.settings.revealCooldownMinutes} min)`
          : 'oui'

  const shouldReveal =
    severity === 'critical' &&
    status.settings.revealOnCritical &&
    !alreadyRevealedFor(fingerprint, status.settings.revealCooldownMinutes)

  const durationMs = Date.now() - startedAt.getTime()
  logCycle({
    startedAt: startedAt.toISOString(),
    trigger,
    durationMs,
    severity,
    revealed: shouldReveal,
    fingerprint
  })

  status.running = false
  status.severity = severity
  status.hits = hits
  status.lastCycle = startedAt.toISOString()
  status.lastDurationMs = durationMs
  status.modulesFed = markets && markets.ok > 0 ? 4 : 3

  scheduler.arm(status.settings.intervalMinutes)
  status.nextCycle = scheduler.next
  publish()

  if (shouldReveal) revealWindow(true)

  if (process.env['BORIS_SELFTEST']) reportSelfTest()
}

/** Compte rendu de controle — n'a pas de role en fonctionnement normal. */
function reportSelfTest(): void {
  const db = getDb()
  const counts = db
    .prepare('SELECT (SELECT COUNT(*) FROM cycles) AS cycles, (SELECT COUNT(*) FROM quotes) AS quotes')
    .get() as { cycles: number; quotes: number }

  console.log('\n===== DIAGNOSTIC BORIS =====')
  console.log('base           :', db.name)
  console.log('cycles journal :', counts.cycles, '| cotations stockees :', counts.quotes)
  console.log('declencheur    :', status.lastTrigger, '| duree :', status.lastDurationMs, 'ms')
  console.log('gravite        :', status.severity)
  console.log('prochain cycle :', status.nextCycle)
  console.log('reglages       :', JSON.stringify(status.settings))
  console.log('marches        :', markets ? `${markets.ok}/${markets.total} obtenues` : 'aucun')
  for (const q of markets?.quotes ?? []) {
    console.log(
      `  ${q.label.padEnd(12)} ${String(q.price ?? '—').padStart(12)}` +
        `  ${q.changePercent === null ? '' : q.changePercent.toFixed(2) + ' %'}` +
        (q.error ? `  ECHEC: ${q.error}` : '')
    )
  }
  console.log('revelation     :', lastRevealDecision)
  console.log('signaux        :', status.hits.length)
  for (const h of status.hits) console.log(`  [${h.rule}] ${h.label}`)
  console.log('============================\n')

  const forgeText = process.env['BORIS_FORGE_TEST']
  if (forgeText) {
    void reportForge(forgeText)
    return
  }

  const mtgFile = process.env['BORIS_MTG_TEST']
  if (mtgFile) {
    void reportMtg(mtgFile)
    return
  }

  const shot = process.env['BORIS_SHOT']
  if (shot) {
    void captureForReview(shot)
    return
  }
  markQuitting()
  app.quit()
}

/** Banc d'essai de la forge — n'a pas de role en fonctionnement normal. */
async function reportForge(text: string): Promise<void> {
  const { currentDeck, lastRun } = await import('./mtg')
  const { planDirectives, snapshot, addChange } = await import('./forge/workbench')
  const { advise } = await import('./forge/recommend')

  try {
    const deck = currentDeck()
    const run = lastRun()
    if (!deck) throw new Error('aucun deck en base')

    console.log('\n===== BANC D’ESSAI FORGE =====')
    console.log(`deck : ${deck.name} · ${deck.main.length + deck.commander.length} / 100`)

    console.log('\n--- RECOMMANDATIONS STATIQUES ---')
    for (const a of advise(deck, run)) {
      console.log(`\n[${a.grade.toUpperCase()}] ${a.title}`)
      console.log(`  mesure  : ${a.measure}`)
      console.log(`  lecture : ${a.reading}`)
      if (a.cards.length) console.log(`  cartes  : ${a.cards.slice(0, 5).join(', ')}${a.cards.length > 5 ? ` … +${a.cards.length - 5}` : ''}`)
    }

    console.log('\n--- DIRECTIVES ---')
    const plan = await planDirectives(text.replace(/\\n/g, '\n'), { deck, run })
    for (const line of plan.report) console.log(`  ${line}`)
    for (const r of plan.rejected) console.log(`  REJET « ${r.raw} » : ${r.reason}`)

    console.log(`\n--- PLAN : ${plan.changes.length} modification(s) ---`)
    for (const c of plan.changes) {
      const price = c.card?.priceEur !== null && c.card ? `${c.card.priceEur?.toFixed(2)} €` : '—'
      console.log(`  ${c.kind === 'add' ? 'ENTRE' : 'SORT '} ${c.cardName.padEnd(30)} ${price.padStart(9)}  ${c.because}`)
      addChange(c)
    }

    const w = snapshot(deck)
    console.log(`\ntotal : ${w?.baseTotal} -> ${w?.projectedTotal} / 100`)
    console.log(`verdict : ${w?.verdict.message}`)
    console.log('==============================\n')
  } catch (err) {
    console.error('BANC D’ESSAI FORGE EN ECHEC :', err)
  }

  markQuitting()
  app.quit()
}

/** Banc d'essai du module MTG — n'a pas de role en fonctionnement normal. */
async function reportMtg(path: string): Promise<void> {
  const { importFromFile, runSimulation } = await import('./mtg')
  const { suggestFor, styleUpgrades } = await import('./suggest')
  const { cacheSize } = await import('./store/cards')

  try {
    console.log('\n===== BANC D’ESSAI MTG =====')
    const t0 = Date.now()
    const deck = await importFromFile(path)
    console.log(`import          : ${Date.now() - t0} ms`)
    console.log(`commandant      : ${deck.commander.map((c) => c.name).join(', ') || 'aucun'}`)
    console.log(`identite        : ${deck.colorIdentity.join('') || '—'}`)
    console.log(`deck principal  : ${deck.main.length} cartes`)
    console.log(`reserve         : ${deck.reserve.length} cartes`)
    console.log(`non resolues    : ${deck.unresolved.length}`)
    for (const u of deck.unresolved.slice(0, 8)) console.log(`   ! ${u.name} — ${u.reason}`)
    console.log(`cache Scryfall  : ${cacheSize()} cartes`)

    const lands = deck.main.filter((c) => c.roles.includes('land')).length
    const avgCmc =
      deck.main.filter((c) => !c.roles.includes('land')).reduce((n, c) => n + c.cmc, 0) /
      Math.max(1, deck.main.filter((c) => !c.roles.includes('land')).length)
    console.log(`terrains        : ${lands} | cout moyen hors terrains : ${avgCmc.toFixed(2)}`)

    const t1 = Date.now()
    const run = runSimulation({ games: 400, opponents: 3 })
    console.log(`\nsimulation      : 400 parties en ${Date.now() - t1} ms`)

    console.log('\n--- CONSTATS ---')
    for (const f of run.findings) {
      console.log(`\n[${f.grade.toUpperCase()}] ${f.title}`)
      console.log(`  mesure  : ${f.measure}`)
      console.log(`  lecture : ${f.reading}`)
    }

    const actionable = run.findings.filter((f) => f.grade !== 'nominal').slice(0, 2)
    if (actionable.length > 0) {
      console.log('\n--- SUGGESTIONS ---')
      const sugg = await suggestFor(actionable, deck, { perFinding: 5 })
      for (const [id, list] of sugg) {
        console.log(`\n  ${id} :`)
        for (const s of list) {
          const price = s.card.priceEur !== null ? `${s.card.priceEur.toFixed(2)} EUR` : '— EUR'
          console.log(`    ${String(s.score).padStart(3)} | ${price.padStart(10)} | ${s.card.name}`)
          console.log(`          ${s.because}`)
        }
      }
    }

    console.log('\n--- VARIANTES GRAPHIQUES BUDGET ---')
    const style = await styleUpgrades(
      ['Blood Artist', 'Sol Ring', 'Skullclamp', 'Swords to Plowshares'],
      { maxPriceEur: 6 }
    )
    for (const s of style) {
      console.log(`\n  ${s.cardName} (moins chere listee : ${s.current?.priceEur ?? '—'} EUR, ${s.current?.setCode ?? '—'})`)
      for (const p of s.candidates) {
        const fx = [
          p.borderColor === 'borderless' ? 'sans bordure' : null,
          p.fullArt ? 'pleine illustration' : null,
          ...p.frameEffects
        ].filter(Boolean).join(', ') || 'standard'
        console.log(`    ${String(p.priceEur?.toFixed(2) ?? '—').padStart(7)} EUR | style ${String(p.styleScore).padStart(3)} | ${p.setCode.padEnd(5)} ${p.collectorNumber.padEnd(6)} | ${fx} | ${p.artist ?? ''}`)
      }
    }
    console.log('\n============================\n')
  } catch (err) {
    console.error('BANC D’ESSAI EN ECHEC :', err)
  }

  markQuitting()
  app.quit()
}

/** Photographie la fenetre reelle, pont IPC compris, hors du champ de l'ecran. */
async function captureForReview(outFile: string): Promise<void> {
  const { writeFileSync } = await import('node:fs')
  const w = createWindow(false)
  w.setBounds({ x: -6000, y: 0, width: 1440, height: 1200 })
  w.showInactive()
  await new Promise((r) => setTimeout(r, 2500))
  /* Declenche les chargements reseau de la page avant la photo :
   * suggestions et variantes ne se chargent qu'a la demande. */
  for (const label of (process.env['BORIS_SHOT_CLICK'] ?? '').split(',').filter(Boolean)) {
    await w.webContents.executeJavaScript(
      `(() => { const b = [...document.querySelectorAll('button')]
         .find(x => x.textContent && x.textContent.includes(${JSON.stringify(label)}));
         if (b) { b.click(); return true } return false })()`
    )
    await new Promise((r) => setTimeout(r, 9000))
  }

  const anchor = process.env['BORIS_SHOT_ANCHOR']
  if (anchor) {
    await w.webContents.executeJavaScript(
      `document.getElementById(${JSON.stringify(anchor)})?.scrollIntoView()`
    )
    await new Promise((r) => setTimeout(r, 600))
  }

  // Permet de piloter un element precis — un panneau modal ne suit pas
  // le defilement du document.
  const js = process.env['BORIS_SHOT_JS']
  if (js) {
    const out = await w.webContents.executeJavaScript(js)
    console.log('js :', JSON.stringify(out))
    await new Promise((r) => setTimeout(r, 700))
  }

  const extra = Number(process.env['BORIS_SHOT_SCROLL'] ?? 0)
  if (extra) {
    await w.webContents.executeJavaScript(`window.scrollBy(0, ${extra})`)
    await new Promise((r) => setTimeout(r, 700))
  }
  const img = await w.webContents.capturePage()
  writeFileSync(outFile, img.toPNG())
  console.log('capture ecrite :', outFile)
  markQuitting()
  app.quit()
}

/** Diffuse l'etat au renderer et rafraichit le menu de la barre. */
function publish(): void {
  broadcast('core:status-changed', status)
  updateTray(status, trayActions)
}

/* ============================================================
   Actions exposees a la barre de menus
   ============================================================ */

const trayActions = {
  reveal: () => revealWindow(true),
  refresh: (t: TriggerSource) => void runCycle(t),
  setActive: (active: boolean) => {
    status.active = active
    if (active) {
      scheduler.arm(status.settings.intervalMinutes)
      status.nextCycle = scheduler.next
      void runCycle('manual')
    } else {
      scheduler.disarm()
      status.nextCycle = null
      status.severity = 'nominal'
      status.hits = []
    }
    publish()
  },
  updateSettings: (patch: Partial<Settings>) => {
    status.settings = writeSettings(patch)
    if (patch.launchAtLogin !== undefined) applyLaunchAtLogin(patch.launchAtLogin)
    if (patch.intervalMinutes !== undefined && status.active) {
      scheduler.arm(status.settings.intervalMinutes)
      status.nextCycle = scheduler.next
    }
    publish()
  },
  /**
   * Effacement complet, sur confirmation. Irreversible et local : comme
   * rien ne quitte le poste, il n'y a personne d'autre a solliciter.
   */
  purge: () => {
    void (async () => {
      const { dialog } = await import('electron')
      const { response } = await dialog.showMessageBox({
        type: 'warning',
        buttons: ['Annuler', 'Tout effacer'],
        defaultId: 0,
        cancelId: 0,
        title: 'Effacer toutes les donnees',
        message: 'Effacer definitivement toutes les donnees locales ?',
        detail:
          'Profil, identifiants chiffres, historique des cycles, cotations, decks importes et cache de cartes. ' +
          'Cette action est irreversible. Boris redemarrera sur son ecran d’accueil.'
      })
      if (response !== 1) return

      const { purgeAll } = await import('./config')
      purgeAll()
      status.hits = []
      status.severity = 'nominal'
      publish()

      // Rechargement : l'interface doit repartir de l'ecran d'accueil,
      // pas afficher un tableau de bord vide sur des donnees disparues.
      getWindow()?.webContents.reload()
    })()
  },

  quit: () => {
    markQuitting()
    app.quit()
  }
}

/* ============================================================
   Amorcage
   ============================================================ */

/*
 * A placer avant toute chose : le premier acces a userData fige le chemin,
 * et requestSingleInstanceLock() y accede. Sans cet appel en tete, Boris
 * ecrirait sous "Electron/" en developpement et sous "Crimson Boris/" une
 * fois empaquete — deux historiques distincts pour une meme application.
 */
app.setName('Crimson Boris')

/*
 * Boris travaille fenetre fermee : son minuteur ne doit pas etre ralenti
 * parce que l'application n'est pas au premier plan. Sans ce reglage, le
 * cycle regulier derive et le battement de securite se declenche a tort.
 */
app.commandLine.appendSwitch('disable-background-timer-throttling')
app.commandLine.appendSwitch('disable-renderer-backgrounding')

// Une seule instance : deux Boris signifieraient deux cycles concurrents.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => revealWindow(true))

  app.whenReady().then(() => {
    electronApp.setAppUserModelId('fr.crimson.boris')
    applyContentSecurityPolicy()
    app.on('browser-window-created', (_, w) => optimizer.watchWindowShortcuts(w))

    getDb()
    const settings = readSettings()

    // Le mode diagnostic ne doit jamais modifier les reglages du systeme :
    // il s'execute a repetition et inscrirait le binaire de developpement
    // au demarrage de la session.
    if (!process.env['BORIS_SELFTEST']) applyLaunchAtLogin(settings.launchAtLogin)

    status = {
      active: true,
      lastCycle: null,
      nextCycle: null,
      lastTrigger: 'boot',
      lastDurationMs: null,
      severity: 'nominal',
      hits: [],
      modulesFed: 3,
      modulesTotal: 4,
      running: false,
      settings
    }

    scheduler = new Scheduler((t) => void runCycle(t))

    registerIpc()
    createTray(status, trayActions)
    watchPower((trigger) => void runCycle(trigger))

    const hidden = startedHidden()
    if (hidden && process.platform === 'darwin') app.dock?.hide()
    createWindow(!hidden)

    scheduler.arm(settings.intervalMinutes)
    status.nextCycle = scheduler.next
    void runCycle('boot')

    // Verification de version en tache de fond : elle ne doit jamais
    // retarder le premier cycle ni empecher le demarrage.
    void setupUpdates()

    // Clic sur l'icone du Dock : Boris revient, il n'a jamais cesse de tourner.
    app.on('activate', () => revealWindow(true))
  })
}

/**
 * Politique de securite du contenu.
 *
 * Le renderer n'emet aucune requete : tout passe par le process principal.
 * Seules les illustrations Scryfall sont chargees directement par la page,
 * d'ou l'unique origine distante autorisee. En developpement, le serveur
 * Vite et son canal de rechargement doivent etre admis en plus.
 */
function applyContentSecurityPolicy(): void {
  const dev = is.dev && Boolean(process.env['ELECTRON_RENDERER_URL'])
  const devOrigins = dev ? " http://localhost:* ws://localhost:*" : ''

  const policy = [
    "default-src 'self'",
    `script-src 'self'${dev ? " 'unsafe-inline' 'unsafe-eval'" : ''}${devOrigins}`,
    `style-src 'self' 'unsafe-inline'${devOrigins}`,
    "img-src 'self' data: https://cards.scryfall.io",
    `connect-src 'self'${devOrigins}`,
    "font-src 'self' data:",
    "object-src 'none'",
    "frame-src 'none'",
    "base-uri 'none'",
    "form-action 'none'"
  ].join('; ')

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [policy]
      }
    })
  })
}

function registerIpc(): void {
  ipcMain.handle('core:status', () => status)
  ipcMain.handle('core:refresh', async () => {
    await runCycle('manual')
    return status
  })
  ipcMain.handle('core:set-active', (_e, active: boolean) => {
    trayActions.setActive(active)
    return status
  })
  ipcMain.handle('core:update-settings', (_e, patch: Partial<Settings>) => {
    trayActions.updateSettings(patch)
    return status
  })
  ipcMain.handle('tasks:list', () => readTasks())
  ipcMain.handle('tasks:set-done', (_e, id: string, done: boolean) => {
    const next = setTaskDone(id, done)
    // Cloturer une action peut suffire a lever un signal critique.
    const { severity, hits } = evaluate({ trigger: status.lastTrigger, markets })
    status.severity = severity
    status.hits = hits
    publish()
    return next
  })
  ipcMain.handle('markets:get', () => markets)

  registerMtgIpc()
  registerForgeIpc()

  registerConfigIpc()

  ipcMain.handle('version:get', async () => {
    const { currentVersion } = await import('./version')
    return currentVersion()
  })
  ipcMain.handle('version:check', async () => {
    const { checkVersion } = await import('./version')
    return checkVersion()
  })
  ipcMain.handle('version:install', async () => {
    const { installNow } = await import('./updater')
    await installNow()
  })
}

/* ============================================================
   Mises a jour
   ============================================================ */

/**
 * Branche le canal de mise a jour et la surveillance de version.
 * Les deux coexistent : l'un applique, l'autre informe. Sur les
 * plateformes ou l'application ne peut pas se mettre a jour seule, seule
 * la surveillance reste active — et elle le dit.
 */
async function setupUpdates(): Promise<void> {
  const v = await import('./version')
  const { startUpdater, autoUpdateBlocker } = await import('./updater')

  v.onVersionChange((next) => broadcast('version:changed', next))

  const blocker = autoUpdateBlocker()
  v.patchVersion({ autoUpdate: blocker === null, autoUpdateBlocker: blocker })

  // La surveillance par manifeste fonctionne partout, signature ou non.
  void v.checkVersion()

  await startUpdater({
    onChecking: () => v.patchVersion({ state: 'verification' }),
    onAvailable: (version) =>
      v.patchVersion({
        remote: version,
        state: 'telechargement',
        detail: `Version ${version} en cours de recuperation.`
      }),
    onNone: () => v.patchVersion({ state: 'a-jour', detail: null, progress: null }),
    onProgress: (progress) => v.patchVersion({ state: 'telechargement', progress }),
    onReady: (version) =>
      v.patchVersion({
        remote: version,
        state: 'prete',
        progress: null,
        detail: `Version ${version} prete. Elle s'appliquera au redemarrage.`
      }),
    onError: (message) =>
      v.patchVersion({ state: 'hors-ligne', progress: null, detail: message })
  })
}

/* ============================================================
   Configuration
   ============================================================ */

function registerConfigIpc(): void {
  ipcMain.handle('config:get', async () => (await import('./config')).readConfig())

  ipcMain.handle('config:profile', async (_e, patch: Partial<OperatorProfile>) => {
    const c = await import('./config')
    c.writeProfile(patch)
    return c.readConfig()
  })

  /*
   * Ecriture seule. Il n'existe volontairement AUCUN canal de lecture
   * d'un secret vers le renderer : ce qui ne traverse pas le pont ne peut
   * pas fuir par une capture d'ecran ou un rapport d'erreur.
   */
  ipcMain.handle('config:secret', async (_e, id: ConnectorId, key: string, value: string) => {
    const c = await import('./config')
    c.setSecret(id, key, value)
    return c.readConfig()
  })

  ipcMain.handle('config:clear', async (_e, id: ConnectorId) => {
    const c = await import('./config')
    c.clearConnector(id)
    return c.readConfig()
  })

  ipcMain.handle('config:skip', async (_e, id: ConnectorId) => {
    const c = await import('./config')
    c.skipConnector(id)
    return c.readConfig()
  })

  ipcMain.handle('config:complete', async () => (await import('./config')).completeOnboarding())

  ipcMain.handle('config:purge', async () => {
    const c = await import('./config')
    c.purgeAll()
  })
}

/* ============================================================
   Forge — atelier de composition
   ============================================================ */

function registerForgeIpc(): void {
  const load = async () => {
    const { currentDeck, lastRun } = await import('./mtg')
    return { deck: currentDeck(), run: lastRun() }
  }

  ipcMain.handle('forge:workbench', async () => {
    const { snapshot } = await import('./forge/workbench')
    const { deck } = await load()
    return snapshot(deck)
  })

  ipcMain.handle('forge:advise', async () => {
    const { advise } = await import('./forge/recommend')
    const { deck, run } = await load()
    return deck ? advise(deck, run) : []
  })

  ipcMain.handle('forge:search', async (_e, query: PoolQuery) => {
    const { searchPool } = await import('./forge/workbench')
    const { deck } = await load()
    return searchPool(query, deck)
  })

  ipcMain.handle('forge:plan', async (_e, text: string) => {
    const { planDirectives } = await import('./forge/workbench')
    const { deck, run } = await load()
    if (!deck) throw new Error('Aucun deck importe : la forge n’a rien sur quoi travailler.')
    return planDirectives(text, { deck, run })
  })

  ipcMain.handle('forge:add', async (_e, change: Omit<Change, 'id'>) => {
    const { addChange, snapshot } = await import('./forge/workbench')
    addChange(change)
    const { deck } = await load()
    return snapshot(deck)
  })

  ipcMain.handle('forge:drop', async (_e, id: string) => {
    const { dropChange, snapshot } = await import('./forge/workbench')
    dropChange(id)
    const { deck } = await load()
    return snapshot(deck)
  })

  ipcMain.handle('forge:clear', async () => {
    const { clearChanges, snapshot } = await import('./forge/workbench')
    clearChanges()
    const { deck } = await load()
    return snapshot(deck)
  })

  ipcMain.handle('forge:export', async () => {
    const { exportPlan } = await import('./forge/workbench')
    const { ensureDecksDir } = await import('./mtg')
    const { deck } = await load()
    if (!deck) throw new Error('Aucun deck importe.')
    return exportPlan(deck, await ensureDecksDir())
  })
}

/* ============================================================
   Arsenal ludique
   ============================================================ */

/** Suggestions et variantes sont couteuses en reseau : on les garde
 *  en memoire pour la campagne en cours. */
let suggestionCache: { runAt: string; data: Record<string, Suggestion[]> } | null = null
let styleCache: { key: string; data: StyleFind[] } | null = null

function registerMtgIpc(): void {
  ipcMain.handle('mtg:deck', async () => {
    const { currentDeck } = await import('./mtg')
    return currentDeck()
  })

  ipcMain.handle('mtg:decks-dir', async () => {
    const { ensureDecksDir } = await import('./mtg')
    return ensureDecksDir()
  })

  ipcMain.handle('mtg:import-folder', async () => {
    const { importFromFolder } = await import('./mtg')
    suggestionCache = null
    styleCache = null
    return importFromFolder()
  })

  ipcMain.handle('mtg:import-dialog', async () => {
    const { dialog } = await import('electron')
    const { importFromFile, decksDir } = await import('./mtg')
    const res = await dialog.showOpenDialog({
      title: 'Importer une liste de cartes',
      defaultPath: decksDir(),
      properties: ['openFile'],
      filters: [{ name: 'Listes de cartes', extensions: ['txt', 'dec'] }]
    })
    if (res.canceled || res.filePaths.length === 0) return null
    suggestionCache = null
    styleCache = null
    return importFromFile(res.filePaths[0])
  })

  ipcMain.handle('mtg:last-run', async () => {
    const { lastRun } = await import('./mtg')
    return lastRun()
  })

  ipcMain.handle('mtg:run-sim', async (_e, config: Partial<SimConfig>) => {
    const { runSimulation } = await import('./mtg')
    const run = runSimulation(config)
    suggestionCache = null
    return run
  })

  ipcMain.handle('mtg:suggestions', async () => {
    const { lastRun, currentDeck } = await import('./mtg')
    const run = lastRun()
    const deck = currentDeck()
    if (!run || !deck) return {}
    if (suggestionCache?.runAt === run.runAt) return suggestionCache.data

    const { suggestFor } = await import('./suggest')
    const actionable = run.findings.filter((f) => f.grade !== 'nominal')
    const map = await suggestFor(actionable, deck, { perFinding: 6 })
    const data = Object.fromEntries(map) as Record<string, Suggestion[]>
    suggestionCache = { runAt: run.runAt, data }
    return data
  })

  ipcMain.handle('mtg:style', async (_e, names?: string[]) => {
    const { currentDeck } = await import('./mtg')
    const { styleUpgrades, styleCandidatesFrom } = await import('./suggest')
    const deck = currentDeck()
    if (!deck) return []

    const targets = names?.length ? names : styleCandidatesFrom(deck, 10)
    const key = targets.join('|')
    if (styleCache?.key === key) return styleCache.data

    const data = await styleUpgrades(targets, { maxPriceEur: 6 })
    styleCache = { key, data }
    return data
  })
}

// Boris survit a la fermeture de sa fenetre : c'est tout l'objet de la v2.
app.on('window-all-closed', () => {
  /* volontairement vide */
})

app.on('before-quit', () => {
  markQuitting()
  scheduler?.disarm()
  stopWatchingPower()
  destroyTray()
  closeDb()
})
