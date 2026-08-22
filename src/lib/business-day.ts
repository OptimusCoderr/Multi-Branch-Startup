/**
 * Sale/Payment timestamps are stored in UTC, but "today's sales" and an
 * end-of-day report both mean the business's *local* day — a shop in Lagos
 * (UTC+1) closing at 9pm local time shouldn't have its last two hours of
 * sales land in "tomorrow's" report just because the server stores UTC.
 * Uses `Intl.DateTimeFormat`, built into the JS runtime, so this needs no
 * new dependency the way a full timezone library (date-fns-tz, luxon)
 * would.
 */
export type BusinessDay = {
  /** "YYYY-MM-DD" in the given timezone — the natural key for "which day is this." */
  dateKey: string;
  /** The UTC instant this business day starts (inclusive). */
  startUtc: Date;
  /** The UTC instant this business day ends (exclusive) — the next day's start. */
  endUtc: Date;
};

function dateKeyInTimezone(at: Date, timezone: string): string {
  // en-CA formats as YYYY-MM-DD directly, avoiding a manual part-reassembly.
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

/**
 * Resolves the business day `at` (default: now) falls into for `timezone`,
 * and that day's UTC boundaries. Works by bisecting: a local calendar day's
 * UTC start is always within +/-26 hours of the UTC midnight for the same
 * date key (no real-world UTC offset exceeds that), so a narrow linear scan
 * over minutes at the boundary is both simple and exact — this runs at
 * report-submission/sale-creation time, not in a hot loop, so the small
 * constant cost is irrelevant.
 */
// Start from UTC midnight for a date key and walk backward/forward in
// 15-minute steps (every real-world UTC offset is a multiple of 15
// minutes) until the timezone's date key actually flips — finds the exact
// UTC instant that local day begins, regardless of the zone's offset.
function startOfLocalDay(dateKey: string, timezone: string): Date {
  const STEP_MS = 15 * 60 * 1000;
  let start = new Date(`${dateKey}T00:00:00.000Z`);

  while (dateKeyInTimezone(new Date(start.getTime() - STEP_MS), timezone) === dateKey) {
    start = new Date(start.getTime() - STEP_MS);
  }
  while (dateKeyInTimezone(start, timezone) !== dateKey) {
    start = new Date(start.getTime() + STEP_MS);
  }

  return start;
}

function nextDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return next.toISOString().slice(0, 10);
}

export function resolveBusinessDay(timezone: string, at: Date = new Date()): BusinessDay {
  const dateKey = dateKeyInTimezone(at, timezone);
  // endUtc is the *next* local day's start — computed the same way as
  // startUtc rather than a naive +24h, so a DST-shortened/lengthened day
  // (23 or 25 real hours) still gets an exact boundary.
  return { dateKey, startUtc: startOfLocalDay(dateKey, timezone), endUtc: startOfLocalDay(nextDateKey(dateKey), timezone) };
}

/** For persisting `DailySalesReport.reportDate` — a plain UTC-midnight Date keyed off the business day, not a real instant. */
export function businessDayToDate(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}
