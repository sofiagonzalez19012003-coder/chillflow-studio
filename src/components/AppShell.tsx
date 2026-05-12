import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Home, Sparkles, Calendar, Mail, Search, BarChart3, Settings, LogOut, BookOpen, Zap } from "lucide-react";
import { toast } from "sonner";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: Home },
  { to: "/studio", label: "Content Studio", icon: Sparkles },
  { to: "/library", label: "Library", icon: BookOpen },
  { to: "/planner", label: "Planner", icon: Calendar },
  { to: "/email", label: "Email", icon: Mail },
  { to: "/competitors", label: "Competitor Intel", icon: Search },
  { to: "/ads", label: "Ads", icon: Zap },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const nav = useNavigate();

  async function signOut() {
    await supabase.auth.signOut();
    toast.success("Signed out");
    nav({ to: "/" });
  }

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside className="w-60 shrink-0 bg-[color:var(--brown-deep)] text-[color:var(--cream)] flex flex-col">
        <div className="px-5 py-6">
          <div className="text-xs font-mono uppercase tracking-widest opacity-60">🦔 Chill Vibe</div>
          <div className="mt-1 font-display text-xl">Command Center</div>
        </div>
        <nav className="px-3 flex-1 space-y-0.5">
          {NAV.map((item) => {
            const active = loc.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  active
                    ? "bg-[color:var(--sidebar-accent)] text-[color:var(--tapes-soft)]"
                    : "text-[color:var(--cream)]/80 hover:bg-[color:var(--sidebar-accent)] hover:text-[color:var(--cream)]"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-[color:var(--sidebar-border)]">
          <button
            onClick={signOut}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-[color:var(--cream)]/70 hover:bg-[color:var(--sidebar-accent)] hover:text-[color:var(--cream)]"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 overflow-auto">
        <div className="mx-auto max-w-6xl px-8 py-8">{children}</div>
      </main>
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, action }: {
  eyebrow?: string; title: string; description?: string; action?: ReactNode;
}) {
  return (
    <header className="mb-8 flex items-start justify-between gap-4">
      <div>
        {eyebrow && (
          <div className="font-mono text-xs uppercase tracking-widest text-[color:var(--brown-light)]">
            {eyebrow}
          </div>
        )}
        <h1 className="mt-1 font-display text-4xl text-[color:var(--brown-deep)]">{title}</h1>
        {description && <p className="mt-2 text-[color:var(--brown-mid)] max-w-2xl">{description}</p>}
      </div>
      {action}
    </header>
  );
}

export function Hedgehog({ size = 64 }: { size?: number }) {
  return <div style={{ fontSize: size }} aria-hidden>🦔</div>;
}