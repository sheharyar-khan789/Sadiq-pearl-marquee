"use client";

import { useId, useState } from "react";
import { NoticeLine, useAdminAction } from "./BookingActions";

/** Internal notes. Only admin pages and admin APIs ever see these. */
export default function AdminNotesForm({ bookingId, initial, updatedAt }: { bookingId: string; initial: string; updatedAt: string }) {
  const uid = useId();
  const [notes, setNotes] = useState(initial);
  const { busy, notice, send } = useAdminAction();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void send(`/api/admin/bookings/${bookingId}/notes`, { adminNotes: notes, expectedUpdatedAt: updatedAt }, "Notes saved.");
      }}
      className="space-y-2"
    >
      <NoticeLine notice={notice} />
      <label htmlFor={`${uid}-notes`} className="sr-only">
        Admin notes
      </label>
      <textarea
        id={`${uid}-notes`}
        rows={4}
        maxLength={4000}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Internal notes (never shown to the customer)"
        className="block w-full rounded-xl border border-line-strong/50 bg-surface px-3 py-2 text-[0.9375rem] text-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-gold-container/40"
      />
      <button type="submit" disabled={busy || notes === initial} className="btn btn-outline btn-sm">
        {busy ? "Saving…" : "Save notes"}
      </button>
    </form>
  );
}
