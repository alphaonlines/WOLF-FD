import { getPosApiBaseUrl } from "./posBackendApi";

async function fetchJson(path: string, init?: RequestInit): Promise<any> {
  const baseUrl = getPosApiBaseUrl();
  const url = `${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
  const res = await fetch(url, {
    ...init,
    credentials: "include",
    headers: { Accept: "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) throw new Error(`API ${res.status} for ${path}`);
  return res.json();
}

export type VoteCounts = Record<string, Record<number, number>>;
export type UserVotes = Record<string, number>;

export async function fetchObjectionVotes(): Promise<{ votes: VoteCounts; userVotes: UserVotes }> {
  const json = await fetchJson("/api/objection-votes");
  return {
    votes: (json as any)?.votes ?? {},
    userVotes: (json as any)?.userVotes ?? {},
  };
}

export async function castObjectionVote(objectionId: string, rebuttalIndex: number): Promise<void> {
  await fetchJson("/api/objection-votes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ objectionId, rebuttalIndex }),
  });
}

export async function removeObjectionVote(objectionId: string): Promise<void> {
  await fetchJson(`/api/objection-votes/${encodeURIComponent(objectionId)}`, { method: "DELETE" });
}
