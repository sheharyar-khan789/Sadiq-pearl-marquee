import type { Metadata } from "next";
import { redirect } from "next/navigation";
import LoginForm from "@/components/auth/LoginForm";
import { AuthHeading } from "@/components/auth/AuthFrame";
import { safeNextPath } from "@/lib/auth/constants";
import { getSessionUser } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
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
        eyebrow="Your account"
        title={
          <>
            Welcome <em className="text-gold">back</em>
          </>
        }
        intro="Sign in to your Sadiq Pearl account."
      />
      <LoginForm next={nextPath} />
    </>
  );
}
