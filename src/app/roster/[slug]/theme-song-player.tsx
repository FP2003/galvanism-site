"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Pause, Play, RotateCcw, SkipBack, Volume2 } from "lucide-react";

import styles from "./theme-song-player.module.css";

/*
 * Case-file theme song (audio-only). Hidden YouTube IFrame Player driven by
 * the official IFrame API — lazy-loaded only on the first play click, so an
 * idle case file makes zero YouTube network requests. Plays once; ENDED
 * resets to idle. EQ bars are a CSS animation tied to playback state, not
 * real amplitude (a cross-origin iframe's audio can't be analyzed) — their
 * peak scales with the volume slider for a "dynamic volume" feel.
 *
 * Note: YouTube's API ToS expect a visible >=200x200 player; this hides it
 * (off-flow, not display:none, since that halts playback in some browsers).
 * Accepted risk for a small private hobby site with a handful of players.
 */

type PlaybackState = "idle" | "loading" | "playing" | "paused" | "error";

interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setVolume(volume: number): void;
  destroy(): void;
}

interface YTPlayerEvent {
  data: number;
  target: YTPlayer;
}

declare global {
  interface Window {
    YT?: {
      Player: new (
        el: HTMLElement,
        opts: {
          host?: string;
          videoId: string;
          playerVars?: Record<string, number | string>;
          events?: {
            onReady?: (e: YTPlayerEvent) => void;
            onStateChange?: (e: YTPlayerEvent) => void;
            onError?: (e: YTPlayerEvent) => void;
          };
        },
      ) => YTPlayer;
      PlayerState: { ENDED: number; PLAYING: number; PAUSED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<NonNullable<Window["YT"]>> | null = null;

function loadIframeApi(): Promise<NonNullable<Window["YT"]>> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiPromise) {
    apiPromise = new Promise((resolve) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        resolve(window.YT!);
      };
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      document.head.appendChild(script);
    });
  }
  return apiPromise;
}

// Staggered, slightly-detuned durations/delays so the bars feel organic
// rather than mechanically synced.
const BARS = [
  { rest: 0.35, dur: 0.9, delay: 0 },
  { rest: 0.6, dur: 1.15, delay: 0.12 },
  { rest: 0.45, dur: 0.8, delay: 0.24 },
  { rest: 0.75, dur: 1.05, delay: 0.06 },
  { rest: 0.3, dur: 0.95, delay: 0.18 },
];

