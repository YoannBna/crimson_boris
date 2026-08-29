import { useCallback, useEffect, useRef } from 'react'

/*
 * Enclume et marteau de la Forge.
 *
 * Trois calques : un canvas de flammes derriere, l'enclume en SVG au
 * milieu, un canvas d'etincelles devant. Le feu doit passer DERRIERE le
 * metal et les etincelles DEVANT — un calque unique aurait impose de
 * choisir, et le choix se serait vu.
 *
 * Les runes sont des traces vectoriels, pas des caracteres : les runes
 * Unicode ne sont pas garanties par les polices systeme, et une case
 * vide au lieu d'un glyphe est un defaut qu'on ne voit qu'apres
 * livraison.
 */

interface Flamme {
  x: number
  y: number
  vy: number
  taille: number
  alpha: number
  chaud: number
}

interface Etincelle {
  x: number
  y: number
  vx: number
  vy: number
  vie: number
  taille: number
}

/** Huit glyphes de deux ou trois traits, dessines dans une case de 10. */
const RUNES = [
  'M5 0 V10 M5 2 L9 5 M5 6 L9 9',
  'M2 10 V2 L8 0 V6',
  'M3 10 V0 L8 3 L3 6',
  'M5 0 V10 M1 3 L9 3',
  'M3 10 V0 H7 L4 5 L8 10',
  'M1 0 L5 5 L9 0 M5 5 V10',
  'M8 0 L2 4 L8 6 L2 10',
  'M1 1 L5 4 L9 1 M5 4 V10'
]

