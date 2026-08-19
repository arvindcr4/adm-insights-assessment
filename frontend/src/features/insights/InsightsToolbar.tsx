import { memo, useState, type ChangeEvent } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { Button } from '@/components/ui'
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback'
import styles from './InsightsToolbar.module.css'
import {
  searchTermChanged,
  selectSortDirection,
  selectSortField,
  sortDirectionToggled,
  sortFieldChanged,
  SORT_FIELDS,
  type SortField,
} from './insightsViewSlice'

export const SEARCH_DEBOUNCE_MS = 300

/** Search + sort controls. Memoised: it never depends on the list itself. */
export const InsightsToolbar = memo(function InsightsToolbar() {
  return (
    <div className={styles.toolbar} role="group" aria-label="Filter and sort insights">
      <SearchInput />
      <SortControls />
    </div>
  )
})

function SearchInput() {
  const dispatch = useAppDispatch()
  // Raw value is local so every keystroke does not touch the store; the store gets the debounced term.
  const [value, setValue] = useState('')
  const pushTerm = useDebouncedCallback((term: string) => {
    dispatch(searchTermChanged(term))
  }, SEARCH_DEBOUNCE_MS)

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value)
    pushTerm(e.target.value)
  }
  const onClear = () => {
    setValue('')
    pushTerm.cancel()
    dispatch(searchTermChanged(''))
  }

  return (
    <div className={styles.search}>
      <label htmlFor="insight-search" className="sr-only">
        Search insights
      </label>
      <input
        id="insight-search"
        type="search"
        className={styles.input}
        placeholder="Search text, category, tags…"
        value={value}
        onChange={onChange}
        autoComplete="off"
      />
      {value && (
        <Button variant="ghost" onClick={onClear} aria-label="Clear search">
          ×
        </Button>
      )}
    </div>
  )
}

const SORT_LABEL: Record<SortField, string> = { title: 'Title', content: 'Content' }

function SortControls() {
  const dispatch = useAppDispatch()
  const sortField = useAppSelector(selectSortField)
  const sortDirection = useAppSelector(selectSortDirection)

  return (
    <div className={styles.sort}>
      <label htmlFor="sort-field" className={styles.sortLabel}>
        Sort by
      </label>
      <select
        id="sort-field"
        className={styles.select}
        value={sortField}
        onChange={(e) => dispatch(sortFieldChanged(e.target.value as SortField))}
      >
        {SORT_FIELDS.map((f) => (
          <option key={f} value={f}>
            {SORT_LABEL[f]}
          </option>
        ))}
      </select>
      <Button
        variant="secondary"
        onClick={() => dispatch(sortDirectionToggled())}
        aria-label={`Sort ${sortDirection === 'asc' ? 'A to Z' : 'Z to A'}; click to toggle`}
        aria-pressed={sortDirection === 'desc'}
      >
        {sortDirection === 'asc' ? 'A → Z' : 'Z → A'}
      </Button>
    </div>
  )
}
