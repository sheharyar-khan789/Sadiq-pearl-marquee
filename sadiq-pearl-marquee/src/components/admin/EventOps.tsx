"use client";

import Link from "next/link";
import { useId, useState } from "react";
import {
  ASSIGNMENT_STATUS_LABELS,
  CHECKLIST_STATUS_LABELS,
  CHECKLIST_STATUSES,
  OPS_STATUS_LABELS,
  OPS_STATUSES,
  VENDOR_CATEGORIES,
  VENDOR_CATEGORY_LABELS,
  type AssignmentStatus,
  type ChecklistStatus,
  type OpsStatus,
  type VendorCategory,
} from "@/lib/booking/operations-model";
import { formatEventDate, formatTimestamp } from "@/lib/booking/format";
import { NoticeLine, useAdminAction } from "./BookingActions";
import ConfirmDialog from "./ConfirmDialog";
import WhatsAppComposer from "./WhatsAppComposer";
import { OpsStatusPill } from "./OpsUi";

const field =
  "block h-11 w-full rounded-xl border border-line-strong/50 bg-surface px-3 text-sm text-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-gold-container/40";
const label = "mb-1 block text-xs font-semibold text-ink";

// ------------------------------------------------------------ status

export function OpsStatusControl({ bookingId, status, eventDate, today, editable }: { bookingId: string; status: OpsStatus; eventDate: string; today: string; editable: boolean }) {
  const { busy, notice, send } = useAdminAction();
  const [pending, setPending] = useState<OpsStatus | null>(null);
  const i = OPS_STATUSES.indexOf(status);
  const next = OPS_STATUSES[i + 1];
  const prev = OPS_STATUSES[i - 1];
  const eventStarted = eventDate <= today;
  const blocked = (to: OpsStatus) => (to === "in_progress" || to === "completed") && !eventStarted;
  return (
    <div className="space-y-3">
      <NoticeLine notice={notice} />
      <ol className="flex flex-wrap gap-1 text-xs" aria-label="Operational stages">
        {OPS_STATUSES.map((s, j) => (
          <li key={s} aria-current={s === status ? "step" : undefined} className={`rounded-full border px-2 py-0.5 ${s === status ? "border-ink font-semibold text-ink" : j < i ? "border-line text-ink-soft" : "border-line text-ink-muted"}`}>
            {j < i ? "✓ " : ""}
            {OPS_STATUS_LABELS[s]}
          </li>
        ))}
      </ol>
      {editable ? (
        <div className="flex flex-wrap gap-2">
          {next && (
            <button type="button" className="btn btn-primary btn-sm" disabled={busy || blocked(next)} onClick={() => setPending(next)}>
              Move to “{OPS_STATUS_LABELS[next]}”
            </button>
          )}
          {prev && (
            <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => setPending(prev)}>
              Back to “{OPS_STATUS_LABELS[prev]}”
            </button>
          )}
          {next && blocked(next) && <p className="w-full text-xs text-ink-muted">“{OPS_STATUS_LABELS[next]}” is available from the event date ({formatEventDate(eventDate, "short")}).</p>}
        </div>
      ) : (
        <p className="text-sm text-ink-muted">Operations can only be changed for confirmed or completed events.</p>
      )}
      <ConfirmDialog
        open={pending !== null}
        title={pending ? `Change operational status to “${OPS_STATUS_LABELS[pending]}”?` : ""}
        confirmLabel="Change status"
        busy={busy}
        onClose={() => setPending(null)}
        onConfirm={async () => {
          if (!pending) return;
          await send(`/api/admin/events/${bookingId}/status`, { to: pending }, `Operational status: ${OPS_STATUS_LABELS[pending]}.`);
          setPending(null);
        }}
      >
        <p>This is the event-preparation status only. The booking status, slot, price and payments are not changed.</p>
        {pending && <p>New status: <OpsStatusPill status={pending} /></p>}
      </ConfirmDialog>
    </div>
  );
}

// --------------------------------------------------------- checklist

export interface ChecklistItemView {
  id: string;
  label: string;
  source: string;
  status: ChecklistStatus;
  note: string;
  removed: boolean;
  completedAt: string | null;
  completedBy: string | null;
  updatedBy: string | null;
}

