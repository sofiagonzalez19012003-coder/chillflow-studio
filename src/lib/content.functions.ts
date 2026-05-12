import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { callAI, CHILL_VIBE_BRAND_CONTEXT } from "./ai.server";

const GenSchema = z.object({
  contentType: z.enum(["reel_script","carousel","post_caption","email","tiktok_hook","ad_copy"]),
  linea: z.enum(["tapes","zen","play"]),
  platform: z.enum(["instagram","tiktok","youtube","threads","email","spotify_description"]),
  funnelStage: z.enum(["tofu","mofu","bofu"]),
  topic: z.string().min(2).max(2000),
  hookStyle: z.enum(["nocturnal_pov","scientific_data","provocative_question","emotional","tutorial"]),
  length: z.enum(["short","medium","long"]),
});

export const generateContent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => GenSchema.parse(input))
  .handler(async ({ data }) => {
    const platformLimits: Record<string,string> = {
      instagram: "Caption max 2200 chars; first 125 visible. 5–10 niche hashtags at the end.",
      tiktok: "Script max 60s. Title hook + on-screen text beats.",
      youtube: "Description with timestamps + playlist link.",
      threads: "Max 500 chars per post.",
      email: "Subject under 50 chars + body under 200 words.",
      spotify_description: "120–180 chars, mood-led.",
    };

    const sys = `You are an elite lo-fi marketing copywriter for the LATAM market.
${CHILL_VIBE_BRAND_CONTEXT}

Always return JSON with this exact shape:
{
  "title": "short label",
  "content": "the full piece, ready to publish",
  "imagePrompt": "a Midjourney-ready watercolor prompt — single human silhouette continuous line, nature/brand element instead of head, one calm eye, warm cream background, sage + amber palette, hand-drawn watercolor texture, --ar 1:1"
}`;

    const usr = `Create ${data.contentType} for ${data.platform}.
Sub-brand: ${data.linea.toUpperCase()}
Funnel: ${data.funnelStage.toUpperCase()}
Hook style: ${data.hookStyle}
Length: ${data.length}
Platform requirements: ${platformLimits[data.platform]}
Topic / brief: ${data.topic}`;

    const raw = await callAI({ system: sys, user: usr, json: true });
    try {
      const json = JSON.parse(raw);
      return {
        title: String(json.title ?? "Untitled"),
        content: String(json.content ?? raw),
        imagePrompt: String(json.imagePrompt ?? ""),
      };
    } catch {
      return { title: "Generated content", content: raw, imagePrompt: "" };
    }
  });

const RepurposeSchema = z.object({
  source: z.string().min(10).max(8000),
  formats: z.array(z.string()).min(1).max(8),
  linea: z.enum(["tapes","zen","play"]),
});

export const repurposeContent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => RepurposeSchema.parse(input))
  .handler(async ({ data }) => {
    const sys = `You repurpose Chill Vibe content across formats.
${CHILL_VIBE_BRAND_CONTEXT}
Return JSON: { "results": [ { "format": "...", "content": "..." } ] }`;
    const usr = `Source content (sub-brand ${data.linea}):
---
${data.source}
---
Repurpose into these formats: ${data.formats.join(", ")}`;
    const raw = await callAI({ system: sys, user: usr, json: true });
    return { resultsJson: raw };
  });

const WeekSchema = z.object({
  theme: z.string().max(500).optional(),
  lineas: z.array(z.enum(["tapes","zen","play"])).min(1),
});

export const generateWeek = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => WeekSchema.parse(input))
  .handler(async ({ data }) => {
    const sys = `${CHILL_VIBE_BRAND_CONTEXT}
Return JSON: { "items": [ { "day": 1-7, "linea": "tapes|zen|play", "type": "reel_script|carousel|post_caption", "platform": "instagram|tiktok", "funnel_stage": "tofu|mofu|bofu", "title": "...", "content": "..." } ] }
Follow Chill Vibe weekly batching: 2 new Reels (cinematic/lo-fi), 2 repeated Reels with new hook, 1 Carousel, 2 Informational Posts. Balance across the requested sub-brands.`;
    const usr = `Generate 7 days of content. Theme: ${data.theme || "general nocturnal productivity"}.
Active sub-brands: ${data.lineas.join(", ")}.`;
    const raw = await callAI({ system: sys, user: usr, json: true });
    return { itemsJson: raw };
  });

const EmailSchema = z.object({
  goal: z.string().min(2).max(200),
  linea: z.enum(["tapes","zen","play"]),
  count: z.number().int().min(1).max(5),
});

export const generateEmailSequence = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => EmailSchema.parse(input))
  .handler(async ({ data }) => {
    const sys = `${CHILL_VIBE_BRAND_CONTEXT}
Sequence structure:
- Email 1: Emotional hook — "We sell the moment".
- Email 2: Value — science/data about music + productivity/wellness.
- Email 3: Social proof — community usage.
- Email 4+: Direct CTA — save playlist / subscribe to Vibras Semanales.
Return JSON: { "emails": [ { "position": N, "subject": "<50 chars Spanish", "body": "scannable body", "cta": "button text" } ] }`;
    const usr = `Goal: ${data.goal}. Sub-brand: ${data.linea}. Number of emails: ${data.count}.`;
    const raw = await callAI({ system: sys, user: usr, json: true });
    return { emailsJson: raw };
  });

const InsightsSchema = z.object({
  context: z.string().max(4000),
});

export const generateInsights = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InsightsSchema.parse(input))
  .handler(async ({ data }) => {
    const sys = `${CHILL_VIBE_BRAND_CONTEXT}
You are a marketing analyst. Return JSON: { "insights": [ { "title": "...", "detail": "actionable next step", "linea": "tapes|zen|play|all" } ] }
Generate exactly 3 sharp, specific, action-oriented insights — never vague platitudes.`;
    const raw = await callAI({ system: sys, user: data.context, json: true });
    return { insightsJson: raw };
  });