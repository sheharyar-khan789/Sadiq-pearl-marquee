"use client";

import { useState } from "react";
import { formatPKR } from "@/lib/booking/format";
import ConfirmDialog from "./ConfirmDialog";
import { NoticeLine, useAdminAction } from "./BookingActions";

/** Approve / reject one open customer request, each behind a confirmation step. */
export default function RequestDecision({
  requestId,
  type,
  summary,
  bookingUpdatedAt,
  requestedSlotNow,
  financialAdjustment = null,
  paidSoFar = 0,
}: {
  requestId: string;
  type: "modification" | "cancellation";
  summary: string[];
  bookingUpdatedAt: string;
  /** Current state of a requested new slot ("available" | "held" | "booked" | …), if any. */
  requestedSlotNow: string | null;
  /** Phase 8: approving would price the booking below the amount already paid. */
  financialAdjustment?: { newTotal: number; paid: number } | null;
  /** Amount already paid on the booking (for the cancellation note). */
  paidSoFar?: number;
}) {
  const { busy, notice, send } = useAdminAction();
  const [decision, setDecision] = useState<"approve" | "reject" | null>(null);
  const [reason, setReason] = useState("");
  const slotTaken = requestedSlotNow !== null && requestedSlotNow !== "available";
  const noun = type === "cancellation" ? "cancellation" : "change";

  const confirm = async () => {
    if (!decision) return;
    const ok = await send(
      `/api/admin/requests/${requestId}/decision`,
      { decision, reason: reason.trim(), expectedBookingUpdatedAt: bookingUpdatedAt },
      decision === "approve" ? `The ${noun} was approved.` : `The ${noun} request was rejected.`
    );
    setDecision(null);
    if (ok) setReason("");
  };

  return (
    <div className="space-y-2">
      <NoticeLine notice={notice} />
      {financialAdjustment && (
        <div role="note" className="rounded-xl border border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <p className="font-semibold">⚠ Refund / financial adjustment required</p>
          <p className="mt-1">
            With current prices this change would make the total {formatPKR(financialAdjustment.newTotal)}, but{" "}
            {formatPKR(financialAdjustment.paid)} has already been paid (difference{" "}
            {formatPKR(financialAdjustment.paid - financialAdjustment.newTotal)}). It can&rsquo;t be approved until the difference is
            settled with the customer. Recorded payments and receipts are never reduced, and refunds are not recorded in the system yet
            (no refund policy is configured).
          </p>
        </div>
      )}
      {type === "cancellation" && paidSoFar > 0 && (
        <p role="note" className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {formatPKR(paidSoFar)} has been paid on this booking. Cancelling keeps those payments and receipts unchanged; any refund
          must be handled outside the system (refund / financial adjustment required — no refund policy is configured).
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setDecision("approve")}
          disabled={busy || !!financialAdjustment}
          title={financialAdjustment ? "Refund / financial adjustment required first" : undefined}
          className="btn btn-primary btn-sm"
        >
          Approve {noun}
        </button>
        <button type="button" onClick={() => setDecision("reject")} disabled={busy} className="btn btn-sm border border-red-300 text-red-800 hover:bg-red-50">
          Reject {noun}
        </button>
      </div>
      <ConfirmDialog
        open={decision !== null}
        title={decision === "approve" ? `Approve this ${noun}?` : `Reject this ${noun} request?`}
        confirmLabel={decision === "approve" ? `Approve ${noun}` : "Reject request"}
        danger={decision === "reject" || type === "cancellation"}
        busy={busy}
        onConfirm={confirm}
        onClose={() => setDecision(null)}
        reason={{ value: reason, onChange: setReason, label: "Note (optional, internal — kept in the audit trail)" }}
      >
        {type === "cancellation" ? (
          <p>
            {decision === "approve"
              ? "The booking will be cancelled and its slot released. No refund is calculated (policy not configured)."
              : "The booking stays as it is."}
          </p>
        ) : (
          <>
            <ul className="list-disc pl-5">
              {summary.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            {decision === "approve" && (
              <p>
                {slotTaken
                  ? "The requested slot is not free right now, so approval will fail safely and nothing will change."
                  : "The new slot (if any) is claimed, the booking updated and the old slot released — all at once. If the slot was taken in the meantime, nothing changes. Prices are recalculated only when real prices are configured; otherwise pricing is marked pending."}
              </p>
            )}
          </>
        )}
      </ConfirmDialog>
    </div>
  );
}
