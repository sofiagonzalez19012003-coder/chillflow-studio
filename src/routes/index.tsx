import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-6 pt-24 pb-16">
        <p className="font-mono text-xs uppercase tracking-widest text-[color:var(--brown-light)]">
          🦔 Chill Vibe · Kapital Music · Medellín
        </p>
        <h1 className="mt-4 text-5xl md:text-7xl font-display font-bold leading-[1.05] text-[color:var(--brown-deep)]">
          The marketing command center
          <br />
          <span className="italic text-[color:var(--tapes)]">for nocturnal creators.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-[color:var(--brown-mid)]">
          One AI workspace for Tapes 📼, Zen 🪷 and Play 🎮. Generate reels, run weekly batches,
          analyze competitors with LATAM-aware intel, and ship campaigns that actually feel like Chill Vibe.
        </p>
        <div className="mt-10 flex gap-3">
          <Button asChild size="lg" className="bg-[color:var(--brown-deep)] text-[color:var(--cream)] hover:bg-[color:var(--brown-mid)]">
            <Link to="/login">Enter the studio</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="border-[color:var(--brown-deep)]/30">
            <Link to="/login">Sign up</Link>
          </Button>
        </div>

        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { e: "📼", t: "Tapes", d: "Nocturnal urban chill", c: "var(--tapes)" },
            { e: "🪷", t: "Zen",   d: "Mindfulness & peace",   c: "var(--zen)" },
            { e: "🎮", t: "Play",  d: "Focus & gaming energy", c: "var(--play-soft)" },
          ].map((b) => (
            <div key={b.t} className="brand-card p-6" style={{ borderTopColor: b.c, borderTopWidth: 3 }}>
              <div className="text-3xl">{b.e}</div>
              <h3 className="mt-3 font-display text-2xl">{b.t}</h3>
              <p className="mt-1 text-sm text-[color:var(--brown-light)]">{b.d}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
