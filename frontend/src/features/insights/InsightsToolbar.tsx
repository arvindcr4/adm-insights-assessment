import { memo, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { Button } from '@/components/ui'
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback'
import { useT } from '@/i18n'
import styles from './InsightsToolbar.module.css'
import {
  searchTermChanged,
  selectSearchTerm,
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
  const t = useT()
  return (
    <div className={styles.toolbar} role="group" aria-label={t('insights.toolbarLabel')}>
      <SearchInput />
      <SortControls />
    </div>
  )
})

function SearchInput() {
  const dispatch = useAppDispatch()
  const t = useT()
  // Raw value is local so every keystroke does not touch the store; the store gets the debounced term.
  const storeTerm = useAppSelector(selectSearchTerm)
  const [value, setValue] = useState(storeTerm)
  const lastPushed = useRef(storeTerm)
  const pushTerm = useDebouncedCallback((term: string) => {
    lastPushed.current = term
    dispatch(searchTermChanged(term))
  }, SEARCH_DEBOUNCE_MS)

  // If the store term changes from elsewhere (e.g. reset on a new answer), follow it.
  useEffect(() => {
    if (storeTerm !== lastPushed.current) {
      lastPushed.current = storeTerm
      setValue(storeTerm)
    }
  }, [storeTerm])

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value)
    pushTerm(e.target.value)
  }
  const onClear = () => {
    setValue('')
    pushTerm.cancel()
    lastPushed.current = ''
    dispatch(searchTermChanged(''))
  }

  return (
    <div className={styles.search}>
      <label htmlFor="insight-search" className="sr-only">
        {t('insights.searchLabel')}
      </label>
      <input
        id="insight-search"
        type="search"
        className={styles.input}
        placeholder={t('insights.searchPlaceholder')}
        value={value}
        onChange={onChange}
        autoComplete="off"
      />
      {value && (
        <Button variant="ghost" onClick={onClear} aria-label={t('insights.clearSearch')}>
          ×
        </Button>
      )}
    </div>
  )
}

const SORT_LABEL_KEY = { title: 'insights.sortTitle', content: 'insights.sortContent' } as const

function SortControls() {
  const dispatch = useAppDispatch()
  const t = useT()
  const sortField = useAppSelector(selectSortField)
  const sortDirection = useAppSelector(selectSortDirection)

  return (
    <div className={styles.sort}>
      <label htmlFor="sort-field" className={styles.sortLabel}>
        {t('insights.sortBy')}
      </label>
      <select
        id="sort-field"
        className={styles.select}
        value={sortField}
        onChange={(e) => dispatch(sortFieldChanged(e.target.value as SortField))}
      >
        {SORT_FIELDS.map((f) => (
          <option key={f} value={f}>
            {t(SORT_LABEL_KEY[f])}
          </option>
        ))}
      </select>
      <Button
        variant="secondary"
        onClick={() => dispatch(sortDirectionToggled())}
        aria-label={t('insights.sortToggleAria', {
          order: t(sortDirection === 'asc' ? 'insights.sortOrderAsc' : 'insights.sortOrderDesc'),
        })}
        aria-pressed={sortDirection === 'desc'}
      >
        {sortDirection === 'asc' ? t('insights.sortAsc') : t('insights.sortDesc')}
      </Button>
    </div>
  )
}
