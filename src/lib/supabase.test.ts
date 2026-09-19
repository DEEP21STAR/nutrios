import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchWithJwtSkewRetry } from '@/lib/supabase'

/**
 * Real, observed-in-production bug this guards against: PostgREST rejecting a freshly-minted
 * anonymous JWT with PGRST303 "JWT issued at future" (auth-service/database clock skew) — caught
 * live during pre-launch regression testing, see the header comment on fetchWithJwtSkewRetry.
 */
describe('fetchWithJwtSkewRetry', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('passes through a normal successful response untouched', async () => {
    const ok = new Response('{}', { status: 200 })
    const fetchMock = vi.fn().mockResolvedValue(ok)
    vi.stubGlobal('fetch', fetchMock)

    const res = await fetchWithJwtSkewRetry('https://example.test/rest/v1/meals')
    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('passes through a 401 that is NOT the clock-skew error, with no retry', async () => {
    const unauthorized = new Response(JSON.stringify({ code: 'PGRST301', message: 'JWT expired' }), { status: 401 })
    const fetchMock = vi.fn().mockResolvedValue(unauthorized)
    vi.stubGlobal('fetch', fetchMock)

    const res = await fetchWithJwtSkewRetry('https://example.test/rest/v1/meals')
    expect(res.status).toBe(401)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries once and returns the second response on PGRST303 "JWT issued at future"', async () => {
    const skewError = new Response(
      JSON.stringify({ code: 'PGRST303', details: null, hint: null, message: 'JWT issued at future' }),
      { status: 401 },
    )
    const success = new Response('[]', { status: 200 })
    const fetchMock = vi.fn().mockResolvedValueOnce(skewError).mockResolvedValueOnce(success)
    vi.stubGlobal('fetch', fetchMock)

    const res = await fetchWithJwtSkewRetry('https://example.test/rest/v1/workout_logs')
    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    // Same URL/init passed through unchanged on the retry.
    expect(fetchMock.mock.calls[1][0]).toBe('https://example.test/rest/v1/workout_logs')
  })
})
