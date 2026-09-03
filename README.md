# CRIMSON BORIS — v2.0

Noyau analytique & executif. Application de bureau autonome (macOS, Apple Silicon).

## Stack

| Couche | Choix |
|---|---|
| Coquille | Electron 43 |
| Interface | React 19 + TypeScript |
| Build | electron-vite 5 / Vite 7 |
| Persistance | better-sqlite3 (prebuild N-API, aucun rebuild requis) |
| Empaquetage | electron-builder |

## Confidentialite

Boris est une application **locale**. Il n'a pas de serveur, pas de compte, pas
de telemetrie. Rien de ce que tu saisis ne part ailleurs que sur ton disque.

| Donnee | Ou elle vit | Chiffree |
|---|---|---|
| Profil, tickers, flux | `boris.db`, table `config` | non — ne revele rien |
| Identifiants de connecteurs | `boris.db`, table `secrets` | **oui**, trousseau du systeme |
| Historique, cache, decks | `boris.db` | non |

Le chiffrement s'appuie sur `safeStorage` : **Keychain** sur macOS, **DPAPI** sur
Windows. La cle appartient a la session de l'utilisateur — un fichier de base
copie hors de cette session est illisible. Si le trousseau est indisponible,
Boris **refuse d'ecrire un secret** plutot que de le poser en clair.

Aucun canal IPC ne permet de LIRE un secret depuis l'interface : elle n'apprend
que son existence. Ce qui ne traverse pas le pont ne peut pas fuir par une
capture d'ecran ou un rapport d'erreur.

### Effacement

Le menu de la barre de menus efface toutes les donnees locales — profil,
identifiants, historique, cache. Comme rien ne quitte le poste, il n'y a
personne d'autre a solliciter.

### Ce qui sort quand meme du poste

Trois appels reseau, tous vers des services publics, aucun ne transportant de
donnee personnelle :

- **Yahoo Finance** — cotations. Les symboles suivis, rien d'autre.
- **Scryfall** — cartes et prix. Les noms de cartes cherches.
- **Depot de mises a jour** — un numero de version.

Le `User-Agent` ne contient aucune adresse ni identifiant.

## Premier lancement

Au demarrage initial, Boris **barre le tableau de bord** et affiche l'ecran
d'accueil : nom affiche, puis trois connecteurs — courrier, flux financiers,
Archidekt. Chacun peut etre renseigne ou ecarte ; Boris fonctionne sans aucun
d'eux, en degrade, et le dit dans chaque module concerne.

Les modules ne fabriquent jamais de contenu : sans connecteur, ils annoncent
leur etat au lieu d'afficher une actualite ou un courrier qui ne serait celui
de personne.

## Synchronisation et version

Boris surveille sa propre version et se met a jour **au lancement**, jamais
pendant qu'il tourne : remplacer son binaire en cours d'execution est le
meilleur moyen de le corrompre.

### Mise a jour — manuelle et interactive

Boris **verifie** au demarrage mais ne telecharge rien de lui-meme :
`autoDownload` est desactive. Cent trente megaoctets tires sur la connexion de
quelqu'un sans son accord, ce n'est pas une decision qui revient a une
application.

Le numero de version, en bas a droite, dit l'etat d'un coup d'oeil :

| Couleur | Etat |
|---|---|
| **vert** | derniere version |
| **braise** | une version plus recente existe |
| gris | verification, depot injoignable, ou aucun depot declare |

Un clic sur l'indicateur braise ouvre un panneau qui affiche les **notes de
version** publiees, puis propose d'agir. Les notes arrivent en texte brut :
GitHub renvoie du HTML, converti dans le process principal et rendu dans un
`<pre>`. Du contenu distant n'est jamais interprete comme du balisage.

**Windows** — le bouton telecharge (`downloadUpdate()`), affiche une barre de
progression braise, puis redemarre et installe (`quitAndInstall()`).

**macOS** — Squirrel verifie la signature du paquet avant de l'appliquer. Sans
certificat Apple Developer ID, `quitAndInstall()` echoue **apres** avoir
telecharge : l'operateur attend, puis rien. Le bouton ouvre donc la page des
versions dans le navigateur, pour recuperer le `.dmg` a la main. Le panneau
l'explique au lieu de le subir.

L'adresse de cette page est **construite a la compilation** depuis
`electron-builder.yml`, jamais reprise d'une reponse du serveur :
`shell.openExternal` ouvre ce qu'on lui donne, et une URL venue du reseau y
serait une porte d'entree.

