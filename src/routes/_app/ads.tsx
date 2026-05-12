import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader, Hedgehog } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BRAND_META, type Linea } from "@/lib/brands";
import { generateAdsStrategy, generateAdsInsights } from "@/lib/ads.functions";
import { Loader2, Upload, Sparkles, Calendar, FileText, TrendingUp, AlertCircle, ArrowRight, Zap } from "lucide-react";
import { toast } from "sonner";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from "recharts";

export const Route = createFileRoute("/_app/ads")({ component: AdsCommandCenter });

function AdsCommandCenter() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Analytics & Strategy"
        title="Ads Command Center"
        description="Analiza tus posts orgánicos para decidir qué pautar y revisa tus métricas del Ads Manager en un solo lugar."
      />
      <Tabs defaultValue="organic" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="organic">🌿 Estrategia Orgánica</TabsTrigger>
          <TabsTrigger value="paid">📈 Analítica de Pauta</TabsTrigger>
        </TabsList>
        <TabsContent value="organic">
          <OrganicTab />
        </TabsContent>
        <TabsContent value="paid">
          <PaidTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* =========================================================================
   ======================= UTILS (NUM & CSV PARSER) ========================
   ========================================================================= */

const NUM = (s: string) => {
  if (!s) return 0;
  // Eliminar símbolos de moneda y espacios
  let str = s.replace(/[^0-9.,-]/g, "");
  
  // Detectar formato español (1.234,56) vs inglés (1,234.56)
  if (str.includes(",") && str.includes(".")) {
    const lastComma = str.lastIndexOf(",");
    const lastDot = str.lastIndexOf(".");
    if (lastComma > lastDot) {
      str = str.replace(/\./g, "").replace(",", ".");
    } else {
      str = str.replace(/,/g, "");
    }
  } else if (str.includes(",")) {
    const parts = str.split(",");
    if (parts.length === 2 && parts[1].length !== 3) {
      str = str.replace(",", "."); // Es un decimal
    } else {
      str = str.replace(/,/g, ""); // Es separador de miles
    }
  }
  
  const n = Number(str);
  return isNaN(n) ? 0 : n;
};

const normalize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

function universalParseCSV(text: string): Record<string, string>[] {
  text = text.replace(/^\uFEFF/, ""); // Remove BOM
  
  // Detect delimiter
  const firstLine = text.split('\n')[0] || "";
  let delimiter = ",";
  if (firstLine.includes(";")) delimiter = ";";
  else if (firstLine.includes("\t")) delimiter = "\t";

  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false;
      } else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === delimiter) { cur.push(field); field = ""; }
      else if (c === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else field += c;
    }
  }
  if (field.length || cur.length) { cur.push(field); rows.push(cur); }
  if (rows.length === 0) return [];
  
  const header = rows[0].map(h => normalize(h));
  return rows.slice(1).filter((r) => r.length > 1).map((r) => {
    const o: Record<string, string> = {};
    header.forEach((h, i) => { o[h] = (r[i] ?? "").trim(); });
    return o;
  });
}

function findCol(r: Record<string, string>, keywords: string[]) {
  const keys = Object.keys(r);
  const keywordsNorm = keywords.map(normalize);
  for (const k of keys) {
    if (keywordsNorm.some(kw => k.includes(kw))) return r[k];
  }
  return "";
}

/* =========================================================================
   ========================== 1. ORGANIC TAB ===============================
   ========================================================================= */

type AggregatedOrganic = {
  totalPosts: number;
  totalReach: number;
  topPosts: { title: string; date: string; reach: number; views: number; react: number; comm: number; shar: number; clk: number; eng: number; type: string }[];
  dateRange: { from: string; to: string };
};

