import { useState } from 'react'
import { api } from '../api/client'
import type { Budget } from '../domain/types'
import { StatusMessage } from './StatusMessage'

interface BudgetListProps {
  budgets: Budget[]
  isLoading: boolean
  loadError: string
  onRefresh: () => Promise<void>
  onCreate: () => void
}

const currency = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol' })
const date = new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' })
const stateLabels: Record<Budget['estado'], string> = {
  Borrador: 'Borrador',
  Aprobado: 'Aprobado',
  Rechazado: 'Rechazado',
  Facturado: 'Facturado',
}

function getExpiry(budget: Budget): Date {
  const expiry = new Date(budget.fecha)
  expiry.setUTCDate(expiry.getUTCDate() + budget.validezDias)
  return expiry
}

function isExpired(budget: Budget): boolean {
  return Date.now() > getExpiry(budget).getTime()
}

export function BudgetList({ budgets, isLoading, loadError, onRefresh, onCreate }: BudgetListProps) {
  const [invoiceId, setInvoiceId] = useState<number | null>(null)
  const [actionError, setActionError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  async function handleInvoice(budget: Budget) {
    setInvoiceId(budget.id)
    setActionError('')
    setSuccessMessage('')

    try {
      const invoice = await api.invoiceBudget(budget.id)
      setSuccessMessage(`La factura #${invoice.numero} se creó a partir del presupuesto #${budget.numero}.`)
      await onRefresh()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'No se pudo facturar el presupuesto.')
    } finally {
      setInvoiceId(null)
    }
  }

  return (
    <section aria-labelledby="budget-list-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Registro de ventas</p>
          <h1 id="budget-list-title">Presupuestos</h1>
          <p className="section-summary">Revise la vigencia, los totales y la disponibilidad para facturar desde un solo lugar.</p>
        </div>
        <button className="button button--primary" type="button" onClick={onCreate}>Crear presupuesto</button>
      </div>

      {actionError && <StatusMessage tone="error">{actionError}</StatusMessage>}
      {successMessage && <StatusMessage tone="success">{successMessage}</StatusMessage>}
      {loadError && (
        <StatusMessage tone="error">
          {loadError} <button className="text-button" type="button" onClick={() => void onRefresh()}>Reintentar</button>
        </StatusMessage>
      )}

      {isLoading ? (
        <div className="loading-state" role="status"><span className="spinner" aria-hidden="true" />Cargando presupuestos…</div>
      ) : budgets.length === 0 && !loadError ? (
        <div className="empty-state">
          <p className="empty-state__title">Aún no hay presupuestos</p>
          <p>Cree el primer presupuesto para iniciar el registro de ventas.</p>
          <button className="button button--secondary" type="button" onClick={onCreate}>Crear el primer presupuesto</button>
        </div>
      ) : (
        <div className="ledger" aria-label="Lista de presupuestos">
          <div className="ledger__header" aria-hidden="true">
            <span>Presupuesto</span><span>Cliente</span><span>Vigencia</span><span>Artículos</span><span>Importes</span><span>Acción</span>
          </div>
          {budgets.map((budget) => {
            const expired = isExpired(budget)
            const invoiced = budget.estado === 'Facturado'
            const disabledReason = invoiced ? 'Ya facturado' : expired ? 'Vencido' : ''

            return (
              <article className="ledger-row" key={budget.id}>
                <div className="ledger-cell ledger-cell--identity">
                  <span className="mobile-label">Presupuesto</span>
                  <strong>#{budget.numero}</strong>
                  <span>{date.format(new Date(budget.fecha))}</span>
                  <span className={`badge ${invoiced ? 'badge--neutral' : 'badge--active'}`}>{stateLabels[budget.estado]}</span>
                </div>
                <div className="ledger-cell">
                  <span className="mobile-label">Cliente</span>
                  <strong>{budget.clienteRazonSocial}</strong>
                  <span>Cliente #{budget.clienteId}</span>
                </div>
                <div className="ledger-cell">
                  <span className="mobile-label">Vigencia</span>
                  <strong className={expired && !invoiced ? 'warning-text' : ''}>
                    {expired ? 'Vencido' : `Hasta el ${date.format(getExpiry(budget))}`}
                  </strong>
                  <span>{budget.validezDias} {budget.validezDias === 1 ? 'día' : 'días'}</span>
                </div>
                <div className="ledger-cell">
                  <span className="mobile-label">Artículos</span>
                  <strong>{budget.items.length} {budget.items.length === 1 ? 'línea' : 'líneas'}</strong>
                  <span>{budget.items.reduce((sum, item) => sum + item.cantidad, 0)} unidades</span>
                </div>
                <div className="ledger-cell ledger-cell--money">
                  <span className="mobile-label">Importes</span>
                  <strong>{currency.format(budget.total)}</strong>
                  <span>Neto {currency.format(budget.subtotal)} · IVA {currency.format(budget.iva)}</span>
                </div>
                <div className="ledger-cell ledger-cell--action">
                  <button
                    className="button button--invoice"
                    type="button"
                    disabled={Boolean(disabledReason) || invoiceId !== null}
                    onClick={() => void handleInvoice(budget)}
                    aria-describedby={disabledReason ? `invoice-reason-${budget.id}` : undefined}
                  >
                    {invoiceId === budget.id ? 'Facturando…' : invoiced ? 'Facturado' : 'Facturar'}
                  </button>
                  {disabledReason && <span id={`invoice-reason-${budget.id}`} className="action-reason">{disabledReason}</span>}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
