import type { Metadata } from "next";
import Link from "next/link";
import { AdminError, PageHeader, Panel } from "@/components/admin/AdminUi";
import EntityManager from "@/components/admin/settings/EntityManager";
import VenueTermsList from "@/components/VenueTerms";
import { HallForm, PoliciesForm, PricingForm, RulesForm, SlotForm } from "@/components/admin/settings/SettingsForms";
import { loadSettings } from "@/lib/booking/admin-server";
import { formatTimestamp } from "@/lib/booking/format";
import { BUSINESS_TIME_ZONE } from "@/lib/config/business-config";
import { business } from "@/lib/config";

export const metadata: Metadata = { title: "Settings" };

const SECTIONS = [
  ["venue", "Venue"],
  ["hall", "Hall"],
  ["slots", "Slots"],
  ["rules", "Booking rules"],
  ["event-types", "Event types"],
  ["services", "Services"],
  ["menus", "Menus"],
  ["packages", "Packages"],
  ["pricing", "Pricing"],
  ["policies", "Policies"],
  ["history", "Change history"],
] as const;
type SectionId = (typeof SECTIONS)[number][0];

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const section: SectionId = SECTIONS.some(([id]) => id === params.section) ? (params.section as SectionId) : "venue";
  const result = await loadSettings();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Settings"
        subtitle="Business configuration used by the booking engine, the booking page and staff bookings. Changes never rewrite existing bookings."
      />
      <nav aria-label="Settings sections">
        <ul className="flex flex-wrap gap-2">
          {SECTIONS.map(([id, label]) => (
            <li key={id}>
              <Link
                href={`/admin/settings?section=${id}`}
                aria-current={id === section ? "page" : undefined}
                className={`inline-flex min-h-[44px] items-center rounded-full border px-4 text-sm font-semibold ${
                  id === section ? "border-espresso bg-espresso text-surface" : "border-line-strong/50 bg-surface text-ink-soft hover:text-ink"
                }`}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {!result.ok ? (
        <AdminError reason={result.reason} retryHref={`/admin/settings?section=${section}`} />
      ) : (
        (() => {
          const { config, stored, audit } = result.data;
          return (
            <>
              <p className="text-xs text-ink-muted">
                Configuration version {config.version}
                {stored && config.updatedAt ? ` · last saved ${formatTimestamp(new Date(config.updatedAt).toISOString())}` : " · built-in defaults (nothing saved yet)"}
              </p>
              {section === "venue" && (
                <Panel title="Venue">
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <div><dt className="text-ink-muted">Business name</dt><dd className="font-semibold">{business.name}</dd></div>
                    <div><dt className="text-ink-muted">Time zone</dt><dd className="font-semibold">{BUSINESS_TIME_ZONE}</dd></div>
                    <div><dt className="text-ink-muted">Address</dt><dd className="font-semibold">{business.fullAddress}</dd></div>
                    <div><dt className="text-ink-muted">Phones</dt><dd className="font-semibold">{business.phones.map((p) => p.display).join(" · ")}</dd></div>
                  </dl>
                  <p className="mt-3 text-xs text-ink-muted">
                    These verified details come from the website&rsquo;s business configuration (src/lib/config.ts) and are shown read-only here so
                    they can&rsquo;t be overwritten by mistake. The time zone drives &ldquo;today&rdquo; for every booking rule.
                  </p>
                </Panel>
              )}
              {section === "hall" && (
                <Panel title="Hall">
                  {config.halls.map((h) => (
                    <HallForm key={h.id} hall={h} />
                  ))}
                </Panel>
              )}
              {section === "slots" && (
                <Panel title="Day / Night slots">
                  <div className="space-y-3">
                    {[...config.slots].sort((a, b) => a.sortOrder - b.sortOrder).map((s) => (
                      <SlotForm key={s.id} slot={s} />
                    ))}
                  </div>
                </Panel>
              )}
              {section === "rules" && (
                <Panel title="Booking rules">
                  <RulesForm rules={config.rules} />
                </Panel>
              )}
              {section === "event-types" && (
                <Panel title="Event types">
                  <EntityManager section="eventTypes" items={config.eventTypes} />
                </Panel>
              )}
              {section === "services" && (
                <Panel title="Services & add-ons">
                  <EntityManager section="services" items={config.services} />
                </Panel>
              )}
              {section === "menus" && (
                <Panel title="Menus">
                  <EntityManager section="menus" items={config.menus} />
                </Panel>
              )}
              {section === "packages" && (
                <Panel title="Packages">
                  <EntityManager section="packages" items={config.packages} services={config.services} menus={config.menus} />
                </Panel>
              )}
              {section === "pricing" && (
                <Panel title="Pricing & advance">
                  <PricingForm pricing={config.pricing} halls={config.halls} />
                </Panel>
              )}
              {section === "policies" && (
                <>
                  <Panel title="Official venue terms">
                    <p className="mb-4 text-sm text-ink-soft">
                      From the venue&rsquo;s printed policy card. Shown on the public booking terms, in the booking review, on
                      customers&rsquo; booking pages and in every new quotation. The guest surcharge and the 5% service charge are
                      applied from Pricing; the other terms are shown as written. To change a term, update the card text in the
                      code (src/data/policies.ts).
                    </p>
                    <VenueTermsList className="text-sm" />
                  </Panel>
                  <Panel title="Policies">
                    <PoliciesForm policies={config.policies} />
                  </Panel>
                </>
              )}
              {section === "history" && (
                <Panel title="Configuration change history">
                  {audit.length === 0 ? (
                    <p className="text-sm text-ink-muted">No configuration changes yet.</p>
                  ) : (
                    <ul className="divide-y divide-line text-sm">
                      {audit.map((a) => (
                        <li key={a.auditId} className="py-2">
                          <span className="font-semibold">{a.label}</span> · <span className="font-mono">{a.entityId}</span> ·{" "}
                          {formatTimestamp(new Date(a.at).toISOString())} · {a.actor.email ?? a.actor.uid}
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              )}
            </>
          );
        })()
      )}
    </div>
  );
}
