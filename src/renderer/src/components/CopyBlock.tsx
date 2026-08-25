import { useState } from 'react'

interface Props {
  label: string
  body: string
}

/** Modele de reponse pret a l'emploi, copiable en un geste. */
export function CopyBlock({ label, body }: Props) {
  const [copied, setCopied] = useState(false)

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(body)
    } catch {
      const t = document.createElement('textarea')
      t.value = body
      t.style.position = 'fixed'
      t.style.opacity = '0'
      document.body.appendChild(t)
      t.select()
      document.execCommand('copy')
      document.body.removeChild(t)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="reply">
      <div className="reply-h">
        {label}
        <button className={`btn${copied ? ' done' : ''}`} onClick={copy}>
          {copied ? 'Copie' : 'Copier'}
        </button>
      </div>
      <pre>{body}</pre>
    </div>
  )
}
