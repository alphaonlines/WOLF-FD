import type { CRMLeadChannel } from "../types";

export type UpsPriority = "Hot" | "Today" | "Nurture";
export type UpsLane = "Unattended" | "Be-Back" | "Quote Follow-up";

export type UpsItem = {
  id: string;
  customer: string;
  task: string;
  owner: string;
  lane: UpsLane;
  priority: UpsPriority;
  dueAt: string;
  channel: CRMLeadChannel;
  done: boolean;
  startedAt?: string;
};

export const UPS_LANES: UpsLane[] = ["Unattended", "Be-Back", "Quote Follow-up"];
export const UPS_PRIORITIES: UpsPriority[] = ["Hot", "Today", "Nurture"];
export const LEAD_CHANNELS: CRMLeadChannel[] = ["SMS", "Webchat", "Facebook", "Instagram", "Phone"];

export const upsPriorityClass = (priority: UpsPriority) => {
  if (priority === "Hot") return "border-rose-200 bg-rose-50 text-rose-700";
  if (priority === "Today") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-blue-200 bg-blue-50 text-blue-700";
};

export const upsLaneClass = (lane: UpsLane) => {
  if (lane === "Unattended") return "border-violet-200 bg-violet-50 text-violet-700";
  if (lane === "Quote Follow-up") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
};

export const priorityRank: Record<UpsPriority, number> = {
  Hot: 0,
  Today: 1,
  Nurture: 2,
};

const isUpsLane = (value: unknown): value is UpsLane => typeof value === "string" && UPS_LANES.includes(value as UpsLane);
const isUpsPriority = (value: unknown): value is UpsPriority =>
  typeof value === "string" && UPS_PRIORITIES.includes(value as UpsPriority);
const isLeadChannel = (value: unknown): value is CRMLeadChannel =>
  typeof value === "string" && LEAD_CHANNELS.includes(value as CRMLeadChannel);

export const normalizeUpsList = (raw: unknown, fallback: UpsItem[], todayIso: () => string): UpsItem[] => {
  if (!Array.isArray(raw) || !raw.length) return fallback;

  const normalized = raw
    .map((entry, index): UpsItem | null => {
      if (!entry || typeof entry !== "object") return null;
      const item = entry as Record<string, unknown>;
      const legacyTitle = typeof item.title === "string" ? item.title.trim() : "";
      const customer =
        typeof item.customer === "string" && item.customer.trim()
          ? item.customer.trim()
          : legacyTitle || `Lead ${index + 1}`;
      const task =
        typeof item.task === "string" && item.task.trim()
          ? item.task.trim()
          : legacyTitle || "Follow up";
      const owner = typeof item.owner === "string" && item.owner.trim() ? item.owner.trim() : "Unassigned";
      const lane = isUpsLane(item.lane) ? item.lane : "Unattended";
      const priority = isUpsPriority(item.priority) ? item.priority : "Today";
      const dueAt =
        typeof item.dueAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.dueAt)
          ? item.dueAt
          : todayIso();
      const channel = isLeadChannel(item.channel) ? item.channel : "SMS";
      const done = item.done === true;
      const startedAt =
        typeof item.startedAt === "string" && item.startedAt.trim()
          ? item.startedAt
          : undefined;
      const id =
        typeof item.id === "string" && item.id.trim()
          ? item.id
          : `ups-${Date.now()}-${index}`;

      const normalizedItem: UpsItem = {
        id,
        customer,
        task,
        owner,
        lane,
        priority,
        dueAt,
        channel,
        done,
      };
      if (startedAt) normalizedItem.startedAt = startedAt;
      return normalizedItem;
    })
    .filter((item): item is UpsItem => item !== null);

  return normalized.length ? normalized : fallback;
};
