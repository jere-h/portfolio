/**
 * Single source of truth for the portfolio's content.
 *
 * Editing later:
 *  - Add / remove / reorder a project by editing the `projects` array below.
 *    Order here IS the render order. Set `featured: true` for the large cards.
 *  - `title` and `description` here ALWAYS win over whatever GitHub returns.
 *    The live numbers (stars, forks, language, last-updated) come from the
 *    build-time fetch in src/lib/github.ts (cached to src/data/repos.json).
 */

export interface ProjectConfig {
  /** GitHub repo name under the owner below (github.com/<owner>/<repo>). */
  repo: string;
  /** Display title - overrides the GitHub repo name. */
  title: string;
  /** Display description - overrides the GitHub description. */
  description: string;
  /** Larger card, rendered in the Featured row when true. */
  featured: boolean;
  /**
   * Optional thumbnail override (a path under public/, or an absolute URL).
   * When omitted, the card uses public/thumbnails/<repo>.png. Regenerate the
   * default screenshots with `node scripts/screenshots.mjs`.
   */
  thumbnail?: string;
}

export interface SocialLinks {
  github: string;
  email: string;
}

export interface ProfileConfig {
  name: string;
  tagline: string;
  bio: string;
  location: string;
  avatarUrl: string;
  email: string;
  socials: SocialLinks;
}

/** GitHub owner for repos + demo URLs. */
export const owner = "jere-h";

export const profile: ProfileConfig = {
  name: "Jeremy H.",
  tagline: "Product & Analytics",
  bio: "I ship small ideas while hoping for a big one.",
  location: "Singapore",
  avatarUrl: "https://github.com/jere-h.png",
  email: "jeremyhyf@gmail.com",
  socials: {
    github: "https://github.com/jere-h",
    email: "jeremyhyf@gmail.com",
  },
};

/** Ordered - this is the display order for both featured and grid sections. */
export const projects: ProjectConfig[] = [
  {
    repo: "undergrad-paths-map",
    title: "Open Doors",
    description:
      "An interactive map that shows students how each course and internship choice opens or closes their future career paths.",
    featured: true,
  },
  {
    repo: "idea-collider",
    title: "Collider",
    description:
      "A swipe-to-discover app that smashes concepts together so you can flick through fresh project and startup ideas one card at a time.",
    featured: true,
  },
  {
    repo: "fifteen-percent",
    title: "Fifteen Percent",
    description:
      "A private, on-device tool that walks you through preparing a tax-evasion tip-off to Singapore's IRAS, which can pay a discretionary 15% of the tax it recovers.",
    featured: true,
  },
  {
    repo: "smarty-challenge",
    title: "Smarty Challenge",
    description:
      "A timed mobile quiz app for math problems and riddles, playable solo or pass-the-phone with friends on identical question sets.",
    featured: false,
  },
  {
    repo: "skin-concept-arena",
    title: "Skin Concept Arena",
    description:
      "A community arena where players rank video-game cosmetic skins in head-to-head matchups, giving designers a live read on which concepts fans actually want.",
    featured: false,
  },
  {
    repo: "travel-encounters-playbook",
    title: "Travel Encounters Playbook",
    description:
      "A pocket playbook of ready-made scripts and rescue phrases that help travelers handle tricky situations abroad with confidence.",
    featured: false,
  },
  {
    repo: "the-ordeal",
    title: "The Ordeal",
    description:
      "A short interactive story game that drops early-career data analysts into no-win workplace dilemmas to reveal what they truly value under pressure.",
    featured: false,
  },
  {
    repo: "blunt-boot-2026",
    title: "The Blunt Boot Index",
    description:
      "A tongue-in-cheek statistical bulletin ranking the 2026 FIFA World Cup's most goalless shooters by how many shots they fired without ever scoring.",
    featured: false,
  },
];

/** Live demo URL convention: each repo publishes its own project Pages site. */
export function demoUrl(repo: string): string {
  return `https://${owner}.github.io/${repo}/`;
}

/** Canonical GitHub URL for a repo. */
export function repoUrl(repo: string): string {
  return `https://github.com/${owner}/${repo}`;
}

/**
 * Resolve a project's card thumbnail to a base-aware URL. Uses the project's
 * `thumbnail` override when set, otherwise the committed screenshot at
 * public/thumbnails/<repo>.png. Absolute URLs (http...) pass through unchanged.
 */
export function thumbUrl(project: ProjectConfig, baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, "");
  const rel = project.thumbnail ?? `thumbnails/${project.repo}.png`;
  if (/^https?:\/\//.test(rel)) return rel;
  return `${base}/${rel.replace(/^\//, "")}`;
}
