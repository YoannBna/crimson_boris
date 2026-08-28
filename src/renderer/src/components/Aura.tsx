/**
 * Fond anime.
 * Trois nappes en derive lente, en CSS et non en canvas : le fond ne
 * doit rien couter, l'avatar a besoin de toute la marge de rendu.
 */
export function Aura() {
  return (
    <>
      <div className="aura" aria-hidden>
        <i />
      </div>
      <div className="aura-grain" aria-hidden />
    </>
  )
}
