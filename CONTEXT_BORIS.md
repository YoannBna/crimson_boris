# CONTEXT BORIS — point de restauration

> **À quoi sert ce fichier.** Il contient tout ce qu'il faut savoir pour reprendre
> le développement de Crimson Boris sans aucun autre contexte. Après un `/clear`,
> sa lecture seule doit suffire.
>
> **Règle de maintenance (permanente).** Ce fichier est mis à jour *avant de
> conclure* toute intervention qui : livre une fonctionnalité, apporte une
> spécification, ouvre un sous-projet, ou change l'architecture. Il doit toujours
> refléter l'état exact du projet, l'arborescence, ce qui est validé, les
> demandes en cours et les priorités suivantes.

**Dernière mise à jour :** 2026-08-30
**Version publiée :** 2.1.1 · **Commit :** `6219490` · **Branche :** `main`
**Dépôt :** https://github.com/YoannBna/crimson_boris
**Opérateur :** Yoann — échanges en français, réponses en français.

---

## 1 · CE QU'EST BORIS

Assistant personnel de bureau, **local et privé**, qui tourne en tâche de fond
depuis la barre de menus et se manifeste quand quelque chose le mérite. Deux
domaines :

- **Opti** — marchés financiers, veille, courrier, actions, asymétries.
- **Forge** — Magic: The Gathering : analyse de deck, simulation, construction,
  illustrations.

Trois principes tenus dans tout le code :

1. **Aucune donnée ne quitte la machine.** Réglages en clair dans SQLite local,
   secrets chiffrés par le trousseau système. Rien n'est collecté ni transmis.
2. **Boris n'invente jamais de contenu.** Sans connecteur configuré, un module
   annonce ce qui manque plutôt que d'afficher un faux contenu.
3. **Il ne s'impose qu'à bon escient.** Une condition durable ne redéclenche pas
   une révélation à chaque cycle (empreinte + délai de repos).

---

## 2 · ARCHITECTURE TECHNIQUE

### 2.1 Stack

| Brique | Version | Choix |
|---|---|---|
| Electron | ^43.4.1 | process de fond + `powerMonitor` + `safeStorage` |
| React | ^19.2.8 | renderer |
| TypeScript | ^7.0.2 | strict ; `baseUrl` supprimé en TS 6 → chemins relatifs dans `paths` |
| electron-vite | ^5.0.0 | build des trois cibles |
| Vite | **^7** | **ne pas passer en 8** : incompatible avec electron-vite 5 |
| @vitejs/plugin-react | ^5.2.0 | idem, pinné |
| better-sqlite3 | ^13.0.3 | **prebuilds N-API** (ABI stable) → `npmRebuild: false` permet la compilation Windows croisée depuis macOS |
| electron-updater | ^6.8.9 | mise à jour **manuelle** (`autoDownload = false`) |
| electron-builder | ^26.15.3 | dmg macOS arm64 · NSIS Windows x64 + arm64 |

### 2.2 Les trois process

```
src/main/       process principal — Node complet, seul à toucher réseau et disque
src/preload/    pont contextBridge, typé, exposé sous window.boris
src/renderer/   React ; aucune requête réseau sortante (CSP)
src/shared/     contrat de types partagé main ↔ renderer
```

**CSP du renderer** (`src/main/index.ts`) : `default-src 'self'`,
`connect-src 'self'`, `img-src 'self' data: https://cards.scryfall.io`
— la seule origine distante autorisée, pour les illustrations Scryfall.

### 2.3 Pont IPC — canaux exposés

```
core:      status · refresh · set-active · update-settings
tasks:     list · set-done
markets:   get
version:   get · check · download · install · open-releases
config:    get · profile · secret · clear · skip · complete · purge
forge:     workbench · advise · search · plan · add · drop · clear
           apply · history · revert · export
mtg:       deck · decks-dir · import-folder · import-dialog · last-run
           run-sim · suggestions · style · printings · arts · choose-art · clear-art
```

**`config:secret` est en écriture seule.** Aucun canal ne permet de *lire* un
secret depuis le renderer : l'interface sait qu'un identifiant existe, jamais ce
qu'il vaut. Cette propriété est structurelle, ne pas l'affaiblir.

### 2.4 Chiffrement — `safeStorage`

