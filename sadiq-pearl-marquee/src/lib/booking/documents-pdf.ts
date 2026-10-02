// Quotation and receipt PDFs (Phase 7). Built ONLY from the stored document
// snapshots (quotations/{id}.snapshot, payments/{id}.receipt) — never from the
// current configuration or a recalculated price — so a document downloaded
// years later shows exactly what was issued.
// Uses pdf-lib's built-in Helvetica (WinAnsi): characters outside that set
// (e.g. Urdu script in a name) are replaced with "?" rather than failing.
import { degrees, PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatEventDate, formatPKR, formatTimestamp } from "./format.ts";
import {
  PAYMENT_METHOD_LABELS,
  QUOTATION_STATUS_LABELS,
  type BusinessSnapshot,
  type PaymentRecord,
  type QuotationRecord,
} from "./finance-model.ts";

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 48;
const INK = rgb(0.13, 0.12, 0.11);
const SOFT = rgb(0.42, 0.4, 0.37);
const GOLD = rgb(0.64, 0.5, 0.25);
const LINE = rgb(0.85, 0.82, 0.76);
const RED = rgb(0.7, 0.12, 0.12);

// WinAnsi covers Latin-1 plus these typographic characters.
const WIN_ANSI_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");
export function pdfSafe(text: string): string {
  return [...text.normalize("NFC")]
    .map((c) => {
      const code = c.codePointAt(0)!;
      if (c === "\n" || c === "\t") return " ";
      if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WIN_ANSI_EXTRA.has(c)) return c;
      if (c === "₨") return "Rs";
      return "?";
    })
    .join("");
}

const iso = (d: Date | string) => new Date(d).toISOString();

/** A tiny top-to-bottom layout helper with automatic page breaks. */
class Writer {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  regular: PDFFont;
  bold: PDFFont;
  footer: string;
  watermark: { text: string; color: ReturnType<typeof rgb> } | null;

  constructor(doc: PDFDocument, regular: PDFFont, bold: PDFFont, footer: string, watermark: Writer["watermark"]) {
    this.doc = doc;
    this.regular = regular;
    this.bold = bold;
    this.footer = footer;
    this.watermark = watermark;
    this.page = this.newPage();
    this.y = A4[1] - MARGIN;
  }

  newPage(): PDFPage {
    const page = this.doc.addPage(A4);
    if (this.watermark) {
      page.drawText(this.watermark.text, {
        x: 110,
        y: 300,
        size: 72,
        font: this.bold,
        color: this.watermark.color,
        opacity: 0.12,
        rotate: degrees(35),
      });
    }
    const n = this.doc.getPageCount();
    page.drawText(pdfSafe(`${this.footer}   ·   Page ${n}`), { x: MARGIN, y: 28, size: 7.5, font: this.regular, color: SOFT });
    return page;
  }

  ensure(height: number) {
    if (this.y - height < MARGIN + 20) {
      this.page = this.newPage();
      this.y = A4[1] - MARGIN;
    }
  }

  gap(h: number) {
    this.y -= h;
  }