export function ForgeLogo({
  size = 92,
  /** Nom de la classe portee par le conteneur, pour l'ancrer */
  className = ''
}: {
  size?: number
  className?: string
}) {
  const feuRef = useRef<HTMLCanvasElement>(null)
  const etinRef = useRef<HTMLCanvasElement>(null)
  const marteauRef = useRef<SVGGElement>(null)
  // La frappe vit dans un ref : soixante rendus React par seconde pour
  // une lueur qui ne concerne que deux canvas seraient du gaspillage.
  const frappeRef = useRef(0)

  const frapper = useCallback(() => {
    frappeRef.current = 1
    const g = marteauRef.current
    if (g) {
      g.classList.remove('frappe')
      // Force le navigateur a reprendre l'animation depuis son debut ;
      // sans cette lecture, retirer puis remettre la classe dans le meme
      // train de rendu ne relance rien.
      void g.getBoundingClientRect()
      g.classList.add('frappe')
    }
  }, [])

  useEffect(() => {
    // La Forge frappe depuis n'importe quel volet : l'evenement passe
    // par le document plutot que de traverser cinq composants en props.
    const onFrappe = (): void => frapper()
    document.addEventListener('forge:frappe', onFrappe)
    return () => document.removeEventListener('forge:frappe', onFrappe)
  }, [frapper])

  useEffect(() => {
    const feu = feuRef.current
    const etin = etinRef.current
    if (!feu || !etin) return
    const cf = feu.getContext('2d')
    const ce = etin.getContext('2d')
    if (!cf || !ce) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    for (const c of [feu, etin]) {
      c.width = size * dpr
      c.height = size * dpr
    }
    cf.scale(dpr, dpr)
    ce.scale(dpr, dpr)

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // Le foyer est sous l'enclume : c'est de la que tout monte.
    const foyerY = size * 0.83
    const foyerX = size * 0.5
    const largeur = size * 0.46

    const flammes: Flamme[] = []
    const etincelles: Etincelle[] = []

    const naitre = (): Flamme => ({
      x: foyerX + (Math.random() - 0.5) * largeur,
      y: foyerY + Math.random() * size * 0.05,
      vy: 0.22 + Math.random() * 0.55,
      taille: size * (0.05 + Math.random() * 0.1),
      alpha: 0.35 + Math.random() * 0.5,
      chaud: Math.random()
    })

    let raf = 0

    const draw = (): void => {
      cf.clearRect(0, 0, size, size)
      ce.clearRect(0, 0, size, size)

      const frappe = frappeRef.current
      if (frappe > 0) frappeRef.current = Math.max(0, frappe - 0.022)

      /* --- Flammes, derriere le metal --------------------------- */
      cf.globalCompositeOperation = 'lighter'
      const debit = reduced ? 0 : 3 + Math.round(frappe * 5)
      for (let i = 0; i < debit; i++) flammes.push(naitre())

      for (let i = flammes.length - 1; i >= 0; i--) {
        const f = flammes[i]
        f.y -= f.vy
        // Resserrement vers le haut : une flamme s'effile, elle ne monte
        // pas en colonne.
        f.x += (foyerX - f.x) * 0.012 + (Math.random() - 0.5) * 0.5
        f.alpha -= 0.011
        f.taille *= 0.985
        if (f.alpha <= 0 || f.y < size * 0.16) {
          flammes.splice(i, 1)
          continue
        }
        const g = cf.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.taille)
        const coeur = f.chaud > 0.72 ? '255, 214, 130' : '255, 138, 61'
        g.addColorStop(0, `rgba(${coeur}, ${f.alpha})`)
        g.addColorStop(0.55, `rgba(163, 59, 12, ${f.alpha * 0.42})`)
        g.addColorStop(1, 'rgba(163, 59, 12, 0)')
        cf.fillStyle = g
        cf.beginPath()
        cf.arc(f.x, f.y, f.taille, 0, Math.PI * 2)
        cf.fill()
      }

      // Lueur jaune incandescente : elle nait de la frappe et s'eteint.
      if (frappe > 0) {
        const r = size * (0.24 + (1 - frappe) * 0.34)
        const g = cf.createRadialGradient(foyerX, size * 0.53, 0, foyerX, size * 0.53, r)
        g.addColorStop(0, `rgba(255, 236, 168, ${frappe * 0.55})`)
        g.addColorStop(1, 'rgba(255, 193, 99, 0)')
        cf.fillStyle = g
        cf.fillRect(0, 0, size, size)
      }
      cf.globalCompositeOperation = 'source-over'

      /* --- Etincelles, devant ----------------------------------- */
      if (frappe > 0.94 && etincelles.length < 90) {
        for (let i = 0; i < 26; i++) {
          const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.5
          const v = 0.9 + Math.random() * 2.6
          etincelles.push({
            x: foyerX + (Math.random() - 0.5) * size * 0.2,
            y: size * 0.53,
            vx: Math.cos(a) * v,
            vy: Math.sin(a) * v,
            vie: 1,
            taille: 0.6 + Math.random() * 1.5
          })
        }
      }

      ce.globalCompositeOperation = 'lighter'
      for (let i = etincelles.length - 1; i >= 0; i--) {
        const e = etincelles[i]
        e.x += e.vx
        e.y += e.vy
        e.vy += 0.07
        e.vie -= 0.021
        if (e.vie <= 0) {
          etincelles.splice(i, 1)
          continue
        }
        ce.fillStyle = `rgba(255, ${190 + Math.round(e.vie * 60)}, 110, ${e.vie})`
        ce.beginPath()
        ce.arc(e.x, e.y, e.taille, 0, Math.PI * 2)
        ce.fill()
      }
      ce.globalCompositeOperation = 'source-over'

      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [size])

  return (
    <div
      className={`forge-logo ${className}`}
      style={{ width: size, height: size }}
      onClick={frapper}
    >
      <canvas ref={feuRef} className="fl-feu" style={{ width: size, height: size }} />

      <svg className="fl-svg" viewBox="0 0 100 100" aria-label="Forge">
        <defs>
          <linearGradient id="fl-metal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8A8296" />
            <stop offset="42%" stopColor="#4A4353" />
            <stop offset="100%" stopColor="#221C2C" />
          </linearGradient>
          <linearGradient id="fl-manche" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#8C5A2E" />
            <stop offset="100%" stopColor="#4A2E16" />
          </linearGradient>
        </defs>

        {/*
          Runes sur un cercle de rayon 47 : a 41 elles tombaient sur la
          table de l'enclume, ou elles ne se lisaient plus.
        */}
        <g className="fl-runes">
          {RUNES.map((d, i) => {
            const a = (i / RUNES.length) * Math.PI * 2 - Math.PI / 2
            const x = 50 + Math.cos(a) * 47
            const y = 50 + Math.sin(a) * 47
            return (
              <path
                key={i}
                d={d}
                className="fl-rune"
                style={{ animationDelay: `${-i * 0.73}s` }}
                transform={`translate(${x - 4} ${y - 4}) rotate(${(a * 180) / Math.PI + 90} 4 4) scale(.8)`}
              />
            )
          })}
        </g>

        {/* Enclume : corne a gauche, table, taille, socle evase. */}
        <g className="fl-enclume">
          <path d="M26 45 C18 44 12 47 7 51 C12 55 18 56 26 55 Z" fill="url(#fl-metal)" />
          <path d="M24 43 H80 V55 H24 Z" fill="url(#fl-metal)" />
          <path d="M36 55 H64 L59 69 H41 Z" fill="url(#fl-metal)" />
          <path d="M41 69 H59 L78 74 V82 H22 V74 Z" fill="url(#fl-metal)" />
          {/* Aretes claires : sans elles la silhouette s'aplatit. */}
          <path d="M24 43 H80" className="fl-arete" />
          <path d="M22 74 H78" className="fl-arete" />
        </g>

        {/*
          Marteau leve au-dessus de la table, et non relegue dans le
          coin : c'est sa proximite avec l'enclume qui fait lire le
          geste. Il s'abat a la frappe autour du point (58, 46).
        */}
        <g ref={marteauRef} className="fl-marteau">
          <path d="M62 27 L86 9" className="fl-manche" strokeLinecap="round" />
          <path d="M40 19 L64 19 L64 33 L40 33 L36 26 Z" fill="url(#fl-metal)" />
          <path d="M40 19 H64" className="fl-arete" />
        </g>
      </svg>

      <canvas ref={etinRef} className="fl-etin" style={{ width: size, height: size }} />
    </div>
  )
}

/** Signale une action accomplie dans la Forge : le marteau tombe. */
export function frapperLaForge(): void {
  document.dispatchEvent(new CustomEvent('forge:frappe'))
}
