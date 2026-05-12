import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader, Hedgehog } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { generateEmailSequence } from "@/lib/content.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/email")({ component: EmailPage });

type EmailItem = { position: number; subject: string; body: string; cta: string };

function EmailPage() {
  const gen = useServerFn(generateEmailSequence);
  const [goal, setGoal] = useState("Weekly Vibras Semanales newsletter");
  const [linea, setLinea] = useState<"tapes"|"zen"|"play">("tapes");
  const [count, setCount] = useState(3);
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    try {
      const res = await gen({ data: { goal, linea, count } });
      const j = JSON.parse(res.emailsJson);
      setEmails(Array.isArray(j.emails) ? j.emails : []);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <PageHeader eyebrow="Email" title="Campaign builder" description="AI-generated email sequences in the Chill Vibe voice — Spanish by default." />
      <div className="brand-card brand-card-zen p-6 grid md:grid-cols-[2fr_1fr_1fr_auto] gap-3 items-end">
        <div><Label>Goal</Label><Input value={goal} onChange={(e) => setGoal(e.target.value)} /></div>
        <div><Label>Sub-brand</Label>
          <Select value={linea} onValueChange={(v) => setLinea(v as typeof linea)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="tapes">📼 Tapes</SelectItem>
              <SelectItem value="zen">🪷 Zen</SelectItem>
              <SelectItem value="play">🎮 Play</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label># Emails</Label><Input type="number" min={1} max={5} value={count} onChange={(e) => setCount(Number(e.target.value))} /></div>
        <Button onClick={go} disabled={busy} className="bg-[color:var(--brown-deep)] text-[color:var(--cream)] hover:bg-[color:var(--brown-mid)]">
          {busy ? "🦔…" : "Generate"}
        </Button>
      </div>
      {emails.length === 0 ? (
        <div className="mt-8 brand-card p-10 text-center text-[color:var(--brown-mid)]">
          <Hedgehog /><p className="mt-3">Generate a sequence to see it here.</p>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {emails.map((e, k) => (
            <div key={k} className="brand-card brand-card-zen p-5">
              <div className="font-mono text-[10px] uppercase text-[color:var(--brown-light)]">Email {e.position}</div>
              <div className="font-display text-lg mt-1">{e.subject}</div>
              <p className="mt-2 text-sm whitespace-pre-wrap">{e.body}</p>
              <Button size="sm" className="mt-3 bg-[color:var(--brown-deep)] text-[color:var(--cream)] hover:bg-[color:var(--brown-mid)]">{e.cta}</Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}