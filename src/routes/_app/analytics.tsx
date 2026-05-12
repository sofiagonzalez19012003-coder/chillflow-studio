import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";

export const Route = createFileRoute("/_app/analytics")({ component: Analytics });

function Analytics() {
  const stats = [
    { l: "Posts published", v: "22" },
    { l: "Followers", v: "15" },
    { l: "Profile views (90d)", v: "4,739" },
    { l: "Interactions", v: "342" },
    { l: "Accounts reached", v: "2,144" },
    { l: "Profile visits", v: "115" },
  ];
  return (
    <div>
      <PageHeader eyebrow="Analytics" title="@chillvibeglobal" description="Real account snapshot. Live Instagram API integration coming next." />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.l} className="brand-card p-4">
            <div className="font-mono text-xs uppercase text-[color:var(--brown-light)]">{s.l}</div>
            <div className="mt-1 font-display text-3xl">{s.v}</div>
          </div>
        ))}
      </div>
      <div className="mt-8 brand-card brand-card-tapes p-6">
        <div className="font-mono text-xs uppercase text-[color:var(--brown-light)]">Audience split</div>
        <p className="mt-2">59.8% from followers · 40.2% from non-followers — strong organic reach signal. Lean into TOFU.</p>
      </div>
    </div>
  );
}