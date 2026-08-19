import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { makeInsights } from '@/test/fixtures'
import { renderWithStore } from '@/test/render'
import { InsightList, VIRTUALIZE_FROM } from './InsightList'

describe('InsightList windowing', () => {
  it('renders every card below the threshold', () => {
    renderWithStore(
      <InsightList insights={makeInsights(VIRTUALIZE_FROM - 1)} loading={false} searchTerm="" />,
    )
    expect(screen.getAllByTestId('insight-card')).toHaveLength(VIRTUALIZE_FROM - 1)
  })

  it('only mounts the visible window for large lists', () => {
    const many = makeInsights(400)
    renderWithStore(<InsightList insights={many} loading={false} searchTerm="" />)
    const rendered = screen.getAllByTestId('insight-card').length
    expect(rendered).toBeGreaterThan(0)
    expect(rendered).toBeLessThan(100)
    expect(screen.getByRole('list')).toHaveAttribute('aria-rowcount', '400')
  })
})
