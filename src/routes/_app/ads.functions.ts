import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { callAI, CHILL_VIBE_BRAND_CONTEXT } from "./ai.server";

const AdSchema = z.object({
  linea: z.enum(["tapes", "zen", "play"]),
  objective: z.enum(["reach", "engagement", "conversions"]),
  audience: z.enum(["deep_workers", "students", "gamers", "mindfulness_enthusiasts"]),
  budgetPerDay: z.number().min(1).max(10000),
  notes: z.string().max(500).optional(),
});

export const generateAdCreative = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => AdSchema.parse(input))
  .handler(async ({ data }) => {
    const sys = `You are a Meta Ads (Instagram/Facebook) copywriter for the LATAM market.
${CHILL_VIBE_BRAND_CONTEXT}
Return JSON: { "headline": "max 40 chars", "primaryText": "max 125 chars, hook in line 1", "cta": "one of: Listen Now, Save Playlist, Learn More, Sign Up, Subscribe", "creativePrompt": "watercolor Midjourney prompt — single human silhouette continuous line, brand element, warm cream background, sage + amber palette, --ar 1:1", "campaignName": "short identifying name" }`;
    const usr = `Sub-brand: ${data.linea.toUpperCase()}
Objective: ${data.objective}
Audience: ${data.audience.replace("_", " ")}
Budget/day: $${data.budgetPerDay} USD
Notes: ${data.notes || "—"}`;
    const raw = await callAI({ system: sys, user: usr, json: true });
    try {
      const j = JSON.parse(raw);
      return {
        headline: String(j.headline ?? ""),
        primaryText: String(j.primaryText ?? ""),
        cta: String(j.cta ?? "Listen Now"),
        creativePrompt: String(j.creativePrompt ?? ""),
        campaignName: String(j.campaignName ?? "Untitled campaign"),
      };
    } catch {
      return { headline: "", primaryText: raw, cta: "Listen Now", creativePrompt: "", campaignName: "Untitled campaign" };
    }
  });

const StrategySchema = z.object({
  totalBudgetUsd: z.number().min(15).max(5000),
  startDate: z.string(),
  postsSummary: z.string().max(8000),
});

export const generateAdsStrategy = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => StrategySchema.parse(input))
  .handler(async ({ data }) => {
    const sys = `${CHILL_VIBE_BRAND_CONTEXT}
You are a senior LATAM Meta Ads strategist building a 15-day launch plan for a brand-new IG account (~15 followers, 0 paid history).
Goals (in order): grow followers, build audience pixel data, validate which sub-brand & hook converts.
Use the user's organic post performance to infer what hooks resonate. Recommend conservative budgets (USD 3–8/day per ad set) and stagger sub-brands.

Return STRICT JSON with this exact shape:
{
  "diagnosis": "2–3 sentences in Spanish (LATAM) about what the organic data shows",
  "recommendedDailyBudget": number,        // USD/day across the whole account
  "split": { "tapes": number, "zen": number, "play": number }, // % integers summing to 100
  "bestHours": ["HH:00", "HH:00"],         // 2 peak posting hours from data, LATAM time
  "audiences": [
    { "linea": "tapes"|"zen"|"play", "audience": "deep_workers"|"students"|"gamers"|"mindfulness_enthusiasts", "interests": ["...","..."], "geos": ["CO","MX","AR"] }
  ],
  "creatives": [
    { "linea": "tapes"|"zen"|"play", "headline": "≤40 chars", "primaryText": "≤125 chars con hook en línea 1", "cta": "Listen Now"|"Save Playlist"|"Learn More"|"Subscribe", "creativePrompt": "watercolor MJ prompt" }
  ],
  "plan": [
    { "day": 1, "date": "YYYY-MM-DD", "phase": "Test"|"Learn"|"Scale", "budgetUsd": number, "linea": "tapes"|"zen"|"play"|"all", "action": "qué lanzar/pausar/duplicar hoy en español" }
  ],   // EXACTLY 15 entries, day 1..15, dates starting at startDate
  "kpisWeek1": { "reachTarget": number, "newFollowersTarget": number, "ctrTarget": "0.0%" },
  "kpisWeek2": { "reachTarget": number, "newFollowersTarget": number, "ctrTarget": "0.0%" },
  "nextSteps": ["...", "...", "..."]   // 3 acciones concretas para el día 16+
}
Spanish (LATAM). Be numeric and specific. No prose outside JSON.`;
    const usr = `Total budget for 15 days: $${data.totalBudgetUsd} USD
Start date: ${data.startDate}

Organic posts performance (CSV-derived summary):
${data.postsSummary}`;
    const raw = await callAI({ system: sys, user: usr, json: true, model: "google/gemini-2.5-pro" });
    return { json: raw };
  });