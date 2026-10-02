import type { Metadata } from "next";
import { AdminError, PageHeader } from "@/components/admin/AdminUi";
import ManualBookingForm from "@/components/admin/ManualBookingForm";
import { loadCustomers } from "@/lib/booking/admin-server";
import { businessToday } from "@/lib/booking/dates";
import { loadConfigFresh } from "@/lib/config/config-server";
import { toPublicConfig } from "@/lib/config/business-config";

export const metadata: Metadata = { title: "New booking" };

export default async function NewBookingPage() {
  const [customers, cfg] = await Promise.all([loadCustomers(), loadConfigFresh()]);
  return (
    <div className="max-w-3xl">
      <PageHeader title="New booking" subtitle="Walk-in, WhatsApp, phone or other offline booking. Same availability rules as the website." />
      {!customers.ok || !cfg.ok ? (
        <AdminError reason={!customers.ok ? customers.reason : !cfg.ok ? cfg.reason : "error"} retryHref="/admin/bookings/new" />
      ) : (
        <ManualBookingForm
          today={businessToday(new Date())}
          config={toPublicConfig(cfg.config)}
          customers={customers.data
            .filter((c) => c.uid)
            .map((c) => ({ uid: c.uid as string, name: c.name, email: c.email, phone: c.phone }))}
        />
      )}
    </div>
  );
}
