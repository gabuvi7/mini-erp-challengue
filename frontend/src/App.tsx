import { useCallback, useEffect, useState } from 'react'
import { api } from './api/client'
import { BudgetForm } from './components/BudgetForm'
import { BudgetList } from './components/BudgetList'
import { StatusMessage } from './components/StatusMessage'
import type { Budget, Customer } from './domain/types'
import './App.css'

type View = 'list' | 'create'

function App() {
  const [view, setView] = useState<View>('list')
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoadingBudgets, setIsLoadingBudgets] = useState(true)
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true)
  const [budgetsError, setBudgetsError] = useState('')
  const [customersError, setCustomersError] = useState('')
  const [notice, setNotice] = useState('')

  const loadBudgets = useCallback(async () => {
    setIsLoadingBudgets(true)
    setBudgetsError('')
    try {
      setBudgets(await api.listBudgets())
    } catch (error) {
      setBudgetsError(error instanceof Error ? error.message : 'No se pudieron cargar los presupuestos.')
    } finally {
      setIsLoadingBudgets(false)
    }
  }, [])

  const loadCustomers = useCallback(async () => {
    setIsLoadingCustomers(true)
    setCustomersError('')
    try {
      setCustomers(await api.listCustomers())
    } catch (error) {
      setCustomers([])
      setCustomersError(error instanceof Error ? error.message : 'No se pudieron cargar los clientes.')
    } finally {
      setIsLoadingCustomers(false)
    }
  }, [])

  useEffect(() => {
    void api.listBudgets()
      .then(setBudgets)
      .catch((error: unknown) => setBudgetsError(error instanceof Error ? error.message : 'No se pudieron cargar los presupuestos.'))
      .finally(() => setIsLoadingBudgets(false))
    void api.listCustomers()
      .then(setCustomers)
      .catch((error: unknown) => setCustomersError(error instanceof Error ? error.message : 'No se pudieron cargar los clientes.'))
      .finally(() => setIsLoadingCustomers(false))
  }, [])

  async function handleCreated(budgetNumber: number) {
    await loadBudgets()
    setNotice(`El presupuesto #${budgetNumber} se creó correctamente.`)
    setView('list')
  }

  function showCreate() {
    setNotice('')
    setView('create')
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <button className="brand" type="button" onClick={() => setView('list')} aria-label="Inicio de presupuestos de Mini ERP">
          <span className="brand__mark" aria-hidden="true">M</span>
          <span><strong>Mini ERP</strong><small>Mesa de operaciones</small></span>
        </button>
        <nav aria-label="Navegación principal">
          <button type="button" className={view === 'list' ? 'nav-button nav-button--active' : 'nav-button'} onClick={() => setView('list')} aria-current={view === 'list' ? 'page' : undefined}>Presupuestos</button>
          <button type="button" className={view === 'create' ? 'nav-button nav-button--active' : 'nav-button'} onClick={showCreate} aria-current={view === 'create' ? 'page' : undefined}>Crear</button>
        </nav>
        <span className="environment-label"><span aria-hidden="true" />Entorno local</span>
      </header>

      <main>
        {notice && view === 'list' && <StatusMessage tone="success">{notice}</StatusMessage>}
        {view === 'list' ? (
          <BudgetList budgets={budgets} isLoading={isLoadingBudgets} loadError={budgetsError} onRefresh={loadBudgets} onCreate={showCreate} />
        ) : (
          <BudgetForm customers={customers} customersError={customersError} isLoadingCustomers={isLoadingCustomers} onRetryCustomers={loadCustomers} onCancel={() => setView('list')} onCreated={handleCreated} />
        )}
      </main>
    </div>
  )
}

export default App
