import { OFFICIAL_VENUE_TERMS } from "@/data/policies";

/** The official venue terms (single source: src/data/policies.ts) as a numbered list. */
export default function VenueTermsList({ className = "" }: { className?: string }) {
  return (
    <ol className={`space-y-3 ${className}`}>
      {OFFICIAL_VENUE_TERMS.map((t, i) => (
        <li key={t.title} className="flex gap-3">
          <span className="w-5 shrink-0 font-semibold text-gold" aria-hidden="true">
            {i + 1}.
          </span>
          <div>
            <p className="font-semibold text-ink">{t.title}</p>
            <p className="text-ink-soft">{t.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
