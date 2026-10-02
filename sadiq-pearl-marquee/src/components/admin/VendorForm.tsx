"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { VENDOR_CATEGORIES, VENDOR_CATEGORY_LABELS, type VendorCategory } from "@/lib/booking/operations-model";
import { NoticeLine, useAdminAction } from "./BookingActions";
import ConfirmDialog from "./ConfirmDialog";

const field =
  "block h-11 w-full rounded-xl border border-line-strong/50 bg-surface px-3 text-sm text-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-gold-container/40";
const label = "mb-1 block text-xs font-semibold text-ink";

function newKey() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
}

export interface VendorFields {
  name: string;
  category: VendorCategory | "";
  phone: string;
  whatsapp: string;
  email: string;
  notes: string;
}
const EMPTY: VendorFields = { name: "", category: "", phone: "", whatsapp: "", email: "", notes: "" };

/** Create (no vendorId) or edit a vendor. All values are entered by the admin; nothing is pre-filled. */
export default function VendorForm({ vendorId, initial, updatedAt }: { vendorId?: string; initial?: VendorFields; updatedAt?: string }) {
  const uid = useId();
  const router = useRouter();
  const { busy, notice, send } = useAdminAction();
  const [f, setF] = useState<VendorFields>(initial ?? EMPTY);
  const [key, setKey] = useState(newKey);
  const set = (k: keyof VendorFields) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const editing = !!vendorId;

  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const body = editing ? { action: "update", ...f, expectedUpdatedAt: updatedAt } : { ...f, requestKey: key };
        const ok = await send(editing ? `/api/admin/vendors/${vendorId}` : "/api/admin/vendors", body, editing ? "Vendor saved." : `Vendor “${f.name.trim()}” added.`);
        if (ok && !editing) {
          setF(EMPTY);
          setKey(newKey());
          router.refresh();
        }
      }}
    >
      <div className="sm:col-span-2"><NoticeLine notice={notice} /></div>
      <div>
        <label htmlFor={`${uid}-name`} className={label}>Name *</label>
        <input id={`${uid}-name`} required minLength={2} maxLength={100} value={f.name} onChange={set("name")} className={field} />
      </div>
      <div>
        <label htmlFor={`${uid}-cat`} className={label}>Category *</label>
        <select id={`${uid}-cat`} required value={f.category} onChange={set("category")} className={field}>
          <option value="">Choose…</option>
          {VENDOR_CATEGORIES.map((c) => <option key={c} value={c}>{VENDOR_CATEGORY_LABELS[c]}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor={`${uid}-phone`} className={label}>Phone *</label>
        <input id={`${uid}-phone`} type="tel" required maxLength={20} value={f.phone} onChange={set("phone")} className={field} />
      </div>
      <div>
        <label htmlFor={`${uid}-wa`} className={label}>WhatsApp (optional)</label>
        <input id={`${uid}-wa`} type="tel" maxLength={20} value={f.whatsapp} onChange={set("whatsapp")} className={field} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={`${uid}-email`} className={label}>Email (optional)</label>
        <input id={`${uid}-email`} type="email" maxLength={254} value={f.email} onChange={set("email")} className={field} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={`${uid}-notes`} className={label}>Notes (optional, internal)</label>
        <textarea id={`${uid}-notes`} rows={3} maxLength={1000} value={f.notes} onChange={set("notes")} className="block w-full rounded-xl border border-line-strong/50 bg-surface px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-gold-container/40" />
      </div>
      <div className="sm:col-span-2">
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>{busy ? "Saving…" : editing ? "Save vendor" : "Add vendor"}</button>
      </div>
    </form>
  );
}

export function VendorActiveToggle({ vendorId, active, updatedAt, name }: { vendorId: string; active: boolean; updatedAt: string; name: string }) {
  const { busy, notice, send } = useAdminAction();
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-2">
      <NoticeLine notice={notice} />
      <button type="button" className={`btn btn-sm ${active ? "border border-red-300 text-red-800 hover:bg-red-50" : "btn-outline"}`} disabled={busy} onClick={() => setOpen(true)}>
        {active ? "Deactivate vendor" : "Reactivate vendor"}
      </button>
      <ConfirmDialog
        open={open}
        title={active ? `Deactivate ${name}?` : `Reactivate ${name}?`}
        confirmLabel={active ? "Deactivate" : "Reactivate"}
        danger={active}
        busy={busy}
        onClose={() => setOpen(false)}
        onConfirm={async () => {
          await send(`/api/admin/vendors/${vendorId}`, { action: active ? "deactivate" : "activate", expectedUpdatedAt: updatedAt }, active ? "Vendor deactivated." : "Vendor reactivated.");
          setOpen(false);
        }}
      >
        <p>{active ? "The vendor can no longer be assigned to new events. Existing assignments and history are kept." : "The vendor can be assigned to events again."}</p>
      </ConfirmDialog>
    </div>
  );
}
