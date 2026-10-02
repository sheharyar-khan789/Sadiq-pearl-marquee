import type { Metadata } from "next";
import EmailActionHandler from "@/components/auth/EmailActionHandler";
import { AuthHeading } from "@/components/auth/AuthFrame";
import { safeNextPath } from "@/lib/auth/constants";

export const metadata: Metadata = { title: "Account email link" };

/** Handles Firebase email-action links (configure as the custom action URL in Firebase Console). */
export default async function EmailActionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const pick = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : null);

  // continueUrl is absolute; only its same-site path is honoured.
  let continuePath = "/account";
  const continueUrl = pick("continueUrl");
  if (continueUrl) {
    try {
      const url = new URL(continueUrl);
      continuePath = safeNextPath(url.pathname + url.search);
    } catch {
      continuePath = "/account";
    }
  }

  const mode = pick("mode");
  const reset = mode === "resetPassword";
  const emailChange = mode === "verifyAndChangeEmail" || mode === "recoverEmail";

  return (
    <>
      <AuthHeading
        eyebrow={reset ? "Password help" : emailChange ? "Sign-in email" : "Email verification"}
        title={
          reset
            ? "Choose a new password"
            : mode === "recoverEmail"
              ? "Restore your email"
              : emailChange
                ? "Confirm your new email"
                : "Verify your email"
        }
      />
      <EmailActionHandler mode={mode} oobCode={pick("oobCode")} continuePath={continuePath} />
    </>
  );
}
