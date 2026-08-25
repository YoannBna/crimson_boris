import type { DistRow } from '@/data/deck'

export function DistBars({ rows }: { rows: DistRow[] }) {
  return (
    <div className="dist">
      {rows.map((r) => (
        <div className="drow" key={r.label}>
          <span className="dlab">{r.label}</span>
          <span className={`dbar${r.land ? ' land' : ''}`}>
            <span style={{ width: `${r.width}%` }} />
          </span>
          <span className="dval">{r.value}</span>
        </div>
      ))}
    </div>
  )
}
