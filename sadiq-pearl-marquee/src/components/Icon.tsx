// Small inline icon set (24×24, stroke-based). Keeps the site free of an
// external icon font.
const paths = {
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z",
  chat: "M4 5h16v11H9l-5 4V5z",
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6L6 18",
  arrow: "M5 12h14M13 6l6 6-6 6",
  down: "M12 5v14M6 13l6 6 6-6",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v5M16 3v5",
  pin: "M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  parking: "M6 4h7a4.5 4.5 0 0 1 0 9H9v7M6 4v16",
  dining: "M7 3v8a2 2 0 0 0 2 2v8M5 3v6M9 3v6M17 21V3c-2.5 1-4 4-4 8h4",
  groups: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M17 11a2.5 2.5 0 1 0 0-5M17 14a5 5 0 0 1 4 6",
  light: "M12 3v2M4.6 6.6l1.4 1.4M3 14h2M19 14h2M18 8l1.4-1.4M7 18a5 5 0 1 1 10 0M4 21h16",
  play: "M8 5v14l11-7z",
  pause: "M8 5v14M16 5v14",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5a7.5 7.5 0 0 1 15 0",
  eye: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  eyeOff: "M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2",
  alert: "M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  prev: "M15 5l-7 7 7 7",
  next: "M9 5l7 7-7 7",
  download: "M12 4v11M7 11l5 5 5-5M5 20h14",
  check: "M5 12.5l4.5 4.5L19 7",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  bell: "M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0",
  mail: "M4 6h16v12H4zM4 7l8 6 8-6",
  video: "M4 6h11v12H4zM15 10l5-3v10l-5-3",
  doc: "M7 3h7l4 4v14H7zM14 3v5h4M10 13h5M10 17h5",
  external: "M14 4h6v6M20 4l-9 9M18 14v6H4V6h6",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  expand: "M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7",
} as const;

export type IconName = keyof typeof paths;

export default function Icon({
  name,
  className = "w-5 h-5",
  fill = false,
}: {
  name: IconName;
  className?: string;
  fill?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={fill || name === "play" ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}

/** Five stars; `value` (0–5) fills them proportionally, e.g. 4.4. */
export function Stars({ value, className = "w-4 h-4" }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(5, value)) * 20;
  const row = (
    <span className="flex gap-0.5 w-max">
      {[0, 1, 2, 3, 4].map((i) => (
        <Icon key={i} name="star" className={className} fill />
      ))}
    </span>
  );
  return (
    <span className="relative inline-block" role="img" aria-label={`${value} out of 5 stars`}>
      {/* Unfilled stars: faded gold, visible on light and dark backgrounds alike. */}
      <span className="text-gold-container opacity-30">{row}</span>
      <span className="absolute inset-0 overflow-hidden text-gold-container" style={{ width: `${pct}%` }}>
        {row}
      </span>
    </span>
  );
}

export function WhatsAppGlyph({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.44.79 3.06 1.2 4.71 1.2h.01c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm0 18.15h-.01c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 01-1.26-4.38c0-4.54 3.7-8.24 8.26-8.24 2.21 0 4.28.86 5.84 2.42a8.2 8.2 0 012.42 5.83c0 4.55-3.7 8.24-8.26 8.24zm4.52-6.18c-.25-.12-1.47-.72-1.69-.81-.23-.08-.4-.12-.56.13-.17.25-.65.81-.79.97-.15.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.38-1.72-.15-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.15.16-.25.25-.42.08-.16.04-.31-.02-.43-.06-.12-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.43-.14-.01-.31-.01-.48-.01-.16 0-.43.06-.66.31-.23.25-.86.84-.86 2.06 0 1.21.88 2.38 1.01 2.54.12.17 1.74 2.66 4.22 3.73.59.25 1.05.4 1.41.52.59.19 1.13.16 1.55.1.47-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.11-.23-.17-.48-.29z" />
    </svg>
  );
}

export function TikTokGlyph({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.29 0 .58.04.86.11V9.4a6.33 6.33 0 0 0-.86-.06A6.34 6.34 0 0 0 3.1 15.68a6.34 6.34 0 0 0 10.82 4.48c1.77-1.74 2.36-4.28 2.36-6.68v-4.1a8.16 8.16 0 0 0 4.68 1.48V7.4a4.85 4.85 0 0 1-1.37-.71z" />
    </svg>
  );
}
