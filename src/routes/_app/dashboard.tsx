import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Hedgehog } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { BRAND_META, type Linea } from "@/lib/brands";
import { generateInsights } from "@/lib/content.functions";
import { Sparkles, Search, Calendar, Mail } from "lucide-react";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

type Counts = { total: number; tofu: number; mofu: number; bofu: number; tapes: number; zen: number; play: number; scheduled: number };
type Insight = { title: string; detail: string; linea: string };

function Dashboard() {
  const [counts, setCounts] = useState<Counts>({ total: 0, tofu: 0, mofu: 0, bofu: 0, tapes: 0, zen: 0, play: 0, scheduled: 0 });
  const [recent, setRecent] = useState<Array<{ id: string; title: string; linea: Linea; created_at: string; type: string }>>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const fetchInsights = useServerFn(generateInsights);

  useEffect(() => {
    (async () => {
      const since = new Date(Date.now() - 7 * 86400_000).toISOString();
      const { data } = await supabase
        .from("content_items")
        .select("id,title,linea,funnel_stage,status,scheduled_for,type,created_at")
        .gte("created_at", since);
      const all = data ?? [];
      const c: Counts = { total: all.length, tofu: 0, mofu: 0, bofu: 0, tapes: 0, zen: 0, play: 0, scheduled: 0 };
      for (const r of all) {
        if (r.funnel_stage === "tofu") c.tofu++;
        if (r.funnel_stage === "mofu") c.mofu++;
        if (r.funnel_stage === "bofu") c.bofu++;
        if (r.linea === "tapes") c.tapes++;
        if (r.linea === "zen") c.zen++;
        if (r.linea === "play") c.play++;
        if (r.status === "scheduled") c.scheduled++;
      }
      setCounts(c);

      const { data: r2 } = await supabase
        .from("content_items")
        .select("id,title,linea,created_at,type")
        .order("created_at", { ascending: false })
        .limit(5);
      setRecent((r2 ?? []) as never);
    })();
  }, []);

  async function loadInsights() {
    setInsightsLoading(true);
    try {
      const ctx = `Account: @chillvibeglobal. Real metrics last 90d: 22 posts, 15 followers, 4,739 profile views, 342 interactions (59.8% followers / 40.2% non-followers), 2,144 reached, 115 profile visits.
This week activity: ${counts.total} content pieces (Tapes: ${counts.tapes}, Zen: ${counts.zen}, Play: ${counts.play}). Funnel: TOFU ${counts.tofu} / MOFU ${counts.mofu} / BOFU ${counts.bofu}. Scheduled: ${counts.scheduled}.`;
      const res = await fetchInsights({ data: { context: ctx } });
      try {
        const j = JSON.parse(res.insightsJson);
        if (Array.isArray(j.insights)) setInsights(j.insights.slice(0, 3));
      } catch { /* ignore */ }
    } finally {
      setInsightsLoading(false);
    }
  }

  const total = Math.max(1, counts.tofu + counts.mofu + counts.bofu);

  return (
    <div>
      <PageHeader
        eyebrow="Home"
        title="Welcome back, nocturnal one 🦔"
        description="Your week at a glance — content shipped, scheduled, and what to make next."
        action={
          <Button asChild className="bg-[color:var(--brown-deep)] text-[color:var(--cream)] hover:bg-[color:var(--brown-mid)]">
            <Link to="/studio">Create content</Link>
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="This week" value={counts.total} hint="content pieces" />
        <Stat label="Scheduled" value={counts.scheduled} hint="ready to publish" />
        <Stat label="Tapes 📼" value={counts.tapes} hint="this week" color="var(--tapes)" />
        <Stat label="Zen 🪷 / Play 🎮" value={counts.zen + counts.play} hint={`${counts.zen} / ${counts.play}`} color="var(--zen)" />
      </div>

      {/* Funnel */}
      <section className="mt-8 brand-card brand-card-all p-6">
        <h2 className="font-display text-xl">Content funnel · last 7d</h2>
        <div className="mt-4 space-y-2">
          {(["tofu","mofu","bofu"] as const).map((s) => {
            const v = counts[s];
            const pct = Math.round((v / total) * 100);
            return (
              <div key={s}>
                <div className="flex justify-between text-xs font-mono uppercase">
                  <span>{s} · {v}</span><span>{pct}%</span>
                </div>
                <div className="h-2 mt-1 bg-muted rounded-full overflow-hidden">
                  <div className="h-full" style={{ width: `${pct}%`, background: "var(--tapes)" }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Quick actions */}
      <section className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3">
        <QuickAction icon={<Sparkles className="h-4 w-4" />} to="/studio" label="Generate content" />
        <QuickAction icon={<Calendar className="h-4 w-4" />} to="/planner" label="Generate week" />
        <QuickAction icon={<Search className="h-4 w-4" />} to="/competitors" label="Analyze competitor" />
        <QuickAction icon={<Mail className="h-4 w-4" />} to="/email" label="New email sequence" />
      </section>

      {/* AI insights */}
      <section className="mt-8 brand-card brand-card-tapes p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-mono text-xs uppercase tracking-widest text-[color:var(--brown-light)]">AI insights</div>
            <h2 className="mt-1 font-display text-xl">What to do next</h2>
          </div>
          <Button onClick={loadInsights} disabled={insightsLoading} variant="outline">
            {insightsLoading ? "🦔 thinking…" : insights.length ? "Refresh" : "Generate"}
          </Button>
        </div>
        {insights.length === 0 ? (
          <div className="mt-6 flex items-center gap-4 text-[color:var(--brown-mid)]">
            <Hedgehog size={48} />
            <p>Click "Generate" to get 3 actionable insights based on your real account data.</p>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {insights.map((i, k) => (
              <li key={k} className="flex gap-3">
                <div className="text-xl">💡</div>
                <div>
                  <div className="font-medium text-[color:var(--brown-deep)]">{i.title}</div>
                  <div className="text-sm text-[color:var(--brown-mid)]">{i.detail}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Recent */}
      <section className="mt-8">
        <h2 className="font-display text-xl mb-3">Recent content</h2>
        {recent.length === 0 ? (
          <div className="brand-card p-8 text-center text-[color:var(--brown-mid)]">
            <Hedgehog />
            <p className="mt-3">Nothing yet. Open the studio and ship the first piece.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {recent.map((r) => (
              <li key={r.id} className={`p-4 ${r.linea !== "all" ? BRAND_META[r.linea as Exclude<Linea,"all">]?.cardClass : "brand-card brand-card-all"}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{r.title}</div>
                    <div className="text-xs font-mono uppercase text-[color:var(--brown-light)]">
                      {r.linea} · {r.type.replace("_"," ")}
                    </div>
                  </div>
                  <div className="text-xs text-[color:var(--brown-light)]">{new Date(r.created_at).toLocaleDateString()}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, hint, color }: { label: string; value: number | string; hint?: string; color?: string }) {
  return (
    <div className="brand-card p-4" style={color ? { borderTopColor: color, borderTopWidth: 3 } : undefined}>
      <div className="font-mono text-xs uppercase text-[color:var(--brown-light)]">{label}</div>
      <div className="mt-1 font-display text-3xl text-[color:var(--brown-deep)]">{value}</div>
      {hint && <div className="text-xs text-[color:var(--brown-light)] mt-1">{hint}</div>}
    </div>
  );
}

function QuickAction({ icon, to, label }: { icon: React.ReactNode; to: string; label: string }) {
  return (
    <Link
      to={to}
      className="brand-card p-4 hover:shadow-md transition-shadow flex items-center gap-3 text-sm font-medium text-[color:var(--brown-deep)]"
    >
      <span className="p-2 rounded-md bg-[color:var(--brown-deep)] text-[color:var(--cream)]">{icon}</span>
      {label}
    </Link>
  );
}