import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AdminLoginForm from "@/components/admin/AdminLoginForm";
import { safeNextPath } from "@/lib/auth/constants";
import { getSessionUser, isSuperAdminSession } from "@/lib/auth/server";

// Separate admin sign-in. Lives outside the (admin) group so the admin guard
// layout doesn't wrap it, and outside (auth) so it never shows customer
// sign-up or Google sign-in. Private: never indexed.
export const metadata: Metadata = { title: "Admin sign in", robots: { index: false, follow: false } };

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { next } = await searchParams;
  const requested = safeNextPath(typeof next === "string" ? next : undefined, "/admin");
  const nextPath = requested === "/admin" || requested.startsWith("/admin/") ? requested : "/admin";
  const user = await getSessionUser();
  if (user && isSuperAdminSession(user)) redirect(nextPath);

  return (
    <div className="grid min-h-svh place-items-center bg-surface-low px-5 py-12">
      <main id="main" className="w-full max-w-md rounded-3xl border border-line bg-surface p-6 shadow-soft sm:p-10">
        <p className="leading-none">
          <span className="font-display text-xl font-semibold text-ink">Sadiq Pearl</span>
          <span className="ml-2 rounded bg-espresso px-1.5 py-0.5 align-middle text-[0.75rem] font-semibold uppercase tracking-wider text-surface">
            Admin
          </span>
        </p>
        <h1 className="mt-6 font-display text-[2rem] font-medium leading-tight text-ink">Admin sign in</h1>
        <p className="mb-8 mt-2 text-sm leading-relaxed text-ink-soft">
          For venue management only. Use the admin credentials created in Firebase.
        </p>
        <AdminLoginForm next={nextPath} />
      </main>
    </div>
  );
}
