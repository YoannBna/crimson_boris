import { useState, type ReactNode } from 'react'

interface Props {
  id: string
  num: string
  title: string
  children: ReactNode
  defaultCollapsed?: boolean
}

export function ModuleSection({ id, num, title, children, defaultCollapsed = false }: Props) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  return (
    <section id={id} className={collapsed ? 'collapsed' : undefined}>
      <div
        className="mod-head"
        role="button"
        tabIndex={0}
        onClick={() => setCollapsed((c) => !c)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setCollapsed((c) => !c)
          }
        }}
      >
        <span className="mod-num">{num}</span>
        <span className="mod-title">{title}</span>
        <span className="chev">[ {collapsed ? 'DEPLIER' : 'REPLIER'} ]</span>
      </div>
      {children}
    </section>
  )
}
