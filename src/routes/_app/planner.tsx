import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader, Hedgehog } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { generateWeek } from "@/lib/content.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/planner")({ component: Planner });

type Item = { day: number; linea: string; type: string; platform: string; funnel_stage: string; title: string; content: string };

function Planner() {
  const gen = useServerFn(generateWeek);
  const [theme, setTheme] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    try {
      const res = await gen({ data: { theme, lineas: ["tapes","zen","play"] } });
      const j = JSON.parse(res.itemsJson);
      setItems(Array.isArray(j.items) ? j.items : []);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <PageHeader eyebrow="Planner" title="Generate week" description="7 days of balanced Tapes / Zen / Play content following the Chill Vibe batching strategy." />
      <div className="brand-card brand-card-tapes p-6 flex gap-3 items-end">
        <div className="flex-1">
          <Input placeholder="Optional theme (e.g. nocturnal productivity)" value={theme} onChange={(e) => setTheme(e.target.value)} />
        </div>
        <Button onClick={go} disabled={busy} className="bg-[color:var(--brown-deep)] text-[color:var(--cream)] hover:bg-[color:var(--brown-mid)]">
          {busy ? "🦔 generating…" : "Generate week"}
        </Button>
      </div>
      {items.length === 0 ? (
        <div className="mt-8 brand-card p-10 text-center text-[color:var(--brown-mid)]">
          <Hedgehog /><p className="mt-3">No plan yet. Generate one above.</p>
        </div>
      ) : (
        <div className="mt-8 grid md:grid-cols-2 gap-3">
          {items.map((it, k) => (
            <div key={k} className="brand-card brand-card-all p-4">
              <div className="flex items-center gap-2 mb-2 text-[10px] font-mono uppercase">
                <span className="px-2 py-0.5 rounded bg-secondary">Day {it.day}</span>
                <span className="px-2 py-0.5 rounded bg-secondary">{it.linea}</span>
                <span className="px-2 py-0.5 rounded bg-secondary">{it.type}</span>
              </div>
              <div className="font-display">{it.title}</div>
              <p className="text-sm text-[color:var(--brown-mid)] mt-1 whitespace-pre-wrap">{it.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}