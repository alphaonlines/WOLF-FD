export const ymd = (d: Date) => d.toISOString().slice(0, 10);

export const addDaysYmd = (dateYmd: string, days: number) => {
  const d = new Date(`${dateYmd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return ymd(d);
};

export const startOfMonthYmd = (year: number, monthIndex0: number) =>
  ymd(new Date(Date.UTC(year, monthIndex0, 1)));

export const getMonthRange = (yearMonth: string): { start: string; endExclusive: string } => {
  const [y, m] = yearMonth.split("-").map((n) => Number(n));
  const start = startOfMonthYmd(y, m - 1);
  const endExclusive = startOfMonthYmd(y, m);
  return { start, endExclusive };
};

export const getYearRange = (year: number): { start: string; endExclusive: string } => {
  const start = ymd(new Date(Date.UTC(year, 0, 1)));
  const endExclusive = ymd(new Date(Date.UTC(year + 1, 0, 1)));
  return { start, endExclusive };
};

export const getSimplifiedRange = (
  year: number,
  month: string,
  day: string
): { start: string; endExclusive: string } | null => {
  if (!year) return null;
  if (month === "ALL") return getYearRange(year);
  const ym = `${year}-${month.padStart(2, "0")}`;
  if (day === "ALL") return getMonthRange(ym);
  const start = `${ym}-${day.padStart(2, "0")}`;
  return { start, endExclusive: addDaysYmd(start, 1) };
};

export const pctOf = (value: number, total: number) => (total > 0 ? (value / total) * 100 : 0);

export const pctChange = (current: number, previous: number) => {
  if (!Number.isFinite(current)) return 0;
  if (!Number.isFinite(previous) || previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
};

export const monthOptions = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
export const dayOptions = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"));

export const safeDiv = (n: number, d: number) => (Number.isFinite(n) && Number.isFinite(d) && d !== 0 ? n / d : 0);

export const formatShortDate = (value: string) => {
  if (!value) return "";
  const raw = String(value).slice(0, 10);
  const d = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return raw;
  const day = d.getUTCDate();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[d.getUTCMonth()];
  const year = String(d.getUTCFullYear() % 100).padStart(2, "0");
  return `${day} ${month} ${year}'`;
};

export const formatMonthLabel = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
};

export const formatDateLong = (value: string) => {
  if (!value) return "";
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
};

export const formatRangeLabel = (range: { start: string; endExclusive: string }) => {
  const endInclusive = addDaysYmd(range.endExclusive, -1);
  if (range.start === endInclusive) return formatDateLong(range.start);
  return `${formatDateLong(range.start)} – ${formatDateLong(endInclusive)}`;
};

export const salespersonLabel = (fullName: string) => {
  const s = String(fullName || "").trim();
  if (!s) return "UNK";
  let first = "";
  let last = "";
  if (s.includes(",")) {
    const [l, f] = s.split(",").map((p) => p.trim());
    last = l || "";
    first = f || "";
  } else {
    const parts = s.split(/\s+/).filter(Boolean);
    if (parts.length > 0) first = parts[0];
    if (parts.length > 1) last = parts[parts.length - 1];
  }
  const initials = ((first[0] || "") + (last[0] || "")).toUpperCase();
  return initials || "UNK";
};
