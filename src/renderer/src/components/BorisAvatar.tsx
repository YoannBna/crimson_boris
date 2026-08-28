import { useEffect, useRef, useState } from 'react'

/*
 * Avatar de Boris — sphere d'energie et particules fluides.
 *
 * Canvas 2D plutot que WebGL : quelques centaines de particules et
 * trois degrades radiaux ne justifient pas une couche 3D, et le 2D
 * tient les soixante images par seconde sans effort ni dependance.
 *
 * Toute l'animation vit dans un `ref` mute par la boucle de rendu.
 * Passer par l'etat React ferait un rendu par image — soixante
 * reconciliations par seconde pour un dessin qui ne concerne que le
 * canvas.
 */

export type AvatarState = 'repos' | 'survol' | 'activation'

interface Particle {
  /** Angle sur l'orbite, en radians */
  a: number
  /** Rayon orbital, en fraction du rayon de base */
  r: number
  /** Vitesse angulaire propre */
  v: number
  /** Taille en pixels */
  size: number
  /** Position sur le degrade violet -> orange, 0 a 1 */
  hue: number
  /** Derive verticale, donne l'epaisseur au nuage */
  z: number
  alpha: number
}

interface Wave {
  /** Rayon courant de l'onde de choc */
  r: number
  alpha: number
}

const PARTICLES = 190

export function BorisAvatar({
  size = 220,
  greeting,
  onActivate
}: {
  size?: number
  /** Message affiche a l'apparition. Null : aucun. */
  greeting?: string | null
  onActivate?: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<AvatarState>('repos')
  const [hovering, setHovering] = useState(false)

  useEffect(() => {
    stateRef.current = hovering ? 'survol' : 'repos'
  }, [hovering])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)

    const cx = size / 2
    const cy = size / 2
    const base = size * 0.19

    const particles: Particle[] = Array.from({ length: PARTICLES }, () => ({
      a: Math.random() * Math.PI * 2,
      r: 1.25 + Math.random() * 1.5,
      v: 0.0022 + Math.random() * 0.0052,
      size: 0.7 + Math.random() * 2.1,
      hue: Math.random(),
      z: (Math.random() - 0.5) * 0.5,
      alpha: 0.25 + Math.random() * 0.6
    }))

    const waves: Wave[] = []
    let raf = 0
    let t = 0
    let intensity = 0 // 0 au repos, 1 au survol — interpole pour eviter les a-coups

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const draw = (): void => {
      t += 1
      const st = stateRef.current
      const cible = st === 'repos' ? 0 : 1
      intensity += (cible - intensity) * 0.07

      ctx.clearRect(0, 0, size, size)

      // Respiration : lente au repos, plus ample et rapide au survol.
      const souffle = reduced ? 0 : Math.sin(t * 0.014) * 0.06 + Math.sin(t * 0.031) * 0.022
      const rayon = base * (1 + souffle + intensity * 0.16)

      /* --- Onde de choc --------------------------------------- */
      for (let i = waves.length - 1; i >= 0; i--) {
        const w = waves[i]
        w.r += 3.4
        w.alpha *= 0.955
        if (w.alpha < 0.012) {
          waves.splice(i, 1)
          continue
        }
        ctx.beginPath()
        ctx.arc(cx, cy, w.r, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(255, 200, 140, ${w.alpha})`
        ctx.lineWidth = 2.2 * w.alpha + 0.4
        ctx.stroke()
      }

      /* --- Halo exterieur ------------------------------------- */
      /* Le degrade doit s'eteindre AU-DELA de la demi-diagonale du
       * canvas (0.707 × cote), sinon sa derniere teinte reste visible
       * dans les coins et dessine un rectangle autour de l'avatar. */
      const portee = size * 0.78
      const halo = ctx.createRadialGradient(cx, cy, rayon * 0.55, cx, cy, portee)
      halo.addColorStop(0, `rgba(139, 69, 199, ${0.3 + intensity * 0.22})`)
      halo.addColorStop(0.3, `rgba(107, 45, 142, ${0.12 + intensity * 0.1})`)
      halo.addColorStop(0.62, 'rgba(58, 27, 82, 0.03)')
      halo.addColorStop(1, 'rgba(8, 7, 10, 0)')
      ctx.fillStyle = halo
      ctx.fillRect(0, 0, size, size)

      /* --- Particules ----------------------------------------- */
      ctx.globalCompositeOperation = 'lighter'
      const vitesse = 1 + intensity * 2.3
      for (const p of particles) {
        p.a += p.v * vitesse
        const orbite = rayon * p.r
        const x = cx + Math.cos(p.a) * orbite
        // L'orbite est ecrasee verticalement : un cercle parfait ferait
        // plat, un disque incline suggere le volume.
        const y = cy + Math.sin(p.a) * orbite * 0.62 + p.z * rayon

        // Violet profond au loin, braise en approche.
        const chaud = p.hue * 0.55 + intensity * 0.3
        const r = Math.round(139 + chaud * 116)
        const v = Math.round(69 + chaud * 69)
        const b = Math.round(199 - chaud * 138)

        ctx.beginPath()
        ctx.arc(x, y, p.size * (1 + intensity * 0.35), 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${r}, ${v}, ${b}, ${p.alpha * (0.6 + intensity * 0.4)})`
        ctx.fill()
      }
      ctx.globalCompositeOperation = 'source-over'

      /* --- Coeur ---------------------------------------------- */
      const coeur = ctx.createRadialGradient(cx, cy, 0, cx, cy, rayon * 1.5)
      coeur.addColorStop(0, `rgba(255, 255, 255, ${0.94 + intensity * 0.06})`)
      coeur.addColorStop(0.22, `rgba(255, 214, 170, ${0.8 + intensity * 0.15})`)
      coeur.addColorStop(0.5, `rgba(232, 89, 12, ${0.44 + intensity * 0.2})`)
      coeur.addColorStop(0.78, `rgba(107, 45, 142, ${0.26 + intensity * 0.14})`)
      coeur.addColorStop(1, 'rgba(27, 15, 38, 0)')
      ctx.beginPath()
      ctx.arc(cx, cy, rayon * 1.5, 0, Math.PI * 2)
      ctx.fillStyle = coeur
      ctx.fill()

      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)

    // L'activation est declenchee de l'exterieur : le composant expose
    // son emetteur d'onde par un evenement, sans re-rendu.
    const onPulse = (): void => {
      waves.push({ r: base * 1.1, alpha: 0.92 })
    }
    canvas.addEventListener('boris:pulse', onPulse)

    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('boris:pulse', onPulse)
    }
  }, [size])

  const activer = (): void => {
    canvasRef.current?.dispatchEvent(new CustomEvent('boris:pulse'))
    stateRef.current = 'activation'
    setTimeout(() => {
      stateRef.current = hovering ? 'survol' : 'repos'
    }, 620)
    onActivate?.()
  }

  return (
    <div className="avatar-wrap" style={{ width: size, height: size }}>
      <canvas
        ref={canvasRef}
        className="avatar-canvas"
        style={{ width: size, height: size }}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        onClick={activer}
        role="button"
        aria-label="Boris"
      />
      {/* La disparition est confiee a l'animation CSS : un etat React
          double emploi se perdait au remontage du composant. La cle
          rejoue l'animation a chaque nouveau message. */}
      {greeting && (
        <div className="avatar-hello" key={greeting}>
          <span>{greeting}</span>
        </div>
      )}
    </div>
  )
}
