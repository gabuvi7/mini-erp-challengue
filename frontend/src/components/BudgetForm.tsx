import { useEffect, useId, useState } from 'react'
import { api } from '../api/client'
import { parseDiscountPercent } from '../domain/money'
import type { Article, BudgetLineDraft, CreateBudgetRequest, Customer } from '../domain/types'
import { StatusMessage } from './StatusMessage'
import { TotalsRail } from './TotalsRail'

interface BudgetFormProps {
  customers: Customer[]
  customersError: string
  isLoadingCustomers: boolean
  onRetryCustomers: () => Promise<void>
  onCancel: () => void
  onCreated: (budgetNumber: number) => Promise<void>
}

const currency = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol' })

interface LineValidation {
  quantity?: string
  discount?: string
}

function getLineValidation(line: BudgetLineDraft): LineValidation {
  return {
    quantity: !Number.isInteger(line.quantity) || line.quantity <= 0 ? 'Ingrese un número entero positivo.' : undefined,
    discount: parseDiscountPercent(line.discountPercent) === null
      ? 'Use un número decimal entre 0 y 100 con un máximo de dos decimales.'
      : undefined,
  }
}

export function BudgetForm({ customers, customersError, isLoadingCustomers, onRetryCustomers, onCancel, onCreated }: BudgetFormProps) {
  const searchId = useId()
  const [customerId, setCustomerId] = useState(0)
  const [validityDays, setValidityDays] = useState(15)
  const [lines, setLines] = useState<BudgetLineDraft[]>([])
  const [query, setQuery] = useState('')
  const [articles, setArticles] = useState<Article[]>([])
  const [isSearching, setIsSearching] = useState(true)
  const [searchError, setSearchError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [showValidation, setShowValidation] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const customerError = !customerId ? 'Seleccione un cliente.' : ''
  const validityError = !Number.isInteger(validityDays) || validityDays <= 0 ? 'Ingrese un número entero positivo.' : ''
  const lineErrors = new Map(lines.map((line) => [line.article.id, getLineValidation(line)]))
  const hasLineErrors = [...lineErrors.values()].some((errors) => errors.quantity || errors.discount)
  const validationSummary = customerError || validityError || lines.length === 0 || hasLineErrors
    ? 'Revise los campos destacados antes de guardar.'
    : ''

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setIsSearching(true)
      setSearchError('')
      try {
        const matches = await api.searchArticles(query.trim())
        if (!controller.signal.aborted) setArticles(matches)
      } catch (error) {
        if (!controller.signal.aborted) {
          setArticles([])
          setSearchError(error instanceof Error ? error.message : 'No se pudieron cargar los artículos.')
        }
      } finally {
        if (!controller.signal.aborted) setIsSearching(false)
      }
    }, 250)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [query])

  function addArticle(article: Article) {
    setLines((current) => current.some((line) => line.article.id === article.id)
      ? current
      : [...current, { article, quantity: 1, discountPercent: '0' }])
  }

  function updateLine(articleId: number, updates: Partial<Pick<BudgetLineDraft, 'quantity' | 'discountPercent'>>) {
    setLines((current) => current.map((line) => line.article.id === articleId ? { ...line, ...updates } : line))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setShowValidation(true)
    setSubmitError('')
    if (validationSummary) return

    const items: CreateBudgetRequest['items'] = []
    for (const line of lines) {
      const discountPercent = parseDiscountPercent(line.discountPercent)
      if (discountPercent === null) return
      items.push({
        articuloId: line.article.id,
        cantidad: line.quantity,
        descuentoPct: discountPercent,
      })
    }

    const request: CreateBudgetRequest = {
      clienteId: customerId,
      validezDias: validityDays,
      items,
    }

    setIsSubmitting(true)
    try {
      const budget = await api.createBudget(request)
      await onCreated(budget.numero)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'No se pudo crear el presupuesto.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section aria-labelledby="create-budget-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Nuevo documento de venta</p>
          <h1 id="create-budget-title">Crear presupuesto</h1>
          <p className="section-summary">Defina las condiciones comerciales, agregue los artículos y verifique los impuestos antes de guardar.</p>
        </div>
        <button className="button button--quiet" type="button" onClick={onCancel}>Volver a presupuestos</button>
      </div>

      <form onSubmit={(event) => void handleSubmit(event)} noValidate>
        {submitError && <StatusMessage tone="error">{submitError}</StatusMessage>}
        {showValidation && validationSummary && <StatusMessage tone="error"><span id="form-validation">{validationSummary}</span></StatusMessage>}
        {customersError && (
          <StatusMessage tone="error">
            {customersError} <button className="text-button" type="button" onClick={() => void onRetryCustomers()}>Reintentar</button>
          </StatusMessage>
        )}

        <div className="workbench">
          <div className="workbench__main">
            <fieldset className="terms-panel">
              <legend>Condiciones comerciales</legend>
              <div className="field">
                <label htmlFor="customer">Cliente</label>
                <select id="customer" value={customerId} onChange={(event) => setCustomerId(Number(event.target.value))} disabled={isLoadingCustomers || Boolean(customersError) || customers.length === 0} required aria-invalid={showValidation && Boolean(customerError)} aria-describedby={showValidation && customerError ? 'customer-error' : undefined}>
                  <option value={0}>{isLoadingCustomers ? 'Cargando clientes…' : customersError ? 'Clientes no disponibles' : customers.length === 0 ? 'No hay clientes disponibles' : 'Seleccione un cliente'}</option>
                  {customers.map((customer) => <option value={customer.id} key={customer.id}>{customer.razonSocial} · {customer.cuit}</option>)}
                </select>
                {showValidation && customerError && !isLoadingCustomers && !customersError && <span className="field-error" id="customer-error">{customerError}</span>}
              </div>
              <div className="field field--compact">
                <label htmlFor="validity">Validez (días)</label>
                <input id="validity" type="number" min="1" step="1" value={validityDays} onChange={(event) => setValidityDays(Number.isFinite(event.target.valueAsNumber) ? event.target.valueAsNumber : 0)} required aria-invalid={showValidation && Boolean(validityError)} aria-describedby={showValidation && validityError ? 'validity-error' : undefined} />
                {showValidation && validityError && <span className="field-error" id="validity-error">{validityError}</span>}
              </div>
            </fieldset>

            <section className="article-picker" aria-labelledby="article-picker-title">
              <div className="subsection-heading">
                <div><p className="eyebrow">Catálogo</p><h2 id="article-picker-title">Agregar artículos</h2></div>
                <span>{articles.length} {articles.length === 1 ? 'resultado' : 'resultados'}</span>
              </div>
              <div className="field search-field">
                <label htmlFor={searchId}>Buscar por código o descripción</label>
                <input id={searchId} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ej.: TEC-001 o teclado" autoComplete="off" />
              </div>
              {searchError && <StatusMessage tone="error">{searchError}</StatusMessage>}
              {isSearching ? (
                <div className="inline-state" role="status"><span className="spinner" aria-hidden="true" />Buscando en el catálogo…</div>
              ) : articles.length === 0 ? (
                <p className="inline-state">Ningún artículo coincide con la búsqueda.</p>
              ) : (
                <ul className="article-results">
                  {articles.map((article) => {
                    const added = lines.some((line) => line.article.id === article.id)
                    return (
                      <li key={article.id}>
                        <div><strong>{article.codigo}</strong><span>{article.descripcion}</span></div>
                        <div className="article-results__facts"><span>{currency.format(article.precioUnitario)}</span><span>{article.alicuotaIva}% IVA</span><span>{article.stockActual} disponibles</span></div>
                        <button className="button button--small" type="button" disabled={added} onClick={() => addArticle(article)}>{added ? 'Agregado' : 'Agregar'}</button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            <section className="line-editor" aria-labelledby="line-editor-title">
              <div className="subsection-heading"><div><p className="eyebrow">Detalle del presupuesto</p><h2 id="line-editor-title">Artículos</h2></div><span>{lines.length} {lines.length === 1 ? 'línea' : 'líneas'}</span></div>
              <span className="visually-hidden" id="discount-format-help">Use un porcentaje decimal entre 0 y 100 con un máximo de dos decimales. No se acepta la notación científica.</span>
              {lines.length === 0 ? (
                <p className="inline-state">Busque en el catálogo y agregue un artículo para comenzar.</p>
              ) : (
                <div className="line-editor__rows">
                  {lines.map((line) => (
                    <div className="line-item" key={line.article.id}>
                      <div className="line-item__name"><strong>{line.article.codigo}</strong><span>{line.article.descripcion}</span><small>{currency.format(line.article.precioUnitario)} · {line.article.alicuotaIva}% IVA</small></div>
                      <div className="field field--numeric">
                        <label htmlFor={`quantity-${line.article.id}`}>Cantidad</label>
                        <input id={`quantity-${line.article.id}`} type="number" min="1" step="1" value={line.quantity} onChange={(event) => updateLine(line.article.id, { quantity: Number.isFinite(event.target.valueAsNumber) ? Math.max(0, event.target.valueAsNumber) : 0 })} required aria-invalid={showValidation && Boolean(lineErrors.get(line.article.id)?.quantity)} aria-describedby={showValidation && lineErrors.get(line.article.id)?.quantity ? `quantity-error-${line.article.id}` : undefined} />
                        {showValidation && lineErrors.get(line.article.id)?.quantity && <span className="field-error" id={`quantity-error-${line.article.id}`}>{lineErrors.get(line.article.id)?.quantity}</span>}
                      </div>
                      <div className="field field--numeric">
                        <label htmlFor={`discount-${line.article.id}`}>Descuento % <span>(máx. 2 decimales)</span></label>
                        <input id={`discount-${line.article.id}`} type="text" inputMode="decimal" value={line.discountPercent} onChange={(event) => updateLine(line.article.id, { discountPercent: event.target.value })} required aria-invalid={Boolean(lineErrors.get(line.article.id)?.discount)} aria-describedby={`${showValidation && lineErrors.get(line.article.id)?.discount ? `discount-error-${line.article.id} ` : ''}discount-format-help`} />
                        {lineErrors.get(line.article.id)?.discount && <span className="field-error" id={`discount-error-${line.article.id}`}>{lineErrors.get(line.article.id)?.discount}</span>}
                      </div>
                      <button className="remove-button" type="button" onClick={() => setLines((current) => current.filter((item) => item.article.id !== line.article.id))} aria-label={`Quitar ${line.article.descripcion}`}>Quitar</button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="workbench__rail">
            <TotalsRail lines={lines} />
            <button className="button button--primary button--full" type="submit" disabled={isSubmitting || isLoadingCustomers || Boolean(customersError) || customers.length === 0 || lines.length === 0}>{isSubmitting ? 'Guardando presupuesto…' : 'Guardar presupuesto aprobado'}</button>
            <p className="submit-note">Los precios y las alícuotas de IVA se confirman en el servidor al guardar.</p>
          </div>
        </div>
      </form>
    </section>
  )
}
