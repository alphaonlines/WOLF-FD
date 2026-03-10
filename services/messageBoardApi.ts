import type { BoardMessage, BoardUpload, BoardUser } from "../types";
import { getPosApiBaseUrl } from "./posBackendApi";

type ApiChannelRow = {
  id?: string;
  name?: string;
  is_private?: boolean;
  count?: number;
};

type ApiUserRow = {
  id?: string | number;
  name?: string;
  email?: string;
  roles?: string[];
  active?: boolean;
  last_message_at?: string | null;
  last_message_preview?: string | null;
};

type ApiUploadRow = {
  id?: string | number;
  originalName?: string;
  original_name?: string;
  mimeType?: string;
  mime_type?: string;
  fileSizeBytes?: number;
  file_size_bytes?: number;
  publicUrl?: string;
  public_url?: string;
  createdAt?: string;
  created_at?: string;
};

type ApiMessageRow = {
  id?: string | number;
  scope?: string;
  channel?: string | null;
  body?: string;
  priority?: boolean;
  authorName?: string;
  author_name?: string;
  authorEmail?: string;
  author_email?: string;
  authorUserId?: string | number | null;
  author_user_id?: string | number | null;
  recipientUserId?: string | number | null;
  recipient_user_id?: string | number | null;
  recipientName?: string;
  recipient_name?: string;
  recipientEmail?: string;
  recipient_email?: string;
  attachment?: ApiUploadRow | null;
  mentions?: string[];
  editedAt?: string | null;
  edited_at?: string | null;
  deletedAt?: string | null;
  deleted_at?: string | null;
  forwardedFromMessageId?: string | number | null;
  forwarded_from_message_id?: string | number | null;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
};

export type BoardChannel = {
  id: string;
  name: string;
  isPrivate: boolean;
  count: number;
};