Les cinq canaux IPC de mise a jour n'acceptent **aucun parametre** du renderer :
l'interface declenche, elle ne dicte pas.

### Publication automatique

Une poussee sur `main` touchant au code suffit : le workflow
`.github/workflows/release.yml` incremente le numero de correctif, pose le tag,
compile sur un runner macOS et un runner Windows, et publie la version avec ses
deux installeurs.

```
poussee sur main
   └─ job « version »  : npm version patch, commit « [skip ci] », tag, push
   └─ job « build »    : macos-14 + windows-latest, electron-builder --publish
```

Le commit de version porte `[skip ci]` : sans ce marqueur, il se redeclencherait
lui-meme indefiniment. Les poussees ne touchant que la documentation, le
`.gitignore` ou le workflow ne publient rien — retirer le bloc `paths-ignore`
pour publier a chaque poussee quelle qu'elle soit.

`fail-fast: false` : si une plateforme echoue, l'autre publie quand meme. Mieux
vaut une version disponible sur un seul systeme que pas de version du tout.

Pour publier a la main, sans passer par le depot :

```
npm run release      # compile, empaquette macOS + Windows, publie la release
```

### Scripts de demarrage

```
scripts/launch/boris.command   macOS  — double-clic depuis le Finder
scripts/launch/boris.bat       Windows — double-clic
```

Chacun enchaine, en silence :

1. `git fetch` sur le depot distant, puis avance rapide si une version plus
   recente existe. Les modifications locales sont **mises de cote** (`git stash`),
   jamais perdues.
2. Recompilation, si le source a bouge ou si aucune compilation n'existe.
3. Demarrage : application installee, sinon application compilee, sinon
   demarrage direct depuis `out/`.

**Un echec de mise a jour n'empeche jamais le demarrage.** Depot injoignable,
compilation en erreur, git absent : Boris demarre sur sa version locale. Un
tableau de bord un peu ancien vaut mieux qu'un tableau de bord absent. Tout est
journalise :

| Systeme | Journal |
|---|---|
| macOS | `~/Library/Logs/CrimsonBoris-launch.log` |
| Windows | `%LOCALAPPDATA%\CrimsonBoris\launch.log` |

### Indicateur de synchronisation

En haut a droite de l'interface, une pastille discrete affiche la version et
s'ouvre au clic : etat, version locale, version publiee, horodatage de
compilation, derniere verification. Les etats sont honnetes — `depot injoignable`
et `aucun depot declare` sont affiches tels quels, jamais masques derriere un
vert rassurant.

Pour activer la surveillance, declarer l'URL d'un manifeste :

```
export BORIS_UPDATE_URL="https://api.github.com/repos/<compte>/<depot>/releases/latest"
```

L'API GitHub Releases et un simple JSON `{ "version": "2.1.0" }` sont tous deux
acceptes.

### Publication du depot

Le code source ne contient **aucune donnee personnelle** : ni nom, ni adresse,
ni identifiant, ni cle, ni chemin local. Le depot peut etre public.

Exclus du controle de version : `.env`, `boris.private.json`, les exports de
deck (`decks/*.txt`), les certificats (`*.pem`, `*.p12`). Le fichier
`.env.example` documente les variables sans en porter aucune valeur.

Pour verifier avant un push :

```
grep -rniE 'api[_-]?key|password|secret' src/ | grep -v token-maker
```

## Lancer Boris

**En usage normal**, apres empaquetage : ouvrir `Crimson Boris.app` depuis le
Finder ou le Launchpad. C'est la seule facon d'avoir Boris en tache de fond
permanente, avec son icone dans la barre de menus et son lancement a l'ouverture
de session.

```
npm run dist:mac   # macOS  : .app + .dmg (arm64)
npm run dist:win   # Windows : installeur NSIS (x64 + arm64)
npm run dist:all   # les deux
```

### Premier lancement

L'application n'est ni signee ni notarisee — cela demande un compte developpeur
Apple a 99 $/an. Au premier lancement, macOS refusera de l'ouvrir.

**Clic droit sur l'application → Ouvrir → Ouvrir.** Une seule fois : les
lancements suivants se font normalement, y compris au demarrage de la session.

### Ne PAS lancer Electron directement

```
npx electron            # -> "Usage: electron path-to-app", fenetre de demo
```

Le binaire d'Electron ne sait pas ou trouver Boris : il ouvre alors son
application de bienvenue. Utiliser les scripts ci-dessous, ou l'application
empaquetee.

