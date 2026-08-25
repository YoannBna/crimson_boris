/* ============================================================
   Monitoring du courrier — modeles de reponse
   ============================================================ */

export interface ReplyTemplate {
  id: string
  label: string
  /** Corps du modele. Les champs entre accolades sont a completer. */
  body: string
}

/**
 * Modeles generiques, sans aucune donnee nominative.
 * Les champs entre accolades restent a completer par l'operateur : ni
 * l'application ni son depot ne connaissent son identite.
 */
export const REPLY_TEMPLATES: ReplyTemplate[] = [
  {
    id: 'relance-administrative',
    label: 'Relance administrative — piece manquante non identifiee',
    body: `Objet : Dossier {NUMERO_DOSSIER} - piece manquante non identifiee

Madame, Monsieur,

J'ai recu le {DATE} une notification m'indiquant que mon dossier {NUMERO_DOSSIER} est a completer.

La notification ne precise pas la piece attendue et je ne parviens pas a identifier l'element manquant depuis mon espace personnel. Je vous remercie de bien vouloir me preciser la nature exacte du document a fournir, ainsi que la date limite applicable a mon dossier.

Vous remerciant par avance,

{NOM}`
  },
  {
    id: 'verrouillage-conditions',
    label: 'Resiliation — verrouillage ecrit des conditions',
    body: `Objet : RE - Demande de resiliation

Bonjour,

Je vous remercie pour votre retour et pour la prise en compte de ma demande.

Je prends note de la fin de contrat au {DATE_FIN} au terme du preavis. Afin d'eviter tout malentendu, pourriez-vous me confirmer par ecrit :

- le nombre et le montant des prelevements restant a intervenir jusqu'a cette date ;
- le montant exact du remboursement auquel je peux pretendre ;
- la procedure et le delai pour en faire la demande.

Je vous remercie par avance pour ces precisions.

Bien cordialement,

{NOM}`
  },
  {
    id: 'signalement-securite',
    label: 'Correction — courriel exposant un secret',
    body: `Bonjour,

Je vous recontacte suite a mon precedent message, qui comportait une erreur.

Je vous transmets ci-joint l'ensemble des informations necessaires au traitement de ma demande.

Je precise ne pas transmettre mon mot de passe : aucune administration ni aucun service n'a a en demander la communication par courriel.

Merci par avance pour votre aide.

Bien a vous,

{NOM}`
  }
]