  /** Wrapped text; returns nothing, advances y. */
  text(value: string, opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; x?: number; width?: number } = {}) {
    const size = opts.size ?? 10;
    const font = opts.bold ? this.bold : this.regular;
    const x = opts.x ?? MARGIN;
    const width = opts.width ?? A4[0] - MARGIN - x;
    for (const line of this.wrap(pdfSafe(value), font, size, width)) {
      this.ensure(size + 4);
      this.page.drawText(line, { x, y: this.y - size, size, font, color: opts.color ?? INK });
      this.y -= size + 4;
    }
  }

  wrap(value: string, font: PDFFont, size: number, width: number): string[] {
    const out: string[] = [];
    for (const para of value.split(/\r?\n/)) {
      let line = "";
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const next = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(next, size) <= width) line = next;
        else {
          if (line) out.push(line);
          // A single word wider than the line is cut hard.
          let rest = word;
          while (font.widthOfTextAtSize(rest, size) > width && rest.length > 1) {
            let cut = rest.length - 1;
            while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > width) cut--;
            out.push(rest.slice(0, cut));
            rest = rest.slice(cut);
          }
          line = rest;
        }
      }
      out.push(line);
    }
    return out;
  }

  /** Label / value pairs in two columns. */
  pairs(rows: [string, string][], labelWidth = 120) {
    for (const [label, value] of rows) {
      const lines = this.wrap(pdfSafe(value), this.regular, 10, A4[0] - MARGIN * 2 - labelWidth);
      this.ensure(14 * lines.length);
      this.page.drawText(pdfSafe(label), { x: MARGIN, y: this.y - 10, size: 9, font: this.regular, color: SOFT });
      for (const line of lines) {
        this.page.drawText(line, { x: MARGIN + labelWidth, y: this.y - 10, size: 10, font: this.regular, color: INK });
        this.y -= 14;
      }
    }
  }

  rule(color = LINE) {
    this.ensure(8);
    this.page.drawLine({ start: { x: MARGIN, y: this.y - 3 }, end: { x: A4[0] - MARGIN, y: this.y - 3 }, thickness: 0.7, color });
    this.y -= 8;
  }

  heading(value: string) {
    this.gap(6);
    this.ensure(30);
    this.text(value.toUpperCase(), { size: 9, bold: true, color: GOLD });
    this.rule();
  }

  /** Right-aligned amount row. */
  amountRow(label: string, amount: string, opts: { bold?: boolean; color?: ReturnType<typeof rgb> } = {}) {
    this.ensure(16);
    const font = opts.bold ? this.bold : this.regular;
    const size = opts.bold ? 11 : 10;
    const right = A4[0] - MARGIN;
    const a = pdfSafe(amount);
    this.page.drawText(pdfSafe(label), { x: MARGIN + 250, y: this.y - size, size, font, color: opts.color ?? INK });
    this.page.drawText(a, { x: right - font.widthOfTextAtSize(a, size), y: this.y - size, size, font, color: opts.color ?? INK });
    this.y -= size + 6;
  }
}

async function start(
  business: BusinessSnapshot,
  logo: Uint8Array | null,
  title: string,
  number: string,
  footer: string,
  watermark: Writer["watermark"]
) {
  const doc = await PDFDocument.create();
  doc.setTitle(pdfSafe(`${title} ${number}`));
  doc.setAuthor(pdfSafe(business.name));
  doc.setCreator(pdfSafe(business.name));
  doc.setProducer("Sadiq Pearl booking system");
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const w = new Writer(doc, regular, bold, footer, watermark);

  // Header: logo, business details, document title/number.
  let textX = MARGIN;
  if (logo) {
    try {
      const img = await doc.embedJpg(logo);
      const h = 64;
      const wd = (img.width / img.height) * h;
      w.page.drawImage(img, { x: MARGIN, y: w.y - h, width: wd, height: h });
      textX = MARGIN + wd + 14;
    } catch {
      /* logo unreadable: header without it */
    }
  }
  const top = w.y;
  w.text(business.name, { size: 16, bold: true, x: textX, width: 250 });
  w.text(business.address, { size: 8.5, color: SOFT, x: textX, width: 250 });
  if (business.phones.length) w.text(business.phones.join("  ·  "), { size: 8.5, color: SOFT, x: textX, width: 250 });
  const leftBottom = w.y;
  const right = A4[0] - MARGIN;
  const t = pdfSafe(title.toUpperCase());
  w.page.drawText(t, { x: right - bold.widthOfTextAtSize(t, 15), y: top - 15, size: 15, font: bold, color: GOLD });
  const n = pdfSafe(number);
  w.page.drawText(n, { x: right - regular.widthOfTextAtSize(n, 10), y: top - 32, size: 10, font: regular, color: INK });
  w.y = Math.min(leftBottom, top - 64) - 6;
  w.rule(GOLD);
  return w;
}

