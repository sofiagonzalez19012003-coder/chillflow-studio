const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-2.5-flash";

export async function callAI(opts: {
  system: string;
  user: string;
  model?: string;
  json?: boolean;
}): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

  const body: Record<string, unknown> = {
    model: opts.model ?? DEFAULT_MODEL,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
  };
  if (opts.json) body.response_format = { type: "json_object" };

  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 429) throw new Error("AI rate limit reached. Try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted. Add credits in workspace settings.");
    throw new Error(`AI request failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

export const CHILL_VIBE_BRAND_CONTEXT = `
Brand: Chill Vibe by Kapital Music (@chillvibeglobal) — record label from Medellín, Colombia.
Brand Voice: intimate, nocturnal, poetic. We sell THE MOMENT, not the music.
Tone: a friend who understands you work at night.
Sub-brands:
- Tapes 📼 — Nostalgia & Urban Chill. Deep Workers 25–35, late-night productivity.
- Zen 🪷 — Mindfulness & Peace. Wellness & meditation 22–35.
- Play 🎮 — Focus & Energy. Gamers & tech 18–30, ranked sessions, lo-fi gaming.

Non-negotiable rules:
1. Emotional hook in the first 2 lines.
2. Never say "background music" — say "soundtrack of [specific moment]".
3. Include CTA (playlist or "Vibras Semanales" newsletter in bio).
4. Default language: Spanish (Latin American). Use English only if explicitly asked.
5. Write for the LATAM Spanish-speaking audience — this is our differentiator.
`;