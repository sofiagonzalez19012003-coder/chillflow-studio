import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Hedgehog } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { generateContent } from "@/lib/content.functions";
import { BRAND_META, type Linea } from "@/lib/brands";
import { toast } from "sonner";
import { Sparkles, Copy } from "lucide-react";

export const Route = createFileRoute("/_app/studio")({
  component: Studio,
});

const TYPES = [
  { v: "reel_script", l: "Reel Script" },
  { v: "carousel", l: "Educational Carousel" },
  { v: "post_caption", l: "Post Caption" },
  { v: "email", l: "Email" },
  { v: "tiktok_hook", l: "TikTok Hook" },
  { v: "ad_copy", l: "Ad Copy" },
] as const;
const PLATFORMS = ["instagram","tiktok","youtube","threads","email","spotify_description"] as const;
const HOOKS = [
  { v: "nocturnal_pov", l: "Nocturnal POV" },
  { v: "scientific_data", l: "Scientific Data" },
  { v: "provocative_question", l: "Provocative Question" },
  { v: "emotional", l: "Emotional" },
  { v: "tutorial", l: "Tutorial" },
] as const;

function Studio() {
  const gen = useServerFn(generateContent);
  const [contentType, setType] = useState<typeof TYPES[number]["v"]>("reel_script");
  const [linea, setLinea] = useState<Exclude<Linea,"all">>("tapes");
  const [platform, setPlatform] = useState<typeof PLATFORMS[number]>("instagram");
  const [funnelStage, setFunnel] = useState<"tofu"|"mofu"|"bofu">("tofu");
  const [hookStyle, setHook] = useState<typeof HOOKS[number]["v"]>("nocturnal_pov");
  const [length, setLength] = useState<"short"|"medium"|"long">("medium");
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<{ title: string; content: string; imagePrompt: string } | null>(null);

  async function go() {
    if (!topic.trim()) { toast.error("Add a topic / brief"); return; }
    setBusy(true);
    try {
      const res = await gen({ data: { contentType, linea, platform, funnelStage, topic, hookStyle, length } });
      setOut(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally { setBusy(false); }
  }

  async function save(status: "draft" | "approved") {
    if (!out) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { toast.error("Sign in first"); return; }
    const { error } = await supabase.from("content_items").insert({
      user_id: u.user.id,
      type: contentType,
      platform,
      linea,
      funnel_stage: funnelStage,
      title: out.title,
      content: out.content,
      image_prompt: out.imagePrompt,
      status,
    });
    if (error) toast.error(error.message);
    else toast.success(status === "approved" ? "Approved & saved" : "Saved as draft");
  }

  const meta = BRAND_META[linea];

  return (
    <div>
      <PageHeader
        eyebrow="Content Studio"
        title="Generate"
        description="On-brand content tuned for Tapes, Zen and Play. Auto-includes a watercolor image prompt ready for Midjourney."
      />

      <div className="grid lg:grid-cols-[1fr_1.2fr] gap-6">
        {/* Form */}
        <div className={`${meta.cardClass} p-6 space-y-4`}>
          <Field label="Content type">
            <Select value={contentType} onValueChange={(v) => setType(v as typeof contentType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-3 gap-2">
            {(["tapes","zen","play"] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLinea(l)}
                className={`p-3 rounded-md border-2 text-sm transition-colors ${
                  linea === l ? "border-[color:var(--brown-deep)] bg-secondary" : "border-transparent bg-muted hover:bg-secondary"
                }`}
              >
                <div className="text-xl">{BRAND_META[l].emoji}</div>
                <div className="font-medium mt-1">{BRAND_META[l].label}</div>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Platform">
              <Select value={platform} onValueChange={(v) => setPlatform(v as typeof platform)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Funnel stage">
              <Select value={funnelStage} onValueChange={(v) => setFunnel(v as typeof funnelStage)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tofu">TOFU — reach</SelectItem>
                  <SelectItem value="mofu">MOFU — consider</SelectItem>
                  <SelectItem value="bofu">BOFU — convert</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Hook style">
              <Select value={hookStyle} onValueChange={(v) => setHook(v as typeof hookStyle)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HOOKS.map((h) => <SelectItem key={h.v} value={h.v}>{h.l}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Length">
              <Select value={length} onValueChange={(v) => setLength(v as typeof length)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="short">Short</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="long">Long</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Topic / brief">
            <Textarea
              rows={4}
              placeholder="e.g. Por qué los lo-fi nocturnos ayudan a entrar en flow después de medianoche…"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </Field>
          <Button
            onClick={go}
            disabled={busy}
            className="w-full bg-[color:var(--brown-deep)] text-[color:var(--cream)] hover:bg-[color:var(--brown-mid)]"
          >
            {busy ? "🦔 generating…" : <><Sparkles className="h-4 w-4 mr-2" /> Generate</>}
          </Button>
        </div>

        {/* Output */}
        <div className={`${meta.cardClass} p-6`}>
          {!out ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-[color:var(--brown-mid)] py-16">
              <Hedgehog />
              <p className="mt-3 max-w-sm">Fill the form and hit Generate. Output will appear here, ready to edit, save or approve.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded bg-secondary">{meta.emoji} {meta.label}</span>
                <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded bg-secondary">{funnelStage}</span>
                <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded bg-secondary">{platform}</span>
              </div>
              <Input value={out.title} onChange={(e) => setOut({ ...out, title: e.target.value })} className="font-display text-lg" />
              <Textarea
                rows={12}
                value={out.content}
                onChange={(e) => setOut({ ...out, content: e.target.value })}
              />
              <div className="text-xs text-[color:var(--brown-light)]">{out.content.length} characters</div>

              {out.imagePrompt && (
                <div className="brand-card p-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-mono text-[10px] uppercase text-[color:var(--brown-light)]">Watercolor image prompt</div>
                    <button
                      onClick={() => { navigator.clipboard.writeText(out.imagePrompt); toast.success("Copied"); }}
                      className="text-xs flex items-center gap-1 text-[color:var(--brown-mid)] hover:text-[color:var(--brown-deep)]"
                    >
                      <Copy className="h-3 w-3" /> Copy
                    </button>
                  </div>
                  <p className="text-xs">{out.imagePrompt}</p>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={go} disabled={busy}>Regenerate</Button>
                <Button variant="outline" onClick={() => save("draft")}>Save draft</Button>
                <Button onClick={() => save("approved")} className="bg-[color:var(--brown-deep)] text-[color:var(--cream)] hover:bg-[color:var(--brown-mid)]">
                  Approve
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs font-mono uppercase tracking-wider text-[color:var(--brown-light)]">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}