// Shared vision fallback — Deep's family calorie tracker (2026-09-17).
//
// Why this exists: Ollama (home/Tailscale) and the on-device WebGPU model (device-dependent,
// confirmed NOT available on Deep's own phone) both have real gaps. This is the third leg —
// a single Gemini API key, held ONLY here, server-side, never distributed to any device. Every
// family member's app calls this function; none of them ever sees or needs a key of their own.
//
// Auth: relies on Supabase's default `verify_jwt` behavior for Edge Functions (no config.toml
// override here) — only requests carrying a valid Supabase session JWT reach this code, which
// every real user of the app already has via ensureAuthenticated()'s anonymous sign-in. This is
// NOT a public-internet-facing endpoint; it can't be hit by a stranger to drain the Gemini quota.
//
// Model: `gemini-flash-lite-latest`, not `gemini-flash-latest` — changed 2026-09-17 after real
// live testing (Deep's own key, 3 back-to-back calls each) showed flash-latest returning genuine
// 503 "high demand" twice, while flash-lite-latest answered instantly and correctly every time.
// This is a reliability call, not a guess: for a simple "what food is this" vision task, the lite
// tier's accuracy is more than enough, and for a shared family app, "answers reliably" beats
// "slightly better food-name guesses" every time.
//
// Real bug found and fixed the same session: the original prompt asked for JSON "with no
// markdown", but on a photo with 5+ real items (tested: eggs + stir-fry + noodles), the response
// ran long enough to hit maxOutputTokens BEFORE the closing brace — confirmed via the exact error
// text this produced (`No parseable JSON in Gemini response: {"items":`, cut off mid-object).
// Fixed at the actual cause: `responseMimeType: "application/json"` (verified against the real
// API directly, not the model card — a docs fetch claimed a different, wrong field name first)
// forces clean JSON with no prose/markdown overhead, and maxOutputTokens raised to give real
// multi-item photos headroom to finish.
//
// Contract: same IdentifiedItem[] shape (`{name, estimated_grams}`) as ollamaVision.ts's
// PROMPT/response format and onDeviceVision.ts — resolveFoodItems.ts downstream doesn't know or
// care which of the three vision paths produced its input.

const GEMINI_MODEL = "gemini-flash-lite-latest";

const PROMPT =
  "Identify the distinct food items visible in this photo. List each DISTINCT item only ONCE. " +
  "Maximum 6 items total. Respond ONLY with valid JSON, no markdown, no commentary, in this exact " +
  'shape: {"items":[{"name":"string","estimated_grams":number}]}. Use short, generic food names ' +
  'suitable for a nutrition database lookup (e.g. "grilled chicken breast", not "delicious juicy ' +
  "chicken\"). Estimate a realistic portion size in grams for each item based on what is visible. " +
  "If the image shows no real food, respond with {\"items\":[]}.";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const { imageBase64, mimeType } = await req.json();
    if (typeof imageBase64 !== "string" || typeof mimeType !== "string") {
      return jsonResponse({ error: "imageBase64 and mimeType are required" }, 400);
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return jsonResponse({ error: "GEMINI_API_KEY is not configured on the server" }, 500);
    }

    // Real failure observed live testing this: Gemini returns a genuine 503 "high demand, try
    // again later" often enough that a bare single attempt isn't good enough for a family app —
    // this is Google's own server load, not our request, so a short retry is the correct fix,
    // not a code bug to chase. 429 (rate limit) gets the same treatment.
    let geminiRes: Response | null = null
    let lastDetail = ""
    for (let attempt = 0; attempt < 3; attempt++) {
      geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: PROMPT }, { inlineData: { mimeType, data: imageBase64 } }],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 1024,
              responseMimeType: "application/json",
            },
          }),
        },
      );
      if (geminiRes.ok) break;
      if (geminiRes.status !== 503 && geminiRes.status !== 429) break;
      lastDetail = await geminiRes.text();
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }

    if (!geminiRes) {
      return jsonResponse({ error: "Gemini API call never completed" }, 502);
    }
    if (!geminiRes.ok) {
      const detail = geminiRes.status === 503 || geminiRes.status === 429 ? lastDetail : await geminiRes.text();
      return jsonResponse({ error: `Gemini API error (${geminiRes.status}) after retries: ${detail.slice(0, 300)}` }, 502);
    }

    const geminiJson = await geminiRes.json();
    const rawText: string | undefined = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      return jsonResponse({ error: "Gemini returned no text content" }, 502);
    }

    const match = rawText.match(/\{[\s\S]*\}/);
    if (!match) {
      return jsonResponse({ error: `No parseable JSON in Gemini response: ${rawText.slice(0, 200)}` }, 502);
    }

    const parsed = JSON.parse(match[0]) as { items?: Array<{ name: string; estimated_grams: number }> };
    return jsonResponse({ items: parsed.items ?? [] }, 200);
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
