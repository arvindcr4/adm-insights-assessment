import { describe, expect, it } from 'vitest'
import { makeInsight } from '@/test/fixtures'
import {
  deriveVisibleInsights,
  filterInsights,
  matchesSearch,
  sortInsights,
} from './insightFilters'

const a = makeInsight(1, {
  title: 'banana yields',
  content: 'zeta',
  metadata: { ...makeInsight(1).metadata, tags: ['tropical'], category: 'Fruit' },
})
const b = makeInsight(2, {
  title: 'Apple harvest',
  content: 'alpha',
  metadata: { ...makeInsight(2).metadata, tags: ['orchard'], category: 'Fruit' },
})
const c = makeInsight(3, {
  title: 'cherry export',
  content: 'Mid',
  metadata: {
    ...makeInsight(3).metadata,
    tags: ['orchard', 'export'],
    category: 'Trade',
    source: 'policy-watch',
  },
})

describe('matchesSearch', () => {
  it('matches case-insensitively on title, content, tags, category and source', () => {
    expect(matchesSearch(a, 'BANANA')).toBe(true)
    expect(matchesSearch(a, 'zeta')).toBe(true)
    expect(matchesSearch(c, 'orchard')).toBe(true)
    expect(matchesSearch(c, 'trade')).toBe(true)
    expect(matchesSearch(c, 'policy')).toBe(true)
    expect(matchesSearch(a, 'orchard')).toBe(false)
  })
  it('treats blank terms as match-all', () => {
    expect(matchesSearch(a, '   ')).toBe(true)
  })
})

describe('filterInsights', () => {
  it('returns the same array instance for an empty term (no needless re-renders)', () => {
    const list = [a, b, c]
    expect(filterInsights(list, '')).toBe(list)
  })
  it('filters by metadata', () => {
    expect(filterInsights([a, b, c], 'orchard').map((i) => i.id)).toEqual([b.id, c.id])
  })
})

describe('sortInsights', () => {
  it('sorts A–Z / Z–A by title ignoring case and does not mutate input', () => {
    const list = [a, b, c]
    expect(sortInsights(list, 'title', 'asc').map((i) => i.title)).toEqual([
      'Apple harvest',
      'banana yields',
      'cherry export',
    ])
    expect(sortInsights(list, 'title', 'desc').map((i) => i.title)).toEqual([
      'cherry export',
      'banana yields',
      'Apple harvest',
    ])
    expect(list.map((i) => i.id)).toEqual([a.id, b.id, c.id])
  })
  it('sorts by content', () => {
    expect(sortInsights([a, b, c], 'content', 'asc').map((i) => i.content)).toEqual([
      'alpha',
      'Mid',
      'zeta',
    ])
  })
})

describe('deriveVisibleInsights', () => {
  it('filters then sorts', () => {
    expect(deriveVisibleInsights([a, b, c], 'orchard', 'title', 'desc').map((i) => i.id)).toEqual([
      c.id,
      b.id,
    ])
  })
})
