/* ============================================================
   ASYMETRIES RADICALES
   Dix positions de rupture, retenues sur quatre criteres :
     1. avancee technologique et caractere de rupture
     2. presence dans l'actualite recente
     3. importance geostrategique
     4. potentiel de croissance massive du chiffre d'affaires

   Le cours de chacune est releve en direct (voir providers/markets.ts).
   Ce fichier ne porte que la these — c'est le seul endroit a editer
   pour faire entrer ou sortir une position.
   ============================================================ */

export type Axis =
  | 'calcul'
  | 'lithographie'
  | 'fonderie'
  | 'memoire'
  | 'quantique'
  | 'energie'
  | 'defense'
  | 'robotique'
  | 'matieres'

export interface Asymmetry {
  /** Doit correspondre a un `id` de TRACKED */
  quoteId: string
  ticker: string
  name: string
  axis: Axis
  /** Ce qui justifie la selection : rupture technique ou annonce politique */
  rupture: string
  /** Partenaires, filiales, indices qui captent la meme dynamique */
  network: string
  /** Impact estime sur les revenus futurs — une estimation, pas une donnee */
  impact: string
  /** Ce qui invaliderait la these */
  risk: string
}

export const AXIS_LABEL: Record<Axis, string> = {
  calcul: 'Calcul IA',
  lithographie: 'Lithographie',
  fonderie: 'Fonderie',
  memoire: 'Memoire',
  quantique: 'Quantique',
  energie: 'Energie',
  defense: 'Defense',
  robotique: 'Robotique',
  matieres: 'Matieres critiques'
}

