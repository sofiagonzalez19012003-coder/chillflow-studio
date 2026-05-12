import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Hedgehog } from "@/components/AppShell";
import { BRAND_META, type Linea } from "@/lib/brands";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_app/library")({ component: Library });

type Item = { id: string; title: string; content: string; linea: Linea; type: string; platform: string; funnel_stage: string; status: string; created_at: string };

function Library() {
  const [items, setItems] = useState<Item[]>([]);
  const [q, setQ] = useState("");
  useEffect(() => {
    supabase.from("content_items").select("*").order("created_at", { ascending: false }).then(({ data }) => setItems((data ?? []) as Item[]));
  }, []);
  const filtered = items.filter((i) => !q || (i.title + i.content).toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <PageHeader eyebrow="Library" title="All content" description="Everything you've generated, in one place." />
      <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm mb-6" />
      {filtered.length === 0 ? (
        <div className="brand-card p-10 text-center text-[color:var(--brown-mid)]">
          <Hedgehog />
          <p className="mt-3">No content yet. Head to the studio.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {filtered.map((i) => {
            const cardCls = i.linea !== "all" ? BRAND_META[i.linea as Exclude<Linea,"all">].cardClass : "brand-card brand-card-all";
            return (
              <div key={i.id} className={`${cardCls} p-4`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded bg-secondary">{i.linea}</span>
                  <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded bg-secondary">{i.type.replace("_"," ")}</span>
                  <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded bg-secondary">{i.status}</span>
                </div>
                <div className="font-display text-lg">{i.title}</div>
                <p className="mt-1 text-sm text-[color:var(--brown-mid)] line-clamp-3 whitespace-pre-wrap">{i.content}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}