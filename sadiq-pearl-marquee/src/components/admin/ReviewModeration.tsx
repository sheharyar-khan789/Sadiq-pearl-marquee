"use client";

import { useState } from "react";
import { NoticeLine, useAdminAction } from "./BookingActions";
import ConfirmDialog from "./ConfirmDialog";

/** Approve / reject one guest review, behind a confirmation step (audited on the server). */
export default function ReviewModeration({ reviewId, status, updatedAt, name }: { reviewId: string; status: "pending" | "approved" | "rejected"; updatedAt: string; name: string }) {
  const { busy, notice, send } = useAdminAction();
  const [decision, setDecision] = useState<"approve" | "reject" | null>(null);
  const [note, setNote] = useState("");
  return (
    <div className="space-y-2">
      <NoticeLine notice={notice} />
      <div className="flex flex-wrap gap-2">
        {status !== "approved" && (
          <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => setDecision("approve")}>
            Approve &amp; publish
          </button>
        )}
        {status !== "rejected" && (
          <button type="button" className="btn btn-sm border border-red-300 text-red-800 hover:bg-red-50" disabled={busy} onClick={() => setDecision("reject")}>
            {status === "approved" ? "Unpublish (reject)" : "Reject"}
          </button>
        )}
      </div>
      <ConfirmDialog
        open={decision !== null}
        title={decision === "approve" ? `Publish the review by ${name}?` : `Reject the review by ${name}?`}
        confirmLabel={decision === "approve" ? "Approve & publish" : "Reject"}
        danger={decision === "reject"}
        busy={busy}
        onClose={() => setDecision(null)}
        onConfirm={async () => {
          if (!decision) return;
          await send(`/api/admin/reviews/${reviewId}`, { decision, note: note.trim(), expectedUpdatedAt: updatedAt }, decision === "approve" ? "Review published." : "Review rejected (not public).");
          setDecision(null);
          setNote("");
        }}
        reason={{ value: note, onChange: setNote, label: "Note (optional, internal — never shown publicly)" }}
      >
        <p>{decision === "approve" ? "It will appear on the public Reviews page exactly as written." : "It will not be shown publicly. The guest can edit and resubmit it."}</p>
      </ConfirmDialog>
    </div>
  );
}