export const ASYMMETRIES: Asymmetry[] = [
  {
    quoteId: 'nvda',
    ticker: 'NVDA',
    name: 'NVIDIA',
    axis: 'calcul',
    rupture:
      "Beneficiaire central du cycle d'investissement en infrastructure IA, estime pres de 700 Md$ en 2026 pour les centres de donnees. La saison de resultats d'aout 2026 s'est jouee sur la soutenabilite de ce capex.",
    network:
      'TSMC (gravure) · SK Hynix et Micron (HBM) · hyperscalers Microsoft, Amazon, Google · indices SOX et Nasdaq 100',
    impact:
      "Le capex des hyperscalers se transforme quasi directement en chiffre d'affaires. Le risque a suivre n'est pas la demande mais son FINANCEMENT — c'est le point de bascule du narratif.",
    risk: "Un ralentissement du capex des hyperscalers frappe le revenu au trimestre suivant, sans amortisseur."
  },
  {
    quoteId: 'asml',
    ticker: 'ASML',
    name: 'ASML Holding',
    axis: 'lithographie',
    rupture:
      "Quasi-monopole sur la lithographie EUV, et seul fournisseur du High-NA. Previsions 2026 relevees a 43-45 Md€. Aucun noeud avance ne se grave sans ses machines.",
    network:
      'TSMC, Intel, Samsung (clients exclusifs) · Zeiss (optique) · ASM International, BE Semiconductor · indice AEX',
    impact:
      "Carnet de commandes pluriannuel : la visibilite revenus est la plus longue du secteur. Chaque machine High-NA se compte en centaines de millions d'euros.",
    risk: "Instrument de politique etrangere : les licences d'exportation neerlandaises et americaines vers la Chine peuvent fermer un marche du jour au lendemain."
  },
  {
    quoteId: 'tsm',
    ticker: 'TSM',
    name: 'TSMC',
    axis: 'fonderie',
    rupture:
      "Demande de puces avancees superieure a l'offre sur les noeuds 3 nm et le packaging avance (CoWoS), qui est le veritable goulot d'etranglement de l'IA — pas la gravure.",
    network:
      'NVIDIA, Apple, AMD, Qualcomm (clients) · ASML (equipementier) · usines Arizona et Kumamoto (derisquage)',
    impact:
      'Pouvoir de fixation des prix sur les noeuds avances, faute d’alternative credible. La montee du packaging avance ouvre un second gisement de marge.',
    risk: 'Concentration geographique a Taiwan : c’est la position la plus exposee du portefeuille technologique mondial.'
  },
  {
    quoteId: 'mu',
    ticker: 'MU',
    name: 'Micron Technology',
    axis: 'memoire',
    rupture:
      "La memoire HBM est passee de composant banalise a ressource rare : la demande atteint des niveaux records et l'offre est prevendue plusieurs trimestres a l'avance.",
    network:
      'NVIDIA et AMD (acheteurs HBM) · SK Hynix et Samsung (concurrents directs) · indice SOX',
    impact:
      "Sortie du cycle memoire classique : les contrats HBM sont pluriannuels et a marge nettement superieure au DRAM standard.",
    risk: 'Retour a la cyclicite si les capacites de SK Hynix et Samsung rattrapent la demande.'
  },
  {
    quoteId: 'ionq',
    ticker: 'IONQ',
    name: 'IonQ',
    axis: 'quantique',
    rupture:
      "Croissance de revenus de 755 % en glissement annuel au premier trimestre 2026 (64,7 M$), prevision annuelle relevee a 280-290 M$. Acquisitions de SkyWater et Nexus, cap sur 256 qubits et correction d'erreurs.",
    network:
      'SkyWater et Nexus (integres) · Rigetti, D-Wave, IQM et Quantinuum (comparables cotes depuis leurs IPO 2026) · programmes de souverainete quantique americains et allies',
    impact:
      "Base de revenus encore minuscule : le potentiel est un ordre de grandeur, pas un pourcentage. A l'inverse, toute deception se paie plein tarif.",
    risk: "Valorisation adossee a une promesse technologique. L'IPO de Quantinuum a durci la comparaison sur tout le secteur."
  },
  {
    quoteId: 'ceg',
    ticker: 'CEG',
    name: 'Constellation Energy',
    axis: 'energie',
    rupture:
      "Nexus IA-nucleaire : les hyperscalers signent des contrats d'achat d'electricite a vingt ans en direct avec les producteurs. Le nucleaire cesse d'etre une utility pour devenir une infrastructure IA.",
    network:
      'Microsoft (contrat vingt ans) · Amazon et Google (accords comparables) · secteur nucleaire cote pese ~1 700 Md$ en aout 2026, dont 865 Md$ d’utilities',
    impact:
      "Revenus contractualises sur deux decennies a prix garanti : c'est la visibilite d'une utility avec la croissance d'une valeur technologique.",
    risk: "Reevaluation deja largement operee. Les SMR ne produiront pas avant le debut des annees 2030 : rien de neuf cote capacite d'ici la."
  },
  {
    quoteId: 'rhm',
    ticker: 'RHM.DE',
    name: 'Rheinmetall',
    axis: 'defense',
    rupture:
      "Symbole du rearmement europeen. Chiffre d'affaires 2025 de 9,94 Md€ contre 7,72 Md€ en 2024, carnet de commandes et accords-cadres a 63,8 Md€. Plan ReArm Europe / Readiness 2030 : jusqu'a 800 Md€ mobilises.",
    network:
      'Premiere ponderation des indices de defense europeens (14,03 %), devant BAE (11,68 %), Leonardo (11,47 %) et Thales (11,13 %) · Leopard, Puma, munitions 155 mm',
    impact:
      "Le carnet represente plus de six annees de chiffre d'affaires 2025. La contrainte n'est plus la commande, c'est la capacite de production.",
    risk: 'Une detente geopolitique durable degonflerait la prime. Les depenses de defense europeennes ont deja crû de pres de 20 % en reel en 2025.'
  },
  {
    quoteId: 'ho',
    ticker: 'HO.PA',
    name: 'Thales',
    axis: 'defense',
    rupture:
      "Bascule de la defense vers l'electronique, le connecte et le logiciel — radars, guerre electronique, cybersecurite, spatial. Trois des quatre meilleures performances du CAC 40 en debut 2026 viennent de l'armement.",
    network:
      "Safran et Dassault Aviation (filiere francaise) · Naval Group · indices de defense europeens · plan national de souverainete",
    impact:
      "Marge superieure a celle des plateformes lourdes : le logiciel embarque se vend mieux que l'acier. Exposition directe aux budgets europeens records.",
    risk: 'Exposition France : une prime de risque sur l’OAT et un blocage budgetaire a l’automne pesent sur toute la cote parisienne.'
  },
  {
    quoteId: 'tsla',
    ticker: 'TSLA',
    name: 'Tesla',
    axis: 'robotique',
    rupture:
      "Production de masse d'Optimus Gen 3 lancee a Fremont le 21 janvier 2026 : le seul humanoide reellement en chaine. 22 degres de liberte par main, Grok integre pour l'interaction. Feuille de route annoncee jusqu'a dix millions d'unites par an.",
    network:
      'xAI (modele de langage) · fournisseurs d’actionneurs et de reducteurs harmoniques · Figure 03 (superieur en dexterite fine) · Hyundai Atlas',
    impact:
      "Quelques centaines d'unites en 2026, montee en cadence prevue en 2027, lancement grand public vise fin 2027. Aucun revenu materiel avant 2027 : c'est une option, pas un flux.",
    risk: 'Ecart historique entre le calendrier annonce par la direction et le calendrier constate. La valorisation integre deja une execution parfaite.'
  },
  {
    quoteId: 'remx',
    ticker: 'REMX',
    name: 'VanEck Rare Earth & Strategic Metals',
    axis: 'matieres',
    rupture:
      "Les terres rares deviennent un instrument de politique etrangere. Plan national francais « Terres rares et aimants permanents » presente le 5 mai 2026, fonds metaux critiques dote a terme de 2 Md€, Critical Raw Materials Act europeen avec objectifs 2030.",
    network:
      "Producteurs et transformateurs hors Chine · accords bilateraux francais avec la Serbie, le Vietnam, le Kazakhstan et l'Inde · filiere aimants permanents (eolien, vehicule electrique, defense)",
    impact:
      "Exposition diversifiee a un goulot d'etranglement structurel : aucun aimant permanent, donc aucun moteur electrique ni radar, sans cette filiere.",
    risk: "La Chine controle la transformation et peut ajuster les prix pour etouffer toute capacite concurrente naissante. Un ETF dilue l'exposition autant qu'il repartit le risque."
  }
]