async function fetchJson(path: string, init?: RequestInit): Promise<any> {
  const baseUrl = getPosApiBaseUrl();
  const url = `${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
  const res = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`POS API ${res.status} for ${path}${msg ? `: ${msg}` : ""}`);
  }
  return res.json();
}

function mapUpload(row: ApiUploadRow | null | undefined): BoardUpload | null {
  if (!row) return null;
  return {
    id: String(row.id ?? ""),
    originalName: String(row.originalName ?? row.original_name ?? ""),
    mimeType: String(row.mimeType ?? row.mime_type ?? "application/octet-stream"),
    fileSizeBytes: Number(row.fileSizeBytes ?? row.file_size_bytes ?? 0),
    publicUrl: String(row.publicUrl ?? row.public_url ?? ""),
    createdAt: String(row.createdAt ?? row.created_at ?? ""),
  };
}

function mapMessage(row: ApiMessageRow): BoardMessage {
  return {
    id: String(row.id ?? ""),
    scope: String(row.scope ?? "channel") === "dm" ? "dm" : "channel",
    channel: row.channel == null ? null : String(row.channel),
    body: String(row.body ?? ""),
    priority: Boolean(row.priority),
    authorName: String(row.authorName ?? row.author_name ?? ""),
    authorEmail: String(row.authorEmail ?? row.author_email ?? ""),
    authorUserId:
      row.authorUserId == null && row.author_user_id == null
        ? null
        : String(row.authorUserId ?? row.author_user_id ?? ""),
    recipientUserId:
      row.recipientUserId == null && row.recipient_user_id == null
        ? null
        : String(row.recipientUserId ?? row.recipient_user_id ?? ""),
    recipientName: String(row.recipientName ?? row.recipient_name ?? ""),
    recipientEmail: String(row.recipientEmail ?? row.recipient_email ?? ""),
    attachment: mapUpload(row.attachment),
    mentions: Array.isArray(row.mentions) ? row.mentions.map((value) => String(value)) : [],
    editedAt: row.editedAt ?? row.edited_at ?? null,
    deletedAt: row.deletedAt ?? row.deleted_at ?? null,
    forwardedFromMessageId:
      row.forwardedFromMessageId == null && row.forwarded_from_message_id == null
        ? null
        : String(row.forwardedFromMessageId ?? row.forwarded_from_message_id ?? ""),
    createdAt: String(row.createdAt ?? row.created_at ?? ""),
    updatedAt: String(row.updatedAt ?? row.updated_at ?? ""),
  };
}

export async function fetchBoardChannels(): Promise<BoardChannel[]> {
  const json = await fetchJson("/api/board/channels");
  const rows = Array.isArray((json as any)?.rows) ? (json as any).rows : [];
  return rows.map((row: ApiChannelRow) => ({
    id: String(row.id ?? "announcements"),
    name: String(row.name ?? row.id ?? "announcements"),
    isPrivate: Boolean(row.is_private),
    count: Number(row.count ?? 0),
  }));
}

export async function fetchBoardUsers(): Promise<BoardUser[]> {
  const json = await fetchJson("/api/board/users");
  const rows = Array.isArray((json as any)?.rows) ? (json as any).rows : [];
  return rows.map((row: ApiUserRow) => ({
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    email: String(row.email ?? ""),
    roles: Array.isArray(row.roles) ? row.roles.map((role) => String(role)) as BoardUser["roles"] : [],
    active: Boolean(row.active),
    lastMessageAt: row.last_message_at ?? null,
    lastMessagePreview: String(row.last_message_preview ?? ""),
  }));
}

export async function fetchBoardMessages(input: { scope: "channel" | "dm"; channel?: string; userId?: string }): Promise<BoardMessage[]> {
  const qs = new URLSearchParams({ scope: input.scope });
  if (input.scope === "channel") qs.set("channel", String(input.channel || "announcements"));
  if (input.scope === "dm") qs.set("userId", String(input.userId || ""));
  const json = await fetchJson(`/api/board/messages?${qs.toString()}`);
  const rows = Array.isArray((json as any)?.rows) ? (json as any).rows : [];
  return rows.map((row: ApiMessageRow) => mapMessage(row));
}

export async function createBoardMessage(input: {
  scope: "channel" | "dm";
  channel?: string;
  recipientUserId?: string;
  body: string;
  priority?: boolean;
  attachmentUploadId?: string | null;
}): Promise<BoardMessage> {
  const json = await fetchJson("/api/board/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scope: input.scope,
      channel: input.channel,
      recipientUserId: input.recipientUserId,
      body: input.body,
      priority: Boolean(input.priority),
      attachmentUploadId: input.attachmentUploadId || null,
    }),
  });
  return mapMessage((json as any)?.row || {});
}

export async function updateBoardMessage(messageId: string, patch: { body: string; priority?: boolean }): Promise<BoardMessage> {
  const json = await fetchJson(`/api/board/messages/${encodeURIComponent(messageId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      body: patch.body,
      priority: Boolean(patch.priority),
    }),
  });
  return mapMessage((json as any)?.row || {});
}

export async function deleteBoardMessage(messageId: string): Promise<void> {
  await fetchJson(`/api/board/messages/${encodeURIComponent(messageId)}`, {
    method: "DELETE",
  });
}

export async function forwardBoardMessage(
  messageId: string,
  target: { scope: "channel" | "dm"; channel?: string; recipientUserId?: string }
): Promise<BoardMessage> {
  const json = await fetchJson(`/api/board/messages/${encodeURIComponent(messageId)}/forward`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(target),
  });
  return mapMessage((json as any)?.row || {});
}

export async function uploadBoardAttachment(file: File): Promise<BoardUpload> {
  const baseUrl = getPosApiBaseUrl();
  const form = new FormData();
  form.append("file", file, file.name);
  const res = await fetch(`${baseUrl}/api/board/uploads`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(msg || `Upload failed with ${res.status}`);
  }
  const json = await res.json();
  const upload = mapUpload((json as any)?.row || null);
  if (!upload) throw new Error("Upload did not return a file.");
  return upload;
}
