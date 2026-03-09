import { getPosApiBaseUrl } from "./posBackendApi";

export type SocialPlatform = "facebook" | "instagram" | "google";
export type SocialPostStatus = "draft" | "scheduled" | "publishing" | "published" | "failed";

export type SocialAsset = {
  id: string;
  originalName: string;
  mimeType: string;
  fileSizeBytes: number;
  assetKind: "image" | "video" | "gif" | string;
  publicUrl: string;
  createdAt: string;
};

export type SocialAccount = {
  id: string;
  platform: SocialPlatform;
  label: string;
  externalId: string;
  accessTokenConfigured: boolean;
  tokenPreview: string;
  refreshTokenConfigured: boolean;
  tokenExpiresAt: string | null;
  active: boolean;
  configJson: Record<string, any>;
  createdAt: string;
  updatedAt: string;
};

export type SocialPublishJob = {
  id: string;
  postId: string;
  platform: SocialPlatform;
  accountId: string | null;
  status: string;
  scheduledFor: string;
  attemptCount: number;
  providerPostId: string | null;
  lastError: string;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SocialPostRecord = {
  id: string;
  title: string;
  caption: string;
  status: SocialPostStatus;
  scheduledFor: string | null;
  timezone: string;
  linkUrl: string;
  ctaLabel: string;
  googleTopicType: string;
  googleEventTitle: string;
  googleEventStart: string | null;
  googleEventEnd: string | null;
  platforms: SocialPlatform[];
  platformAccountIds: Partial<Record<SocialPlatform, string>>;
  asset: SocialAsset | null;
  publishedAt: string | null;
  lastError: string;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  jobs: SocialPublishJob[];
};

export type SocialPostPayload = {
  title: string;
  caption: string;
  status?: SocialPostStatus;
  scheduledFor?: string | null;
  timezone?: string;
  linkUrl?: string;
  ctaLabel?: string;
  googleTopicType?: string;
  googleEventTitle?: string;
  googleEventStart?: string | null;
  googleEventEnd?: string | null;
  platforms?: SocialPlatform[];
  platformAccountIds?: Partial<Record<SocialPlatform, string>>;
  assetId?: string | null;
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
    const message = await res.text().catch(() => "");
    throw new Error(message || `POS API ${res.status} for ${path}`);
  }
  return res.json();
}

export async function fetchSocialPosts(filters?: { status?: string; platform?: string; q?: string }) {
  const qs = new URLSearchParams();
  if (filters?.status) qs.set("status", filters.status);
  if (filters?.platform) qs.set("platform", filters.platform);
  if (filters?.q) qs.set("q", filters.q);
  const json = await fetchJson(`/api/social/posts${qs.toString() ? `?${qs.toString()}` : ""}`);
  return Array.isArray(json?.rows) ? (json.rows as SocialPostRecord[]) : [];
}

export async function fetchSocialAccounts() {
  const json = await fetchJson("/api/social/accounts");
  return Array.isArray(json?.rows) ? (json.rows as SocialAccount[]) : [];
}

export async function upsertSocialAccount(payload: {
  id?: string | null;
  platform: SocialPlatform;
  label: string;
  externalId: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: string | null;
  active: boolean;
  configJson?: Record<string, any>;
}) {
  const json = await fetchJson(`/api/social/accounts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return (json?.row || null) as SocialAccount | null;
}

export async function uploadSocialAsset(file: File) {
  const baseUrl = getPosApiBaseUrl();
  const form = new FormData();
  form.append("file", file, file.name);
  const res = await fetch(`${baseUrl}/api/social/assets`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  if (!res.ok) {
    const message = await res.text().catch(() => "");
    throw new Error(message || `Upload failed with ${res.status}`);
  }
  const json = await res.json();
  return (json?.row || null) as SocialAsset | null;
}

export async function createSocialPost(payload: SocialPostPayload) {
  const json = await fetchJson("/api/social/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return (json?.row || null) as SocialPostRecord | null;
}

export async function updateSocialPost(id: string, payload: Partial<SocialPostPayload> & { status?: SocialPostStatus }) {
  const json = await fetchJson(`/api/social/posts/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return (json?.row || null) as SocialPostRecord | null;
}

export async function scheduleSocialPost(id: string, payload: {
  scheduledFor: string;
  platforms: SocialPlatform[];
  platformAccountIds?: Partial<Record<SocialPlatform, string>>;
}) {
  const json = await fetchJson(`/api/social/posts/${encodeURIComponent(id)}/schedule`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return (json?.row || null) as SocialPostRecord | null;
}

export async function publishSocialPostNow(id: string, payload: {
  platforms: SocialPlatform[];
  platformAccountIds?: Partial<Record<SocialPlatform, string>>;
}) {
  const json = await fetchJson(`/api/social/posts/${encodeURIComponent(id)}/publish-now`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return (json?.row || null) as SocialPostRecord | null;
}

export async function cancelSocialPost(id: string) {
  const json = await fetchJson(`/api/social/posts/${encodeURIComponent(id)}/cancel`, {
    method: "POST",
  });
  return (json?.row || null) as SocialPostRecord | null;
}
