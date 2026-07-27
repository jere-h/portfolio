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
  bio: "I ship small fun ideas while working towards a big one.",
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
      "Interactive map of how course and internship choices affect career paths.",
    featured: true,
  },
  {
    repo: "idea-collider",
    title: "Collider",
    description:
      "Swipe through random concept pairings to find project and startup ideas.",
    featured: true,
  },
  {
    repo: "fifteen-percent",
    title: "Fifteen Percent",
    description:
      "On-device tool for preparing a tax-evasion report to Singapore's IRAS, which can pay 15% of recovered tax.",
    featured: true,
  },
  {
    repo: "smarty-challenge",
    title: "Smarty Challenge",
    description:
      "Timed quiz app for math problems and riddles, solo or pass-the-phone.",
    featured: false,
  },
  {
    repo: "skin-concept-arena",
    title: "Skin Concept Arena",
    description:
      "Head-to-head voting on video-game skin concepts, with live community rankings.",
    featured: false,
  },
  {
    repo: "travel-encounters-playbook",
    title: "Travel Encounters Playbook",
    description:
      "Ready-made scripts and phrases for handling difficult situations abroad.",
    featured: false,
  },
  {
    repo: "the-ordeal",
    title: "The Ordeal",
    description:
      "Short interactive story that puts data analysts in workplace dilemmas.",
    featured: false,
  },
  {
    repo: "blunt-boot-2026",
    title: "The Blunt Boot Index",
    description:
      "Ranking of 2026 World Cup players with the most shots and no goals.",
    featured: false,
  },
  {
    repo: "shape-by-shape",
    title: "Shape by Shape",
    description:
      "Pass-and-play drawing game: build a picture one shape at a time, then compare results.",
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
