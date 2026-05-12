import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { scrapeWithFirecrawl } from "./firecrawl.server";
import { callAI, CHILL_VIBE_BRAND_CONTEXT } from "./ai.server";

const Schema = z.object({
  url: z.string().url(),
});

export const scrapeAndAnalyze = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Schema.parse(input))
  .handler(async ({ data }) => {
    const scraped = await scrapeWithFirecrawl(data.url);

    const sys = `You are a marketing strategist for Chill Vibe.
${CHILL_VIBE_BRAND_CONTEXT}

Analyze this competitor and return STRICT JSON:
{
  "positioning": "...",
  "target_audience": "...",
  "key_messages": ["...","..."],
  "tone_voice": "...",
  "latam_presence": "...",
  "strengths": ["...","..."],
  "gaps": ["...","..."],
  "your_opportunity": "Specific concrete LATAM differentiation moves Chill Vibe can take immediately."
}
Be specific. Every point must have concrete strategic implications for Chill Vibe.`;

    const raw = await callAI({
      system: sys,
      user: `Competitor URL: ${data.url}\n\nScraped content:\n${scraped}`,
      json: true,
    });

    let analysis: Record<string, unknown> = {};
    try {
      analysis = JSON.parse(raw);
    } catch {
      analysis = { positioning: raw };
    }
    return { scraped, analysis };
  });

const CompareSchema = z.object({
  competitors: z.array(z.object({
    name: z.string(),
    analysis: z.unknown(),
  })).min(2).max(4),
});

export const compareCompetitors = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => CompareSchema.parse(input))
  .handler(async ({ data }) => {
    const sys = `${CHILL_VIBE_BRAND_CONTEXT}
Return JSON: { "comparison": "side-by-side narrative", "latam_advantage": "Chill Vibe's specific LATAM differentiation in 3-5 punchy bullets joined with newlines" }`;
    const usr = `Compare these competitors for Chill Vibe:\n${JSON.stringify(data.competitors, null, 2)}`;
    const raw = await callAI({ system: sys, user: usr, json: true });
    try { return JSON.parse(raw); } catch { return { comparison: raw, latam_advantage: "" }; }
  });