import { calculateBudgetTotals, formatCents, formatMicros } from '../domain/money'
import type { BudgetLineDraft } from '../domain/types'

export function TotalsRail({ lines }: { lines: BudgetLineDraft[] }) {
  const totals = calculateBudgetTotals(lines)

  return (
    <aside className="totals-rail" aria-labelledby="totals-title" aria-live="polite">
      <p className="eyebrow">Conciliación en tiempo real</p>
      <h2 id="totals-title">Totales del presupuesto</h2>
      {totals ? (
        <dl>
          <div><dt>Subtotal con descuentos</dt><dd>{formatMicros(totals.subtotalMicros)}</dd></div>
          <div><dt>IVA</dt><dd>{formatCents(totals.vatCents)}</dd></div>
          <div className="totals-rail__total"><dt>Total</dt><dd>{formatMicros(totals.totalMicros)}</dd></div>
        </dl>
      ) : (
        <p className="totals-rail__invalid">Corrija los errores de las líneas para calcular los totales.</p>
      )}
      <div className="reconcile-line" aria-hidden="true">
        <span>NETO</span><span>+</span><span>IVA</span><span>=</span><strong>TOTAL</strong>
      </div>
      <p className="calculation-note">El IVA se redondea a dos decimales por línea antes de sumarlo.</p>
    </aside>
  )
}
