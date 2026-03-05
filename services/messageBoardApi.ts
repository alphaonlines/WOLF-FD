import type { BoardComment, BoardPost } from "../types";
import { getPosApiBaseUrl } from "./posBackendApi";

type ApiChannelRow = {
  id?: string;
  name?: string;
  is_private?: boolean;
  count?: number;
};

type ApiPostRow = {
  id?: string | number;
  channel?: string;
  body?: string;
  priority?: boolean;
  author_name?: string;
  author_email?: string;
  created_at?: string;
};

type ApiCommentRow = {
  id?: string | number;
  post_id?: string | number;
  body?: string;
  author_name?: string;
  author_email?: string;
  created_at?: string;
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

export async function fetchBoardPosts(channel: string): Promise<BoardPost[]> {
  const json = await fetchJson(`/api/board/posts?channel=${encodeURIComponent(channel)}`);
  const rows = Array.isArray((json as any)?.rows) ? (json as any).rows : [];
  return rows.map((row: ApiPostRow) => ({
    id: String(row.id ?? ""),
    channel: String(row.channel ?? channel),
    body: String(row.body ?? ""),
    priority: Boolean(row.priority),
    authorName: String(row.author_name ?? ""),
    authorEmail: String(row.author_email ?? ""),
    createdAt: String(row.created_at ?? ""),
  }));
}

export async function createBoardPost(input: {
  channel: string;
  body: string;
  priority?: boolean;
}): Promise<void> {
  await fetchJson("/api/board/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      channel: input.channel,
      body: input.body,
      priority: Boolean(input.priority),
    }),
  });
}

export async function fetchBoardComments(postId: string): Promise<BoardComment[]> {
  const json = await fetchJson(`/api/board/posts/${encodeURIComponent(postId)}/comments`);
  const rows = Array.isArray((json as any)?.rows) ? (json as any).rows : [];
  return rows.map((row: ApiCommentRow) => ({
    id: String(row.id ?? ""),
    postId: String(row.post_id ?? postId),
    body: String(row.body ?? ""),
    authorName: String(row.author_name ?? ""),
    authorEmail: String(row.author_email ?? ""),
    createdAt: String(row.created_at ?? ""),
  }));
}

export async function createBoardComment(postId: string, body: string): Promise<void> {
  await fetchJson(`/api/board/posts/${encodeURIComponent(postId)}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
}
