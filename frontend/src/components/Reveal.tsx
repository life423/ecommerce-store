import { useEffect, useRef } from 'react'
import type { CSSProperties, ReactNode } from 'react'

/** Content remains visible without observer support and when reduced motion is requested. */
export function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = ref.current!
    if (!('IntersectionObserver' in window) || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    if (element.getBoundingClientRect().top < window.innerHeight - 32) return
    element.dataset.reveal = 'pending'
    const reveal = () => { element.dataset.reveal = 'visible'; observer.unobserve(element) }
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) reveal() }, { threshold: .08, rootMargin: '0px 0px -24px 0px' })
    observer.observe(element)
    element.addEventListener('focusin', reveal)
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const respectPreference = () => { if (media?.matches) reveal() }
    media?.addEventListener('change', respectPreference)
    return () => { observer.disconnect(); element.removeEventListener('focusin', reveal); media?.removeEventListener('change', respectPreference) }
  }, [])
  return <div ref={ref} className={`reveal ${className}`} style={{ '--reveal-delay': `${delay}ms` } as CSSProperties}>{children}</div>
}
