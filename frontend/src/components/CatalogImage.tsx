import type { ImgHTMLAttributes } from 'react'
import { useState } from 'react'

export function CatalogImage({ src, alt, sizes = '(max-width: 760px) 45vw, (max-width: 1100px) 25vw, 320px', ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const [failedSource, setFailedSource] = useState<string | null>(null)
  const failed = failedSource !== null && failedSource === src
  const bundled = src && /^\/images\/(hero|planter|seeds|light|tools|water|greens)\.jpg$/.test(src)
  const srcSet = bundled ? `${src.replace('.jpg', '-480.jpg')} 480w, ${src.replace('.jpg', '-960.jpg')} 960w, ${src} ${src.includes('hero') ? 1536 : 1254}w` : undefined
  return <img {...props} src={failed ? '/product-placeholder.svg' : src} alt={failed ? `${alt ?? 'Product'} · image unavailable` : alt} srcSet={failed ? undefined : srcSet} sizes={!failed && srcSet ? sizes : undefined} onError={() => setFailedSource(src ?? '')} />
}
