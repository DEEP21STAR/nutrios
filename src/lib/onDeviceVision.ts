/**
 * On-device WebGPU fallback for when ZENITH's Ollama (Tailscale or localhost)
 * is unreachable. Researched live (WebSearch, 2026-09-12) rather than
 * guessed — the coordinator's brief named "SmolVLM 500M or similar" only as
 * an example, not a final pick, so this was verified before committing to it:
 *
 *   - HuggingFaceTB/SmolVLM-500M-Instruct (and the smaller 256M variant) has
 *     an official Hugging Face Transformers.js + WebGPU demo
 *     (huggingface/transformers.js-examples/smolvlm-webgpu on GitHub, and
 *     Xenova's public announcement) confirming it runs 100% client-side via
 *     ONNX Runtime Web on WebGPU, with no server round-trip.
 *   - The realistic alternative, Xenova/moondream2 (1.86B params), also has a
 *     working Transformers.js + WebGPU demo, but at ~4x the parameter count
 *     it downloads and loads slower — a worse fit for a "fallback that must
 *     still feel instant" requirement.
 *   - Verdict: SmolVLM-500M-Instruct is the current best free, browser-
 *     runnable pick for this app — small enough to download quickly on a
 *     phone, fast enough on WebGPU, and good enough at short "what food is
 *     this" VQA-style prompts (its stated design target).
 *
 * NOT YET IMPLEMENTED — this is a stub with the real package/model names
 * pinned in package.json-to-be, so the actual @huggingface/transformers
 * integration is a follow-up slice once the primary Ollama path is verified
 * end-to-end. Wiring this in before that would risk spending the core-loop
 * verification budget on the fallback path instead of the primary one.
 */

export const ON_DEVICE_MODEL_ID = 'HuggingFaceTB/SmolVLM-500M-Instruct'

export async function identifyFoodOnDevice(_photo: Blob): Promise<never> {
  throw new Error(
    'On-device WebGPU fallback (SmolVLM-500M-Instruct via @huggingface/transformers) is not yet implemented — ' +
      'only the ZENITH Ollama path (Tailscale + localhost) is wired up so far.',
  )
}
