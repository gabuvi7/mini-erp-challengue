export interface Article {
  id: number
  codigo: string
  descripcion: string
  precioUnitario: number
  stockActual: number
  alicuotaIva: number
}

export interface Customer {
  id: number
  razonSocial: string
  cuit: string
  condicionIva: string
}

export interface BudgetItem {
  articuloId: number
  articuloCodigo: string
  articuloDescripcion: string
  cantidad: number
  precioUnitario: number
  descuentoPct: number
  alicuotaIva: number
  subtotalLinea: number
}

export interface Budget {
  id: number
  numero: number
  fecha: string
  clienteId: number
  clienteRazonSocial: string
  estado: 'Borrador' | 'Aprobado' | 'Rechazado' | 'Facturado'
  validezDias: number
  items: BudgetItem[]
  subtotal: number
  iva: number
  total: number
}

export interface BudgetLineDraft {
  article: Article
  quantity: number
  discountPercent: string
}

export interface CreateBudgetRequest {
  clienteId: number
  validezDias: number
  items: Array<{
    articuloId: number
    cantidad: number
    descuentoPct: number
  }>
}

export interface Invoice {
  id: number
  numero: number
  fecha: string
  presupuestoId: number
  subtotal: number
  iva: number
  total: number
}
