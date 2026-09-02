import type { Article, Budget, CreateBudgetRequest, Customer, Invoice } from '../domain/types'

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5080').replace(/\/$/, '')

interface ApiErrorBody {
  error?: string
  title?: string
  errors?: Record<string, string[]>
}

export class ApiError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options?.headers },
    })
  } catch {
    throw new ApiError(`No se pudo conectar con la API en ${API_URL}. Verifique que el servidor esté en ejecución.`)
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody
    const validationMessage = body.errors ? Object.values(body.errors).flat().join(' ') : undefined
    throw new ApiError(body.error || validationMessage || body.title || `La solicitud falló (${response.status}).`, response.status)
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const api = {
  listBudgets: () => request<Budget[]>('/api/presupuestos'),
  listCustomers: () => request<Customer[]>('/api/clientes'),
  searchArticles: (query: string) =>
    request<Article[]>(`/api/articulos?busqueda=${encodeURIComponent(query)}`),
  createBudget: (budget: CreateBudgetRequest) =>
    request<Budget>('/api/presupuestos', { method: 'POST', body: JSON.stringify(budget) }),
  invoiceBudget: (budgetId: number) =>
    request<Invoice>(`/api/facturas/facturar/${budgetId}`, { method: 'POST' }),
}