function ChecklistRow({ bookingId, item, editable }: { bookingId: string; item: ChecklistItemView; editable: boolean }) {
  const uid = useId();
  const { busy, notice, send } = useAdminAction();
  const [note, setNote] = useState(item.note);
  const [editing, setEditing] = useState(false);
  const update = (body: { status?: ChecklistStatus; note?: string }, msg: string) =>
    send(`/api/admin/events/${bookingId}/checklist`, { action: "update", itemId: item.id, ...body }, msg);
  return (
    <li className={`py-3 ${item.removed ? "opacity-70" : ""}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className={`font-semibold ${item.status === "completed" ? "text-ink-soft" : "text-ink"}`}>
            <span aria-hidden="true">{item.status === "completed" ? "☑" : item.status === "in_progress" ? "◐" : "☐"} </span>
            {item.label}
            {item.removed && <span className="ml-1 text-xs font-normal text-amber-900">(no longer on the booking)</span>}
          </p>
          <p className="text-xs text-ink-muted">
            {CHECKLIST_STATUS_LABELS[item.status]}
            {item.completedAt && ` · done ${formatTimestamp(item.completedAt)} by ${item.completedBy}`}
            {!item.completedAt && item.updatedBy && ` · last update by ${item.updatedBy}`}
          </p>
          {item.note && !editing && <p className="mt-1 break-words text-sm text-ink-soft">Note: {item.note}</p>}
        </div>
        {editable && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <label htmlFor={`${uid}-st`} className="sr-only">Status of {item.label}</label>
            <select
              id={`${uid}-st`}
              value={item.status}
              disabled={busy}
              onChange={(e) => void update({ status: e.target.value as ChecklistStatus }, `“${item.label}”: ${CHECKLIST_STATUS_LABELS[e.target.value as ChecklistStatus]}.`)}
              className="h-11 rounded-xl border border-line-strong/50 bg-surface px-2 text-sm"
            >
              {CHECKLIST_STATUSES.map((s) => (
                <option key={s} value={s}>{CHECKLIST_STATUS_LABELS[s]}</option>
              ))}
            </select>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing((v) => !v)} aria-expanded={editing} aria-label={`${item.note ? "Edit" : "Add"} note for ${item.label}`}>
              {item.note ? "Edit item note" : "Item note"}
            </button>
          </div>
        )}
      </div>
      {editing && (
        <form
          className="mt-2 flex flex-col gap-2 sm:flex-row"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await update({ note }, "Note saved.")) setEditing(false);
          }}
        >
          <label htmlFor={`${uid}-note`} className="sr-only">Note for {item.label}</label>
          <input id={`${uid}-note`} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} className={field} />
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>Save item note</button>
        </form>
      )}
      <NoticeLine notice={notice} />
    </li>
  );
}

export function ChecklistPanel({ bookingId, items, editable, outOfDate }: { bookingId: string; items: ChecklistItemView[]; editable: boolean; outOfDate: boolean }) {
  const uid = useId();
  const { busy, notice, send } = useAdminAction();
  const [labelText, setLabelText] = useState("");
  const active = items.filter((i) => !i.removed);
  const done = active.filter((i) => i.status === "completed").length;
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-soft" aria-live="polite">
        {done} of {active.length} done
      </p>
      <NoticeLine notice={notice} />
      {outOfDate && editable && (
        <div role="note" className="flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between">
          <span>The booking&rsquo;s selections changed since this checklist was made.</span>
          <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => void send(`/api/admin/events/${bookingId}/checklist`, { action: "sync" }, "Checklist updated to match the booking.")}>
            Update checklist
          </button>
        </div>
      )}
      <ul className="divide-y divide-line">
        {items.map((i) => (
          <ChecklistRow key={i.id} bookingId={bookingId} item={i} editable={editable} />
        ))}
      </ul>
      {editable && (
        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await send(`/api/admin/events/${bookingId}/checklist`, { action: "add", label: labelText }, "Item added.")) setLabelText("");
          }}
        >
          <div className="min-w-0 flex-1">
            <label htmlFor={`${uid}-add`} className={label}>Add a checklist item</label>
            <input id={`${uid}-add`} value={labelText} maxLength={120} onChange={(e) => setLabelText(e.target.value)} className={field} />
          </div>
          <button type="submit" className="btn btn-outline btn-sm" disabled={busy || labelText.trim().length < 2}>Add item</button>
        </form>
      )}
    </div>
  );
}

// ------------------------------------------------------------- notes

export interface OpsNoteView {
  id: string;
  text: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

function NoteRow({ bookingId, note, editable }: { bookingId: string; note: OpsNoteView; editable: boolean }) {
  const uid = useId();
  const { busy, notice, send } = useAdminAction();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note.text);
  return (
    <li className="py-3 text-sm">
      {editing ? (
        <form
          className="space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await send(`/api/admin/events/${bookingId}/notes`, { action: "edit", noteId: note.id, text }, "Note updated.")) setEditing(false);
          }}
        >
          <label htmlFor={`${uid}-t`} className="sr-only">Edit note</label>
          <textarea id={`${uid}-t`} rows={3} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} className="block w-full rounded-xl border border-line-strong/50 bg-surface px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !text.trim()}>Save</button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        <>
          <p className="whitespace-pre-line break-words text-ink">{note.text}</p>
          <p className="mt-1 text-xs text-ink-muted">
            {note.createdBy} · {formatTimestamp(note.createdAt)}
            {note.updatedAt !== note.createdAt && ` · edited by ${note.updatedBy} ${formatTimestamp(note.updatedAt)}`}
          </p>
          {editable && (
            <button type="button" className="btn btn-outline btn-sm mt-2" onClick={() => setEditing(true)}>Edit</button>
          )}
        </>
      )}
      <NoticeLine notice={notice} />
    </li>
  );
}

export function NotesPanel({ bookingId, notes, editable }: { bookingId: string; notes: OpsNoteView[]; editable: boolean }) {
  const uid = useId();
  const { busy, notice, send } = useAdminAction();
  const [text, setText] = useState("");
  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-muted">Internal — never shown to the customer.</p>
      <NoticeLine notice={notice} />
      {notes.length === 0 ? <p className="text-sm text-ink-muted">No operational notes yet.</p> : (
        <ul className="divide-y divide-line">
          {[...notes].reverse().map((n) => <NoteRow key={n.id} bookingId={bookingId} note={n} editable={editable} />)}
        </ul>
      )}
      {editable && (
        <form
          className="space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await send(`/api/admin/events/${bookingId}/notes`, { action: "add", text }, "Note added.")) setText("");
          }}
        >
          <label htmlFor={`${uid}-n`} className={label}>New note (setup instruction, timing, special request…)</label>
          <textarea id={`${uid}-n`} rows={3} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} className="block w-full rounded-xl border border-line-strong/50 bg-surface px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-gold-container/40" />
          <button type="submit" className="btn btn-outline btn-sm" disabled={busy || !text.trim()}>Add note</button>
        </form>
      )}
    </div>
  );
}

// ----------------------------------------------------------- vendors

export interface AssignmentView {
  assignmentId: string;
  vendorId: string;
  vendorName: string;
  category: VendorCategory;
  status: AssignmentStatus;
  notes: string;
  assignedBy: string;
  assignedAt: string;
  phone: string | null;
  whatsapp: string | null;
  vendorActive: boolean;
  conflicts: { reference: string; eventDate: string; slotLabel: string }[];
  /** Whether the vendor record has a usable WhatsApp/phone number (Phase 9 manual WhatsApp). */
  whatsappUsable: boolean;
}

export function VendorPanel({
  bookingId,
  assignments,
  vendors,
  canAssign,
}: {
  bookingId: string;
  assignments: AssignmentView[];
  vendors: { vendorId: string; name: string; category: VendorCategory }[];
  canAssign: boolean;
}) {
  const uid = useId();
  const { busy, notice, send } = useAdminAction();
  const [vendorId, setVendorId] = useState("");
  const [category, setCategory] = useState<VendorCategory | "">("");
  const [notes, setNotes] = useState("");
  const [unassign, setUnassign] = useState<AssignmentView | null>(null);
  const active = assignments.filter((a) => a.status !== "cancelled");
  const past = assignments.filter((a) => a.status === "cancelled");
  return (
    <div className="space-y-4">
      <NoticeLine notice={notice} />
      {active.length === 0 ? <p className="text-sm text-ink-muted">No vendors assigned.</p> : (
        <ul className="divide-y divide-line text-sm">
          {active.map((a) => (
            <li key={a.assignmentId} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="font-semibold text-ink">
                  <Link href={`/admin/vendors/${a.vendorId}`} className="underline-offset-2 hover:underline">{a.vendorName}</Link> · {VENDOR_CATEGORY_LABELS[a.category]}
                </p>
                <p className="text-xs text-ink-muted">
                  {ASSIGNMENT_STATUS_LABELS[a.status]} · assigned {formatTimestamp(a.assignedAt)} by {a.assignedBy}
                  {!a.vendorActive && " · vendor now inactive"}
                </p>
                {a.phone && (
                  <p className="text-sm">
                    <a href={`tel:${a.phone.replace(/[^\d+]/g, "")}`} className="inline-flex min-h-[44px] items-center text-gold underline-offset-2 hover:underline">{a.phone}</a>
                    {a.whatsapp && <span className="text-ink-muted"> · WhatsApp {a.whatsapp}</span>}
                  </p>
                )}
                {a.notes && <p className="break-words text-ink-soft">Note: {a.notes}</p>}
                {canAssign && (
                  <details className="mt-2">
                    <summary className="inline-flex min-h-[44px] cursor-pointer items-center text-sm font-semibold text-gold">WhatsApp {a.vendorName} (event details)</summary>
                    <div className="mt-2">
                      <WhatsAppComposer
                        bookingId={bookingId}
                        recipientLabel={a.vendorName}
                        options={[{ key: "vendor", label: "Event details for vendor (no customer contact or prices)", template: "vendor_event_details", assignmentId: a.assignmentId }]}
                        unavailable={a.whatsappUsable ? null : "This vendor's number isn't a usable WhatsApp number. Update it on the vendor page."}
                      />
                    </div>
                  </details>
                )}
                {a.conflicts.length > 0 && (
                  <p role="alert" className="mt-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-900">
                    ⚠ Clash: this vendor is also on {a.conflicts.map((c) => `${c.reference} (${formatEventDate(c.eventDate, "short")}, ${c.slotLabel})`).join(", ")}. Do not assume they are available.
                  </p>
                )}
              </div>
              {canAssign && (
                <div className="flex shrink-0 flex-wrap gap-2">
                  {a.status === "assigned" && (
                    <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => void send(`/api/admin/vendor-assignments/${a.assignmentId}`, { status: "confirmed" }, `${a.vendorName} marked as confirmed.`)}>
                      Mark confirmed
                    </button>
                  )}
                  <button type="button" className="btn btn-sm border border-red-300 text-red-800 hover:bg-red-50" disabled={busy} onClick={() => setUnassign(a)}>
                    Unassign
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {past.length > 0 && (
        <details className="text-sm">
          <summary className="inline-flex min-h-[44px] cursor-pointer items-center text-ink-soft">Unassigned earlier ({past.length})</summary>
          <ul className="divide-y divide-line">
            {past.map((a) => (
              <li key={a.assignmentId} className="py-2 text-ink-muted">{a.vendorName} · {VENDOR_CATEGORY_LABELS[a.category]} · assigned {formatTimestamp(a.assignedAt)}</li>
            ))}
          </ul>
        </details>
      )}
      {canAssign && (
        vendors.length === 0 ? (
          <p className="text-sm text-ink-muted">
            No active vendors yet. <Link href="/admin/vendors" className="font-semibold text-gold underline-offset-2 hover:underline">Add vendors</Link> first.
          </p>
        ) : (
          <form
            className="grid gap-3 rounded-xl border border-line p-3 sm:grid-cols-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await send(`/api/admin/events/${bookingId}/vendors`, { vendorId, category, notes: notes.trim() }, "Vendor assigned. (No message is sent to the vendor.)")) {
                setVendorId("");
                setCategory("");
                setNotes("");
              }
            }}
          >
            <h3 className="text-sm font-semibold text-ink sm:col-span-2">Assign a vendor</h3>
            <div>
              <label htmlFor={`${uid}-v`} className={label}>Vendor</label>
              <select
                id={`${uid}-v`}
                value={vendorId}
                onChange={(e) => {
                  setVendorId(e.target.value);
                  const v = vendors.find((x) => x.vendorId === e.target.value);
                  if (v) setCategory(v.category);
                }}
                className={field}
              >
                <option value="">Choose…</option>
                {vendors.map((v) => (
                  <option key={v.vendorId} value={v.vendorId}>{v.name} ({VENDOR_CATEGORY_LABELS[v.category]})</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`${uid}-c`} className={label}>For</label>
              <select id={`${uid}-c`} value={category} onChange={(e) => setCategory(e.target.value as VendorCategory)} className={field}>
                <option value="">Choose…</option>
                {VENDOR_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{VENDOR_CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor={`${uid}-no`} className={label}>Note (optional, internal)</label>
              <input id={`${uid}-no`} value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} className={field} />
            </div>
            <div className="sm:col-span-2">
              <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !vendorId || !category}>Assign vendor</button>
              <p className="mt-1 text-xs text-ink-muted">The server refuses a vendor already assigned to another event in the same slot.</p>
            </div>
          </form>
        )
      )}
      <ConfirmDialog
        open={unassign !== null}
        title={unassign ? `Unassign ${unassign.vendorName}?` : ""}
        confirmLabel="Unassign"
        danger
        busy={busy}
        onClose={() => setUnassign(null)}
        onConfirm={async () => {
          if (!unassign) return;
          await send(`/api/admin/vendor-assignments/${unassign.assignmentId}`, { status: "cancelled" }, `${unassign.vendorName} unassigned.`);
          setUnassign(null);
        }}
      >
        <p>The assignment is kept in the history as “Unassigned”. No message is sent to the vendor.</p>
      </ConfirmDialog>
    </div>
  );
}
