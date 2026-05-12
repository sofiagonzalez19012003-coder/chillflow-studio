import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader, Hedgehog } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BRAND_META, type Linea } from "@/lib/brands";
import { generateAdCreative, generateAdsStrategy } from "@/lib/ads.functions";
import { Zap, Loader2, Upload, Sparkles, Calendar, FileText } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/ads")({ component: AdsPage });

type Linea3 = Exclude<Linea, "all">;

function AdsPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Ads Command Center"
        title="Ads ⚡ Strategy Builder"
        description="Sube tu reporte de Meta (CSV) y genera una estrategia completa de 15 días basada en tus posts reales."
      />
      <Tabs defaultValue="import">
        <TabsList>
          <TabsTrigger value="import">1 · Importar performance</TabsTrigger>
          <TabsTrigger value="strategy">2 · Estrategia 15 días</TabsTrigger>
          <TabsTrigger value="creative">3 · Generar creatividad</TabsTrigger>
        </TabsList>
        <TabsContent value="import" className="mt-6"><ImportTab /></TabsContent>
        <TabsContent value="strategy" className="mt-6"><StrategyTab /></TabsContent>
        <TabsContent value="creative" className="mt-6"><CreativeTab /></TabsContent>
      </Tabs>
    </div>
  );
}

/* =================== CSV PARSING =================== */

type Row = Record<string, string>;

function parseCSV(text: string): Row[] {
  // strip BOM
  text = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { cur.push(field); field = ""; }
      else if (c === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else field += c;
    }
  }
  if (field.length || cur.length) { cur.push(field); rows.push(cur); }
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).filter((r) => r.length > 1).map((r) => {
    const o: Row = {};
    header.forEach((h, i) => { o[h] = (r[i] ?? "").trim(); });
    return o;
  });
}

type Aggregated = {
  totalPosts: number;
  totalReach: number;
  totalViews: number;
  totalReactions: number;
  totalComments: number;
  totalShares: number;
  totalClicks: number;
  byHour: { hour: number; posts: number; reach: number; eng: number }[];
  byDow: { dow: string; posts: number; reach: number; eng: number }[];
  byType: { type: string; posts: number; reach: number; eng: number }[];
  topPosts: { title: string; date: string; reach: number; views: number; react: number; comm: number; shar: number; clk: number; eng: number; type: string; ts: number }[];
  hashtagsTop: { tag: string; count: number }[];
  dateRange: { from: string; to: string };
};

const NUM = (s: string) => {
  const n = Number((s || "0").replace(/[, ]/g, ""));
  return isNaN(n) ? 0 : n;
};

