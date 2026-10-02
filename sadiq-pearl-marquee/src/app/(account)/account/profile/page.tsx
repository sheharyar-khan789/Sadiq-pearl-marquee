import type { Metadata } from "next";
import { Section } from "@/components/account/BookingSections";
import EmailChangeForm from "@/components/account/EmailChangeForm";
import ProfileForm from "@/components/account/ProfileForm";
import { WhatsAppLink } from "@/components/account/PortalStates";
import Icon from "@/components/Icon";
import type { CustomerProfile } from "@/lib/account/profile";
import { requireUser } from "@/lib/auth/server";
import { logBookingError, profileStore, withTimeout } from "@/lib/booking/server";

export const metadata: Metadata = { title: "Your profile" };

export default async function ProfilePage() {
  const user = await requireUser("/account/profile");
  const store = profileStore();
  let profile: CustomerProfile | null = null;
  let loadFailed = store === null;
  if (store) {
    try {
      profile = await withTimeout(store.get(user.uid), 10_000);
      // Firebase Auth owns the email; after a confirmed change, mirror it.
      if (profile && user.email && profile.email !== user.email) {
        await withTimeout(store.syncEmail(user.uid, user.email), 10_000);
      }
    } catch (error) {
      logBookingError("profile load", error);
      loadFailed = true;
    }
  }
  const isPassword = user.signInProvider === "password";

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow text-xs">Your account</p>
        <h1 className="mt-4 font-display text-[2.5rem] font-medium leading-[1.05] text-ink sm:text-5xl">Your profile</h1>
      </header>

      <Section id="details-title" title="Personal details">
        {loadFailed ? (
          <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm leading-relaxed text-red-900">
            <p>We couldn&rsquo;t load your profile right now. Please try again in a moment.</p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <a href="/account/profile" className="btn btn-outline btn-sm border-red-300 text-red-900">
                Try again
              </a>
              <WhatsAppLink className="btn btn-outline btn-sm" />
            </div>
          </div>
        ) : (
          <ProfileForm initial={{ name: profile?.name ?? user.name ?? "", phone: profile?.phone ?? "" }} />
        )}
      </Section>

      <Section id="email-title" title="Sign-in email">
        <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="break-all font-semibold text-ink">{user.email}</p>
          {user.emailVerified ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-800">
              <Icon name="check" className="h-4 w-4" /> Verified
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-800">
              <Icon name="alert" className="h-4 w-4" /> Not verified yet
            </span>
          )}
        </div>
        {isPassword ? (
          user.email && <EmailChangeForm currentEmail={user.email} />
        ) : (
          <p className="text-[0.9375rem] leading-relaxed text-ink-soft">
            You sign in with Google, so this email is managed by your Google account.
          </p>
        )}
      </Section>

      <Section id="security-title" title="Sign-in method">
        <p className="text-[0.9375rem] text-ink-soft">
          {isPassword ? "Email and password" : "Google"}
          {isPassword && (
            <>
              {" · "}
              <a href="/forgot-password" className="font-semibold text-gold underline underline-offset-2">
                Change password
              </a>
            </>
          )}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">
          We only keep the details above. We never ask for your password, CNIC or payment card details online.
        </p>
      </Section>
    </div>
  );
}
