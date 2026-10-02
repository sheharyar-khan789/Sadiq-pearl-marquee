import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth/AuthProvider";
import AuthFrame from "@/components/auth/AuthFrame";

// Account pages are private: keep them out of search results.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AuthFrame>{children}</AuthFrame>
    </AuthProvider>
  );
}