type Strategy = {
  diagnosis: string;
  recommendedDailyBudget: number;
  split: { tapes: number; zen: number; play: number };
  bestHours: string[];
  audiences: { linea: "tapes"|"zen"|"play"; audience: string; interests: string[]; geos: string[] }[];
  creatives: { linea: "tapes"|"zen"|"play"; headline: string; primaryText: string; cta: string; creativePrompt: string }[];
  plan: { day: number; date: string; phase: string; budgetUsd: number; linea: "tapes"|"zen"|"play" | "all"; action: string }[];
  kpisWeek1: { reachTarget: number; newFollowersTarget: number; ctrTarget: string };
  kpisWeek2: { reachTarget: number; newFollowersTarget: number; ctrTarget: string };
  nextSteps: string[];
};

function aggregateOrganic(rows: Record<string, string>[]): AggregatedOrganic | null {
  if (!rows.length) return null;

  const valid = rows.filter((r) => findCol(r, ["titulo", "title", "descripcion", "description"]) && findCol(r, ["hora de publicacion", "publish time", "date", "fecha"]));
  if (!valid.length) return null;

  const ranked: AggregatedOrganic["topPosts"] = [];
  let minDate = "", maxDate = "";
  let totalReach = 0;

  for (const r of valid) {
    const reach = NUM(findCol(r, ["alcance", "reach"]));
    const views = NUM(findCol(r, ["visualizaciones", "views", "impressions"]));
    const react = NUM(findCol(r, ["reacciones", "reactions"]));
    const comm = NUM(findCol(r, ["comentarios", "comments"]));
    const shar = NUM(findCol(r, ["veces que se compartio", "shares", "compartidos"]));
    const clk = NUM(findCol(r, ["total de clics", "clicks", "clics"]));
    const eng = react + comm + shar + clk;
    totalReach += reach;

    const t = findCol(r, ["hora de publicacion", "publish time", "date", "fecha"]);
    const m = t.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    let iso = "";
    if (m) {
      const [_, mo, da, yr] = m;
      iso = \`\${yr}-\${mo.padStart(2, "0")}-\${da.padStart(2, "0")}\`;
      if (!minDate || iso < minDate) minDate = iso;
      if (!maxDate || iso > maxDate) maxDate = iso;
    }
    const rawTitle = findCol(r, ["titulo", "title", "descripcion", "description"]);
    const title = (rawTitle || "").replace(/\s+/g, " ").slice(0, 140);
    const typeStr = findCol(r, ["tipo de publicacion", "post type", "tipo"]);
    ranked.push({ title, date: iso || t, reach, views, react, comm, shar, clk, eng, type: typeStr || "—" });
  }

  return {
    totalPosts: valid.length,
    totalReach,
    topPosts: ranked.sort((a, b) => b.eng - a.eng || b.reach - a.reach),
    dateRange: { from: minDate, to: maxDate },
  };
}

function summaryForOrganicAI(a: AggregatedOrganic): string {
  const top = a.topPosts.slice(0, 15).map((p, i) => \`\${i + 1}. [\${p.date}] reach=\${p.reach} views=\${p.views} react=\${p.react} eng=\${p.eng} — "\${p.title}"\`).join("\\n");
  return \`Window: \${a.dateRange.from} → \${a.dateRange.to}
Posts: \${a.totalPosts} · Reach total: \${a.totalReach}
Top 15 organic posts (candidates for boosting):
\${top || "n/a"}\`;
}

function OrganicTab() {
  const [agg, setAgg] = useState<AggregatedOrganic | null>(() => {
    if (typeof window === "undefined") return null;
    try { const v = localStorage.getItem("cv_ads_organic_v2"); return v ? JSON.parse(v) : null; } catch { return null; }
  });
  const [strat, setStrat] = useState<Strategy | null>(() => {
    if (typeof window === "undefined") return null;
    try { const v = localStorage.getItem("cv_ads_organic_strat_v2"); return v ? JSON.parse(v) : null; } catch { return null; }
  });
  const [busy, setBusy] = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);
  const [budget, setBudget] = useState(75);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  
  const generate = useServerFn(generateAdsStrategy);

  async function onFile(f: File) {
    setBusy(true);
    try {
      const text = await f.text();
      const rows = universalParseCSV(text);
      const a = aggregateOrganic(rows);
      if (!a) { toast.error("CSV sin posts válidos. ¿Estás seguro que es el de Insights de Instagram?"); return; }
      localStorage.setItem("cv_ads_organic_v2", JSON.stringify(a));
      setAgg(a);
      toast.success(\`Importados \${a.totalPosts} posts orgánicos\`);
    } catch (e) {
      toast.error("Error procesando CSV orgánico");
    } finally { setBusy(false); }
  }

  async function onGenerate() {
    if (!agg) return;
    setLoadingAI(true);
    try {
      const summary = summaryForOrganicAI(agg);
      const res = await generate({ data: { totalBudgetUsd: Number(budget), startDate, postsSummary: summary } });
      const j = JSON.parse(res.json) as Strategy;
      setStrat(j);
      localStorage.setItem("cv_ads_organic_strat_v2", JSON.stringify(j));
      toast.success("Estrategia generada 🚀");
    } catch (e) {
      toast.error("Error al generar estrategia");
    } finally { setLoadingAI(false); }
  }

  return (
    <div className="space-y-6">
      <section className="brand-card brand-card-zen p-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div>
          <h2 className="font-display text-2xl flex items-center gap-2"><Upload className="h-5 w-5" />Importar Posts Orgánicos</h2>
          <p className="text-sm text-[color:var(--brown-mid)] mt-1">
            Sube el reporte de "Insights" de Instagram. Detecta automáticamente CSV o Excel separados por comas o punto y coma.
          </p>
        </div>
        <label className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[color:var(--brown-deep)] text-[color:var(--cream)] cursor-pointer hover:bg-[color:var(--brown-mid)] shrink-0">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          <span>{busy ? "Procesando…" : "Seleccionar CSV Orgánico"}</span>
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
        </label>
      </section>

      {!agg ? (
        <div className="brand-card p-10 text-center text-[color:var(--brown-mid)]">
          <Hedgehog />
          <p className="mt-3">Sube tu CSV Orgánico para descubrir tus mejores posts históricos.</p>
        </div>
      ) : (
        <>
          <section className="brand-card p-5">
            <h3 className="font-display text-lg mb-3">Histórico Orgánico: Todos los posts</h3>
            <div className="overflow-x-auto max-h-[500px]">
              <Table>
                <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
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
                  {agg.topPosts.map((p, i) => (
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

          <section className="brand-card brand-card-play p-6">
            <h2 className="font-display text-xl mb-2 flex items-center gap-2"><Sparkles className="h-5 w-5" />Generar Estrategia de Boost (15 Días)</h2>
            <div className="grid md:grid-cols-3 gap-3 mt-4">
              <div>
                <Label className="font-mono text-[11px] uppercase text-[color:var(--brown-light)]">Presupuesto total (USD)</Label>
                <Input type="number" min={15} value={budget} onChange={(e) => setBudget(Number(e.target.value))} className="mt-1" />
              </div>
              <div>
                <Label className="font-mono text-[11px] uppercase text-[color:var(--brown-light)]">Fecha de inicio</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1" />
              </div>
              <div className="flex items-end">
                <Button onClick={onGenerate} disabled={loadingAI} className="bg-[color:var(--brown-deep)] text-[color:var(--cream)] w-full">
                  {loadingAI ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generando…</> : <><Sparkles className="h-4 w-4 mr-2" />Crear plan IA</>}
                </Button>
              </div>
            </div>
          </section>

          {strat && (
            <div className="space-y-6">
              <section className="brand-card brand-card-tapes p-6">
                <div className="font-mono text-[11px] uppercase text-[color:var(--brown-light)]">Diagnóstico Orgánico</div>
                <p className="mt-2 text-base">{strat.diagnosis}</p>
              </section>
              <section>
                <h3 className="font-display text-xl mb-3 flex items-center gap-2"><Calendar className="h-5 w-5" />Calendario 15 días (Boosting)</h3>
                <div className="brand-card p-2 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Día</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Fase</TableHead>
                        <TableHead>Sub-brand</TableHead>
                        <TableHead>Budget</TableHead>
                        <TableHead>Acción a pautar</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(strat.plan || []).map((d) => {
                        const meta = d.linea === "all" ? null : BRAND_META[d.linea];
                        return (
                          <TableRow key={d.day}>
                            <TableCell className="font-mono">D{d.day}</TableCell>
                            <TableCell className="font-mono text-xs whitespace-nowrap">{d.date}</TableCell>
                            <TableCell><Badge variant="outline">{d.phase}</Badge></TableCell>
                            <TableCell>{meta ? <span className={meta.textClass}>{meta.emoji} {meta.label}</span> : "All"}</TableCell>
                            <TableCell className="font-mono">\${d.budgetUsd}</TableCell>
                            <TableCell className="min-w-[300px]">{d.action}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </section>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* =========================================================================
   ========================== 2. PAID TAB ==================================
   ========================================================================= */

type AggregatedPaid = {
  totalSpend: number;
  totalReach: number;
  avgCPM: number;
  avgCTR: number;
  costPerFollower: number;
  bestSubBrand: string;
  byDay: { date: string; spend: number; reach: number }[];
  byPlatform: { platform: string; reels: number; stories: number; feed: number }[];
  byAudience: { name: string; value: number }[];
  topCreatives: { adName: string; ctr: number; spend: number; reach: number }[];
  rawSummary: string;
};

function aggregatePaid(rows: Record<string, string>[]): AggregatedPaid | null {
  if (!rows.length) return null;
  let totalSpend = 0, totalReach = 0, totalImps = 0, totalClicks = 0, totalFollowers = 0;
  const byDayMap = new Map<string, { spend: number; reach: number }>();
  const byPlatMap = new Map<string, { reels: number; stories: number; feed: number }>();
  const byAudMap = new Map<string, number>();
  const creativeMap = new Map<string, { ctr: number; spend: number; reach: number; imps: number; clicks: number }>();
  const subbrandMap = new Map<string, number>();

  for (const r of rows) {
    const spend = NUM(findCol(r, ["amount spent", "importe gastado", "spend", "gasto"]));
    const reach = NUM(findCol(r, ["reach", "alcance"]));
    const imps = NUM(findCol(r, ["impressions", "impresiones"]));
    const clicks = NUM(findCol(r, ["link clicks", "clics en el enlace", "clics"]));
    const followers = NUM(findCol(r, ["new followers", "nuevos seguidores", "followers"]));
    
    totalSpend += spend;
    totalReach += reach;
    totalImps += imps;
    totalClicks += clicks;
    totalFollowers += followers;

    const date = findCol(r, ["date", "fecha", "dia"]) || "Unknown";
    if (date && date !== "Unknown") {
      const existing = byDayMap.get(date) || { spend: 0, reach: 0 };
      existing.spend += spend;
      existing.reach += reach;
      byDayMap.set(date, existing);
    }

    const platform = findCol(r, ["platform", "plataforma"]) || "Instagram";
    const placement = findCol(r, ["placement", "ubicacion", "format", "formato"]) || "";
    const pExisting = byPlatMap.get(platform) || { reels: 0, stories: 0, feed: 0 };
    if (placement.includes("story") || placement.includes("historia")) pExisting.stories += spend;
    else if (placement.includes("reel")) pExisting.reels += spend;
    else pExisting.feed += spend;
    byPlatMap.set(platform, pExisting);

    const age = findCol(r, ["age", "edad"]);
    const gender = findCol(r, ["gender", "genero", "sexo"]);
    if (age && gender) {
      const key = \`\${age} \${gender}\`;
      byAudMap.set(key, (byAudMap.get(key) || 0) + spend);
    }

    const adName = findCol(r, ["ad name", "nombre del anuncio", "ad"]);
    if (adName) {
      const cExisting = creativeMap.get(adName) || { ctr: 0, spend: 0, reach: 0, imps: 0, clicks: 0 };
      cExisting.spend += spend;
      cExisting.reach += reach;
      cExisting.imps += imps;
      cExisting.clicks += clicks;
      creativeMap.set(adName, cExisting);
    }

    const fullText = ((findCol(r, ["campaign", "campana"]) || "") + " " + adName).toLowerCase();
    let sb = "Otros";
    if (fullText.includes("tapes")) sb = "Tapes";
    else if (fullText.includes("zen")) sb = "Zen";
    else if (fullText.includes("play")) sb = "Play";
    subbrandMap.set(sb, (subbrandMap.get(sb) || 0) + spend);
  }

  // Fallback para validar si realmente procesamos pauta (si todo es 0 y no hay rows, falla)
  if (totalSpend === 0 && totalImps === 0) return null;

  const avgCPM = totalImps > 0 ? (totalSpend / totalImps) * 1000 : 0;
  const avgCTR = totalImps > 0 ? (totalClicks / totalImps) * 100 : 0;
  const costPerFollower = totalFollowers > 0 ? totalSpend / totalFollowers : 0;

  let bestSubBrand = "N/A";
  let maxSb = 0;
  for (const [sb, val] of subbrandMap.entries()) {
    if (val > maxSb) { maxSb = val; bestSubBrand = sb; }
  }

  return {
    totalSpend,
    totalReach,
    avgCPM,
    avgCTR,
    costPerFollower,
    bestSubBrand,
    byDay: Array.from(byDayMap.entries()).map(([k, v]) => ({ date: k, ...v })).sort((a, b) => a.date.localeCompare(b.date)),
    byPlatform: Array.from(byPlatMap.entries()).map(([k, v]) => ({ platform: k, ...v })),
    byAudience: Array.from(byAudMap.entries()).map(([k, v]) => ({ name: k, value: v })).sort((a, b) => b.value - a.value).slice(0, 6),
    topCreatives: Array.from(creativeMap.entries()).map(([k, v]) => ({ adName: k, ctr: v.imps > 0 ? (v.clicks/v.imps)*100 : 0, spend: v.spend, reach: v.reach })).sort((a, b) => b.ctr - a.ctr).slice(0, 10),
    rawSummary: \`Total Spend: $\${totalSpend.toFixed(2)}, Reach: \${totalReach}, Avg CTR: \${avgCTR.toFixed(2)}%, Avg CPM: $\${avgCPM.toFixed(2)}. Best sub-brand: \${bestSubBrand}.\`
  };
}

const COLORS = ['#D4A373', '#8B5A2B', '#E9C46A', '#A0522D', '#CD853F', '#DEB887'];

function PaidTab() {
  const [agg, setAgg] = useState<AggregatedPaid | null>(() => {
    if (typeof window === "undefined") return null;
    try { const v = localStorage.getItem("cv_ads_paid_v2"); return v ? JSON.parse(v) : null; } catch { return null; }
  });
  const [busy, setBusy] = useState(false);

  async function onFile(f: File) {
    setBusy(true);
    try {
      const text = await f.text();
      const rows = universalParseCSV(text);
      const a = aggregatePaid(rows);
      if (!a) { toast.error("El CSV no parece ser del Ads Manager (No hay datos de inversión)."); return; }
      localStorage.setItem("cv_ads_paid_v2", JSON.stringify(a));
      setAgg(a);
      toast.success("Datos financieros importados con éxito");
    } catch (e) {
      toast.error("Error al procesar el reporte de Ads Manager");
    } finally { setBusy(false); }
  }

  if (!agg) {
    return (
      <div className="brand-card p-12 text-center text-[color:var(--brown-mid)] flex flex-col items-center justify-center min-h-[400px]">
        <Hedgehog />
        <h3 className="font-display text-xl mt-4 text-[color:var(--brown-deep)]">Analítica de Ads Manager</h3>
        <p className="mt-2 mb-6 max-w-md mx-auto text-sm">
          Sube el reporte financiero desde tu Meta Ads Manager (con Amount spent, CPM, Clics) para generar las gráficas.
        </p>
        <label className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[color:var(--brown-deep)] text-[color:var(--cream)] cursor-pointer hover:bg-[color:var(--brown-mid)] transition-colors">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          <span>{busy ? "Procesando…" : "Importar Meta Ads CSV"}</span>
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
        </label>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <h2 className="font-display text-2xl text-[color:var(--brown-deep)]">Dashboard Financiero</h2>
        <label className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-md bg-white border border-border text-[color:var(--brown-deep)] cursor-pointer hover:bg-gray-50 transition-colors shadow-sm">
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
          <span>Actualizar CSV</span>
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
        </label>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { l: "Total Spend", v: \`$\${agg.totalSpend.toFixed(2)}\` },
          { l: "Total Reach", v: agg.totalReach.toLocaleString() },
          { l: "Average CPM", v: \`$\${agg.avgCPM.toFixed(2)}\` },
          { l: "Average CTR", v: \`\${agg.avgCTR.toFixed(2)}%\` },
          { l: "Cost / Follower", v: agg.costPerFollower > 0 ? \`$\${agg.costPerFollower.toFixed(2)}\` : "N/A" },
          { l: "Top Sub-brand", v: agg.bestSubBrand },
        ].map((k, i) => (
          <div key={i} className="brand-card p-4 bg-white/50 backdrop-blur-sm">
            <div className="font-mono text-[10px] uppercase text-[color:var(--brown-light)] font-bold tracking-wider">{k.l}</div>
            <div className="mt-1.5 font-display text-2xl text-[color:var(--brown-deep)]">{k.v}</div>
          </div>
        ))}
      </div>
      
      <div className="grid lg:grid-cols-2 gap-6">
        <section className="brand-card p-5">
          <h3 className="font-display text-lg mb-4 text-[color:var(--brown-deep)]">Spend vs Reach by day</h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={agg.byDay} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5E5" />
                <XAxis dataKey="date" tick={{fontSize: 10, fill: '#8B5A2B'}} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{fontSize: 10, fill: '#8B5A2B'}} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{fontSize: 10, fill: '#D4A373'}} axisLine={false} tickLine={false} />
                <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line yAxisId="left" type="monotone" dataKey="spend" name="Spend ($)" stroke="#8B5A2B" strokeWidth={3} dot={{r: 3}} activeDot={{r: 5}} />
                <Line yAxisId="right" type="monotone" dataKey="reach" name="Reach" stroke="#D4A373" strokeWidth={3} dot={{r: 3}} activeDot={{r: 5}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="brand-card p-5">
          <h3 className="font-display text-lg mb-4 text-[color:var(--brown-deep)]">Performance by Platform</h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agg.byPlatform} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5E5" />
                <XAxis dataKey="platform" tick={{fontSize: 10, fill: '#8B5A2B'}} axisLine={false} tickLine={false} />
                <YAxis tick={{fontSize: 10, fill: '#8B5A2B'}} axisLine={false} tickLine={false} />
                <RechartsTooltip cursor={{fill: 'rgba(0,0,0,0.05)'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="reels" name="Reels" fill="#D4A373" radius={[4, 4, 0, 0]} />
                <Bar dataKey="stories" name="Stories" fill="#8B5A2B" radius={[4, 4, 0, 0]} />
                <Bar dataKey="feed" name="Feed" fill="#E9C46A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <section className="brand-card p-5 h-full">
          <h3 className="font-display text-lg mb-4 text-[color:var(--brown-deep)]">Audience Breakdown</h3>
          <div className="h-[220px] w-full flex items-center justify-center">
            {agg.byAudience.length === 0 ? (
              <div className="text-sm text-[color:var(--brown-light)]">No demographic data</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={agg.byAudience} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value">
                    {agg.byAudience.map((entry, index) => (
                      <Cell key={\`cell-\${index}\`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className="brand-card p-5 h-full flex flex-col lg:col-span-2">
          <h3 className="font-display text-lg mb-3 text-[color:var(--brown-deep)]">Best Performing Creatives</h3>
          <div className="overflow-x-auto flex-1">
            <Table>
              <TableHeader>
                <TableRow className="border-b-[color:var(--brown-light)]/20">
                  <TableHead className="text-[color:var(--brown-mid)]">Ad Name</TableHead>
                  <TableHead className="text-[color:var(--brown-mid)] text-right">Spend</TableHead>
                  <TableHead className="text-[color:var(--brown-mid)] text-right">Reach</TableHead>
                  <TableHead className="text-[color:var(--brown-mid)] text-right">CTR</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agg.topCreatives.map((c, i) => (
                  <TableRow key={i} className="border-b-[color:var(--brown-light)]/10 hover:bg-[color:var(--brown-light)]/5">
                    <TableCell className="font-medium text-[color:var(--brown-deep)] max-w-[200px] truncate" title={c.adName}>{c.adName}</TableCell>
                    <TableCell className="text-right font-mono">\${c.spend.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono">{c.reach.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-bold text-[#8B5A2B]">{c.ctr.toFixed(2)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>

      <AIInsightsPanel a={agg} />
    </div>
  );
}

function AIInsightsPanel({ a }: { a: AggregatedPaid }) {
  const [insights, setInsights] = useState<{whatsWorking: string[], whatToFix: {issue: string, action: string}, nextStep: string} | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchInsights = useServerFn(generateAdsInsights);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoading(true); setError(null);
      try {
        const res = await fetchInsights({ data: { summary: a.rawSummary } });
        if (isMounted) setInsights(res as any);
      } catch (err) {
        if (isMounted) setError("Error al generar insights. Reintenta más tarde.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => { isMounted = false; };
  }, [a, fetchInsights]);

  return (
    <section className="brand-card brand-card-zen p-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-10"><Zap className="w-24 h-24 text-[color:var(--brown-deep)]" /></div>
      <h3 className="font-display text-xl mb-4 text-[color:var(--brown-deep)] flex items-center gap-2">
        <Zap className="w-5 h-5 text-amber-500" fill="currentColor" /> Claude AI Insights
      </h3>
      
      {loading ? (
        <div className="flex flex-col items-center justify-center py-8 text-[color:var(--brown-mid)]">
          <Loader2 className="w-8 h-8 animate-spin mb-3 text-[color:var(--brown-deep)]" />
          <p className="animate-pulse">Claude está analizando tus datos de pauta...</p>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 text-red-600 rounded-md flex items-center gap-3"><AlertCircle className="w-5 h-5" /> {error}</div>
      ) : insights ? (
        <div className="grid md:grid-cols-3 gap-6 relative z-10">
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-bold text-green-700 bg-green-50 px-3 py-1.5 rounded-full w-fit text-sm">
              <TrendingUp className="w-4 h-4" /> What's Working
            </div>
            <ul className="space-y-2 text-sm text-[color:var(--brown-deep)]">
              {insights.whatsWorking.map((w, i) => (
                <li key={i} className="flex items-start gap-2">
                  <div className="mt-1 w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" /><span>{w}</span>
                </li>
              ))}
            </ul>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-bold text-amber-700 bg-amber-50 px-3 py-1.5 rounded-full w-fit text-sm">
              <AlertCircle className="w-4 h-4" /> What to Fix
            </div>
            <div className="text-sm text-[color:var(--brown-deep)] p-3 bg-white/50 rounded-lg border border-amber-100">
              <p className="font-semibold">{insights.whatToFix.issue}</p>
              <p className="mt-2 text-amber-800 flex items-start gap-1"><ArrowRight className="w-4 h-4 mt-0.5 flex-shrink-0" /> {insights.whatToFix.action}</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-bold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-full w-fit text-sm">
              <Zap className="w-4 h-4" /> Next Step (7 Days)
            </div>
            <div className="text-sm text-[color:var(--brown-deep)] p-4 bg-[color:var(--brown-deep)] text-white rounded-lg shadow-md font-medium leading-relaxed">
              {insights.nextStep}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
