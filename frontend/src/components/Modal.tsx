import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Icon } from './Icon'
import { DialogContext } from './dialogContext'

/** Native modal semantics provide the top layer, inert background, and focus containment. */
export function Modal({ labelledBy, closeLabel, className = '', onDismiss, children }: {
  labelledBy: string; closeLabel: string; className?: string; onDismiss: () => void
  children: ReactNode
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    const element = dialog.current!
    const originalOverflow = document.body.style.overflow
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    document.body.style.overflow = 'hidden'
    element.showModal()
    return () => {
      if (timer.current) clearTimeout(timer.current)
      if (element.open) element.close()
      document.body.style.overflow = originalOverflow
      if (trigger?.isConnected) trigger.focus({ preventScroll: true })
    }
  }, [])

  function dismiss(immediate = false) {
    if (closing || timer.current) return
    if (immediate || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      dialog.current?.close()
      return
    }
    setClosing(true)
    timer.current = setTimeout(() => dialog.current?.close(), 160)
  }

  return <dialog ref={dialog} aria-labelledby={labelledBy} className={`rewild-dialog ${className}`} data-closing={closing || undefined}
    onCancel={event => { event.preventDefault(); dismiss() }} onClose={() => { if (!dialog.current?.open) onDismiss() }}
    onClick={event => { if (event.target === event.currentTarget) dismiss() }}>
    <div className="modal-surface">
      <button type="button" className="modal-close icon-button" aria-label={closeLabel} onClick={() => dismiss()}><Icon name="close" /></button>
      <DialogContext value={dismiss}>{children}</DialogContext>
    </div>
  </dialog>
}