## Verification du noyau

```
npm test                                   # 35 epreuves, reseau compris
BORIS_TESTS=hors-ligne npm test            # sans les epreuves reseau
```

La suite s'execute dans l'application reelle — SQLite, trousseau du systeme
et reseau compris — parce que c'est la que les defauts se logent. Les bugs les
plus couteux de ce projet ont tous passe la compilation sans broncher :
`autoUpdater` indefini dans le bundle empaquete, terrains engages comptes sur
les noms distincts au lieu des exemplaires, et un plan valide qui n'ecrivait
qu'un fichier sans jamais modifier le deck charge.

Onze groupes : parseur d'exports, solveur de mana, generateur deterministe,
classement des cartes, directives ecrites, comparaison de versions,
persistance et chiffrement, moteur de gravite, etabli et historique,
simulation, acces reseau.

## Commandes

```
npm run dev        # Boris en developpement (Electron + HMR)
npm run dev:web    # interface seule dans un navigateur, hors coquille
npm run build      # compile main + preload + renderer dans out/
npm run typecheck  # verifie les deux projets TS
npm run dist:mac   # produit le .app / .dmg arm64
```

## Arborescence

```
src/
├─ main/        process principal
│  ├─ index.ts      orchestration du cycle
│  ├─ power.ts      detection de sortie de veille (+ battement d'horloge)
│  ├─ scheduler.ts  cycle regulier, rearme apres chaque passe
│  ├─ severity.ts   moteur de regles -> gravite du cycle
│  ├─ tray.ts       barre de menus
│  ├─ mtg.ts        orchestration de l'arsenal ludique
│  ├─ suggest.ts    correctifs de deck + variantes graphiques
│  ├─ deck/         parseur d'exports + resolution Scryfall
│  ├─ sim/          moteur de goldfishing, solveur de mana, analyse
│  ├─ store/        SQLite : reglages, taches, journal, cotations, cartes, decks
│  └─ providers/    file d'attente HTTP + marches + Scryfall
├─ preload/     pont IPC typé exposé sous window.boris
├─ shared/      contrat main <-> renderer
└─ renderer/
   └─ src/
      ├─ styles/      jarvis.css (socle + palette) + forge.css + shell.css
      ├─ components/  avatar · aura · champs de connecteur · panneau de MAJ
      ├─ nav/         carte des constellations
      ├─ forge/       mode Forge : deck, trois volets, inspection, arts
      ├─ opti/        mode Opti : marches, veille, courrier, actions, asymetries
      ├─ shell/       porte d'entree, profil, version, etat du noyau
      ├─ data/        asymetries + modeles de reponse
      └─ lib/         hooks
legacy/          version v1 monofichier, conservee pour reference
scripts/         outillage (capture de controle)
```

## Interface

Boris s'ouvre sur son avatar et deux voies : **Opti** (marches, veille, courrier,
actions, asymetries) et **Forge** (Magic). Chaque mode presente ses categories en
constellation — tout est pose d'un coup, rien derriere un menu. Un clic ouvre une
categorie en grand ; la constellation se replie dans un coin et sert de repere. On
remonte d'un cran par un clic dans le vide, par la fleche flottante ou par Echap.

Le mode Forge occupe l'ecran : le deck a gauche, un volet a trois modes a droite
(Analyse, Simulation, Construction) et la pile des versions en bas. Survoler une
carte la sort du paquet ; cliquer ouvre son inspection et la liste de ses
impressions avec leurs prix.

L'ancienne interface — bandeau et quatre modules empiles — a ete retiree :
elle n'avait plus de role apres la bascule, et deux jeux de feuilles de style
concurrents finissaient par se marcher dessus.

## Design system

Palette definie dans `src/renderer/src/styles/jarvis.css` — source unique, avec
le socle typographique et les decoupes octogonales.
Fond `#08070A`, texte blanc pur, mauve `#6B2D8E` et braise `#E8590C` en accents,
vert reserve aux statuts positifs et aux donnees financieres en hausse.

## Etat d'avancement

- [x] **Etape 1** — stack arretee
- [x] **Etape 2** — projet initialise, v1 migree vers la palette abyssale
- [x] **Etape 3** — process de fond : tray, scheduler, detection de sortie de veille
- [x] **Etape 4** — module MTG : simulateur + integration Scryfall
- [x] **Refonte** — coquille en constellations : avatar, deux modes, dix volets,
      inspection des cartes et illustrations alternatives

