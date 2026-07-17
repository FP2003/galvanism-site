import { TEXT_LIMITS } from "./game-rules";

/*
 * Theme-song YouTube handling (Case File). No zod — hand-written validation,
 * matching the rest of this codebase's field validators. Accepts only the
 * youtube.com/youtu.be family via an exact hostname allowlist (never
 * endsWith/includes, which would admit youtube.com.evil.net or evil-youtu.be).
 */

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

/** Extracts the 11-char video ID from any accepted YouTube URL form, else null. */
export function extractYouTubeVideoId(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  let candidate: string | null = null;
  if (host === "youtu.be") {
    candidate = url.pathname.split("/")[1] ?? null;
  } else if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    if (url.pathname === "/watch") {
      candidate = url.searchParams.get("v");
    } else if (url.pathname.startsWith("/shorts/") || url.pathname.startsWith("/embed/")) {
      candidate = url.pathname.split("/")[2] ?? null;
    }
  }
  return candidate && VIDEO_ID_RE.test(candidate) ? candidate : null;
}

/** Canonical storage form — strips playlist/tracking params, one format in the DB. */
export function canonicalYouTubeUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export type OEmbedTitleResult =
  | { ok: true; title: string | null }
  | { ok: false }; // definitive: video missing/private/embed-disabled

/**
 * Best-effort title lookup + embeddability check via YouTube's oEmbed
 * endpoint. A definitive 4xx (removed/private/embed-disabled) fails the
 * save; network errors, timeouts, and 5xx never block it — YouTube
 * flakiness must not stop a service-record save.
 */
export async function fetchYouTubeOEmbedTitle(canonicalUrl: string): Promise<OEmbedTitleResult> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalUrl)}&format=json`,
      { signal: AbortSignal.timeout(4000), cache: "no-store" },
    );
    if (res.ok) {
      const data = (await res.json()) as { title?: unknown };
      const title =
        typeof data.title === "string"
          ? data.title.trim().slice(0, TEXT_LIMITS.themeSongTitle) || null
          : null;
      return { ok: true, title };
    }
    if (res.status >= 400 && res.status < 500) return { ok: false };
    return { ok: true, title: null }; // 5xx — YouTube hiccup, don't block the save
  } catch {
    return { ok: true, title: null }; // network/timeout — best-effort
  }
}
