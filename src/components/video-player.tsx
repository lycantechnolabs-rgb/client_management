"use client";

import { useEffect, useRef, useState } from "react";
import { Download, PlayCircle, VideoOff } from "lucide-react";

/**
 * Plays an estate video.
 *
 * What this replaces: the gallery and the activity pages both drew the video's
 * URL through next/image with a PlayCircle icon on top of it. That was a
 * picture of a play button — nothing played, and next/image cannot decode an
 * mp4 in the first place, so a real uploaded video rendered as a broken tile.
 *
 * There is no ffmpeg in this stack to cut poster frames, so we lean on
 * preload="metadata": the browser fetches just the header and paints the first
 * frame, which costs a range request rather than the whole file. That matters —
 * the growers reading this are on phones, often on mobile data, and a 25 MB
 * autoloading video is a bill they did not agree to. Nothing downloads in full
 * until they press play.
 */
export function VideoPlayer({
  src,
  caption,
  className,
}: {
  src: string;
  caption?: string | null;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const [started, setStarted] = useState(false);

  // preload="metadata" starts fetching while the HTML is still parsing, so a
  // source the browser cannot demux often fails *before* React has hydrated and
  // attached onError — the handler below never runs and the player sits there
  // looking functional. Media events do not bubble, so there is no delegated
  // listener to catch it either. Re-check the element's own error state once on
  // mount to close that window.
  useEffect(() => {
    const el = ref.current;
    if (el?.error) setFailed(true);
  }, []);

  if (failed) {
    // A source the browser cannot decode should say so and still offer the
    // file, rather than sitting there as a dead black rectangle.
    return (
      <div
        className={
          "flex aspect-video flex-col items-center justify-center gap-2 rounded-xl border border-line bg-cream-deep p-4 text-center " +
          (className ?? "")
        }
      >
        <VideoOff className="size-7 text-muted" aria-hidden="true" />
        <p className="text-sm text-body">This video cannot play in the browser.</p>
        <a
          href={src}
          download
          className="inline-flex items-center gap-1.5 text-sm font-medium text-clay hover:text-clay-600"
        >
          <Download className="size-4" aria-hidden="true" />
          Download the file
        </a>
      </div>
    );
  }

  return (
    <figure className={"group relative " + (className ?? "")}>
      <video
        ref={ref}
        src={src}
        controls
        preload="metadata"
        playsInline
        onError={() => setFailed(true)}
        onPlay={() => setStarted(true)}
        className="aspect-video w-full rounded-xl bg-ink object-cover"
      >
        {/* Shown only by browsers with no <video> support at all. */}
        <a href={src}>Download the video</a>
      </video>

      {/* A large tap target over the first frame. The native control is a small
          corner button, and this is used one-handed in a field. It gets out of
          the way for good once playback starts. */}
      {!started ? (
        <button
          type="button"
          onClick={() => void ref.current?.play()}
          aria-label={caption ? `Play: ${caption}` : "Play video"}
          className="absolute inset-0 grid place-items-center rounded-xl transition-colors hover:bg-ink/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss"
        >
          <PlayCircle className="size-14 text-cream drop-shadow-lg transition-transform duration-200 group-hover:scale-105" />
        </button>
      ) : null}

      {caption ? (
        <figcaption className="mt-1.5 text-xs text-muted">{caption}</figcaption>
      ) : null}
    </figure>
  );
}