## Cycle de vie

Boris tourne depuis la barre de menus, fenetre ouverte ou non. Un cycle est
declenche par : le demarrage, le minuteur (30 min par defaut), une sortie de
veille, un deverrouillage de session, un retour de l'operateur, ou un saut
d'horloge detecte par le battement de fond.

macOS emet plusieurs de ces signaux pour un seul reveil : ils sont dedoublonnes
sur une fenetre de 10 secondes.

### Quand Boris s'impose a l'ecran

Un cycle est **critique** si l'une de ces regles se declenche :

| Regle | Declenchement |
|---|---|
| `task-overdue` | une action SANS DELAI reste non cloturee |
| `market-shock` | un seuil de marche est **franchi** pendant le cycle |
| `deadline-shift` | une echeance datee est atteinte |
| `first-wake` | premier reveil de la journee |

Deux garde-fous, sans lesquels Boris deviendrait invivable :

1. Un seuil **deja** franchi au cycle precedent n'est pas un evenement : il
   retombe en gravite `watch` et n'ouvre pas la fenetre.
2. Boris ne s'impose pas deux fois pour des signaux **identiques** avant
   `revealCooldownMinutes` (4 h par defaut, reglable dans la barre de menus).
   La pastille et la gravite restent visibles ; seule l'irruption est retenue.

### Diagnostic

```
BORIS_SELFTEST=1 npx electron out/main/index.js --hidden
```

Execute un cycle complet, imprime le compte rendu (cotations, gravite, signaux,
decision de revelation) puis s'eteint. `BORIS_SHOT=<fichier.png>` y ajoute une
capture de la fenetre reelle, `BORIS_SHOT_ANCHOR=m2` l'ancre sur un module.

## Radar financier — deux volets

Le fetcher releve **17 cotations** par cycle, reparties en deux volets par le
champ `category` de `MarketQuote` :

- **`core`** — les sept niveaux directeurs (CAC, S&P, Nasdaq, Brent, or, EUR/USD,
  Bitcoin). Ce sont les seuls soumis aux seuils de choc.
- **`asymmetry`** — dix positions de rupture, cotees en direct mais **sans seuil** :
  une valeur de rupture bouge de dix pour cent sans qu'il ne se soit rien passe,
  et Boris crierait a chaque cycle.

