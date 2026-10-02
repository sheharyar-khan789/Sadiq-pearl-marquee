import type { Metadata } from "next";
import Link from "next/link";
import { AdminError, PageHeader, Panel } from "@/components/admin/AdminUi";
import CommunicationHistory from "@/components/admin/CommunicationHistory";
import { COMM_KINDS, loadCommunications, type CommunicationsQuery } from "@/lib/booking/communications-server";
import { addDays, businessToday, isIsoDate } from "@/lib/booking/dates";
import { NOTIFICATION_TYPE_LABELS, NOTIFICATION_TYPES, WHATSAPP_TEMPLATE_LABELS, WHATSAPP_TEMPLATES } from "@/lib/booking/notifications";

export const metadata: Metadata = { title: "Communications" };

const field =
  "block h-11 w-full rounded-xl border border-line-strong/50 bg-surface px-3 text-sm text-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-gold-container/40";
const label = "mb-1 block text-xs font-semibold text-ink";
const pick = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
const MAX_DAYS = 92;

export default async function AdminCommunicationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const today = businessToday(new Date());
  let from = isIsoDate(pick(params.from)) ? pick(params.from) : addDays(today, -30);
  let to = isIsoDate(pick(params.to)) ? pick(params.to) : today;
  if (to < from) [from, to] = [to, from];
  if (to > addDays(from, MAX_DAYS)) to = addDays(from, MAX_DAYS);
  const kind = (COMM_KINDS as readonly string[]).includes(pick(params.kind)) ? (pick(params.kind) as CommunicationsQuery["kind"]) : "all";
  const type = ([...NOTIFICATION_TYPES, ...WHATSAPP_TEMPLATES] as readonly string[]).includes(pick(params.type)) ? pick(params.type) : "";
  const query: CommunicationsQuery = { from, to, kind, type, q: pick(params.q).trim().slice(0, 80) };
  const result = await loadCommunications(query);

  return (
    <div className="space-y-5">
      <PageHeader title="Communications" subtitle="Customer notifications created by the system and WhatsApp messages opened by staff." />

      <Panel title="Delivery channels">
        <ul className="grid gap-2 text-sm sm:grid-cols-2">
          <li><span className="font-semibold text-ink">In-app notifications:</span> active — created automatically for customers with an online account.</li>
          <li><span className="font-semibold text-ink">WhatsApp (manual):</span> available — staff open a prepared message in WhatsApp. Delivery is not tracked.</li>
          <li><span className="font-semibold text-ink">Automated WhatsApp:</span> not configured (no provider).</li>
          <li><span className="font-semibold text-ink">Email / SMS:</span> not configured (no provider).</li>
        </ul>
      </Panel>

      <form method="get" action="/admin/communications" className="grid grid-cols-2 gap-3 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-3 lg:grid-cols-6">
        <div className="col-span-2 sm:col-span-3 lg:col-span-2">
          <label htmlFor="c-q" className={label}>Search (customer, vendor, booking ref)</label>
          <input id="c-q" name="q" defaultValue={query.q} className={field} />
        </div>
        <div>
          <label htmlFor="c-from" className={label}>From</label>
          <input id="c-from" name="from" type="date" defaultValue={from} className={field} />
        </div>
        <div>
          <label htmlFor="c-to" className={label}>To</label>
          <input id="c-to" name="to" type="date" defaultValue={to} className={field} />
        </div>
        <div>
          <label htmlFor="c-kind" className={label}>Channel</label>
          <select id="c-kind" name="kind" defaultValue={kind} className={field}>
            <option value="all">All</option>
            <option value="notifications">In-app notifications</option>
            <option value="whatsapp">WhatsApp (manual)</option>
          </select>
        </div>
        <div>
          <label htmlFor="c-type" className={label}>Type</label>
          <select id="c-type" name="type" defaultValue={type} className={field}>
            <option value="">Any</option>
            <optgroup label="Notifications">
              {NOTIFICATION_TYPES.map((t) => <option key={t} value={t}>{NOTIFICATION_TYPE_LABELS[t]}</option>)}
            </optgroup>
            <optgroup label="WhatsApp">
              {WHATSAPP_TEMPLATES.map((t) => <option key={t} value={t}>{WHATSAPP_TEMPLATE_LABELS[t]}</option>)}
            </optgroup>
          </select>
        </div>
        <div className="col-span-2 flex items-end gap-2 sm:col-span-3 lg:col-span-6">
          <button type="submit" className="btn btn-primary btn-sm">Apply</button>
          <Link href="/admin/communications" className="btn btn-outline btn-sm">Reset</Link>
        </div>
      </form>

      {!result.ok ? (
        <AdminError reason={result.reason} retryHref="/admin/communications" />
      ) : (
        <section aria-label="Communication records" className="space-y-2">
          <p className="text-sm text-ink-soft" aria-live="polite">
            {result.data.rows.length} record{result.data.rows.length === 1 ? "" : "s"} · {from} to {to}
            {result.data.truncated && " · many records in this range; narrow it to see everything"}
          </p>
          <div className="rounded-2xl border border-line bg-surface px-4">
            <CommunicationHistory rows={result.data.rows} showBooking />
          </div>
        </section>
      )}
    </div>
  );
}
