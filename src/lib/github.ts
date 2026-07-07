/**
 * Build-time GitHub metadata fetch with a committed JSON cache fallback.
 *
 * Runs inside `astro build` (Node). For each repo in config it hits the public
 * REST API; on any failure (offline, rate-limit, non-200) it keeps the cached
 * value from src/data/repos.json instead. When at least one repo is fetched
 * fresh, the cache file is rewritten so the newest numbers get committed.
 *
 * Set GITHUB_TOKEN in the environment to raise the rate limit. Never hardcode
 * a token here.
 */
import fs from "node:fs";
import path from "node:path";
import { projects } from "../config";

export interface RepoMeta {
  repo: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  topics: string[];
  homepage: string | null;
  updatedAt: string | null;
}

// Anchored at the project root (where `astro build` runs), not at import.meta.url
// - the build bundles this module, so a URL relative to it would not resolve to
// the source tree. `astro build` is always invoked from the repo root.
const CACHE_PATH = path.join(process.cwd(), "src", "data", "repos.json");

function readCache(): Record<string, RepoMeta> {
  try {
    const raw = fs.readFileSync(CACHE_PATH, "utf8");
    const arr = JSON.parse(raw) as RepoMeta[];
    return Object.fromEntries(arr.map((r) => [r.repo, r]));
  } catch {
    return {};
  }
}

function writeCache(byRepo: Record<string, RepoMeta>): void {
  // Preserve config order in the committed cache.
  const ordered = projects
    .map((p) => byRepo[p.repo])
    .filter((r): r is RepoMeta => Boolean(r));
  try {
    fs.writeFileSync(CACHE_PATH, JSON.stringify(ordered, null, 2) + "\n");
  } catch (err) {
    console.warn(`[github] could not update cache: ${(err as Error).message}`);
  }
}

async function fetchOne(repo: string, token?: string): Promise<RepoMeta> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "jere-h-portfolio-build",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`https://api.github.com/repos/jere-h/${repo}`, {
    headers,
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }
  const j = (await res.json()) as Record<string, unknown>;
  return {
    repo,
    description: (j.description as string | null) ?? null,
    language: (j.language as string | null) ?? null,
    stars: Number(j.stargazers_count ?? 0),
    forks: Number(j.forks_count ?? 0),
    topics: Array.isArray(j.topics) ? (j.topics as string[]) : [],
    homepage: (j.homepage as string | null) || null,
    updatedAt: (j.pushed_at as string | null) ?? (j.updated_at as string | null) ?? null,
  };
}

/**
 * Returns metadata for every repo in config, keyed by repo name. Fresh from
 * the API where reachable, cached where not.
 */
export async function getRepoMeta(): Promise<Record<string, RepoMeta>> {
  const token = process.env.GITHUB_TOKEN?.trim() || undefined;
  const cache = readCache();
  const result: Record<string, RepoMeta> = { ...cache };
  let anyFresh = false;

  await Promise.all(
    projects.map(async (p) => {
      try {
        result[p.repo] = await fetchOne(p.repo, token);
        anyFresh = true;
      } catch (err) {
        const note = cache[p.repo] ? "using cached value" : "no cache available";
        console.warn(
          `[github] ${p.repo}: ${(err as Error).message}, ${note}`,
        );
        // Guarantee an entry even with no cache, so the UI stays honest (zeros).
        if (!result[p.repo]) {
          result[p.repo] = {
            repo: p.repo,
            description: null,
            language: null,
            stars: 0,
            forks: 0,
            topics: [],
            homepage: null,
            updatedAt: null,
          };
        }
      }
    }),
  );

  if (anyFresh) writeCache(result);
  return result;
}
