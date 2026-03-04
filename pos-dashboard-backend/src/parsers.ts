export function parseDateParam(v: any, fallback: string) {
  if (!v || typeof v !== "string") return fallback;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return fallback;
  return v;
}

export function parseTextParam(v: any): string | null {
  if (!v || typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

export function parseTaskStatus(v: any): "TODO" | "IN_PROGRESS" | "DONE" | null {
  if (!v || typeof v !== "string") return null;
  const t = v.trim().toUpperCase();
  if (t === "TODO" || t === "IN_PROGRESS" || t === "DONE") return t;
  return null;
}

export function parseTaskPriority(v: any): "low" | "medium" | "high" | null {
  if (!v || typeof v !== "string") return null;
  const t = v.trim().toLowerCase();
  if (t === "low" || t === "medium" || t === "high") return t as any;
  return null;
}

export function parseTaskDeadline(v: any): string | null {
  if (v === null) return null;
  if (v === undefined) return null;
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  return t;
}

export function parseIntBody(v: any): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

export function parseTaskIdParam(v: any): number | null {
  if (!v || typeof v !== "string") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const id = Math.trunc(n);
  return id > 0 ? id : null;
}

export const CRM_STAGES = ["New", "Contacted", "Appointment", "Quoted", "Won", "Lost"] as const;
export const CRM_CHANNELS = ["SMS", "Webchat", "Facebook", "Instagram", "Phone"] as const;

export function parseCrmLeadId(v: any): string | null {
  if (!v || typeof v !== "string") return null;
  const id = v.trim();
  return id || null;
}

export function parseCrmStage(v: any): (typeof CRM_STAGES)[number] | null {
  if (!v || typeof v !== "string") return null;
  const t = v.trim();
  return CRM_STAGES.includes(t as any) ? (t as any) : null;
}

export function parseCrmChannel(v: any): (typeof CRM_CHANNELS)[number] | null {
  if (!v || typeof v !== "string") return null;
  const t = v.trim();
  return CRM_CHANNELS.includes(t as any) ? (t as any) : null;
}

export function parseCrmDate(v: any): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  return t;
}

export function parseCrmBool(v: any): boolean | null {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const t = v.trim().toLowerCase();
    if (t === "true") return true;
    if (t === "false") return false;
  }
  return null;
}
