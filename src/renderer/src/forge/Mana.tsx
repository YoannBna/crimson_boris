/*
 * Cout de mana.
 *
 * Scryfall renvoie une chaine du type « {2}{B}{R} ». La decouper en
 * pastilles vaut mieux que de l'afficher telle quelle : a la taille ou
 * ces lignes se lisent, les accolades sont du bruit.
 */
const TEINTE: Record<string, string> = {
  W: 'm-w',
  U: 'm-u',
  B: 'm-b',
  R: 'm-r',
  G: 'm-g',
  C: 'm-c',
  X: 'm-c'
}

export function Mana({ cost }: { cost: string | null }) {
  if (!cost) return null
  const symboles = cost.match(/\{[^}]+\}/g) ?? []
  if (symboles.length === 0) return null

  return (
    <span className="mana" aria-label={`cout ${cost}`}>
      {symboles.map((s, i) => {
        const brut = s.slice(1, -1)
        // Les hybrides « {B/R} » n'ont pas de couleur unique : la premiere
        // moitie decide de la teinte, faute de pouvoir en montrer deux.
        const cle = brut.split('/')[0].toUpperCase()
        const classe = TEINTE[cle] ?? (/^\d+$/.test(cle) ? 'm-n' : 'm-c')
        return (
          <span className={`msym ${classe}`} key={`${s}-${i}`}>
            {brut.replace('/', '')}
          </span>
        )
      })}
    </span>
  )
}
