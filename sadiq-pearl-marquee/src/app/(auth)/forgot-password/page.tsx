import type { Metadata } from "next";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";
import { AuthHeading } from "@/components/auth/AuthFrame";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <AuthHeading
        eyebrow="Password help"
        title={
          <>
            Reset your <em className="text-gold">password</em>
          </>
        }
        intro="Enter the email you use to sign in and we'll send you a link to choose a new password."
      />
      <ForgotPasswordForm />
    </>
  );
}
