"use client";

import { usePreviewTracks } from "@livekit/components-react";
import type { LocalVideoTrack } from "livekit-client";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/components/app/AppContext";
import { Button } from "@/components/app/ui";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";

export interface JoinChoices {
  camera: boolean;
  microphone: boolean;
}

const CHOICES_KEY = "atlethera.v1.live.choices";

function savedChoices(): JoinChoices {
  try {
    const raw = window.localStorage.getItem(CHOICES_KEY);
    if (raw) return { camera: true, microphone: false, ...(JSON.parse(raw) as Partial<JoinChoices>) };
  } catch {
    // Storage blocked: defaults.
  }
  // Microphone off by default: a room of phones on speaker echoes.
  return { camera: true, microphone: false };
}

/** Camera preview and microphone choice before entering the room. */
export function PreJoin({ title, name, busy, onJoin }: { title: string; name: string; busy: boolean; onJoin: (choices: JoinChoices) => void }) {
  const { t } = useApp();
  const l = t.live;
  const [choices, setChoices] = useState(savedChoices);
  const [error, setError] = useState<"camera" | "microphone" | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const tracks = usePreviewTracks({ audio: choices.microphone, video: choices.camera }, (err) => {
    setError(/audio|microphone/i.test(err.message) ? "microphone" : "camera");
  });
  const videoTrack = tracks?.find((track) => track.kind === "video") as LocalVideoTrack | undefined;

  useEffect(() => {
    const el = video.current;
    if (!el || !videoTrack) return;
    videoTrack.attach(el);
    return () => {
      videoTrack.detach(el);
    };
  }, [videoTrack]);

  const toggle = (key: keyof JoinChoices) => {
    setError(null);
    setChoices((c) => ({ ...c, [key]: !c[key] }));
  };

  const join = () => {
    try {
      window.localStorage.setItem(CHOICES_KEY, JSON.stringify(choices));
    } catch {
      // Not remembered this time.
    }
    onJoin(choices);
  };

  return (
    <div className="mx-auto grid w-full max-w-4xl items-center gap-8 px-5 py-10 md:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="relative aspect-video overflow-hidden rounded-[var(--radius-card)] bg-night-850 shadow-[inset_0_0_0_1px_var(--color-hairline)]">
        {choices.camera && videoTrack ? (
          <video ref={video} muted playsInline className="size-full -scale-x-100 object-cover" data-testid="preview" />
        ) : (
          <div className="grid size-full place-items-center">
            <span className="display grid size-20 place-items-center rounded-full bg-chalk/10 text-[2rem]">{name.slice(0, 1).toLocaleUpperCase()}</span>
          </div>
        )}
        <p className="absolute bottom-3 left-3 rounded-md bg-night-950/70 px-2 py-1 text-[0.82rem] font-semibold">{name}</p>
      </div>

      <div>
        <p className="text-[0.9rem] font-semibold text-ice">{l.prejoin.title}</p>
        <h1 className="display mt-2 text-[2rem] leading-none">{title}</h1>
        <div className="mt-6 space-y-2">
          {(["camera", "microphone"] as const).map((key) => {
            const on = choices[key];
            return (
              <button
                key={key}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(key)}
                className={cn(
                  "flex h-12 w-full items-center gap-3 rounded-[0.8rem] px-4 text-left font-semibold transition-colors",
                  on ? "bg-chalk/10 text-chalk" : "bg-night-850 text-chalk-dim shadow-[inset_0_0_0_1px_var(--color-hairline)]",
                )}
              >
                <Icon name={key === "camera" ? (on ? "camera" : "cameraOff") : on ? "mic" : "micOff"} className="size-5" />
                <span className="flex-1">{key === "camera" ? l.prejoin.camera : l.prejoin.microphone}</span>
                <span className={cn("text-[0.85rem]", on ? "text-volt" : "text-mist")}>{on ? l.prejoin.on : l.prejoin.off}</span>
              </button>
            );
          })}
        </div>
        {error && (
          <p className="mt-3 text-[0.85rem] text-amber" role="alert">
            {error === "camera" ? l.prejoin.cameraBlocked : l.prejoin.micBlocked}
          </p>
        )}
        <Button className="mt-6 w-full" onClick={join} disabled={busy}>
          {busy ? l.prejoin.connecting : l.prejoin.join}
        </Button>
      </div>
    </div>
  );
}