export function ThemeSongPlayer({
  videoId,
  title,
}: {
  videoId: string;
  title: string | null;
}) {
  const [state, setState] = useState<PlaybackState>("idle");
  const [volume, setVolume] = useState(80);
  const [ready, setReady] = useState(false);
  const mountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const volumeRef = useRef(volume);

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  useEffect(() => {
    return () => {
      playerRef.current?.destroy();
    };
  }, []);

  async function createPlayer() {
    const YT = await loadIframeApi();
    if (!mountRef.current) return;
    playerRef.current = new YT.Player(mountRef.current, {
      host: "https://www.youtube-nocookie.com",
      videoId,
      playerVars: {
        autoplay: 1,
        playsinline: 1,
        controls: 0,
        disablekb: 1,
        origin: window.location.origin,
      },
      events: {
        onReady: (e) => {
          e.target.setVolume(volumeRef.current);
          e.target.playVideo();
          setReady(true);
        },
        onStateChange: (e) => {
          if (e.data === YT.PlayerState.PLAYING) setState("playing");
          else if (e.data === YT.PlayerState.PAUSED) setState("paused");
          else if (e.data === YT.PlayerState.ENDED) setState("idle");
        },
        onError: () => setState("error"),
      },
    });
  }

  async function toggle() {
    if (state === "loading" || state === "error") return;
    if (state === "playing") {
      playerRef.current?.pauseVideo();
      return;
    }
    if (state === "paused") {
      playerRef.current?.playVideo();
      return;
    }
    // idle
    setState("loading");
    try {
      if (playerRef.current) {
        playerRef.current.playVideo();
      } else {
        await createPlayer();
      }
    } catch {
      setState("error");
    }
  }

  function onVolumeChange(next: number) {
    setVolume(next);
    playerRef.current?.setVolume(next);
  }

  function seekToStart() {
    playerRef.current?.seekTo(0, true);
  }

  async function replay() {
    if (state === "loading" || state === "error") return;
    if (playerRef.current && ready) {
      playerRef.current.seekTo(0, true);
      playerRef.current.playVideo();
    } else {
      await toggle();
    }
  }

  const playing = state === "playing";
  const eqPeak = 0.35 + 0.65 * (volume / 100);

  return (
    <div className="relative mt-3 flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className="shrink-0 font-[family-name:var(--font-jetbrains)] text-xs text-muted-ink">
          THEME
        </span>
        {state === "error" ? (
          <span className="font-[family-name:var(--font-jetbrains)] text-xs uppercase text-muted-ink">
            Unavailable
          </span>
        ) : (
          title && (
            <span className="min-w-0 truncate font-[family-name:var(--font-jetbrains)] text-xs text-case-file-white">
              {title}
            </span>
          )
        )}

        <div
          aria-hidden="true"
          className="relative -top-[2px] flex h-4 shrink-0 items-end gap-[3px]"
          style={{ "--eq-peak": eqPeak } as React.CSSProperties}
        >
          {BARS.map((b, i) => (
            <span
              key={i}
              className={`h-full w-[3px] origin-bottom ${
                playing ? "animate-eq-bar bg-signal-cyan" : "bg-signal-cyan/30"
              }`}
              style={{
                transform: `scaleY(${b.rest})`,
                ...(playing && { animationDuration: `${b.dur}s`, animationDelay: `${b.delay}s` }),
              }}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 p-2">
        <button
          type="button"
          onClick={seekToStart}
          disabled={!ready || state === "loading" || state === "error"}
          aria-label="Restart from beginning"
          className="flex h-8 w-8 shrink-0 items-center justify-center border border-signal-cyan/50 text-signal-cyan transition-colors hover:border-signal-cyan hover:bg-signal-cyan/10 disabled:opacity-40 pointer-coarse:h-11 pointer-coarse:w-11"
        >
          <SkipBack size={14} aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={toggle}
          disabled={state === "loading" || state === "error"}
          aria-label={playing ? "Pause theme song" : "Play theme song"}
          className="flex h-8 w-8 shrink-0 items-center justify-center border border-signal-cyan/50 text-signal-cyan transition-colors hover:border-signal-cyan hover:bg-signal-cyan/10 disabled:opacity-60 pointer-coarse:h-11 pointer-coarse:w-11"
        >
          {state === "loading" ? (
            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          ) : playing ? (
            <Pause size={14} aria-hidden="true" />
          ) : (
            <Play size={14} aria-hidden="true" />
          )}
        </button>

        <button
          type="button"
          onClick={replay}
          disabled={state === "loading" || state === "error"}
          aria-label="Replay from start"
          className="flex h-8 w-8 shrink-0 items-center justify-center border border-signal-cyan/50 text-signal-cyan transition-colors hover:border-signal-cyan hover:bg-signal-cyan/10 disabled:opacity-40 pointer-coarse:h-11 pointer-coarse:w-11"
        >
          <RotateCcw size={14} aria-hidden="true" />
        </button>

        <div className="ml-1 flex min-w-36 flex-1 items-center gap-2 text-muted-ink">
          <Volume2 className="size-4 shrink-0" aria-hidden="true" />
          <input
            type="range"
            min={0}
            max={100}
            value={volume}
            onChange={(e) => onVolumeChange(Number(e.target.value))}
            aria-label="Theme song volume"
            aria-valuetext={`${volume}%`}
            className={styles.volumeSlider}
            style={{ "--volume-percent": `${volume}%` } as React.CSSProperties}
          />
          <output
            aria-hidden="true"
            className="w-[4ch] shrink-0 text-right font-[family-name:var(--font-jetbrains)] text-xs tabular-nums text-case-file-white"
          >
            {volume}%
          </output>
        </div>
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 h-px w-px overflow-hidden opacity-0"
      >
        <div ref={mountRef} />
      </div>
    </div>
  );
}
