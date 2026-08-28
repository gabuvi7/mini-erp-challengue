import { describe, expect, it } from 'vitest'
import { calculateBudgetTotals, parseDiscountPercent } from './money'
import type { Article, BudgetLineDraft } from './types'

function line(price: number, quantity: number, discountPercent: string, vatRate: number): BudgetLineDraft {
  const article: Article = {
    id: 1,
    codigo: 'TEST',
    descripcion: 'Test article',
    precioUnitario: price,
    stockActual: 100,
    alicuotaIva: vatRate,
  }

  return { article, quantity, discountPercent }
}

describe('calculateBudgetTotals', () => {
  it('applies each discount before calculating VAT', () => {
    const totals = calculateBudgetTotals([line(100, 2, '10', 21)])

    expect(totals?.subtotalMicros).toBe(180_000_000n)
    expect(totals?.vatCents).toBe(3_780n)
    expect(totals?.totalMicros).toBe(217_800_000n)
  })

  it('rounds VAT to cents per line before summing', () => {
    const totals = calculateBudgetTotals([
      line(0.05, 1, '0', 10),
      line(0.05, 1, '0', 10),
    ])

    expect(totals?.subtotalMicros).toBe(100_000n)
    expect(totals?.vatCents).toBe(2n)
    expect(totals?.totalMicros).toBe(120_000n)
  })

  it('retains fractional cents in the discounted subtotal', () => {
    const totals = calculateBudgetTotals([line(0.05, 1, '50', 21)])

    expect(totals?.subtotalMicros).toBe(25_000n)
    expect(totals?.vatCents).toBe(1n)
    expect(totals?.totalMicros).toBe(35_000n)
  })

  it('uses a valid two-decimal discount without changing its submitted value', () => {
    const discount = parseDiscountPercent('12.34')
    const totals = calculateBudgetTotals([line(100, 1, '12.34', 21)])

    expect(discount).toBe(12.34)
    expect(totals?.subtotalMicros).toBe(87_660_000n)
    expect(totals?.vatCents).toBe(1_841n)
  })

  it.each(['0.999', '1e-7'])('rejects unsupported discount syntax: %s', (input) => {
    expect(parseDiscountPercent(input)).toBeNull()
    expect(calculateBudgetTotals([line(1000, 1, input, 21)])).toBeNull()
  })
})
