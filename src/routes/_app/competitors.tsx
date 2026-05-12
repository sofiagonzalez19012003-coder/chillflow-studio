import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Hedgehog } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { scrapeAndAnalyze, compareCompetitors } from "@/lib/competitors.functions";
import { toast } from "sonner";
import { Sparkles, Trash2, RefreshCw, GitCompare } from "lucide-react";

export const Route = createFileRoute("/_app/competitors")({
  component: CompetitorsPage,
});

const SUGGESTED = [
  { name: "LoFi Girl", url: "https://www.lofigirl.com" },
  { name: "Chillhop Music", url: "https://chillhop.com" },
  { name: "College Music", url: "https://www.collegemusic.com" },
  { name: "Nightfall", url: "https://nightfallmusic.com" },
];

type Comp = {
  id: string;
  name: string;
  website_url: string;
  scraped_at: string | null;
  analyzed_at: string | null;
  ai_analysis: Record<string, unknown> | null;
};

function CompetitorsPage() {
  const [list, setList] = useState<Comp[]>([]);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [compareResult, setCompareResult] = useState<{ comparison: string; latam_advantage: string } | null>(null);
  const [comparing, setComparing] = useState(false);

  const runScrape = useServerFn(scrapeAndAnalyze);
  const runCompare = useServerFn(compareCompetitors);

  async function load() {
    const { data } = await supabase.from("competitors").select("*").order("created_at", { ascending: false });
    setList((data ?? []) as Comp[]);
  }
  useEffect(() => { load(); }, []);

  async function add(useName: string, useUrl: string) {
    if (!useName || !useUrl) return;
    setAdding(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("competitors")
        .insert({ user_id: u.user.id, name: useName, website_url: useUrl })
        .select()
        .single();
      if (error) throw error;
      setName(""); setUrl("");
      await analyze(data.id, useUrl);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add");
    } finally {
      setAdding(false);
    }
  }

  async function analyze(id: string, urlVal: string) {
    setBusyId(id);
    try {
      toast.info("🦔 Scanning competitor website…");
      const res = await runScrape({ data: { url: urlVal } });
      const analysis = JSON.parse(res.analysisJson);
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("competitors")
        .update({
          scraped_content: res.scraped,
          scraped_at: now,
          ai_analysis: analysis,
          analyzed_at: now,
        })
        .eq("id", id);
      if (error) throw error;
      toast.success("Analysis complete");
      await load();
      setOpen(id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    await supabase.from("competitors").delete().eq("id", id);
    setSelected((s) => s.filter((x) => x !== id));
    await load();
  }

  function toggleSelect(id: string) {
    setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : (s.length < 3 ? [...s, id] : s));
  }

  async function compareNow() {
    const items = list.filter((c) => selected.includes(c.id) && c.ai_analysis);
    if (items.length < 2) {
      toast.error("Pick at least 2 analyzed competitors.");
      return;
    }
    setComparing(true);
    try {
      const res = await runCompare({
        data: { competitors: items.map((c) => ({ name: c.name, analysis: c.ai_analysis })) },
      });
      setCompareResult(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Compare failed");
    } finally {
      setComparing(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Killer feature"
        title="Competitor Intel"
        description="Scrape competitor sites with Firecrawl, then run an AI analysis tuned for the LATAM lo-fi market — find the gap Chill Vibe can own."
      />

      {/* Add */}
      <section className="brand-card brand-card-tapes p-6">
        <h2 className="font-display text-xl">Add a competitor</h2>
        <div className="mt-4 grid md:grid-cols-[1fr_2fr_auto] gap-3 items-end">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="LoFi Girl" />
          </div>
          <div>
            <Label>Website URL</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://lofigirl.com" />
          </div>
          <Button
            disabled={adding || !name || !url}
            onClick={() => add(name, url)}
            className="bg-[color:var(--brown-deep)] text-[color:var(--cream)] hover:bg-[color:var(--brown-mid)]"
          >
            {adding ? "🦔 working…" : <><Sparkles className="h-4 w-4 mr-2" /> Scrape & analyze</>}
          </Button>
        </div>
        <div className="mt-4">
          <div className="font-mono text-xs uppercase text-[color:var(--brown-light)] mb-2">Suggested for Chill Vibe</div>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED.map((s) => (
              <button
                key={s.url}
                onClick={() => { setName(s.name); setUrl(s.url); }}
                className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-secondary transition-colors"
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* List */}
      <section className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-xl">Tracked competitors</h2>
          {list.length >= 2 && (
            <Button
              variant="outline"
              disabled={selected.length < 2 || comparing}
              onClick={compareNow}
            >
              <GitCompare className="h-4 w-4 mr-2" />
              {comparing ? "🦔 comparing…" : `Compare selected (${selected.length})`}
            </Button>
          )}
        </div>
        {list.length === 0 ? (
          <div className="brand-card p-10 text-center text-[color:var(--brown-mid)]">
            <Hedgehog />
            <p className="mt-3">No competitors tracked yet. Try one from the suggested list above.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {list.map((c) => (
              <div key={c.id} className="brand-card brand-card-zen p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selected.includes(c.id)}
                      onChange={() => toggleSelect(c.id)}
                      disabled={!c.ai_analysis}
                      className="mt-2"
                      title={c.ai_analysis ? "Select to compare" : "Analyze first"}
                    />
                    <div>
                      <div className="font-display text-lg">{c.name}</div>
                      <a href={c.website_url} target="_blank" rel="noreferrer" className="text-xs text-[color:var(--brown-light)] hover:underline">
                        {c.website_url}
                      </a>
                      <div className="font-mono text-[10px] uppercase mt-1 text-[color:var(--brown-light)]">
                        {c.analyzed_at ? `Analyzed ${new Date(c.analyzed_at).toLocaleDateString()}` : "Not analyzed yet"}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={busyId === c.id} onClick={() => analyze(c.id, c.website_url)}>
                      <RefreshCw className={`h-3 w-3 mr-1 ${busyId === c.id ? "animate-spin" : ""}`} />
                      {busyId === c.id ? "Working…" : c.analyzed_at ? "Re-analyze" : "Analyze"}
                    </Button>
                    {c.ai_analysis && (
                      <Button size="sm" variant="outline" onClick={() => setOpen(open === c.id ? null : c.id)}>
                        {open === c.id ? "Hide" : "View"}
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => remove(c.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {open === c.id && c.ai_analysis && (
                  <AnalysisView analysis={c.ai_analysis} />
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {compareResult && (
        <section className="mt-8 brand-card brand-card-tapes p-6">
          <h2 className="font-display text-xl">Your LATAM Advantage</h2>
          <pre className="mt-3 whitespace-pre-wrap text-sm text-[color:var(--brown-deep)] font-sans">
{compareResult.latam_advantage}
          </pre>
          <div className="mt-6 pt-6 border-t border-border">
            <div className="font-mono text-xs uppercase text-[color:var(--brown-light)] mb-2">Side-by-side</div>
            <pre className="whitespace-pre-wrap text-sm font-sans text-[color:var(--brown-mid)]">
{compareResult.comparison}
            </pre>
          </div>
        </section>
      )}
    </div>
  );
}

function AnalysisView({ analysis }: { analysis: Record<string, unknown> }) {
  const get = (k: string) => analysis[k];
  const renderField = (label: string, key: string) => {
    const v = get(key);
    if (!v) return null;
    if (Array.isArray(v)) {
      return (
        <div>
          <div className="font-mono text-[10px] uppercase text-[color:var(--brown-light)]">{label}</div>
          <ul className="mt-1 list-disc pl-5 text-sm space-y-0.5">{v.map((x, i) => <li key={i}>{String(x)}</li>)}</ul>
        </div>
      );
    }
    return (
      <div>
        <div className="font-mono text-[10px] uppercase text-[color:var(--brown-light)]">{label}</div>
        <p className="mt-1 text-sm">{String(v)}</p>
      </div>
    );
  };

  return (
    <div className="mt-5 pt-5 border-t border-border grid md:grid-cols-2 gap-5">
      {renderField("Positioning", "positioning")}
      {renderField("Target audience", "target_audience")}
      {renderField("Key messages", "key_messages")}
      {renderField("Tone & voice", "tone_voice")}
      {renderField("LATAM presence", "latam_presence")}
      {renderField("Strengths", "strengths")}
      {renderField("Gaps", "gaps")}
      <div className="md:col-span-2 brand-card brand-card-tapes p-4">
        <div className="font-mono text-[10px] uppercase text-[color:var(--brown-light)]">Your opportunity 🦔</div>
        <p className="mt-1 text-sm font-medium">{String(get("your_opportunity") ?? "")}</p>
      </div>
    </div>
  );
}