// ---------------------------------------------------------------- quotation

export async function quotationPdf(q: QuotationRecord, logo: Uint8Array | null): Promise<Uint8Array> {
  const s = q.snapshot;
  const number = q.quotationNumber ?? "DRAFT (not issued)";
  const watermark =
    q.status === "issued"
      ? null
      : { text: QUOTATION_STATUS_LABELS[q.status].toUpperCase(), color: q.status === "draft" ? SOFT : RED };
  const w = await start(
    s.business,
    logo,
    "Quotation",
    number,
    `${s.business.name} · Quotation ${number} · Booking ${s.bookingReference}`,
    watermark
  );

  w.pairs([
    ["Quotation no.", number],
    ["Status", QUOTATION_STATUS_LABELS[q.status]],
    ["Date", q.issuedAt ? formatTimestamp(iso(q.issuedAt)) : `Draft of ${formatTimestamp(iso(s.generatedAt))}`],
    ["Booking reference", s.bookingReference],
  ]);

  w.heading("Customer");
  w.pairs([
    ["Name", s.customer.name],
    ["Phone", s.customer.phone],
    ...(s.customer.email ? ([["Email", s.customer.email]] as [string, string][]) : []),
  ]);

  w.heading("Event");
  w.pairs([
    ["Date", formatEventDate(s.event.date)],
    ["Slot", s.event.slotLabel],
    ["Hall", s.event.hallName],
    ["Event type", s.event.eventTypeLabel],
    ["Guests", s.event.guestCount.toLocaleString("en-PK")],
    ...(s.package ? ([["Package", s.package]] as [string, string][]) : []),
    ...(s.menu ? ([["Menu", s.menu]] as [string, string][]) : []),
    ...(s.services.length ? ([["Services", s.services.join(", ")]] as [string, string][]) : []),
  ]);

  w.heading("Pricing");
  // Itemised lines exactly as stored in the booking's price snapshot.
  const colQty = A4[0] - MARGIN - 230;
  const colUnit = A4[0] - MARGIN - 150;
  const right = A4[0] - MARGIN;
  const head = (label: string, x: number, alignRight = false) => {
    const width = w.bold.widthOfTextAtSize(label, 8.5);
    w.page.drawText(label, { x: alignRight ? x - width : x, y: w.y - 8.5, size: 8.5, font: w.bold, color: SOFT });
  };
  w.ensure(18);
  head("Item", MARGIN);
  head("Qty", colQty + 30, true);
  head("Rate", colUnit + 60, true);
  head("Amount", right, true);
  w.y -= 14;
  for (const line of s.pricing.lines) {
    const label = w.wrap(pdfSafe(line.label), w.regular, 10, colQty - MARGIN - 20);
    w.ensure(14 * label.length + 2);
    const y = w.y - 10;
    const draw = (t: string, x: number) =>
      w.page.drawText(pdfSafe(t), { x: x - w.regular.widthOfTextAtSize(pdfSafe(t), 10), y, size: 10, font: w.regular, color: INK });
    draw(line.quantity.toLocaleString("en-PK"), colQty + 30);
    draw(formatPKR(line.unitAmount), colUnit + 60);
    draw(formatPKR(line.amount), right);
    for (const l of label) {
      w.page.drawText(l, { x: MARGIN, y: w.y - 10, size: 10, font: w.regular, color: INK });
      w.y -= 14;
    }
  }
  w.rule();
  w.amountRow("Subtotal", formatPKR(s.pricing.subtotal));
  if (s.pricing.discount) w.amountRow(s.pricing.discountLabel || "Discount", `- ${formatPKR(s.pricing.discount)}`);
  if (s.pricing.serviceCharge) w.amountRow("Service charge", formatPKR(s.pricing.serviceCharge));
  w.amountRow("Total", formatPKR(s.pricing.total), { bold: true });
  w.gap(4);
  w.amountRow("Required advance", s.requiredAdvance === null ? "Not set" : formatPKR(s.requiredAdvance));
  w.amountRow("Paid (at the date of this quotation)", formatPKR(s.paidToDate));
  w.amountRow("Remaining", formatPKR(s.remaining), { bold: true });

  if (s.policies) {
    w.heading("Policies");
    if (s.policies.effectiveDate) w.text(`Effective ${formatEventDate(s.policies.effectiveDate)}`, { size: 8.5, color: SOFT });
    for (const [label, text] of [
      ["Cancellation", s.policies.cancellation],
      ["Refund", s.policies.refund],
      ["Changes", s.policies.modification],
    ] as const) {
      if (!text) continue;
      w.text(label, { size: 9, bold: true });
      w.text(text, { size: 9 });
      w.gap(3);
    }
  }

  // Official venue terms as copied into this quotation when it was generated
  // (older quotations have none and print none).
  if (s.terms?.length) {
    w.heading("Venue terms");
    s.terms.forEach((t, i) => {
      w.text(`${i + 1}. ${t.title}`, { size: 9, bold: true });
      w.text(t.body, { size: 9 });
      w.gap(3);
    });
  }

  w.gap(10);
  w.text(
    `Prices are those stored with the booking (calculated ${formatTimestamp(iso(s.pricing.calculatedAt))}). ` +
      "All amounts in Pakistani rupees. This document does not change if prices are updated later.",
    { size: 8, color: SOFT }
  );
  return w.doc.save();
}

