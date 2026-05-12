import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader, Hedgehog } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BRAND_META, type Linea } from "@/lib/brands";
import { generateAdCreative, generateAdInsights } from "@/lib/ads.functions";
import { Zap, Pause, Copy, Pencil, Check, Loader2, CheckCircle2, Circle, Hourglass } from "lucide-react";
import { toast } from "sonner";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

export const Route = createFileRoute("/_app/ads")({ component: AdsPage });

type Linea3 = Exclude<Linea, "all">;
type Status = "active" | "paused" | "ended";
type Campaign = {
  id: string;
  name: string;
  linea: Linea3;
  budgetPerDay: number;
  status: Status;
  startDate: string;
  objective: string;
  audience: string;
  headline: string;
  primaryText: string;
  cta: string;
};

const SEED: Campaign[] = [
  { id: "c1", name: "Tapes · Late-Night Focus", linea: "tapes", budgetPerDay: 5, status: "active", startDate: "2026-05-04", objective: "engagement", audience: "deep_workers", headline: "La banda sonora de tus 11pm", primaryText: "Para los que rinden cuando el mundo duerme. Guarda la playlist.", cta: "Save Playlist" },
  { id: "c2", name: "Zen · Morning Reset", linea: "zen", budgetPerDay: 3, status: "active", startDate: "2026-05-08", objective: "reach", audience: "mindfulness_enthusiasts", headline: "5 minutos. Cero ruido.", primaryText: "Empieza tu día con un respiro intencional. Sin apps, sin login.", cta: "Listen Now" },
  { id: "c3", name: "Play · Ranked Sessions", linea: "play", budgetPerDay: 4, status: "paused", startDate: "2026-04-29", objective: "conversions", audience: "gamers", headline: "Sube de rango sin perder el flow", primaryText: "Lo-fi gaming para los que apuntan al diamante.", cta: "Listen Now" },
];

function AdsPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Ads Command Center"
        title="Ads ⚡ Auto-Pilot"
        description="Lanza, optimiza y analiza tus campañas de Meta sin salir de Chill Vibe."
      />
      <Tabs defaultValue="manager">
        <TabsList>
          <TabsTrigger value="manager">Auto-Pilot Manager</TabsTrigger>
          <TabsTrigger value="analytics">Analytics & KPIs</TabsTrigger>
        </TabsList>
        <TabsContent value="manager" className="mt-6"><Manager /></TabsContent>
        <TabsContent value="analytics" className="mt-6"><Analytics /></TabsContent>
      </Tabs>
    </div>
  );
}

/* -------------------- MANAGER -------------------- */