La these de chaque asymetrie (rupture, reseau de beneficiaires, impact estime sur
les revenus, condition d'invalidation) vit dans
`src/renderer/src/data/asymmetries.ts` — **seul fichier a editer** pour faire
entrer ou sortir une position. Le `quoteId` doit correspondre a une entree de
`TRACKED` dans `providers/markets.ts` pour que le cours suive.

Les impacts sur revenus futurs sont des **estimations**, jamais des donnees
constatees, et le panneau le dit explicitement.

## Forge MTG — module 04

Trois onglets, un seul deck de travail.

### Atelier

Import, profil calcule, puis quatre outils qui deposent tous leurs propositions
au meme endroit — **l'etabli** :

- **Recommandations** — analyse *statique* de la liste : format, identite
  couleur, doublons, terrains engages, courbe, categories sous-dotees, cartes
  que la campagne voit dormir. Chaque constat sait ecrire la directive qui le
  corrige.
- **Directives** — restructuration dictee, voir plus bas.
- **Pool global** — recherche Scryfall reelle, syntaxe native, restreinte a
  l'identite du commandant par defaut. Un clic ajoute une carte a l'etabli.
- **Etabli** — le plan en cours : entrees, sorties, cout d'achat, valeur
  liberee, et un **verdict de format**. Rien n'est applique tant que le plan
  n'est pas exporte, et l'export ecrit un **nouveau fichier** : la liste
  d'origine n'est jamais ecrasee.

### Directives ecrites

Boris lit une **grammaire fermee**, pas du langage libre. C'est un choix : un
analyseur deterministe fait exactement ce qu'il annonce, se verifie ligne a
ligne et ne coute rien. En echange il ne comprend que ce qu'il connait — et
**toute ligne non comprise ressort avec son motif**, jamais devinee.

```
ajoute 3 pioche cmc<=2 budget<5
ajoute 4 sources rouges budget<8
coupe 2 cartes qui dorment
remplace Ruinous Ultimatum par un wrath budget<10
retire les terrains qui entrent engages
```

| Element | Valeurs |
|---|---|
| Verbes | `ajoute` `coupe` `retire` `remplace` |
| Categories | pioche, removal, wrath, ramp, exutoire, drain, jetons, anthem, recursion, protection, terrain, creature |
| Contraintes | `cmc<=N`, `budget<N`, une couleur, `degages` / `engages` |

Les ajouts interrogent Scryfall pour de vrai, filtres sur l'identite couleur du
commandant et classes par frequence de jeu. Les coupes s'appuient sur la
derniere campagne quand elle existe : « cartes qui dorment » designe celles que
la simulation voit rester en main.

### Banc d'essai · Dossier

Les deux autres onglets reprennent la simulation (campagne, constats,
correctifs) et la lecture editoriale (cartes maitresses, arbitrages de reserve,
variantes graphiques).

## Arsenal ludique — details du moteur

### Import

Depose un export dans le **dossier d'accueil** (Archidekt, Moxfield, MTGO `.dec`),
ou passe par le selecteur de fichier. Ce dossier change selon le mode :

| Mode | Emplacement |
|---|---|
| `npm run dev` | `decks/` a la racine du projet |
| Application empaquetee | `~/Library/Application Support/Crimson Boris/decks/` |

L'interface affiche toujours le chemin reel sous les boutons d'import — la base
de donnees, elle, est commune aux deux modes, donc un deck importe en
developpement reste visible dans l'application empaquetee. Chaque nom est resolu sur Scryfall pour obtenir cout de
mana, type, texte oracle, illustration et prix — donnees absentes des exports,
et sans lesquelles aucune simulation n'est possible.

Le parseur respecte les etiquettes : `noDeck`, `Sideboard`, `Maybeboard` et la
categorie `pas terrible` sortent du deck principal. Les cartes recto-verso sont
retrouvees par l'une ou l'autre de leurs faces, les diacritiques sont ignores.

### Simulation

Goldfishing automatique, 100 a 1000 parties par campagne, en duel ou sur table a
quatre. Le nombre d'adversaires ne fait pas jouer d'adversaire : il regle la
pression subie — plus la table est large, plus il passe de removal et de
balayages. Sans cela, un goldfish flatte tous les decks.

Une meme graine rejoue exactement la meme campagne : l'ecart mesure entre deux
campagnes n'est alors imputable qu'a la modification du deck.

La **zone de commandement** est simulee : le commandant est disponible a chaque
tour, avec sa taxe de deux mana par relance, et y retourne apres un balayage.
Sans cela, la carte la plus fiablement accessible du deck n'aurait jamais ete
jouee.

**Ce que le moteur ne fait pas** : il ne resout aucune capacite declenchee.
Trois effets seulement sont modelises, parce qu'ils changent la courbe — la
production de mana, la pioche, et la recherche de terrain. Il mesure des
tendances sur des centaines de parties ; il n'arbitre pas une carte isolee.

Le paiement du mana, lui, est resolu source par source : une bi-terre ne paie
qu'un seul symbole, et le mana generique ne consomme jamais une source de
couleur rare quand une autre suffit.

### Constats et correctifs

Sept constats sont produits, gradues de `nominal` a `critique` : acces a la
pioche, assechement de la main, capacite de reponse, exutoires de sacrifice,
deroulement de la base de mana, courbe contre plan de jeu, et cartes qui
dorment en main — ce dernier nomme les cartes piochees sans jamais avoir pu
etre lancees, c'est-a-dire les premieres candidates a la coupe. Chaque constat separe
strictement ce qui est **mesure** de ce qui en est **deduit**.

Les constats non nominaux ouvrent des requetes Scryfall ciblees, filtrees sur
l'identite couleur du commandant et sur le prix. Le classement combine la
frequence de jeu reelle (`order=edhrec`) et le cout.

### Variantes graphiques

Pour chaque carte maitresse, toutes les impressions sont parcourues et seules
sont retenues celles au traitement recherche — sans bordure, pleine
illustration, cadre vitrine — dont le prix reste sous six euros. Scryfall ne
publie aucune note esthetique : elle est deduite des attributs d'impression.

## Notes

Les donnees vivent dans `~/Library/Application Support/Crimson Boris/boris.db`.
Le seul appel sortant est la collecte des cotations, vers le point d'acces
public de Yahoo Finance — gratuit et sans cle, mais **non contractuel** : il est
isole dans `providers/markets.ts` pour pouvoir etre remplace sans toucher au reste.
Aucune donnee personnelle ne quitte la machine. Les modeles de courriels du module 03
contiennent des informations personnelles et restent strictement locaux.