// ------------------------------------------------------------------ receipt

export async function receiptPdf(p: PaymentRecord, logo: Uint8Array | null): Promise<Uint8Array> {
  const r = p.receipt;
  const voided = p.status === "voided";
  const w = await start(
    r.business,
    logo,
    "Payment receipt",
    r.receiptNumber,
    `${r.business.name} · Receipt ${r.receiptNumber} · Booking ${r.bookingReference}`,
    voided ? { text: "VOID", color: RED } : null
  );
  if (voided && p.voided) {
    w.text(`VOID — this payment was cancelled on ${formatTimestamp(iso(p.voided.at))}. It no longer counts towards the booking.`, {
      bold: true,
      color: RED,
      size: 10,
    });
    w.gap(4);
  }
  w.pairs([
    ["Receipt no.", r.receiptNumber],
    ["Issued", formatTimestamp(iso(r.issuedAt))],
    ["Booking reference", r.bookingReference],
    ...(r.quotationNumber ? ([["Quotation no.", r.quotationNumber]] as [string, string][]) : []),
  ]);

  w.heading("Received from");
  w.pairs([
    ["Name", r.customer.name],
    ["Phone", r.customer.phone],
    ...(r.customer.email ? ([["Email", r.customer.email]] as [string, string][]) : []),
  ]);

  w.heading("Event");
  w.pairs([
    ["Date", formatEventDate(r.event.date)],
    ["Slot", r.event.slotLabel],
    ["Hall", r.event.hallName],
    ["Event type", r.event.eventTypeLabel],
    ["Guests", r.event.guestCount.toLocaleString("en-PK")],
  ]);

  w.heading("Payment");
  w.pairs([
    ["Amount received", formatPKR(p.amount)],
    ["Method", PAYMENT_METHOD_LABELS[p.method]],
    ["Payment date", formatEventDate(iso(p.paidAt).slice(0, 10))],
    ...(p.reference ? ([["Reference", p.reference]] as [string, string][]) : []),
  ]);

  w.heading("Booking balance");
  w.amountRow("Booking total", formatPKR(r.bookingTotal));
  w.amountRow("Paid before this receipt", formatPKR(r.paidBefore));
  w.amountRow("This payment", formatPKR(p.amount));
  w.amountRow("Total paid", formatPKR(r.paidAfter), { bold: true });
  w.amountRow("Remaining balance", formatPKR(r.remainingAfter), { bold: true });

  w.gap(10);
  w.text("Balances are as at the time this receipt was issued. All amounts in Pakistani rupees.", { size: 8, color: SOFT });
  return w.doc.save();
}
