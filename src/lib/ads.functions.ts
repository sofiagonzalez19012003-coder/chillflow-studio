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

const AdInsightsSchema = z.object({ context: z.string().max(4000) });

export const generateAdInsights = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => AdInsightsSchema.parse(input))
  .handler(async ({ data }) => {
    const sys = `${CHILL_VIBE_BRAND_CONTEXT}
You are a paid media analyst for Meta Ads. Return JSON:
{ "working": ["..", ".."], "fix": ["..", ".."], "nextStep": "one concrete recommendation for the next 7 days" }
Be specific, numeric, action-oriented. Spanish (LATAM).`;
    const raw = await callAI({ system: sys, user: data.context, json: true });
    return { json: raw };
  });