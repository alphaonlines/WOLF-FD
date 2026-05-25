import { getPosApiBaseUrl } from "./posBackendApi";

export type DenRecordingSourceType = "mic" | "display";

export type DenRecordingSummary = {
  cleanSummary?: string;
  planIdeas?: string[];
  decisions?: string[];
  actionItems?: string[];
  risksQuestions?: string[];
  followUps?: string[];
};

export type DenRecording = {
  id: string;
  ownerUserId: string;
  title: string;
  sourceType: DenRecordingSourceType;
  status: string;
  durationSec: number;
  mimeType: string;
  fileSizeBytes: number;
  transcriptText: string;
  summary: DenRecordingSummary;
  notes: string;
  modelProvider: string;
  modelName: string;
  errorMessage: string;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
};

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = getPosApiBaseUrl();
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(body || `Den recording API ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function listDenRecordings(): Promise<DenRecording[]> {
  const json = await requestJson<{ rows: DenRecording[] }>("/api/den-recordings");
  return Array.isArray(json.rows) ? json.rows : [];
}

export async function createDenRecording(params: {
  title: string;
  sourceType: DenRecordingSourceType;
}): Promise<DenRecording> {
  const json = await requestJson<{ row: DenRecording }>("/api/den-recordings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return json.row;
}

export async function uploadDenRecordingChunk(params: {
  recordingId: string;
  chunk: Blob;
  index: number;
}): Promise<void> {
  const form = new FormData();
  form.append("chunk", params.chunk, `chunk-${params.index}.webm`);
  form.append("index", String(params.index));
  const baseUrl = getPosApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/den-recordings/${params.recordingId}/chunks`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  if (!response.ok) {
    throw new Error(`Chunk upload failed: ${response.status}`);
  }
}

export async function finishDenRecording(params: {
  recordingId: string;
  durationSec: number;
}): Promise<DenRecording> {
  const json = await requestJson<{ row: DenRecording }>(`/api/den-recordings/${params.recordingId}/finish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ durationSec: params.durationSec }),
  });
  return json.row;
}

export async function fetchDenRecording(recordingId: string): Promise<DenRecording> {
  const json = await requestJson<{ row: DenRecording }>(`/api/den-recordings/${recordingId}`);
  return json.row;
}

export async function updateDenRecording(recordingId: string, params: {
  title?: string;
  transcriptText?: string;
  notes?: string;
}): Promise<DenRecording> {
  const json = await requestJson<{ row: DenRecording }>(`/api/den-recordings/${recordingId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return json.row;
}

export async function summarizeDenRecording(recordingId: string): Promise<void> {
  await requestJson(`/api/den-recordings/${recordingId}/summarize`, { method: "POST" });
}

export async function deleteDenRecording(recordingId: string): Promise<void> {
  await requestJson(`/api/den-recordings/${recordingId}`, { method: "DELETE" });
}

export function getDenRecordingAudioUrl(recordingId: string): string {
  const baseUrl = getPosApiBaseUrl();
  return `${baseUrl}/api/den-recordings/${recordingId}/audio`;
}
