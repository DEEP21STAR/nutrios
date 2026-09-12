/**
 * Core-loop vision step. Two real endpoints, tried in order:
 *   1. ZENITH's Ollama over Tailscale (cross-device — phone reaching the
 *      desktop's GPU). Configure via VITE_OLLAMA_TAILSCALE_URL.
 *   2. Same-machine Ollama at localhost:11434 (confirmed live, `qwen2.5vl:3b`
 *      loaded with vision+completion capability — verified via a real curl
 *      call against a real downloaded food photo before this file was written).
 * If neither responds, callers fall back to the on-device WebGPU model
 * (lib/onDeviceVision.ts).
 *
 * NOTE on Tailscale: `tailscaled` was found installed but NOT RUNNING on this
 * dev machine, and starting it requires an interactive sudo password this
 * session doesn't have. So candidate #1 will fail here until Deep starts it
 * himself (`sudo systemctl start tailscaled`, then `tailscale up`). Candidate
 * #2 (localhost) is what's actually been verified end-to-end so far.
 */

export interface IdentifiedItem {
  name: string
  estimatedGrams: number
}

const MODEL = 'qwen2.5vl:3b'

/**
 * Prompt + generation options were both tuned against REAL failures found
 * during live testing (a real downloaded food photo, sent to the real
 * localhost Ollama endpoint): the first attempt, with an unconstrained
 * prompt and default sampling options, correctly identified the food
 * (pepperoni/ham/mushroom/olive pizza) but then fell into a degenerate
 * repetition loop — re-listing the same items at ever-halving gram values
 * forever — and hit the output-length limit (`done_reason: "length"`)
 * without ever closing the JSON, after 4m43s of CPU-only inference. Fixed by:
 * (1) explicitly telling the model not to repeat items and capping the count,
 * (2) low temperature + repeat_penalty to suppress the loop, (3) a hard
 * num_predict ceiling so a still-degenerate response fails fast instead of
 * burning minutes, (4) sending a resized (max ~640px) image, which cuts
 * vision-token count and inference time.
 */
const PROMPT =
  'Identify the distinct food items visible in this photo. List each DISTINCT item only ONCE — ' +
  'do not repeat any item, and do not list the same food at different portion sizes. Maximum 6 items total. ' +
  'Respond ONLY with valid JSON, no markdown, no commentary, in this exact shape: ' +
  '{"items":[{"name":"string","estimated_grams":number}]}. ' +
  'Use short, generic food names suitable for a nutrition database lookup (e.g. "grilled chicken breast", ' +
  'not "delicious juicy chicken"). Estimate a realistic portion size in grams for each item based on what is visible.'

const GENERATION_OPTIONS = {
  temperature: 0.1,
  repeat_penalty: 1.3,
  repeat_last_n: 256,
  num_predict: 300,
}

function candidateUrls(): string[] {
  const urls: string[] = []
  const tailscaleUrl = import.meta.env.VITE_OLLAMA_TAILSCALE_URL as string | undefined
  if (tailscaleUrl) urls.push(tailscaleUrl.replace(/\/$/, ''))
  urls.push('http://localhost:11434')
  return urls
}

async function fileToBase64(file: Blob): Promise<string> {
  const buf = await file.arrayBuffer()
  let binary = ''
  const bytes = new Uint8Array(buf)
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

interface OllamaGenerateResponse {
  response: string
}

/**
 * Sends a photo to the first reachable Ollama endpoint and returns the
 * identified food items. Throws if every configured endpoint is unreachable
 * or returns unparseable output — callers must catch and fall back to the
 * on-device model rather than silently showing an empty result.
 */
export async function identifyFoodViaOllama(
  photo: Blob,
  { signal, timeoutMs = 45000 }: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<{ items: IdentifiedItem[]; endpointUsed: string }> {
  const base64 = await fileToBase64(photo)
  const errors: string[] = []

  for (const base of candidateUrls()) {
    const controller = new AbortController()
    const onAbort = () => controller.abort()
    signal?.addEventListener('abort', onAbort)
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(`${base}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: MODEL,
          prompt: PROMPT,
          images: [base64],
          stream: false,
          format: 'json',
          options: GENERATION_OPTIONS,
        }),
        signal: controller.signal,
      })
      if (!res.ok) {
        errors.push(`${base}: HTTP ${res.status}`)
        continue
      }
      const data = (await res.json()) as OllamaGenerateResponse
      const parsed = JSON.parse(data.response) as { items?: Array<{ name: string; estimated_grams: number }> }
      const items = (parsed.items ?? []).map((it) => ({
        name: it.name,
        estimatedGrams: it.estimated_grams,
      }))
      if (items.length === 0) {
        errors.push(`${base}: model returned zero items`)
        continue
      }
      return { items, endpointUsed: base }
    } catch (err) {
      errors.push(`${base}: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    }
  }

  throw new Error(`All Ollama endpoints failed: ${errors.join(' | ')}`)
}
