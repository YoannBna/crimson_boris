/*
 * Badge « art choisi ».
 *
 * Une tete de pinceau, en orange pale : assez presente pour se reperer
 * d'un coup d'oeil sur une liste de cent lignes, assez discrete pour ne
 * pas concurrencer l'illustration qu'elle signale.
 */
export function Pinceau({ taille = 14, titre }: { taille?: number; titre?: string }) {
  return (
    <span className="pinceau" style={{ width: taille, height: taille }} title={titre}>
      <svg viewBox="0 0 24 24" aria-hidden focusable="false">
        {/* Manche */}
        <path
          d="M20.2 3.8a2.2 2.2 0 0 0-3.1 0L10.4 10.5l3.1 3.1 6.7-6.7a2.2 2.2 0 0 0 0-3.1z"
          fill="currentColor"
          opacity=".55"
        />
        {/* Virole */}
        <path d="M9.6 11.3l3.1 3.1-1.5 1.5-3.1-3.1z" fill="currentColor" opacity=".8" />
        {/* Touffe */}
        <path
          d="M7.6 13.6c1.4 1.4 1.6 3.1.8 4.4-.7 1.2-2.2 1.9-4.1 2-1 .1-1.4-.4-1.2-1.3.3-1.9 1-3.4 2.2-4.1 1.2-.8 2.3-.6 2.3-1z"
          fill="currentColor"
        />
      </svg>
    </span>
  )
}
