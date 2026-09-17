/**
 * On-device WebGPU vision fallback — the "works with the laptop off" path,
 * built 2026-09-17 after Deep asked for a fully-offline, free-forever
 * option. Real model, verified before writing a line of integration code
 * (not the earlier stub's assumption):
 *
 *   - Model: HuggingFaceTB/SmolVLM2-500M-Video-Instruct — confirmed via a
 *     direct Hugging Face API call (not the model card, which shows no JS
 *     example) that this exact repo ships ONNX weights in the
 *     Transformers.js-expected layout (onnx/embed_tokens*.onnx,
 *     onnx/vision_encoder*.onnx, onnx/decoder_model_merged*.onnx, each in
 *     fp16/int8/q4/q4f16/uint8/bnb4 variants). `q4` is used here — the
 *     smallest real download, since file size was Deep's explicit concern
 *     over the alternative (Moondream, ~4x bigger, experimental browser
 *     support requiring a Transformers.js source build).
 *   - Runtime: @huggingface/transformers v4.3.0 (latest stable on npm at
 *     install time), WebGPU device with automatic WASM fallback on
 *     unsupported browsers/devices (the library's own behavior, not
 *     hand-rolled here).
 *   - API surface verified against the OFFICIAL huggingface/transformers.js-
 *     examples/smolvlm-webgpu reference implementation (fetched and read
 *     directly, not recalled from training data) — AutoModelForVision2Seq
 *     (not AutoModelForImageTextToText, which doesn't exist in this
 *     version), load_image, processor.apply_chat_template, and
 *     model.generate's real return shape ({ sequences }, needs
 *     return_dict_in_generate: true).
 *
 * Prompt is the SAME structured-JSON contract as ollamaVision.ts's PROMPT,
 * on purpose — resolveFoodItems.ts (the macro-lookup step downstream) is
 * shared by both paths and expects the identical IdentifiedItem[] shape.
 * SmolVLM2-500M is a much smaller model than qwen2.5vl:3b, so this prompt
 * is deliberately simpler than the Ollama one — no repeat-suppression
 * language yet, since that tuning was reactive to failures actually
 * observed on qwen2.5vl and hasn't been tested against this model yet. If
 * the same repetition failure shows up here, tune this prompt the same
 * evidence-driven way, not by copying the other file's fix blind.
 */
import { AutoProcessor, AutoModelForVision2Seq, load_image } from '@huggingface/transformers'
import type { IdentifiedItem } from '@/lib/ollamaVision'

export const ON_DEVICE_MODEL_ID = 'HuggingFaceTB/SmolVLM2-500M-Video-Instruct'
const DTYPE = 'q4'

export type OnDeviceProgress = {
  status: string
  file?: string
  progress?: number
  loaded?: number
  total?: number
}

type Processor = Awaited<ReturnType<typeof AutoProcessor.from_pretrained>>
type Model = Awaited<ReturnType<typeof AutoModelForVision2Seq.from_pretrained>>

let processorPromise: Promise<Processor> | null = null
let modelPromise: Promise<Model> | null = null

/** WebGPU feature check — Transformers.js falls back to WASM on its own when this is false,
 * but the caller (App.tsx) uses this to decide whether to even offer the "try on-device" path,
 * since WASM-only inference on a 500M VLM would be too slow to feel usable. */
export function isWebGPUAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator
}

function loadProcessorAndModel(onProgress?: (p: OnDeviceProgress) => void) {
  processorPromise ??= AutoProcessor.from_pretrained(ON_DEVICE_MODEL_ID, {
    progress_callback: onProgress,
  })
  modelPromise ??= AutoModelForVision2Seq.from_pretrained(ON_DEVICE_MODEL_ID, {
    dtype: DTYPE,
    device: 'webgpu',
    progress_callback: onProgress,
  })
  return Promise.all([processorPromise, modelPromise])
}

/** Fire-and-forget warmup so the (first-time, large) download can start before the user has
 * even taken a photo, e.g. as soon as Ollama is confirmed unreachable. Errors are swallowed
 * here — the real attempt in identifyFoodOnDevice will surface them when it matters. */
export function warmUpOnDeviceModel(onProgress?: (p: OnDeviceProgress) => void) {
  loadProcessorAndModel(onProgress).catch(() => {})
}

const PROMPT =
  'Identify the distinct food items visible in this photo. List each DISTINCT item only ONCE. ' +
  'Maximum 6 items total. Respond ONLY with valid JSON, no markdown, no commentary, in this exact ' +
  'shape: {"items":[{"name":"string","estimated_grams":number}]}. Use short, generic food names ' +
  'suitable for a nutrition database lookup (e.g. "grilled chicken breast", not "delicious juicy ' +
  'chicken"). Estimate a realistic portion size in grams for each item based on what is visible.'

export async function identifyFoodOnDevice(
  photo: Blob,
  onProgress?: (p: OnDeviceProgress) => void,
): Promise<IdentifiedItem[]> {
  const [processor, model] = await loadProcessorAndModel(onProgress)

  const objectUrl = URL.createObjectURL(photo)
  try {
    const image = await load_image(objectUrl)
    const messages = [
      {
        role: 'user',
        content: [{ type: 'image' }, { type: 'text', text: PROMPT }],
      },
    ]
    const text = processor.apply_chat_template(messages, { add_generation_prompt: true })
    const inputs = await processor(text, [image])

    // Transformers.js types generate()'s return as `Tensor | ModelOutput` without a named
    // `sequences` field, but the real runtime shape (confirmed against the official
    // huggingface/transformers.js-examples/smolvlm-webgpu reference) is
    // `{ past_key_values, sequences }` whenever `return_dict_in_generate: true` is passed.
    const output = (await model.generate({
      ...inputs,
      do_sample: false,
      max_new_tokens: 256,
      return_dict_in_generate: true,
    })) as unknown as { sequences: import('@huggingface/transformers').Tensor }
    const { sequences } = output

    // Only decode the NEWLY generated tokens, not the echoed-back prompt — sequences includes
    // both since generate() continues from the input, same as every other causal-LM generate().
    // Concrete end index (rather than a null/-1 "to the end" sentinel) since the Tensor.slice
    // type signature only accepts number[] pairs, not (number|null)[] — real end computed from
    // the actual output length, not assumed.
    const inputLength = inputs.input_ids.dims.at(-1) as number
    const totalLength = sequences.dims.at(-1) as number
    const newTokens = sequences.slice(null, [inputLength, totalLength])
    const decoded = processor.batch_decode(newTokens, { skip_special_tokens: true })
    const raw = (decoded[0] ?? '').trim()

    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) {
      throw new Error(`On-device model returned no parseable JSON (got: "${raw.slice(0, 200)}")`)
    }
    const parsed = JSON.parse(match[0]) as { items?: Array<{ name: string; estimated_grams: number }> }
    const items = parsed.items ?? []
    if (items.length === 0) {
      throw new Error('On-device model returned zero items')
    }
    return items.map((it) => ({ name: it.name, estimatedGrams: it.estimated_grams }))
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}