function aggregate(rows: Row[]): Aggregated | null {
  if (!rows.length) return null;
  // detect cols (Spanish meta export)
  const titleKey = pickKey(rows[0], ["Título", "Title", "Descripción", "Description"]);
  const timeKey = pickKey(rows[0], ["Hora de publicación", "Publish time"]);
  const reachKey = pickKey(rows[0], ["Alcance", "Reach"]);
  const viewsKey = pickKey(rows[0], ["Visualizaciones", "Views", "Impressions"]);
  const reactKey = pickKey(rows[0], ["Reacciones", "Reactions"]);
  const commKey = pickKey(rows[0], ["Comentarios", "Comments"]);
  const shareKey = pickKey(rows[0], ["Veces que se compartió", "Shares"]);
  const clickKey = pickKey(rows[0], ["Total de clics", "Clicks"]);
  const typeKey = pickKey(rows[0], ["Tipo de publicación", "Post type"]);

  const valid = rows.filter((r) => r[titleKey] && r[timeKey]);
  const hourMap = new Map<number, { posts: number; reach: number; eng: number }>();
  const dowMap = new Map<string, { posts: number; reach: number; eng: number }>();
  const typeMap = new Map<string, { posts: number; reach: number; eng: number }>();
  const tagMap = new Map<string, number>();
  const DOW = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

  let totalReach = 0, totalViews = 0, totalReactions = 0, totalComments = 0, totalShares = 0, totalClicks = 0;
  let minDate = "", maxDate = "";
  const ranked: { title: string; date: string; reach: number; views: number; react: number; comm: number; shar: number; clk: number; eng: number; type: string; ts: number }[] = [];

  for (const r of valid) {
    const reach = NUM(r[reachKey]);
    const views = NUM(r[viewsKey]);
    const react = NUM(r[reactKey]);
    const comm = NUM(r[commKey]);
    const shar = NUM(r[shareKey]);
    const clk = NUM(r[clickKey]);
    const eng = react + comm + shar + clk;
    totalReach += reach; totalViews += views; totalReactions += react;
    totalComments += comm; totalShares += shar; totalClicks += clk;

    const t = r[timeKey];
    const m = t.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
    let hour = 0, dow = "lun", iso = "";
    if (m) {
      const [_, mo, da, yr, hh] = m;
      hour = Number(hh);
      const d = new Date(Number(yr), Number(mo) - 1, Number(da));
      dow = DOW[d.getDay()];
      iso = `${yr}-${mo.padStart(2, "0")}-${da.padStart(2, "0")}`;
      if (!minDate || iso < minDate) minDate = iso;
      if (!maxDate || iso > maxDate) maxDate = iso;
    }
    bumpHour(hourMap, hour, reach, eng);
    bumpDow(dowMap, dow, reach, eng);
    bumpType(typeMap, r[typeKey] || "—", reach, eng);

    const title = (r[titleKey] || "").replace(/\s+/g, " ").slice(0, 140);
    const ts = iso ? new Date(iso).getTime() : 0;
    ranked.push({ title, date: iso || t, reach, views, react, comm, shar, clk, eng, type: r[typeKey] || "—", ts });

    const tags = (r[titleKey] || "").match(/#[\p{L}\d_]+/gu) || [];
    for (const tg of tags) {
      const k = tg.toLowerCase();
      tagMap.set(k, (tagMap.get(k) || 0) + 1);
    }
  }

  return {
    totalPosts: valid.length,
    totalReach, totalViews, totalReactions, totalComments, totalShares, totalClicks,
    byHour: [...hourMap.entries()].map(([h, v]) => ({ hour: h, ...v })).sort((a, b) => a.hour - b.hour),
    byDow: DOW.map((d) => ({ dow: d, ...(dowMap.get(d) || { posts: 0, reach: 0, eng: 0 }) })),
    byType: [...typeMap.entries()].map(([t, v]) => ({ type: t, ...v })),
    topPosts: (() => {
      let maxTs = 0;
      for (const p of ranked) {
        if (p.ts > maxTs) maxTs = p.ts;
      }
      const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
      const cutoffTs = maxTs > 0 ? maxTs - ninetyDaysMs : 0;
      return ranked
        .filter((p) => p.ts >= cutoffTs)
        .sort((a, b) => b.eng - a.eng || b.reach - a.reach);
    })(),
    hashtagsTop: [...tagMap.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count).slice(0, 10),
    dateRange: { from: minDate, to: maxDate },
  };
}

function pickKey(o: Row, candidates: string[]): string {
  const keys = Object.keys(o);
  for (const c of candidates) {
    const k = keys.find((kk) => kk.toLowerCase() === c.toLowerCase());
    if (k) return k;
  }
  return candidates[0];
}
function bumpHour(m: Map<number, { posts: number; reach: number; eng: number }>, h: number, r: number, e: number) {
  const v = m.get(h) || { posts: 0, reach: 0, eng: 0 };
  m.set(h, { posts: v.posts + 1, reach: v.reach + r, eng: v.eng + e });
}
function bumpDow(m: Map<string, { posts: number; reach: number; eng: number }>, d: string, r: number, e: number) {
  const v = m.get(d) || { posts: 0, reach: 0, eng: 0 };
  m.set(d, { posts: v.posts + 1, reach: v.reach + r, eng: v.eng + e });
}
function bumpType(m: Map<string, { posts: number; reach: number; eng: number }>, t: string, r: number, e: number) {
  const v = m.get(t) || { posts: 0, reach: 0, eng: 0 };
  m.set(t, { posts: v.posts + 1, reach: v.reach + r, eng: v.eng + e });
}

function summaryForAI(a: Aggregated): string {
  const peakHours = [...a.byHour].sort((x, y) => y.eng - x.eng || y.reach - x.reach).slice(0, 3).map((x) => `${x.hour}:00 (eng ${x.eng}, reach ${x.reach})`).join(", ");
  const peakDow = [...a.byDow].sort((x, y) => y.eng - x.eng || y.reach - x.reach).slice(0, 3).map((x) => `${x.dow} (eng ${x.eng})`).join(", ");
  const top = a.topPosts.slice(0, 15).map((p, i) => `${i + 1}. [${p.date}] reach=${p.reach} views=${p.views} react=${p.react} eng=${p.eng} — "${p.title}"`).join("\n");
  const tags = a.hashtagsTop.slice(0, 8).map((t) => `${t.tag}(${t.count})`).join(" ");
  return `Window: ${a.dateRange.from} → ${a.dateRange.to}
Posts: ${a.totalPosts} · Reach total: ${a.totalReach} · Views: ${a.totalViews}
Reactions: ${a.totalReactions} · Comments: ${a.totalComments} · Shares: ${a.totalShares} · Clicks: ${a.totalClicks}
Avg reach/post: ${Math.round(a.totalReach / Math.max(1, a.totalPosts))}
Peak hours: ${peakHours || "n/a"}
Peak weekdays: ${peakDow || "n/a"}
Top posts:
${top || "n/a"}
Top hashtags: ${tags || "n/a"}`;
}

/* =================== STORAGE (localStorage bridge) =================== */

const LS_KEY = "cv_ads_perf_v1";
const LS_STRAT = "cv_ads_strategy_v1";

function loadPerf(): Aggregated | null {
  if (typeof window === "undefined") return null;
  try { const v = localStorage.getItem(LS_KEY); return v ? JSON.parse(v) : null; } catch { return null; }
}
function savePerf(a: Aggregated) { localStorage.setItem(LS_KEY, JSON.stringify(a)); }

/* =================== TABS =================== */

function ImportTab() {
  const [agg, setAgg] = useState<Aggregated | null>(() => loadPerf());
  const [busy, setBusy] = useState(false);

  async function onFile(f: File) {
    setBusy(true);
    try {
      const text = await f.text();
      const rows = parseCSV(text);
      const a = aggregate(rows);
      if (!a || a.totalPosts === 0) { toast.error("CSV no contiene posts válidos"); return; }
      savePerf(a); setAgg(a);
      toast.success(`Importados ${a.totalPosts} posts`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to parse CSV");
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      <section className="brand-card brand-card-tapes p-6">
        <h2 className="font-display text-2xl flex items-center gap-2"><Upload className="h-5 w-5" />Sube tu CSV de Meta / Facebook Insights</h2>
        <p className="text-sm text-[color:var(--brown-mid)] mt-1">
          Exporta desde Meta Business Suite → Insights → Posts → Export. Aceptamos el formato en español (Visualizaciones, Alcance, Reacciones…) o inglés.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <label className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[color:var(--brown-deep)] text-[color:var(--cream)] cursor-pointer hover:bg-[color:var(--brown-mid)]">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            <span>{busy ? "Procesando…" : "Seleccionar CSV"}</span>
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
          </label>
          {agg && <span className="text-xs font-mono text-[color:var(--brown-light)]">{agg.dateRange.from} → {agg.dateRange.to}</span>}
        </div>
      </section>

      {!agg ? (
        <div className="brand-card p-10 text-center text-[color:var(--brown-mid)]">
          <Hedgehog />
          <p className="mt-3">Aún no hay datos. Sube tu CSV para empezar.</p>
        </div>
      ) : (
        <PerfDashboard a={agg} />
      )}
    </div>
  );
}

function PerfDashboard({ a }: { a: Aggregated }) {
  const kpis = [
    { l: "Posts", v: a.totalPosts.toString() },
    { l: "Alcance total", v: a.totalReach.toLocaleString() },
    { l: "Visualizaciones", v: a.totalViews.toLocaleString() },
    { l: "Reacciones", v: a.totalReactions.toLocaleString() },
    { l: "Comentarios", v: a.totalComments.toLocaleString() },
    { l: "Compartidos", v: a.totalShares.toLocaleString() },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((k) => (
          <div key={k.l} className="brand-card p-4">
            <div className="font-mono text-[11px] uppercase text-[color:var(--brown-light)]">{k.l}</div>
            <div className="mt-1 font-display text-2xl text-[color:var(--brown-deep)]">{k.v}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <section className="brand-card brand-card-zen p-5">
          <h3 className="font-display text-lg">Mejor hora para publicar</h3>
          <div className="mt-3 space-y-1.5">
            {[...a.byHour].sort((x, y) => y.eng - x.eng).slice(0, 5).map((h) => (
              <Bar2 key={h.hour} label={`${String(h.hour).padStart(2, "0")}:00`} value={h.eng} max={Math.max(...a.byHour.map((x) => x.eng), 1)} hint={`${h.posts} posts · reach ${h.reach}`} />
            ))}
          </div>
        </section>
        <section className="brand-card brand-card-tapes p-5">
          <h3 className="font-display text-lg">Mejor día de la semana</h3>
          <div className="mt-3 space-y-1.5">
            {a.byDow.map((d) => (
              <Bar2 key={d.dow} label={d.dow} value={d.eng} max={Math.max(...a.byDow.map((x) => x.eng), 1)} hint={`${d.posts} posts · reach ${d.reach}`} />
            ))}
          </div>
        </section>
      </div>

      <section className="brand-card p-5">
        <h3 className="font-display text-lg mb-3">Posts de los últimos 90 días (Por rendimiento)</h3>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Reach</TableHead>
                <TableHead>Views</TableHead>
                <TableHead>React</TableHead>
                <TableHead>Comm</TableHead>
                <TableHead>Share</TableHead>
                <TableHead>Click</TableHead>
                <TableHead>Eng</TableHead>
                <TableHead>Texto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {a.topPosts.map((p, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono">{i + 1}</TableCell>
                  <TableCell className="font-mono text-xs whitespace-nowrap">{p.date}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{p.type}</TableCell>
                  <TableCell>{p.reach}</TableCell>
                  <TableCell>{p.views}</TableCell>
                  <TableCell>{p.react}</TableCell>
                  <TableCell>{p.comm}</TableCell>
                  <TableCell>{p.shar}</TableCell>
                  <TableCell>{p.clk}</TableCell>
                  <TableCell className="font-bold">{p.eng}</TableCell>
                  <TableCell className="max-w-[300px] truncate" title={p.title}>{p.title}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      {a.hashtagsTop.length > 0 && (
        <section className="brand-card brand-card-play p-5">
          <h3 className="font-display text-lg mb-2">Hashtags más usados</h3>
          <div className="flex flex-wrap gap-2">
            {a.hashtagsTop.map((t) => (
              <Badge key={t.tag} variant="outline" className="font-mono">{t.tag} · {t.count}</Badge>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Bar2({ label, value, max, hint }: { label: string; value: number; max: number; hint?: string }) {
  const pct = Math.round((value / Math.max(1, max)) * 100);
  return (
    <div>
      <div className="flex justify-between text-xs font-mono text-[color:var(--brown-light)]">
        <span>{label}</span><span>{hint}</span>
      </div>
      <div className="h-2 bg-card rounded-full overflow-hidden border border-border">
        <div className="h-full bg-[color:var(--brown-deep)]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* =================== STRATEGY TAB =================== */

type Strategy = {
  diagnosis: string;
  recommendedDailyBudget: number;
  split: { tapes: number; zen: number; play: number };
  bestHours: string[];
  audiences: { linea: Linea3; audience: string; interests: string[]; geos: string[] }[];
  creatives: { linea: Linea3; headline: string; primaryText: string; cta: string; creativePrompt: string }[];
  plan: { day: number; date: string; phase: string; budgetUsd: number; linea: Linea3 | "all"; action: string }[];
  kpisWeek1: { reachTarget: number; newFollowersTarget: number; ctrTarget: string };
  kpisWeek2: { reachTarget: number; newFollowersTarget: number; ctrTarget: string };
  nextSteps: string[];
};

function StrategyTab() {
  const [agg] = useState<Aggregated | null>(() => loadPerf());
  const [budget, setBudget] = useState(75);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [strat, setStrat] = useState<Strategy | null>(() => {
    if (typeof window === "undefined") return null;
    try { const v = localStorage.getItem(LS_STRAT); return v ? JSON.parse(v) : null; } catch { return null; }
  });
  const generate = useServerFn(generateAdsStrategy);

  async function onGenerate() {
    if (!agg) { toast.error("Sube primero tu CSV de performance"); return; }
    setLoading(true);
    try {
      const summary = summaryForAI(agg);
      const res = await generate({ data: { totalBudgetUsd: Number(budget), startDate, postsSummary: summary } });
      const j = JSON.parse(res.json) as Strategy;
      setStrat(j);
      localStorage.setItem(LS_STRAT, JSON.stringify(j));
      toast.success("Estrategia generada 🚀");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally { setLoading(false); }
  }

  return (
    <div className="space-y-6">
      <section className="brand-card brand-card-zen p-6">
        <h2 className="font-display text-2xl flex items-center gap-2"><Sparkles className="h-5 w-5" />Generar estrategia de 15 días</h2>
        <p className="text-sm text-[color:var(--brown-mid)] mt-1">
          La IA analiza tus posts orgánicos reales y diseña presupuesto, audiencias, creatividades y un calendario diario de pauta para Meta Ads.
        </p>
        {!agg && (
          <div className="mt-4 p-3 rounded-md bg-[color:var(--tapes-soft)]/30 border border-[color:var(--tapes)] text-sm">
            ⚠️ Aún no has importado datos. Ve a la pestaña <b>Importar performance</b> y sube tu CSV.
          </div>
        )}
        <div className="grid md:grid-cols-3 gap-3 mt-5">
          <div>
            <Label className="font-mono text-[11px] uppercase tracking-widest text-[color:var(--brown-light)]">Presupuesto total 15 días (USD)</Label>
            <Input type="number" min={15} value={budget} onChange={(e) => setBudget(Number(e.target.value))} className="mt-1" />
          </div>
          <div>
            <Label className="font-mono text-[11px] uppercase tracking-widest text-[color:var(--brown-light)]">Fecha de inicio</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1" />
          </div>
          <div className="flex items-end">
            <Button onClick={onGenerate} disabled={loading || !agg} className="bg-[color:var(--brown-deep)] text-[color:var(--cream)] hover:bg-[color:var(--brown-mid)]">
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generando…</> : <><Sparkles className="h-4 w-4 mr-2" />Generar estrategia</>}
            </Button>
          </div>
        </div>
      </section>

      {strat && <StrategyView s={strat} />}
    </div>
  );
}

function StrategyView({ s }: { s: Strategy }) {
  return (
    <div className="space-y-6">
      <section className="brand-card brand-card-tapes p-6">
        <div className="font-mono text-[11px] uppercase text-[color:var(--brown-light)]">Diagnóstico</div>
        <p className="mt-2 text-base">{s.diagnosis}</p>
        <div className="grid md:grid-cols-3 gap-3 mt-5">
          <KPI l="Budget recomendado/día" v={`$${s.recommendedDailyBudget}`} />
          <KPI l="Mejores horas" v={(s.bestHours || []).join(" · ") || "—"} />
          <KPI l="Split sub-brand" v={`📼${s.split?.tapes ?? 0}% · 🪷${s.split?.zen ?? 0}% · 🎮${s.split?.play ?? 0}%`} />
        </div>
      </section>

      <section>
        <h3 className="font-display text-xl mb-3 flex items-center gap-2"><Calendar className="h-5 w-5" />Calendario 15 días</h3>
        <div className="brand-card p-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Día</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Fase</TableHead>
                <TableHead>Sub-brand</TableHead>
                <TableHead>Budget</TableHead>
                <TableHead>Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(s.plan || []).map((d) => {
                const meta = d.linea === "all" ? null : BRAND_META[d.linea];
                return (
                  <TableRow key={d.day}>
                    <TableCell className="font-mono">D{d.day}</TableCell>
                    <TableCell className="font-mono text-xs">{d.date}</TableCell>
                    <TableCell><Badge variant="outline">{d.phase}</Badge></TableCell>
                    <TableCell>{meta ? <span className={meta.textClass}>{meta.emoji} {meta.label}</span> : <span className="text-[color:var(--brown-light)]">All</span>}</TableCell>
                    <TableCell className="font-mono">${d.budgetUsd}</TableCell>
                    <TableCell className="max-w-[420px]">{d.action}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>

      <div className="grid lg:grid-cols-2 gap-4">
        <section className="brand-card brand-card-zen p-5">
          <h3 className="font-display text-lg mb-3">Audiencias propuestas</h3>
          <div className="space-y-3">
            {(s.audiences || []).map((a, i) => {
              const meta = BRAND_META[a.linea];
              return (
                <div key={i} className="p-3 rounded-md bg-card border border-border">
                  <div className={`font-medium ${meta?.textClass}`}>{meta?.emoji} {meta?.label} · {a.audience}</div>
                  <div className="text-xs mt-1 text-[color:var(--brown-mid)]">Intereses: {a.interests?.join(", ")}</div>
                  <div className="text-xs mt-0.5 text-[color:var(--brown-mid)]">Geos: {a.geos?.join(", ")}</div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="brand-card brand-card-play p-5">
          <h3 className="font-display text-lg mb-3">Creatividades sugeridas</h3>
          <div className="space-y-3">
            {(s.creatives || []).map((c, i) => {
              const meta = BRAND_META[c.linea];
              return (
                <div key={i} className="p-3 rounded-md bg-card border border-border">
                  <div className={`font-medium ${meta?.textClass}`}>{meta?.emoji} {c.headline}</div>
                  <div className="text-sm mt-1">{c.primaryText}</div>
                  <div className="text-xs mt-1 font-mono text-[color:var(--brown-light)]">CTA: {c.cta}</div>
                  <div className="text-xs mt-1 font-mono text-[color:var(--brown-light)] line-clamp-2">{c.creativePrompt}</div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <KPIBlock title="Metas semana 1" data={s.kpisWeek1} />
        <KPIBlock title="Metas semana 2" data={s.kpisWeek2} />
      </div>

      <section className="brand-card p-5">
        <h3 className="font-display text-lg mb-2 flex items-center gap-2"><FileText className="h-5 w-5" />Próximos pasos (día 16+)</h3>
        <ul className="list-disc pl-5 space-y-1 text-sm">
          {(s.nextSteps || []).map((n, i) => <li key={i}>{n}</li>)}
        </ul>
      </section>
    </div>
  );
}

function KPI({ l, v }: { l: string; v: string }) {
  return (
    <div className="p-3 rounded-md bg-card border border-border">
      <div className="font-mono text-[11px] uppercase text-[color:var(--brown-light)]">{l}</div>
      <div className="mt-1 font-display text-xl text-[color:var(--brown-deep)]">{v}</div>
    </div>
  );
}
function KPIBlock({ title, data }: { title: string; data: Strategy["kpisWeek1"] }) {
  return (
    <section className="brand-card brand-card-tapes p-5">
      <h3 className="font-display text-lg">{title}</h3>
      <div className="grid grid-cols-3 gap-2 mt-3">
        <KPI l="Reach" v={(data?.reachTarget ?? 0).toLocaleString()} />
        <KPI l="Followers +" v={`+${data?.newFollowersTarget ?? 0}`} />
        <KPI l="CTR" v={data?.ctrTarget ?? "—"} />
      </div>
    </section>
  );
}

/* =================== CREATIVE TAB (manual generator, kept) =================== */

function CreativeTab() {
  const [linea, setLinea] = useState<Linea3>("tapes");
  const [objective, setObjective] = useState("engagement");
  const [audience, setAudience] = useState("deep_workers");
  const [budget, setBudget] = useState(5);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<null | { headline: string; primaryText: string; cta: string; creativePrompt: string; campaignName: string }>(null);
  const generate = useServerFn(generateAdCreative);

  async function onGenerate() {
    setLoading(true);
    try {
      const res = await generate({ data: { linea, objective: objective as never, audience: audience as never, budgetPerDay: Number(budget), notes } });
      setDraft(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally { setLoading(false); }
  }

  return (
    <section className="brand-card brand-card-tapes p-6">
      <h2 className="font-display text-2xl">Creatividad on-demand</h2>
      <p className="text-sm text-[color:var(--brown-mid)] mt-1">Genera copy + prompt visual para un anuncio puntual.</p>
      <div className="grid md:grid-cols-4 gap-3 mt-5">
        <div>
          <Label className="font-mono text-[11px] uppercase">Sub-brand</Label>
          <Select value={linea} onValueChange={(v) => setLinea(v as Linea3)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="tapes">📼 Tapes</SelectItem>
              <SelectItem value="zen">🪷 Zen</SelectItem>
              <SelectItem value="play">🎮 Play</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="font-mono text-[11px] uppercase">Objetivo</Label>
          <Select value={objective} onValueChange={setObjective}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="reach">Reach</SelectItem>
              <SelectItem value="engagement">Engagement</SelectItem>
              <SelectItem value="conversions">Conversions</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="font-mono text-[11px] uppercase">Audiencia</Label>
          <Select value={audience} onValueChange={setAudience}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="deep_workers">Deep Workers</SelectItem>
              <SelectItem value="students">Students</SelectItem>
              <SelectItem value="gamers">Gamers</SelectItem>
              <SelectItem value="mindfulness_enthusiasts">Mindfulness</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="font-mono text-[11px] uppercase">Budget/día (USD)</Label>
          <Input type="number" min={1} value={budget} onChange={(e) => setBudget(Number(e.target.value))} className="mt-1" />
        </div>
      </div>
      <div className="mt-3">
        <Label className="font-mono text-[11px] uppercase">Notas</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1" />
      </div>
      <div className="mt-4">
        <Button onClick={onGenerate} disabled={loading} className="bg-[color:var(--brown-deep)] text-[color:var(--cream)] hover:bg-[color:var(--brown-mid)]">
          {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generando…</> : <><Zap className="h-4 w-4 mr-2" />Generate with AI</>}
        </Button>
      </div>
      {draft && (
        <div className="mt-5 grid md:grid-cols-2 gap-3">
          <KPI l="Campaign" v={draft.campaignName} />
          <KPI l="CTA" v={draft.cta} />
          <KPI l="Headline" v={draft.headline} />
          <KPI l="Primary text" v={draft.primaryText} />
          <div className="md:col-span-2"><KPI l="Creative prompt" v={draft.creativePrompt} /></div>
        </div>
      )}
    </section>
  );
}