/**
 * ESC/POS command builder for 58mm/80mm Bluetooth thermal receipt printers.
 * Pure byte-array logic — no React Native or Bluetooth dependency — so it
 * can be exercised with plain Node.js without any printer hardware. See
 * scratch-escpos-check.mjs (repo root, gitignored/scratch, run manually)
 * for a byte-level sanity check against the ESC/POS spec.
 *
 * Reference: Epson ESC/POS Command Reference. Cheap 58mm/80mm printers
 * clone this command set closely enough that it works across brands
 * (Xprinter, Goojprt, Rongta, etc.) for the small subset of commands used
 * here (init, align, bold, double-height, feed, cut).
 */

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

export const PAPER_WIDTH_CHARS = { "58mm": 32, "80mm": 48 } as const;
export type PaperSize = keyof typeof PAPER_WIDTH_CHARS;

export class ReceiptBuilder {
  private chunks: number[] = [];

  constructor(private width: number) {
    // ESC @ — initialize printer (clears any stuck formatting state from a
    // previous job before this one starts).
    this.chunks.push(ESC, 0x40);
  }

  private pushText(text: string) {
    // Thermal printers overwhelmingly use single-byte code pages (CP437 /
    // Windows-1252), not UTF-8. Non-ASCII characters (currency symbols,
    // curly quotes) render as garbage or blank boxes on most units, so we
    // strip to plain ASCII rather than risk unreadable output — callers
    // are expected to pre-format currency as "NGN 5,000.00", not "₦5,000".
    // eslint-disable-next-line no-control-regex
    const ascii = text.replace(/[^\x00-\x7E]/g, "?");
    for (let i = 0; i < ascii.length; i++) {
      this.chunks.push(ascii.charCodeAt(i));
    }
  }

  align(mode: "left" | "center" | "right"): this {
    const n = mode === "left" ? 0 : mode === "center" ? 1 : 2;
    this.chunks.push(ESC, 0x61, n);
    return this;
  }

  bold(on: boolean): this {
    this.chunks.push(ESC, 0x45, on ? 1 : 0);
    return this;
  }

  doubleHeight(on: boolean): this {
    // GS ! n — n=0x01 is double-height only (width stays normal), keeping
    // wrapping math (this.width) valid while still emphasizing a line.
    this.chunks.push(GS, 0x21, on ? 0x01 : 0x00);
    return this;
  }

  text(line = ""): this {
    this.pushText(line);
    this.chunks.push(LF);
    return this;
  }

  /** A full-width line of repeated characters, e.g. a "-" divider rule. */
  rule(char = "-"): this {
    return this.text(char.repeat(this.width));
  }

  /** Left-aligned label, right-aligned value, padded/wrapped to the paper width. */
  row(left: string, right: string): this {
    const space = this.width - left.length - right.length;
    if (space >= 1) {
      return this.text(left + " ".repeat(space) + right);
    }
    // Doesn't fit on one line — print label then value on its own
    // right-aligned line rather than truncating either silently.
    this.text(left);
    const pad = Math.max(0, this.width - right.length);
    return this.text(" ".repeat(pad) + right);
  }

  blank(lines = 1): this {
    for (let i = 0; i < lines; i++) this.chunks.push(LF);
    return this;
  }

  /** Feed n lines then partial-cut — the standard end-of-receipt sequence. */
  cut(): this {
    this.chunks.push(LF, LF, LF, LF);
    // GS V m — m=1 is partial cut (leaves a tab so the strip doesn't fully
    // detach), the conventional choice for receipts vs. full-sheet cutting.
    this.chunks.push(GS, 0x56, 0x01);
    return this;
  }

  toBytes(): Uint8Array {
    return Uint8Array.from(this.chunks);
  }
}

function money(amount: string, currencyCode: string): string {
  const value = Number(amount);
  const formatted = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  return `${currencyCode} ${formatted}`;
}

export type PrintableSale = {
  saleNumber: string;
  companyName: string;
  branchName: string;
  customerName: string | null;
  createdAt: string;
  status: string;
  voidReason: string | null;
  currency: string;
  lineItems: { productName: string; quantity: number; unitPriceAtSale: string; lineTotal: string }[];
  subtotal: string;
  grandTotal: string;
  amountPaid: string;
  creditedTotal: string;
  outstanding: string;
};

export function buildInvoiceReceipt(sale: PrintableSale, paperSize: PaperSize = "58mm"): Uint8Array {
  const width = PAPER_WIDTH_CHARS[paperSize];
  const b = new ReceiptBuilder(width);

  b.align("center").bold(true).doubleHeight(true).text(sale.companyName).doubleHeight(false).bold(false);
  b.text(sale.branchName);
  b.blank();
  b.bold(true).text("INVOICE").bold(false);
  b.text(sale.saleNumber);
  b.text(new Date(sale.createdAt).toLocaleString());
  b.rule();

  b.align("left");
  b.text(`Customer: ${sale.customerName ?? "Walk-in"}`);
  b.rule();

  for (const li of sale.lineItems) {
    b.text(`${li.productName} x${li.quantity}`);
    b.row("", money(li.lineTotal, sale.currency));
  }
  b.rule();

  b.row("Subtotal", money(sale.subtotal, sale.currency));
  b.bold(true).row("Total", money(sale.grandTotal, sale.currency)).bold(false);
  b.row("Paid", money(sale.amountPaid, sale.currency));
  if (Number(sale.creditedTotal) > 0) {
    b.row("Credited", money(sale.creditedTotal, sale.currency));
  }
  if (Number(sale.outstanding) > 0 && sale.status !== "VOIDED") {
    b.bold(true).row("Balance due", money(sale.outstanding, sale.currency)).bold(false);
  }

  if (sale.status === "VOIDED") {
    b.blank();
    b.align("center").bold(true).text("*** VOIDED ***").bold(false);
    if (sale.voidReason) b.text(sale.voidReason);
  }

  b.blank();
  b.align("center").text("Thank you for your business.");
  b.cut();

  return b.toBytes();
}

export type PrintableCreditNote = {
  creditNoteNumber: string;
  companyName: string;
  saleNumber: string;
  customerName: string | null;
  createdAt: string;
  currency: string;
  amount: string;
  reason: string;
  issuedByName: string;
  status: "ISSUED" | "VOIDED";
  voidReason: string | null;
};

export function buildCreditNoteReceipt(cn: PrintableCreditNote, paperSize: PaperSize = "58mm"): Uint8Array {
  const width = PAPER_WIDTH_CHARS[paperSize];
  const b = new ReceiptBuilder(width);

  b.align("center").bold(true).doubleHeight(true).text(cn.companyName).doubleHeight(false).bold(false);
  b.blank();
  b.bold(true).text("CREDIT NOTE").bold(false);
  b.text(cn.creditNoteNumber);
  b.text(new Date(cn.createdAt).toLocaleString());
  b.rule();

  b.align("left");
  b.text(`Against invoice: ${cn.saleNumber}`);
  b.text(`Customer: ${cn.customerName ?? "Walk-in"}`);
  b.text(`Issued by: ${cn.issuedByName}`);
  b.rule();
  b.text("Reason:");
  b.text(cn.reason);
  b.rule();
  b.bold(true).row("Credit amount", money(cn.amount, cn.currency)).bold(false);

  if (cn.status === "VOIDED") {
    b.blank();
    b.align("center").bold(true).text("*** VOIDED ***").bold(false);
    if (cn.voidReason) b.text(cn.voidReason);
  }

  b.blank(2);
  b.cut();

  return b.toBytes();
}
