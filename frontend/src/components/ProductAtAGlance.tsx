import { useId } from 'react'
import { Icon } from './Icon'

export function ProductAtAGlance({ highlights, heading: Heading = 'h2' }: {
  highlights: string[]
  heading?: 'h2' | 'h3'
}) {
  const titleId = useId()
  if (!highlights.length) return null

  return (
    <section className="product-at-a-glance" aria-labelledby={titleId}>
      <Heading id={titleId}>At a glance</Heading>
      <ul role="list">
        {highlights.map((fact, index) => (
          <li key={`${index}-${fact}`}>
            <Icon name="check" size={17} />
            <span>{fact}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
