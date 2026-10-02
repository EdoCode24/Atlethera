import type { SVGProps } from "react";

const paths = {
  dashboard: "M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z",
  athletes: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0",
  program: "M4 6h16v14H4zM4 10h16M9 3v4M15 3v4",
  training: "M3 10v4M6 7v10M18 7v10M21 10v4M6 12h12",
  nutrition: "M12 21a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm0-16v8l5.6 5.6",
  progress: "M4 19h16M5 15l4-4 3 3 7-7M15 7h4v4",
  check: "m5 12.5 4.5 4.5L19 7.5",
  timer: "M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm0-8V9m-3-6h6",
  plus: "M12 5v14M5 12h14",
  share: "M12 3v12M7.5 7.5 12 3l4.5 4.5M5 13v7h14v-7",
  play: "M8 5v14l11-7z",
  replay: "M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5",
  arrowDown: "M12 5v14M6 13l6 6 6-6",
  playbook: "M4 4h16v16H4zM8 8l3 3m0-3-3 3M15 16a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM11 13l2-4 3 2",
  video: "M4 6h12v12H4zM16 10l4-2v8l-4-2",
  stats: "M5 20V10M10 20V4M15 20v-7M20 20v-4",
  meeting: "M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 19a5 5 0 0 1 10 0M11 19a5 5 0 0 1 10 0",
  team: "M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM5 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm14 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM6 19a6 6 0 0 1 12 0M2 18a4 4 0 0 1 4-4m16 4a4 4 0 0 0-4-4",
  lock: "M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3",
  pencil: "m4 20 4-1L19 8l-3-3L5 16l-1 4Z",
  copy: "M8 8h11v11H8zM5 16V5h11",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-10v6m0-9.5v.5",
  unlock: "M6 11h12v9H6zM9 11V8a3 3 0 0 1 5.8-1",
  flip: "M12 3v18M8 7l-5 5 5 5M16 7l5 5-5 5",
  sliders: "M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4",
  star: "m12 4 2.4 5 5.4.6-4 3.7 1.1 5.3L12 16l-4.9 2.6 1.1-5.3-4-3.7 5.4-.6Z",
  zigzag: "M3 16l3-8 3 8 3-8 3 8 3-8 3 8",
  dashed: "M3 12h4M10 12h4M17 12h4",
  endArrow: "M12 20V5M7 10l5-5 5 5",
  endBlock: "M12 20V5M7 5h10",
  endDot: "M12 20V9M12 8.5a2.7 2.7 0 1 0 0-5.4 2.7 2.7 0 0 0 0 5.4Z",
  cornerSharp: "M6 20V6h14",
  cornerRound: "M6 20v-8a6 6 0 0 1 6-6h8",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  removeSegment: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM5.6 5.6l12.8 12.8",
  done: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-4-9 3 3 5-6",
  pause: "M9 5v14M15 5v14",
  restart: "M6 5v14M19 5 9 12l10 7Z",
  grip: "M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01",
  field: "M4 5h16v14H4zM4 12h16M8 5v14M16 5v14",
  eye: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  undo: "M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3",
  redo: "m15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12h3",
  template: "M7 21V11h10V3M13 7l4-4 4 4",
  zone: "M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm0-9v2",
  speed: "M12 20a8 8 0 1 1 8-8M12 12l4-4",
  chevronLeft: "M15 5l-7 7 7 7",
  printer: "M7 9V4h10v5M7 17H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M7 14h10v6H7z",
  close: "m6 6 12 12M18 6 6 18",
  minus: "M5 12h14",
  mic: "M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm-6-3a6 6 0 0 0 12 0M12 18v3",
  micOff: "M9 9.5V12a3 3 0 0 0 5 2.2M15 9V6a3 3 0 0 0-5.8-1M6 12a6 6 0 0 0 9.6 4.8M18 12a6 6 0 0 1-.5 2.4M12 18v3M4 4l16 16",
  camera: "M3 7h12v10H3zM15 10.5l6-3.5v10l-6-3.5",
  cameraOff: "M3 7h12v10H3zM15 10.5l6-3.5v10l-6-3.5M4 4l16 16",
  screen: "M3 5h18v11H3zM8 20h8M12 16v4M9 10.5l3-3 3 3M12 7.5v5",
  chat: "M4 5h16v11H9l-5 4z",
  leave: "M3 14.5c5-5 13-5 18 0l-2.4 2.3-3.3-1.4v-2.6a10 10 0 0 0-6.6 0v2.6l-3.3 1.4z",
  flipCamera: "M4 8h3l2-2h6l2 2h3v11H4zM9.2 11.8a3 3 0 0 1 5.3-.8M14.8 14.2a3 3 0 0 1-5.3.8M14.5 9v2h-2M9.5 17v-2h2",
  broadcast: "M12 13.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM8.5 15.5a5 5 0 0 1 0-7M15.5 8.5a5 5 0 0 1 0 7M5.6 18.4a9 9 0 0 1 0-12.8M18.4 5.6a9 9 0 0 1 0 12.8",
} as const;

export type IconName = keyof typeof paths;

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
}

export function Icon({ name, className, ...rest }: IconProps) {
  const filled = name === "play";
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} {...rest}>
      <path
        d={paths[name]}
        fill={filled ? "currentColor" : "none"}
        stroke={filled ? "none" : "currentColor"}
        strokeWidth={name === "grip" || name === "more" ? 3 : 1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
