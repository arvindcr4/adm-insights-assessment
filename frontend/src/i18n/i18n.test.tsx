import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { App } from '@/app/App'
import { renderWithStore } from '@/test/render'
import { de } from './messages/de'
import { en } from './messages/en'
import { es } from './messages/es'
import { fr } from './messages/fr'
import { translate } from './index'

function keysOf(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null && !('other' in v)
      ? keysOf(v, `${prefix}${k}.`)
      : [`${prefix}${k}`],
  )
}

describe('i18n', () => {
  it('every locale defines exactly the same keys as en', () => {
    const base = keysOf(en).sort()
    for (const [name, dict] of Object.entries({ es, fr, de })) {
      expect(keysOf(dict).sort(), name).toEqual(base)
    }
  })

  it('interpolates params and picks plural forms per locale', () => {
    expect(translate('en', 'insights.turn', { turn: 3 })).toBe('turn 3')
    expect(translate('en', 'history.insights', { count: 1 })).toBe('1 insight')
    expect(translate('de', 'history.insights', { count: 2 })).toBe('2 Insights')
    expect(translate('fr', 'insights.heading', { prompt: 'x' })).toBe('Insights pour « x »')
  })

  it('switches the whole UI when the target language changes', async () => {
    const user = userEvent.setup()
    renderWithStore(<App />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Insights Console')
    expect(screen.getByRole('button', { name: 'Get insights' })).toBeInTheDocument()

    await user.selectOptions(screen.getByRole('combobox', { name: /target language/i }), 'es')
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      'Consola de Insights',
    )
    expect(screen.getByRole('button', { name: 'Obtener insights' })).toBeInTheDocument()
    expect(screen.getByText('Pregunta algo para empezar')).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('es')

    // Validation messages follow the locale too.
    await user.type(screen.getByRole('textbox', { name: 'Consulta' }), 'x')
    await user.clear(screen.getByRole('textbox', { name: 'Consulta' }))
    expect(await screen.findByText('La consulta es obligatoria')).toBeInTheDocument()

    await user.selectOptions(screen.getByRole('combobox', { name: /idioma de destino/i }), 'de')
    expect(await screen.findByRole('button', { name: 'Insights abrufen' })).toBeInTheDocument()
    expect(screen.getByText('Die Anfrage ist erforderlich')).toBeInTheDocument()
  })

  it('localizes result chrome after a submission in French', async () => {
    const user = userEvent.setup()
    renderWithStore(<App />)
    await user.selectOptions(screen.getByRole('combobox', { name: /target language/i }), 'fr')
    await user.type(screen.getByRole('textbox', { name: 'Requête' }), 'soybean crush margins')
    await user.click(screen.getByRole('button', { name: 'Obtenir des insights' }))
    expect(await screen.findByRole('heading', { name: /insights pour/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Charger plus' })).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Rechercher des insights' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Historique de la conversation' })).toHaveTextContent(
      '23 insights',
    )
  })
})
