import type { ReactNode } from 'react'

/** Accent rouge inline — remplace le <em> de la version parchemin. */
export function Em({ children }: { children: ReactNode }) {
  return <em>{children}</em>
}

export type TagKind = 'crit' | 'hot' | 'cold' | 'ok' | 'myst'

export function Tag({ kind, children }: { kind: TagKind; children: ReactNode }) {
  return <span className={`tag t-${kind}`}>{children}</span>
}

export function Card({
  title,
  full,
  flat,
  children
}: {
  title?: ReactNode
  full?: boolean
  flat?: boolean
  children: ReactNode
}) {
  return (
    <div className={`card${full ? ' full' : ''}${flat ? ' flat' : ''}`}>
      {title && <h3>{title}</h3>}
      {children}
    </div>
  )
}

export function Item({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="item">
      <div className="t">{title}</div>
      <div className="d">{children}</div>
    </div>
  )
}

export function Note({ children }: { children: ReactNode }) {
  return <div className="note">{children}</div>
}

export function Alert({ heading, children }: { heading: ReactNode; children: ReactNode }) {
  return (
    <div className="alert">
      <div className="h">{heading}</div>
      <div className="b">{children}</div>
    </div>
  )
}
