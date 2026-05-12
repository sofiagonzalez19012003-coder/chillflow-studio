export type Linea = "tapes" | "zen" | "play" | "all";

export const BRAND_META: Record<Exclude<Linea, "all">, {
  label: string;
  emoji: string;
  tagline: string;
  audience: string;
  colorVar: string;
  cardClass: string;
  textClass: string;
  bgClass: string;
}> = {
  tapes: {
    label: "Tapes",
    emoji: "📼",
    tagline: "Nostalgia & Urban Chill",
    audience: "Deep workers 25–35, late-night productivity",
    colorVar: "var(--tapes)",
    cardClass: "brand-card brand-card-tapes",
    textClass: "text-[color:var(--tapes)]",
    bgClass: "bg-[color:var(--tapes)]",
  },
  zen: {
    label: "Zen",
    emoji: "🪷",
    tagline: "Mindfulness & Peace",
    audience: "Wellness & meditation 22–35",
    colorVar: "var(--zen)",
    cardClass: "brand-card brand-card-zen",
    textClass: "text-[color:var(--zen)]",
    bgClass: "bg-[color:var(--zen)]",
  },
  play: {
    label: "Play",
    emoji: "🎮",
    tagline: "Focus & Energy",
    audience: "Gamers & tech 18–30",
    colorVar: "var(--play-soft)",
    cardClass: "brand-card brand-card-play",
    textClass: "text-[color:var(--play-soft)]",
    bgClass: "bg-[color:var(--play-soft)]",
  },
};

export function brandClass(l: Linea) {
  if (l === "all") return "brand-card brand-card-all";
  return BRAND_META[l].cardClass;
}

export const TARGET_AUDIENCES = [
  { id: "deep_workers", label: "Deep Workers" },
  { id: "students", label: "Students" },
  { id: "gamers", label: "Gamers" },
  { id: "mindfulness_enthusiasts", label: "Mindfulness Enthusiasts" },
];