`src/main/config.ts`. Trousseau macOS / DPAPI Windows.
**Si le coffre est indisponible, Boris REFUSE d'enregistrer un secret** plutôt
que de l'écrire en clair, et le dit dans l'interface. `maskAccount()` renvoie
`n•••••@domaine`.

### 2.5 Base locale — SQLite (`userData/boris.db`, WAL)

| Table | Contenu |
|---|---|
| `settings` | réglages en clair |
| `tasks` | état des actions |
| `cycles` | journal des cycles + `fingerprint` (anti-harcèlement) |
| `quotes` | cotations horodatées |
| `cards` | cache Scryfall (leur politique l'exige) |
| `decks` | **pile de versions append-only** du deck |
| `sim_runs` | campagnes de simulation |
| `card_arts` | illustration retenue par carte — **hors du deck, volontairement** |

Migrations additives dans `migrate()` de `db.ts`.

### 2.6 Détection de réveil — `src/main/power.ts`

Événements `resume`, `unlock-screen`, `user-did-become-active`, plus un
battement de fond détectant les sauts d'horloge.
**`JUMP_TOLERANCE_MS = 600_000`** — 90 s avait produit 176 faux positifs en
trois jours d'usage réel (throttling des minuteurs macOS en arrière-plan).
Confirmé par `powerMonitor.getSystemIdleTime()`. **Ne pas rabaisser.**

### 2.7 Gravité — `src/main/severity.ts`

Quatre règles : `task-overdue`, `market-shock`, `deadline-shift`, `first-wake`.
Un seuil **franchi pendant le cycle** est critique ; un seuil **déjà franchi au
démarrage** est en surveillance seulement. (Il n'y a pas de cinquième règle.)

### 2.8 Canvas HTML5

- **Avatar** (`components/BorisAvatar.tsx`) — Canvas 2D, 190 particules, orbite
  elliptique (`* 0.62` d'écrasement vertical), onde de choc par
  `CustomEvent('boris:pulse')`. Halo à `size * 0.78` : doit dépasser la
  demi-diagonale 0,707, sinon un rectangle apparaît dans les coins.
  Toute l'animation vit dans un `ref` — passer par l'état React ferait soixante
  réconciliations par seconde.
- **Enseigne de la Forge** (`forge/ForgeLogo.tsx`) — trois calques : canvas de
  flammes **derrière**, enclume et marteau en SVG, canvas d'étincelles
  **devant**. Un calque unique aurait imposé de choisir.
- **Fond** (`components/Aura.tsx` + `.aura` dans `jarvis.css`) — trois nappes en
  dérive lente, **en CSS et non en canvas** : le fond ne doit rien coûter,
  l'avatar a besoin de toute la marge de rendu.

### 2.9 Publication

`.github/workflows/release.yml` — sur push `main` touchant au code
(`paths-ignore` : `**.md`, `.github/**`, `.gitignore`) :

1. job `version` — `npm version patch`, commit `[skip ci]`, **tag annoté**,
   push, puis **ouverture idempotente de la release**.
2. job `build` (matrice macos-14 + windows-latest, `fail-fast: false`) —
   checkout du tag, `npm ci`, `electron-builder --publish always`.

**macOS n'est pas signé** (pas de certificat Apple Developer ID) : la mise à
jour en place est impossible, le bouton ouvre la page des versions.

---

## 3 · ÉTAT ACTUEL DU CODE

### 3.1 Arborescence

```
CONTEXT_BORIS.md          ce fichier
README.md                 documentation publique
electron-builder.yml      npmRebuild: false (cross-build Windows)
electron.vite.config.ts · vite.web.config.ts
tsconfig{,.node,.web}.json
.github/workflows/release.yml
scripts/screenshot.cjs

src/shared/               CONTRAT PARTAGÉ
  types.ts                CoreStatus · MarketQuote · Settings · BorisAPI · MtgAPI
  config.ts               AppConfig · OperatorProfile · ConnectorStatus · CONNECTOR_FIELDS
  mtg.ts                  Card · ResolvedDeck · SimResult · Printing · ChosenArt
  forge.ts                Change · Workbench · Directive · Advice · DeckVersion
  tasks.ts · thresholds.ts · version.ts

src/main/                 PROCESS PRINCIPAL
  index.ts                orchestration, IPC, modes diagnostic
  window.ts               fenêtre + CSP + drapeau BORIS_LEGACY
  tray.ts · trayIcon.ts   barre de menus
  scheduler.ts            minuteur de cycle
  power.ts                détection de réveil
  severity.ts             quatre règles de gravité
  config.ts               profil + secrets (safeStorage)
  version.ts · updater.ts canal de mise à jour manuel
  mtg.ts · suggest.ts     deck courant, suggestions, variantes graphiques
  selftest.ts             suite de vérification (41 épreuves)
  store/                  db · settings · tasks · journal · cards · decks · arts
  providers/              http (file d'attente) · markets · scryfall
  deck/                   parse (Archidekt/Moxfield/.dec) · resolve
  sim/                    engine · mana · rng · analyze
  forge/                  workbench · directives · execute · recommend

src/preload/index.ts      pont contextBridge

src/renderer/src/
  main.tsx                monte JarvisShell par défaut, App si ?legacy
  JarvisShell.tsx         COQUILLE ACTUELLE — 3 profondeurs, barre haute
  App.tsx                 ancienne interface (?legacy), conservée temporairement
  Onboarding.tsx · Settings.tsx   accueil et réglages de l'ancienne interface

  nav/
    map.ts                MODES, angles choisis à la main, nodePosition()
    Constellation.tsx     liens SVG + nœuds ; même composant au premier plan et réduit

  forge/                  MODE FORGE
    ForgeWorkspace.tsx    monté dès le choix du mode ; état survit aux allers-retours
    DeckColonne.tsx       stats, courbe, groupes, survol, clic → inspection
    lecture.ts            ranger() · statistiques() · forces() · agreger()
    VoletAnalyse.tsx      forces et défauts, SANS proposition
    VoletSimulation.tsx   campagne + 8 agrégats + courbe des terrains
    VoletConstruction.tsx 4 sources + établi ancré en bas
    VoletArts.tsx         file d'illustrations économiques, une carte à la fois
    Inspecteur.tsx        carte à gauche, toutes les impressions à droite
    PileVersions.tsx      pile des versions du deck
    ForgeLogo.tsx         enclume, marteau, feu, runes ; frapperLaForge()
    Mana.tsx · Pinceau.tsx

  opti/                   MODE OPTI
    OptiVolet.tsx         coquille + Veille + Courrier + Actions
    Marches.tsx           cotations + seuils + écart au cours
    Asymetries.tsx        dix positions, thèse dépliable

  shell/                  CHROME PERMANENT
    Porte.tsx             porte d'entrée (onboarding)
    Profil.tsx            profil & paramètres
    Version.tsx           pastille de version + modale de mise à jour
    EtatCycle.tsx         relance manuelle + gravité + signaux

  components/             Aura · BorisAvatar · ConnectorFields · UpdateModal
                          SyncBadge · primitives · DistBars · LiveQuotes · CopyBlock
  lib/                    useBoris · useConfig · useMtg · useForge · useArts
  data/                   asymmetries · markets · mail · deck
  modules/                M01…M04 + sous-panneaux (ancienne interface)
  styles/
    tokens.css · base.css · modules.css      ancienne interface
    jarvis.css · forge.css · shell.css       coquille actuelle
```

### 3.2 Fonctionnalités validées

**Noyau** — cycle planifié (30 min par défaut) et déclenché par réveil,
déverrouillage, retour opérateur, saut d'horloge ; barre de menus ; révélation
conditionnelle avec empreinte et délai de repos (4 h) ; journal des cycles.

**Opti** — cotations en direct (Yahoo Finance, isolé dans un seul module) ;
cinq seuils de choc avec écart au cours ; dix asymétries avec thèse ; veille RSS
déclarative ; état du connecteur courrier + trois modèles de réponse ; actions
et signaux.

**Forge** — import Archidekt / Moxfield / `.dec` ; résolution Scryfall avec
cache ; classement par **catégories Archidekt** (repli sur rôles déduits) ;
statistiques et courbe de mana ; analyse statique (7 constats) ; simulation
(goldfishing déterministe, zone de commandement, taxe +2 par relance) ;
directives écrites ; recherche dans le pool ; établi + application au deck ;
pile de versions ; inspection des cartes et illustrations alternatives.

**Coquille** — porte d'entrée, profil persistant, version et mise à jour
interactive, relance manuelle, état du noyau.

**Distribution** — installeurs macOS (`.dmg` arm64) et Windows (`.exe` NSIS
x64 + arm64) publiés automatiquement sur GitHub Releases.

### 3.3 Suite de vérification — **41 réussies, 0 échouées**

```bash
npm run build && BORIS_TESTS=1 npx electron out/main/index.js --hidden
BORIS_TESTS=hors-ligne  # saute les épreuves réseau
```

Douze groupes : Parseur d'exports · Solveur de mana · Générateur · Classement ·
Directives · Versions · Persistance · Gravité · Forge—établi · Forge—arts ·
Simulation · Réseau.

Elle tourne **dans l'application réelle** — SQLite, trousseau, réseau compris —
parce que c'est là que les défauts se logent : les trois bugs les plus coûteux
du projet ont tous passé la compilation sans broncher.
Les épreuves qui écrivent des decks **posent un repère et rendent la pile
intacte** (une épreuve dédiée le vérifie) : sans cela un deck d'essai de dix
cartes restait en tête de pile à la place de la liste de l'opérateur.

### 3.4 Modes diagnostic (process principal)

```
BORIS_TESTS=1          suite de vérification
BORIS_SELFTEST=1       rapport d'état ; REQUIS pour les captures
BORIS_SHOT=<png>       capture de la fenêtre réelle, hors champ
BORIS_SHOT_JS=<js>     pilote la page avant la capture (async accepté)
BORIS_SHOT_CLICK · BORIS_SHOT_SCROLL · BORIS_SHOT_ANCHOR
BORIS_MTG_TEST=<file>  banc d'essai deck
BORIS_FORGE_TEST=<txt> banc d'essai directives
BORIS_LEGACY=1         rouvre l'ancienne interface
BORIS_UPDATE_URL       manifeste de mise à jour
```

---

## 4 · CAHIER DES CHARGES DE LA REFONTE (texte de référence)

Environnement fluide, animé, organique, d'inspiration Jarvis, à formes
octogonales aux angles légèrement arrondis.

### 4.1 Avatar
Canvas 2D ou WebGL léger, 60 i/s. Sphère d'énergie centrale entourée d'un
système de particules fluides en mouvement circulaire, lueur radiale du violet
profond vers l'orange brûlé et le blanc au centre.
Au démarrage ou en sortie de veille : apparition centrale + message cordial
(« Bonjour », « Je me suis assoupi »).
États : **repos** oscillation lente du rayon · **survol** rotation accélérée,
intensification, léger agrandissement · **activation** onde de choc lumineuse
puis déplacement fluide vers le haut au centre.

### 4.2 Logo et enclume de la Forge
Formes SVG vectorielles (enclume + marteau) superposées à un calque Canvas pour
flammes et étincelles. Générateur de particules ascendantes sous l'enclume,
taille et transparence aléatoires. Opacité pulsante sur les runes gravées
autour du logo. Lors d'une action dans la Forge : lueur jaune incandescente et
projection d'étincelles radiales.

### 4.3 Architecture graphique globale
Fond animé sombre oscillant entre noir, mauve et orange brûlé. Tous les boutons
et interfaces portent des calques animés avec de légères vagues sur leurs
bordures démarcatives. Textes fixes en **blanc pur**, contraste parfait sans
fatigue oculaire.

### 4.4 Navigation spatiale en constellations
Choix initial entre **Opti** (finances, mail, productivité) et **Forge**
(Magic). Chaque mode présente ses sous-catégories en constellation où tout
s'affiche simultanément en miniature. Un clic étend une sous-catégorie sur tout
l'écran ; la constellation d'origine reste visible en arrière-plan en format
très réduit. Bouton flottant à flèches ou clic dans le vide pour remonter.

### 4.5 Mode Forge et gestion du deck
Statistiques du deck et visualisation des cartes **triées par catégories
d'après Archidekt**. Panneau latéral droit à trois modes :
- **Analyse** — forces et défauts à l'instant présent, *sans propositions*
- **Simulation** — module statistique de scénarios virtuels
- **Construction** — suggestions automatiques ou requêtes manuelles

Toute modification validée enregistre une nouvelle version dans la **pile
d'historique**, permettant de revenir librement en arrière ou en avant.

### 4.6 Inspection des cartes et suggestions d'arts
Au survol d'une carte dans la pile, elle **sort complètement de son paquet**.
Au clic : vue d'inspection au premier plan, carte centrée à gauche, panneau à
droite répertoriant **toutes** les versions alternatives et arts avec leurs
prix du marché. Sélectionner un art alternatif applique un **petit badge en
forme de tête de pinceau orange pâle** sur la carte, visible en grand comme en
miniature au survol. Le module de suggestions d'arts économiques du mode
Construction propose des illustrations alternatives bon marché ; à la
validation l'art s'applique au deck, le badge s'affiche, et la suggestion
validée laisse la place à la suivante.

### 4.7 Palette (`styles/jarvis.css`)

```
--void #08070A   --void-2 #0E0B12   --mauve-deep #1B0F26
--mauve #3A1B52  --mauve-lit #6B2D8E --violet #8B45C7
--burnt #A33B0C  --ember-2 #E8590C  --ember-lit #FF8A3D  --gold-heat #FFC163
--blood-2 #C81E2D
--pure #FFFFFF   --pure-soft .72     --pure-faint .42     --pure-ghost .16
--octo / --octo-s / --octo-l   clip-path octogonaux (--cut 10 / 6 / 18 px)
```

---

## 5 · ÉTAT DE LIVRAISON DE LA REFONTE

| § | Sujet | État |
|---|---|---|
| 4.1 | Avatar | **livré** — Canvas 2D, 190 particules, 3 états, salutation |
| 4.2 | Enseigne de la Forge | **livré** — 3 calques, runes pulsantes, frappe sur action |
| 4.3 | Architecture graphique | **livré** — aura CSS, bordures en vague, blanc pur |
| 4.4 | Constellations | **livré** — 3 profondeurs, retour par vide / flèche / Échap |
| 4.5 | Mode Forge | **livré** — deck, 3 volets, pile de versions |
| 4.6 | Inspection et arts | **livré** — survol, inspection, badge pinceau, file d'arts |
| — | Porte, profil, version | **livré** |
| — | Bascule | **faite** — la coquille est l'interface par défaut |

**L'ancienne interface reste atteignable par `?legacy` / `BORIS_LEGACY=1`.**
Elle sera retirée quand la coquille aura tourné quelques versions sans manque.

---

## 6 · DÉCISIONS DE CONCEPTION À NE PAS DÉFAIRE

- **`app.setName('Crimson Boris')` avant `requestSingleInstanceLock()`** — le
  premier accès à `userData` fige le chemin.
- **Bordure octogonale** : le conteneur porte le dégradé, un pseudo-élément
  `inset: 1px` porte le fond sombre. Un `clip-path` crée un contexte
  d'empilement où un enfant en z-index négatif passe *entre* le fond du parent
  et le contenu.
- **`clip-path` rogne même les descendants `position: fixed`** → l'aperçu au
  survol et l'inspecteur sont rendus par portail dans `document.body`.
- **`base.css` habille tout `<header>` et tout `<section>`** (ancienne
  interface) : les en-têtes de la coquille remettent à zéro dans `forge.css`,
  les volets posent `margin: 0`.
- **`ConnectorFields` et `UpdateModal` ne sont jamais dupliqués.** Le premier
  est le seul endroit du projet où un secret est saisi ; le second porte la
  règle qui décide de ce qui s'affiche selon la plateforme. Ils sont rhabillés
  par `.jv-skin`, pas recopiés.
- **L'art est rangé hors du deck** (`card_arts`) : un deck enregistré est un
  instantané, revenir en arrière ne doit pas défaire un choix graphique.
  L'art passe dans l'export sous la forme `(SET) numéro`.
- **La pile de versions est append-only.** Charger une version la recopie en
  tête : rien n'est effacé, donc tout est à un clic dans les deux sens — d'où
  l'absence de flèches précédent/suivant.
- **Analyse ne propose rien.** Les remèdes appartiennent à Construction :
  mélanger diagnostic et ordonnance pousse à corriger avant d'avoir lu.
- **L'établi reste ancré en bas de Construction**, quelle que soit la source :
  c'est lui qui porte le compte du format.
- **Les angles de la constellation sont choisis à la main.** Une répartition
  régulière ressemble à un cadran, pas à un ciel. Le secteur du haut reste
  libre : l'avatar s'y ancre.
- **Échap est en phase de capture dans l'inspecteur et le profil** : sinon
  fermer une carte ferait aussi quitter la Forge.
- **Vérifier dans l'application empaquetée, pas seulement compiler.**

---

## 7 · DÉFAUTS CORRIGÉS — MÉMOIRE DES PIÈGES

**Application**
- `autoUpdater` indéfini en bundle CommonJS → tout le canal de mise à jour était
  inerte. Corrigé par un helper `updater()` qui essaie `mod.autoUpdater` puis
  `mod.default?.autoUpdater`.
- Ratio de terrains engagés calculé sur les **noms dédupliqués** : 53 % au lieu
  de 22 %.
- Valider un plan n'écrivait qu'un fichier d'export : le deck chargé ne changeait
  pas. `applyPlan()` crée désormais une version et la charge.
- Pas de zone de commandement en simulation → Edgar lancé 0 % du temps ;
  aujourd'hui 88,3 % avec la taxe de +2 par relance.
- `draw ` vs `draws `, `*F*` foil, textes oracle vides sur cartes multi-faces,
  diacritiques et faces arrière non résolues — tous corrigés.
- Les épreuves écrivaient de faux decks dans la vraie base et laissaient une
  liste de dix cartes en tête de pile.

**Interface**
- Panneaux de la Forge invisibles sans deck (conditionnés sur `hasBridge && deck`).
- Salutation jamais affichée (état React redondant perdu au remontage).
- Établi poussé sous la ligne de flottaison par un conteneur qui défilait.
- Bandeau rouge de `base.css` hérité sur tous les en-têtes de la coquille.
- Impressions sans cote placées en tête d'une liste annoncée croissante.
- Pastille des connecteurs rognée par le `clip-path` du bouton.

**Publication**
- **Tag léger** : `git push --follow-tags` ne pousse que les tags *annotés*. Le
  commit de bump partait seul, les compilations cherchaient un `ref` inexistant.
- **Course à la création de la release** : les deux jobs tentaient chacun de la
  créer, le perdant recevait `already_exists` et mourait, laissant la version
  amputée d'une plateforme.
- `asar extract-file` avait pollué la racine du dépôt et un `git add -A` avait
  committé un identifiant de deck. `.gitignore` durci.
- `gh run watch --exit-status` peut sortir en 0 sur un run échoué : **lire le
  statut du run et la liste des assets**, jamais le code de sortie seul.

---

## 8 · PROCHAINES ÉTAPES

### 8.1 Retouches visuelles annoncées par l'opérateur
L'état actuel lui convient dans l'ensemble ; il souhaite retravailler
l'interface plus tard. Deux points déjà identifiés :

1. **L'aperçu au survol recouvre le volet de droite** dans la Forge. Il sort
   par le bord droit de la colonne du deck et empiète sur les volets.
2. **Les volets Opti à une seule colonne laissent beaucoup de blanc** sur grand
   écran (`.opti-panneau` plafonne à 1080 px centrés).

### 8.2 Dette assumée
3. **Retirer l'ancienne interface** (`App.tsx`, `Onboarding.tsx`,
   `Settings.tsx`, `modules/`, `base.css`, `modules.css`, `tokens.css`,
   drapeau `?legacy`) quand la coquille aura fait ses preuves.
4. **Éprouver le workflow corrigé** au prochain vrai changement de code :
   vérifier les trois jobs verts et les six paquets.

### 8.3 Non commencé
5. Aucun nouveau sous-projet n'est ouvert. Les demandes futures viendront de
   l'opérateur ; les inscrire ici dès leur formulation.

---

## 9 · COMMANDES

```bash
npm run dev                      # développement
npm run build                    # compile les trois cibles
npm run typecheck                # tsc sur node + web
npm run dist:mac                 # .dmg arm64
npm run dist:win                 # .exe x64 + arm64

npm run build && BORIS_TESTS=1 npx electron out/main/index.js --hidden

BORIS_SELFTEST=1 BORIS_SHOT=/tmp/x.png \
  BORIS_SHOT_JS='(async()=>{ /* pilotage */ })()' \
  npx electron out/main/index.js --hidden

BORIS_LEGACY=1 npx electron out/main/index.js   # ancienne interface
```

**Publication :** pousser sur `main` suffit. Ne jamais pousser sans demande
explicite de l'opérateur — un push publie une version.
