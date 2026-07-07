/** Small pure helpers used at build time by the cards. */

/**
 * GitHub Linguist colors for the languages these projects are likely to use.
 * Unknown languages fall back to the muted token (a neutral dot).
 */
const LANG_COLORS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Astro: "#ff5a03",
  HTML: "#e34c26",
  CSS: "#563d7c",
  SCSS: "#c6538c",
  Vue: "#41b883",
  Svelte: "#ff3e00",
  Python: "#3572a5",
  "Jupyter Notebook": "#da5b0b",
  Go: "#00add8",
  Rust: "#dea584",
  Ruby: "#701516",
  Java: "#b07219",
  Shell: "#89e051",
  Dart: "#00b4ab",
  Kotlin: "#a97bff",
  Swift: "#f05138",
  "C++": "#f34b7d",
  C: "#555555",
  "C#": "#178600",
  PHP: "#4f5d95",
  Lua: "#000080",
  MDX: "#fcb32c",
};

export function langColor(lang: string | null): string {
  if (!lang) return "var(--muted)";
  return LANG_COLORS[lang] ?? "var(--muted)";
}

/** Compact count for stars/forks: 1234 -> "1.2k". */
export function formatCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "0";
  if (n < 1000) return String(n);
  const k = n / 1000;
  return `${k >= 10 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, "")}k`;
}

/**
 * Relative "last updated" string, computed once at build time.
 * Returns null when there is no date to show (so the row can be omitted).
 */
export function relativeDate(iso: string | null): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;

  const diffDays = Math.floor((Date.now() - then) / 86_400_000);
  if (diffDays <= 0) return "updated today";
  if (diffDays === 1) return "updated yesterday";
  if (diffDays < 7) return `updated ${diffDays} days ago`;
  if (diffDays < 30) {
    const w = Math.round(diffDays / 7);
    return `updated ${w} week${w === 1 ? "" : "s"} ago`;
  }
  if (diffDays < 365) {
    const m = Math.round(diffDays / 30);
    return `updated ${m} month${m === 1 ? "" : "s"} ago`;
  }
  const y = Math.round(diffDays / 365);
  return `updated ${y} year${y === 1 ? "" : "s"} ago`;
}
