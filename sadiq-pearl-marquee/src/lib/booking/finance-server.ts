// Payments / quotations / receipts — SERVER ONLY glue (Phase 7).
import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { business, media } from "@/lib/config";
import type { BusinessSnapshot } from "./finance-model";

/** Verified business details (src/lib/config.ts) copied into each new document. */
export function businessSnapshot(): BusinessSnapshot {
  return { name: business.name, address: business.fullAddress, phones: business.phones.map((p) => p.display) };
}

let logoCache: Promise<Uint8Array | null> | null = null;
/** The venue logo for PDF headers (null if the file can't be read — the PDF is still produced). */
export function documentLogo(): Promise<Uint8Array | null> {
  logoCache ??= readFile(path.join(process.cwd(), "public", media.logo.replace(/^\//, ""))).then(
    (b) => new Uint8Array(b),
    () => null
  );
  return logoCache;
}

export { paymentForViewer, quotationForViewer } from "./finance-access";
