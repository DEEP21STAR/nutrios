import { Component, type ErrorInfo, type ReactNode } from 'react'

/**
 * Root safety net — without this, any uncaught render error white-screens the whole app with no
 * recovery path. A class component is the only way to implement getDerivedStateFromError; React
 * has no hook equivalent.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('NUTRYOS crashed:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-4 bg-bg-primary px-6 text-center">
        <div
          className="grid h-16 w-16 place-items-center rounded-full"
          style={{ background: 'rgb(255 100 100 / 0.12)', boxShadow: '0 0 24px 4px rgb(255 100 100 / 0.3)' }}
        >
          <span className="text-3xl" aria-hidden>
            ⚠
          </span>
        </div>
        <h1 className="text-title text-text-primary">Something went wrong</h1>
        <p className="max-w-xs text-body text-text-tertiary">
          NUTRYOS hit an unexpected error. Your data is safe — reloading usually fixes this.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 rounded-xl bg-accent-health px-6 py-3 text-body font-semibold text-bg-primary"
        >
          Reload NUTRYOS
        </button>
      </div>
    )
  }
}
