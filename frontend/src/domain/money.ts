import type { BudgetLineDraft } from './types'

const MICRO_UNITS_PER_CURRENCY_UNIT = 1_000_000n
const MICRO_UNITS_PER_CENT = 10_000n
const RATE_BASIS = 10_000n
const DISCOUNT_PATTERN = /^(?:0|[1-9]\d?|100)(?:\.\d{1,2})?$/

export interface BudgetTotals {
  subtotalMicros: bigint
  vatCents: bigint
  totalMicros: bigint
}

function toScaledInteger(value: number, decimalPlaces: number): bigint {
  if (!Number.isFinite(value)) throw new RangeError('Los valores monetarios deben ser números finitos.')
  return BigInt(Math.round(value * 10 ** decimalPlaces))
}

export function parseDiscountPercent(input: string): number | null {
  if (!DISCOUNT_PATTERN.test(input)) return null
  const value = Number(input)
  return value >= 0 && value <= 100 ? value : null
}

function calculateLineSubtotalMicros(line: BudgetLineDraft, discountPercent: number): bigint {
  const priceCents = toScaledInteger(line.article.precioUnitario, 2)
  const discountBasisPoints = toScaledInteger(discountPercent, 2)

  return priceCents * BigInt(line.quantity) * (RATE_BASIS - discountBasisPoints)
}

function roundPositiveFraction(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator / 2n) / denominator
}

export function calculateBudgetTotals(lines: BudgetLineDraft[]): BudgetTotals | null {
  let subtotalMicros = 0n
  let vatCents = 0n

  for (const line of lines) {
    const discountPercent = parseDiscountPercent(line.discountPercent)
    if (discountPercent === null || !Number.isInteger(line.quantity) || line.quantity <= 0) return null

    const lineSubtotalMicros = calculateLineSubtotalMicros(line, discountPercent)
    const vatBasisPoints = toScaledInteger(line.article.alicuotaIva, 2)
    const vatNumerator = lineSubtotalMicros * vatBasisPoints
    const vatDenominator = MICRO_UNITS_PER_CURRENCY_UNIT * 100n

    subtotalMicros += lineSubtotalMicros
    vatCents += roundPositiveFraction(vatNumerator, vatDenominator)
  }

  return {
    subtotalMicros,
    vatCents,
    totalMicros: subtotalMicros + vatCents * MICRO_UNITS_PER_CENT,
  }
}

export function formatMicros(value: bigint): string {
  const cents = roundPositiveFraction(value, MICRO_UNITS_PER_CENT)
  const whole = cents / 100n
  const fraction = String(cents % 100n).padStart(2, '0')
  return `$${whole.toLocaleString('es-AR')},${fraction}`
}

export function formatCents(value: bigint): string {
  return formatMicros(value * MICRO_UNITS_PER_CENT)
}
