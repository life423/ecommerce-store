import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { CatalogImage } from './CatalogImage'

it('serves responsive bundled assets and replaces failed images with an accessible fallback', () => {
  const { rerender } = render(<CatalogImage src="/images/planter.jpg" alt="A planter" />)
  const image = screen.getByRole('img')
  expect(image).toHaveAttribute('srcset', expect.stringContaining('480w'))
  fireEvent.error(image)
  expect(image).toHaveAttribute('src', '/product-placeholder.svg')
  expect(image).not.toHaveAttribute('srcset')
  expect(image).toHaveAccessibleName('A planter · image unavailable')
  rerender(<CatalogImage src="https://example.com/new-photo.jpg" alt="New photo" />)
  expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/new-photo.jpg')
})
