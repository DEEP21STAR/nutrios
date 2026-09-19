import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from '@/components/ErrorBoundary'

function Bomb(): never {
  throw new Error('boom')
}

describe('ErrorBoundary', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    // React logs the caught error to the console by design; keep test output clean.
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.restoreAllMocks()
  })

  it('renders children normally when nothing throws', () => {
    act(() => {
      root.render(
        <ErrorBoundary>
          <div>real content</div>
        </ErrorBoundary>,
      )
    })
    expect(container.textContent).toContain('real content')
  })

  it('catches a render error and shows the reload fallback instead of a blank screen', () => {
    act(() => {
      root.render(
        <ErrorBoundary>
          <Bomb />
        </ErrorBoundary>,
      )
    })
    expect(container.textContent).toContain('Something went wrong')
    expect(container.querySelector('button')?.textContent).toContain('Reload NUTRYOS')
  })
})
