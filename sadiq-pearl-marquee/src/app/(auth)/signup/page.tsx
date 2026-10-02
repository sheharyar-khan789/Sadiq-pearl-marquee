import type { Metadata } from "next";
import { redirect } from "next/navigation";
import SignupForm from "@/components/auth/SignupForm";
import { AuthHeading } from "@/components/auth/AuthFrame";
import { safeNextPath } from "@/lib/auth/constants";
import { getSessionUser } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(typeof next === "string" ? next : undefined);
  if (await getSessionUser()) redirect(nextPath);

  return (
    <>
      <AuthHeading
        eyebrow="Create an account"
        title={
          <>
            Join <em className="text-gold">Sadiq Pearl</em>
          </>
        }
        intro="Create your account with Google or your email address."
      />
      <SignupForm next={nextPath} />
    </>
  );
}