function Manager() {
  const [campaigns, setCampaigns] = useState<Campaign[]>(SEED);
  const [linea, setLinea] = useState<Linea3>("tapes");
  const [objective, setObjective] = useState("engagement");
  const [audience, setAudience] = useState("deep_workers");
  const [budget, setBudget] = useState(5);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<null | Draft>(null);
  const generate = useServerFn(generateAdCreative);

  const [rules, setRules] = useState({
    pauseHighCpm: true,
    duplicateBest: false,
    increaseBudgetRoas: true,
    autoVariant: false,
  });

  async function onGenerate() {
    setLoading(true);
    try {
      const res = await generate({ data: { linea, objective: objective as never, audience: audience as never, budgetPerDay: Number(budget), notes } });
      setDraft(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate");
    } finally {
      setLoading(false);
    }
  }

  function launch() {
    if (!draft) return;
    const c: Campaign = {
      id: crypto.randomUUID(),
      name: draft.campaignName,
      linea,
      budgetPerDay: Number(budget),
      status: "active",
      startDate: new Date().toISOString().slice(0, 10),
      objective, audience,
      headline: draft.headline,
      primaryText: draft.primaryText,
      cta: draft.cta,
    };
    setCampaigns((cs) => [c, ...cs]);
    setDraft(null);
    toast.success("Campaign launched 🚀");
  }

  function setStatus(id: string, status: Status) {
    setCampaigns((cs) => cs.map((c) => (c.id === id ? { ...c, status } : c)));
  }
  function duplicate(id: string) {
    const c = campaigns.find((x) => x.id === id);
    if (!c) return;
    setCampaigns((cs) => [{ ...c, id: crypto.randomUUID(), name: c.name + " (copy)", status: "paused", startDate: new Date().toISOString().slice(0, 10) }, ...cs]);
    toast.success("Duplicated");
  }

  return (
    <div className="space-y-8">
      {/* Creator */}
      <section className="brand-card brand-card-tapes p-6">
        <h2 className="font-display text-2xl">Ad Campaign Creator</h2>
        <p className="text-sm text-[color:var(--brown-mid)] mt-1">Claude AI escribe el copy y sugiere el creative. Tú apruebas y lanzas.</p>
        <div className="grid md:grid-cols-4 gap-3 mt-5">
          <Field label="Sub-brand">
            <Select value={linea} onValueChange={(v) => setLinea(v as Linea3)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tapes">📼 Tapes</SelectItem>
                <SelectItem value="zen">🪷 Zen</SelectItem>
                <SelectItem value="play">🎮 Play</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Objective">
            <Select value={objective} onValueChange={setObjective}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="reach">Reach</SelectItem>
                <SelectItem value="engagement">Engagement</SelectItem>
                <SelectItem value="conversions">Conversions</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Audience">
            <Select value={audience} onValueChange={setAudience}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="deep_workers">Deep Workers</SelectItem>
                <SelectItem value="students">Students</SelectItem>
                <SelectItem value="gamers">Gamers</SelectItem>
                <SelectItem value="mindfulness_enthusiasts">Mindfulness</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Budget / day (USD)">
            <Input type="number" min={1} value={budget} onChange={(e) => setBudget(Number(e.target.value))} />
          </Field>
        </div>
        <div className="mt-3">
          <Field label="Notes (optional)">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Promueve playlist nueva 'Madrugada' — link en bio…" rows={2} />
          </Field>
        </div>
        <div className="mt-4 flex gap-2">
          <Button onClick={onGenerate} disabled={loading} className="bg-[color:var(--brown-deep)] text-[color:var(--cream)] hover:bg-[color:var(--brown-mid)]">
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generando…</> : <><Zap className="h-4 w-4 mr-2" />Generate with AI</>}
          </Button>
          {draft && <Button onClick={launch} variant="outline"><Check className="h-4 w-4 mr-2" />Launch campaign</Button>}
        </div>

        {draft && (
          <div className="mt-5 grid md:grid-cols-2 gap-4">
            <Preview label="Campaign name" value={draft.campaignName} />
            <Preview label="CTA button" value={draft.cta} />
            <Preview label="Headline" value={draft.headline} />
            <Preview label="Primary text" value={draft.primaryText} />
            <div className="md:col-span-2">
              <Preview label="Creative prompt (watercolor)" value={draft.creativePrompt} mono />
            </div>
          </div>
        )}
      </section>

      {/* Campaigns table */}
      <section>
        <h2 className="font-display text-2xl mb-3">Active Campaigns</h2>
        {campaigns.length === 0 ? (
          <div className="brand-card p-10 text-center text-[color:var(--brown-mid)]">
            <Hedgehog />
            <p className="mt-3">Sin campañas todavía. Genera una arriba ⬆️</p>
          </div>
        ) : (
          <div className="brand-card p-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Sub-brand</TableHead>
                  <TableHead>Budget/day</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c) => {
                  const meta = BRAND_META[c.linea];
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell><span className={meta.textClass}>{meta.emoji} {meta.label}</span></TableCell>
                      <TableCell>${c.budgetPerDay}</TableCell>
                      <TableCell><StatusBadge status={c.status} /></TableCell>
                      <TableCell className="font-mono text-xs">{c.startDate}</TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex gap-1">
                          {c.status === "active" ? (
                            <Button size="sm" variant="ghost" onClick={() => setStatus(c.id, "paused")} title="Pause"><Pause className="h-4 w-4" /></Button>
                          ) : c.status === "paused" ? (
                            <Button size="sm" variant="ghost" onClick={() => setStatus(c.id, "active")} title="Resume"><Check className="h-4 w-4" /></Button>
                          ) : null}
                          <Button size="sm" variant="ghost" onClick={() => toast.message("Edit modal coming soon")} title="Edit"><Pencil className="h-4 w-4" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => duplicate(c.id)} title="Duplicate"><Copy className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* Auto rules */}
      <section className="brand-card brand-card-zen p-6">
        <h2 className="font-display text-2xl">Auto-optimization rules</h2>
        <p className="text-sm text-[color:var(--brown-mid)] mt-1">El piloto automático cuida tu presupuesto mientras duermes 🦔.</p>
        <div className="mt-5 space-y-3">
          <Rule label="Pause ad if CPM exceeds $8" checked={rules.pauseHighCpm} onChange={(v) => setRules({ ...rules, pauseHighCpm: v })} />
          <Rule label="Duplicate best performing creative after 3 days" checked={rules.duplicateBest} onChange={(v) => setRules({ ...rules, duplicateBest: v })} />
          <Rule label="Increase budget 20% if ROAS > 2x" checked={rules.increaseBudgetRoas} onChange={(v) => setRules({ ...rules, increaseBudgetRoas: v })} />
          <Rule label="Auto-generate new creative variant every 7 days" checked={rules.autoVariant} onChange={(v) => setRules({ ...rules, autoVariant: v })} />
        </div>
      </section>
    </div>
  );
}

type Draft = { headline: string; primaryText: string; cta: string; creativePrompt: string; campaignName: string };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="font-mono text-[11px] uppercase tracking-widest text-[color:var(--brown-light)]">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
function Preview({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="brand-card p-3">
      <div className="font-mono text-[11px] uppercase text-[color:var(--brown-light)]">{label}</div>
      <div className={`mt-1 text-sm ${mono ? "font-mono" : ""}`}>{value || "—"}</div>
    </div>
  );
}
function StatusBadge({ status }: { status: Status }) {
  const styles: Record<Status, string> = {
    active: "bg-[color:var(--zen)]/20 text-[color:var(--brown-deep)] border-[color:var(--zen)]",
    paused: "bg-[color:var(--tapes-soft)]/30 text-[color:var(--brown-deep)] border-[color:var(--tapes)]",
    ended: "bg-muted text-[color:var(--brown-light)] border-border",
  };
  return <Badge variant="outline" className={styles[status]}>{status}</Badge>;
}
function Rule({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-md bg-card border border-border">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

/* -------------------- ANALYTICS -------------------- */

function Analytics() {
  const kpis = [
    { l: "Ad Spend (mo)", v: "$184", hint: "30-day total" },
    { l: "Reach", v: "12,480", hint: "unique accounts" },
    { l: "CPM", v: "$3.42", hint: "per 1000 impressions" },
    { l: "CTR", v: "1.84%", hint: "vs 0.9% LATAM avg" },
    { l: "ROAS", v: "1.7x", hint: "mocked · pending pixel" },
    { l: "New followers (ads)", v: "+8", hint: "this month" },
  ];

  const spendReach = useMemo(() => {
    const d: { day: string; spend: number; reach: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(Date.now() - i * 86400_000);
      const spend = 4 + Math.round(Math.sin(i / 3) * 2 + Math.random() * 2);
      d.push({
        day: `${date.getMonth() + 1}/${date.getDate()}`,
        spend,
        reach: Math.round(spend * (220 + Math.random() * 80)),
      });
    }
    return d;
  }, []);

  const byBrand = [
    { name: "Tapes", spend: 92, reach: 6840, fill: "var(--tapes)" },
    { name: "Zen", spend: 54, reach: 3120, fill: "var(--zen)" },
    { name: "Play", spend: 38, reach: 2520, fill: "var(--play-soft)" },
  ];

  const audience = [
    { name: "Deep Workers", value: 42, fill: "var(--tapes)" },
    { name: "Mindfulness", value: 26, fill: "var(--zen)" },
    { name: "Gamers", value: 20, fill: "var(--play-soft)" },
    { name: "Students", value: 12, fill: "var(--tapes-soft)" },
  ];

  const creatives = [
    { name: "Tapes · 'banda sonora 11pm'", linea: "tapes" as Linea3, score: 92 },
    { name: "Zen · 'cinco minutos cero ruido'", linea: "zen" as Linea3, score: 81 },
    { name: "Play · 'sube de rango'", linea: "play" as Linea3, score: 68 },
    { name: "Tapes · 'lluvia + lo-fi'", linea: "tapes" as Linea3, score: 64 },
  ];

  // AI insights
  const [insights, setInsights] = useState<{ working: string[]; fix: string[]; nextStep: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const fetchInsights = useServerFn(generateAdInsights);

  async function loadInsights() {
    setLoading(true);
    try {
      const ctx = `Meta Ads last 30d for @chillvibeglobal: spend $184, reach 12,480, CPM $3.42, CTR 1.84%, ROAS 1.7x (mocked), +8 followers from ads.
By sub-brand: Tapes spend $92 / reach 6,840; Zen $54 / 3,120; Play $38 / 2,520.
Audience split: Deep Workers 42%, Mindfulness 26%, Gamers 20%, Students 12%.
Top creative: Tapes 'banda sonora 11pm' (eng score 92). Worst: Play 'lluvia + lo-fi' (64).`;
      const res = await fetchInsights({ data: { context: ctx } });
      try {
        const j = JSON.parse(res.json);
        setInsights({
          working: Array.isArray(j.working) ? j.working.slice(0, 2) : [],
          fix: Array.isArray(j.fix) ? j.fix.slice(0, 2) : [],
          nextStep: String(j.nextStep ?? ""),
        });
      } catch { /* ignore */ }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally { setLoading(false); }
  }

  useEffect(() => { loadInsights(); }, []); // eslint-disable-line

  return (
    <div className="space-y-8">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((k) => (
          <div key={k.l} className="brand-card p-4">
            <div className="font-mono text-[11px] uppercase text-[color:var(--brown-light)]">{k.l}</div>
            <div className="mt-1 font-display text-2xl text-[color:var(--brown-deep)]">{k.v}</div>
            <div className="text-[11px] text-[color:var(--brown-light)] mt-1">{k.hint}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="brand-card brand-card-tapes p-5">
          <h3 className="font-display text-lg mb-3">Spend vs Reach · last 30d</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={spendReach}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="l" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Line yAxisId="l" type="monotone" dataKey="spend" stroke="var(--tapes)" strokeWidth={2} dot={false} />
                <Line yAxisId="r" type="monotone" dataKey="reach" stroke="var(--zen)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="brand-card brand-card-zen p-5">
          <h3 className="font-display text-lg mb-3">Performance by sub-brand</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byBrand}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="spend" name="Spend ($)" radius={[4, 4, 0, 0]}>
                  {byBrand.map((b, i) => <Cell key={i} fill={b.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="brand-card brand-card-play p-5">
          <h3 className="font-display text-lg mb-3">Audience breakdown</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={audience} dataKey="value" nameKey="name" outerRadius={90} label={(d) => `${d.name} ${d.value}%`}>
                  {audience.map((a, i) => <Cell key={i} fill={a.fill} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="brand-card brand-card-all p-5">
          <h3 className="font-display text-lg mb-3">Best performing creatives</h3>
          <ul className="space-y-2">
            {creatives.map((c, i) => {
              const meta = BRAND_META[c.linea];
              return (
                <li key={i} className="flex items-center gap-3 p-3 rounded-md bg-card border border-border">
                  <div className="font-mono text-xs w-6 text-[color:var(--brown-light)]">#{i + 1}</div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{c.name}</div>
                    <div className={`text-xs ${meta.textClass}`}>{meta.emoji} {meta.label}</div>
                  </div>
                  <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full" style={{ width: `${c.score}%`, background: meta.colorVar }} />
                  </div>
                  <div className="font-mono text-sm w-10 text-right">{c.score}</div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* AI Insights */}
      <section className="brand-card brand-card-tapes p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-mono text-xs uppercase tracking-widest text-[color:var(--brown-light)]">AI Insights</div>
            <h2 className="mt-1 font-display text-2xl">Lectura del piloto 🦔</h2>
          </div>
          <Button variant="outline" onClick={loadInsights} disabled={loading}>
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Pensando…</> : "Refresh"}
          </Button>
        </div>
        {!insights ? (
          <div className="mt-4 text-sm text-[color:var(--brown-mid)]">Generando análisis…</div>
        ) : (
          <div className="mt-5 grid md:grid-cols-3 gap-4">
            <InsightCol title="✅ What's working" items={insights.working} />
            <InsightCol title="⚠️ What to fix" items={insights.fix} />
            <div>
              <div className="font-mono text-xs uppercase text-[color:var(--brown-light)]">→ Next step (7d)</div>
              <p className="mt-2 text-sm">{insights.nextStep || "—"}</p>
            </div>
          </div>
        )}
      </section>

      {/* Steps Forward */}
      <StepsForward />
    </div>
  );
}

function InsightCol({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="font-mono text-xs uppercase text-[color:var(--brown-light)]">{title}</div>
      <ul className="mt-2 space-y-2 text-sm">
        {items.length === 0 ? <li className="text-[color:var(--brown-light)]">—</li> :
          items.map((s, i) => <li key={i} className="leading-snug">• {s}</li>)}
      </ul>
    </div>
  );
}

/* -------------------- STEPS FORWARD -------------------- */

type StepState = "done" | "doing" | "todo";
const STEPS: { title: string; desc: string; metric: string; state: StepState; icon: string }[] = [
  { state: "done", icon: "🌱", title: "Account created, brand configured", desc: "Sub-brands Tapes, Zen, Play activos.", metric: "3 sub-brands" },
  { state: "done", icon: "✍️", title: "First content pieces generated", desc: "Studio + Planner produciendo.", metric: "22 posts" },
  { state: "doing", icon: "🚀", title: "First ad campaign launched", desc: "Meta Ads en piloto automático.", metric: "3 campañas activas" },
  { state: "todo", icon: "👥", title: "100 followers milestone", desc: "Comunidad inicial sólida.", metric: "15 / 100" },
  { state: "todo", icon: "📡", title: "First 10,000 reach from ads", desc: "Validación de audiencias.", metric: "0 / 10k" },
  { state: "todo", icon: "💸", title: "ROAS positive", desc: "Ganar más de lo que gastas.", metric: "1.7x → 2.0x" },
  { state: "todo", icon: "🌟", title: "1,000 followers", desc: "Desbloquea analytics avanzados.", metric: "15 / 1,000" },
  { state: "todo", icon: "🎧", title: "First playlist save from paid traffic", desc: "Conversión real de pago a fan.", metric: "0 saves" },
];

function StepsForward() {
  return (
    <section className="brand-card brand-card-all p-6">
      <h2 className="font-display text-2xl">Steps Forward · growth journey</h2>
      <p className="text-sm text-[color:var(--brown-mid)] mt-1">El camino de Chill Vibe, paso a paso.</p>
      <ol className="mt-6 grid md:grid-cols-2 gap-3">
        {STEPS.map((s, i) => {
          const palette =
            s.state === "done"
              ? "border-l-[color:var(--tapes)] bg-[color:var(--tapes-soft)]/15"
              : s.state === "doing"
              ? "border-l-[color:var(--zen)] bg-[color:var(--zen)]/10"
              : "border-l-border bg-card";
          const Icon = s.state === "done" ? CheckCircle2 : s.state === "doing" ? Hourglass : Circle;
          const iconColor =
            s.state === "done" ? "text-[color:var(--tapes)]" :
            s.state === "doing" ? "text-[color:var(--zen)]" : "text-[color:var(--brown-light)]";
          return (
            <li key={i} className={`p-4 border border-border border-l-4 rounded-md ${palette}`}>
              <div className="flex items-start gap-3">
                <div className="text-2xl">{s.icon}</div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-display text-base">Step {i + 1} · {s.title}</div>
                    <Icon className={`h-4 w-4 ${iconColor}`} />
                  </div>
                  <p className="text-sm text-[color:var(--brown-mid)] mt-1">{s.desc}</p>
                  <div className="mt-2 font-mono text-[11px] uppercase tracking-widest text-[color:var(--brown-light)]">{s.metric}</div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}