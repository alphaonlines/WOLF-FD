import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  FileText,
  Mic,
  MonitorUp,
  Pause,
  Play,
  RefreshCw,
  Save,
  Square,
  Trash2,
} from "lucide-react";
import type { AuthUser } from "../types";
import {
  createDenRecording,
  deleteDenRecording,
  fetchDenRecording,
  finishDenRecording,
  getDenRecordingAudioUrl,
  listDenRecordings,
  summarizeDenRecording,
  updateDenRecording,
  uploadDenRecordingChunk,
  type DenRecording,
  type DenRecordingSourceType,
  type DenRecordingSummary,
} from "../services/denRecordingsApi";

type DenRecorderProps = {
  authUser: AuthUser;
  isDarkMode: boolean;
};

type RecorderState = "idle" | "recording" | "paused" | "finishing";

const SUMMARY_KEYS: Array<{ key: keyof DenRecordingSummary; label: string }> = [
  { key: "planIdeas", label: "Plan / Ideas" },
  { key: "decisions", label: "Decisions" },
  { key: "actionItems", label: "Action Items" },
  { key: "risksQuestions", label: "Risks / Questions" },
  { key: "followUps", label: "Follow-ups" },
];

function formatDuration(totalSeconds: number) {
  const safe = Math.max(Math.floor(totalSeconds || 0), 0);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function defaultTitle() {
  return `Den recording ${new Date().toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function normalizeSummaryList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item || "").trim()).filter(Boolean) : [];
}

const DenRecorder: React.FC<DenRecorderProps> = ({ authUser, isDarkMode }) => {
  const [recordings, setRecordings] = useState<DenRecording[]>([]);
  const [selected, setSelected] = useState<DenRecording | null>(null);
  const [title, setTitle] = useState(defaultTitle);
  const [sourceType, setSourceType] = useState<DenRecordingSourceType>("mic");
  const [recorderState, setRecorderState] = useState<RecorderState>("idle");
  const [elapsedSec, setElapsedSec] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [savingEdits, setSavingEdits] = useState(false);
  const [draftTranscript, setDraftTranscript] = useState("");
  const [draftNotes, setDraftNotes] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingIdRef = useRef<string>("");
  const startedAtRef = useRef<number>(0);
  const chunkIndexRef = useRef(0);
  const uploadChainRef = useRef<Promise<void>>(Promise.resolve());

  const panel = isDarkMode ? "border-slate-800 bg-[#121b27] text-slate-100" : "border-slate-200 bg-white text-slate-900";
  const softPanel = isDarkMode ? "border-slate-800 bg-slate-950/35" : "border-slate-200 bg-slate-50";
  const muted = isDarkMode ? "text-slate-400" : "text-slate-500";
  const field = isDarkMode
    ? "border-slate-700 bg-slate-950/60 text-slate-100 placeholder:text-slate-500"
    : "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400";

  const loadRecordings = useCallback(async () => {
    const rows = await listDenRecordings();
    setRecordings(rows);
    setSelected((current) => {
      if (!current) return rows[0] || null;
      return rows.find((row) => row.id === current.id) || rows[0] || null;
    });
  }, []);

  useEffect(() => {
    void loadRecordings().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Unable to load recordings.");
    });
  }, [loadRecordings]);

  useEffect(() => {
    setDraftTranscript(selected?.transcriptText || "");
    setDraftNotes(selected?.notes || "");
  }, [selected?.id, selected?.transcriptText, selected?.notes]);

  useEffect(() => {
    if (recorderState !== "recording") return;
    const timer = window.setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 500);
    return () => window.clearInterval(timer);
  }, [recorderState]);

  useEffect(() => {
    if (!selected || !["uploaded", "transcribing", "summarizing"].includes(selected.status)) return;
    const timer = window.setInterval(() => {
      void fetchDenRecording(selected.id)
        .then((row) => {
          setSelected(row);
          setRecordings((rows) => rows.map((item) => (item.id === row.id ? row : item)));
        })
        .catch(() => undefined);
    }, 3500);
    return () => window.clearInterval(timer);
  }, [selected]);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const uploadChunk = (blob: Blob) => {
    const recordingId = recordingIdRef.current;
    if (!recordingId || !blob.size) return;
    const index = chunkIndexRef.current;
    chunkIndexRef.current += 1;
    uploadChainRef.current = uploadChainRef.current.then(() =>
      uploadDenRecordingChunk({ recordingId, chunk: blob, index })
    );
  };

  const startRecording = async () => {
    setError("");
    setMessage("");
    const nextTitle = title.trim() || defaultTitle();
    setTitle(nextTitle);
    try {
      const stream =
        sourceType === "mic"
          ? await navigator.mediaDevices.getUserMedia({ audio: true })
          : await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      const audioTracks = stream.getAudioTracks();
      if (!audioTracks.length) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error("No audio track was shared.");
      }

      const created = await createDenRecording({ title: nextTitle, sourceType });
      recordingIdRef.current = created.id;
      chunkIndexRef.current = 0;
      uploadChainRef.current = Promise.resolve();
      streamRef.current = stream;
      const audioOnlyStream = new MediaStream(audioTracks);
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      const recorder = new MediaRecorder(audioOnlyStream, { mimeType });
      mediaRecorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setElapsedSec(0);

      recorder.ondataavailable = (event) => uploadChunk(event.data);
      recorder.onerror = () => setError("The browser recorder stopped unexpectedly.");
      recorder.onstop = () => stopStream();
      recorder.start(30000);
      setRecorderState("recording");
      setSelected(created);
      setRecordings((rows) => [created, ...rows]);
    } catch (startError) {
      stopStream();
      setRecorderState("idle");
      setError(startError instanceof Error ? startError.message : "Unable to start recording.");
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.pause();
      setRecorderState("paused");
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current?.state === "paused") {
      mediaRecorderRef.current.resume();
      startedAtRef.current = Date.now() - elapsedSec * 1000;
      setRecorderState("recording");
    }
  };

  const stopRecording = async () => {
    const recorder = mediaRecorderRef.current;
    const recordingId = recordingIdRef.current;
    if (!recorder || !recordingId) return;
    setRecorderState("finishing");
    setMessage("Saving recording...");
    try {
      if (recorder.state !== "inactive") {
        const stopped = new Promise<void>((resolve) => {
          const priorOnStop = recorder.onstop;
          recorder.onstop = (event) => {
            if (typeof priorOnStop === "function") priorOnStop.call(recorder, event);
            resolve();
          };
        });
        recorder.requestData();
        recorder.stop();
        await stopped;
      }
      await uploadChainRef.current;
      const finished = await finishDenRecording({ recordingId, durationSec: elapsedSec });
      setSelected(finished);
      setRecordings((rows) => rows.map((row) => (row.id === finished.id ? finished : row)));
      setMessage("Saved. Transcription will appear here when it is ready.");
      setTitle(defaultTitle());
    } catch (stopError) {
      setError(stopError instanceof Error ? stopError.message : "Unable to finish recording.");
    } finally {
      mediaRecorderRef.current = null;
      recordingIdRef.current = "";
      setRecorderState("idle");
      stopStream();
      void loadRecordings();
    }
  };

  const saveSelectedEdits = async () => {
    if (!selected) return;
    setSavingEdits(true);
    setError("");
    try {
      const updated = await updateDenRecording(selected.id, {
        title: selected.title,
        transcriptText: draftTranscript,
        notes: draftNotes,
      });
      setSelected(updated);
      setRecordings((rows) => rows.map((row) => (row.id === updated.id ? updated : row)));
      setMessage("Saved notes.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save notes.");
    } finally {
      setSavingEdits(false);
    }
  };

  const rerunSummary = async () => {
    if (!selected) return;
    setError("");
    try {
      await summarizeDenRecording(selected.id);
      const updated = await fetchDenRecording(selected.id);
      setSelected(updated);
      setRecordings((rows) => rows.map((row) => (row.id === updated.id ? updated : row)));
      setMessage("Summary queued.");
    } catch (summaryError) {
      setError(summaryError instanceof Error ? summaryError.message : "Unable to summarize recording.");
    }
  };

  const removeSelected = async () => {
    if (!selected) return;
    setError("");
    try {
      await deleteDenRecording(selected.id);
      const nextRows = recordings.filter((row) => row.id !== selected.id);
      setRecordings(nextRows);
      setSelected(nextRows[0] || null);
      setMessage("Recording deleted.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete recording.");
    }
  };

  const summary = selected?.summary || {};
  const canSave = !!selected && (draftTranscript !== selected.transcriptText || draftNotes !== selected.notes);
  const currentUserLabel = useMemo(() => authUser.name || authUser.email || "Current user", [authUser]);

  return (
    <div className={`h-full overflow-auto ${isDarkMode ? "bg-[#0c131d]" : "bg-slate-50"}`}>
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-5 lg:px-7">
        <div className={`border ${panel} rounded-lg p-4`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className={`text-xs font-bold uppercase tracking-wide ${muted}`}>Den Recorder</div>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className={`mt-2 w-full rounded-lg border px-3 py-2 text-lg font-semibold outline-none focus:border-amber-400 ${field}`}
                placeholder="Recording title"
                disabled={recorderState !== "idle"}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSourceType("mic")}
                disabled={recorderState !== "idle"}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${
                  sourceType === "mic"
                    ? "border-amber-400 bg-amber-500/15 text-amber-600"
                    : isDarkMode
                    ? "border-slate-700 text-slate-300"
                    : "border-slate-200 text-slate-600"
                }`}
              >
                <Mic size={16} /> Mic
              </button>
              <button
                type="button"
                onClick={() => setSourceType("display")}
                disabled={recorderState !== "idle"}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${
                  sourceType === "display"
                    ? "border-amber-400 bg-amber-500/15 text-amber-600"
                    : isDarkMode
                    ? "border-slate-700 text-slate-300"
                    : "border-slate-200 text-slate-600"
                }`}
              >
                <MonitorUp size={16} /> Tab Audio
              </button>
              {recorderState === "idle" && (
                <button
                  type="button"
                  onClick={() => void startRecording()}
                  className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700"
                >
                  <Play size={16} /> Record
                </button>
              )}
              {recorderState === "recording" && (
                <button
                  type="button"
                  onClick={pauseRecording}
                  className="inline-flex items-center gap-2 rounded-lg border border-amber-400 bg-amber-500/15 px-4 py-2 text-sm font-bold text-amber-600"
                >
                  <Pause size={16} /> Pause
                </button>
              )}
              {recorderState === "paused" && (
                <button
                  type="button"
                  onClick={resumeRecording}
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-400 bg-emerald-500/15 px-4 py-2 text-sm font-bold text-emerald-600"
                >
                  <Play size={16} /> Resume
                </button>
              )}
              {recorderState !== "idle" && (
                <button
                  type="button"
                  onClick={() => void stopRecording()}
                  disabled={recorderState === "finishing"}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                >
                  <Square size={16} /> Stop
                </button>
              )}
            </div>
          </div>
          <div className={`mt-3 flex flex-wrap items-center gap-3 text-sm ${muted}`}>
            <span>{currentUserLabel}</span>
            <span>{formatDuration(elapsedSec)}</span>
            <span className="capitalize">{recorderState}</span>
            {message && <span className={isDarkMode ? "text-emerald-300" : "text-emerald-700"}>{message}</span>}
            {error && (
              <span className="inline-flex items-center gap-1 text-rose-500">
                <AlertCircle size={14} /> {error}
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className={`border ${panel} rounded-lg`}>
            <div className="flex items-center justify-between border-b border-inherit px-4 py-3">
              <div className="font-semibold">Recordings</div>
              <button
                type="button"
                onClick={() => void loadRecordings()}
                className={`rounded-lg p-2 ${isDarkMode ? "hover:bg-slate-800" : "hover:bg-slate-100"}`}
                aria-label="Refresh recordings"
              >
                <RefreshCw size={16} />
              </button>
            </div>
            <div className="max-h-[660px] overflow-auto p-2">
              {recordings.map((recording) => (
                <button
                  type="button"
                  key={recording.id}
                  onClick={() => setSelected(recording)}
                  className={`mb-2 w-full rounded-lg border p-3 text-left transition ${
                    selected?.id === recording.id
                      ? isDarkMode
                        ? "border-amber-500/40 bg-amber-500/10"
                        : "border-amber-200 bg-amber-50"
                      : isDarkMode
                      ? "border-slate-800 bg-slate-950/25 hover:bg-slate-900"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="line-clamp-2 text-sm font-bold">{recording.title}</div>
                  <div className={`mt-2 flex items-center justify-between text-xs ${muted}`}>
                    <span>{new Date(recording.createdAt).toLocaleDateString()}</span>
                    <span className="capitalize">{recording.status}</span>
                  </div>
                </button>
              ))}
              {!recordings.length && <div className={`p-4 text-sm ${muted}`}>No recordings yet.</div>}
            </div>
          </div>

          <div className={`border ${panel} rounded-lg p-4`}>
            {selected ? (
              <div className="space-y-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <input
                      value={selected.title}
                      onChange={(event) => setSelected({ ...selected, title: event.target.value })}
                      className={`w-full rounded-lg border px-3 py-2 text-xl font-bold outline-none focus:border-amber-400 ${field}`}
                    />
                    <div className={`mt-2 flex flex-wrap gap-3 text-sm ${muted}`}>
                      <span className="capitalize">{selected.sourceType}</span>
                      <span>{formatDuration(selected.durationSec)}</span>
                      <span className="capitalize">{selected.status}</span>
                      {selected.modelName && <span>{selected.modelName}</span>}
                    </div>
                    {selected.fileSizeBytes > 0 && (
                      <audio
                        className="mt-3 w-full max-w-xl"
                        controls
                        src={getDenRecordingAudioUrl(selected.id)}
                      />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void saveSelectedEdits()}
                      disabled={!canSave || savingEdits}
                      className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-sm font-bold text-slate-950 disabled:opacity-50"
                    >
                      <Save size={16} /> Save
                    </button>
                    <button
                      type="button"
                      onClick={() => void rerunSummary()}
                      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold ${
                        isDarkMode ? "border-slate-700 text-slate-200" : "border-slate-200 text-slate-700"
                      }`}
                    >
                      <RefreshCw size={16} /> Summarize
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeSelected()}
                      className="inline-flex items-center gap-2 rounded-lg border border-rose-300 px-3 py-2 text-sm font-bold text-rose-600"
                    >
                      <Trash2 size={16} /> Delete
                    </button>
                  </div>
                </div>

                {selected.errorMessage && (
                  <div className="rounded-lg border border-rose-300 bg-rose-500/10 p-3 text-sm text-rose-600">
                    {selected.errorMessage}
                  </div>
                )}

                <div className={`border ${softPanel} rounded-lg p-4`}>
                  <div className="mb-2 flex items-center gap-2 font-semibold">
                    <FileText size={16} /> Summary
                  </div>
                  <p className={`text-sm leading-6 ${muted}`}>
                    {summary.cleanSummary || "Summary will appear after transcription and Ollama processing."}
                  </p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {SUMMARY_KEYS.map(({ key, label }) => {
                      const values = normalizeSummaryList(summary[key]);
                      return (
                        <div key={key} className={`rounded-lg border p-3 ${isDarkMode ? "border-slate-800" : "border-slate-200 bg-white"}`}>
                          <div className="text-sm font-bold">{label}</div>
                          <ul className={`mt-2 space-y-1 text-sm ${muted}`}>
                            {values.map((value, index) => (
                              <li key={`${key}-${index}`}>{value}</li>
                            ))}
                            {!values.length && <li>None yet.</li>}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold">Transcript</span>
                    <textarea
                      value={draftTranscript}
                      onChange={(event) => setDraftTranscript(event.target.value)}
                      className={`min-h-[280px] w-full rounded-lg border p-3 text-sm leading-6 outline-none focus:border-amber-400 ${field}`}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold">Notes</span>
                    <textarea
                      value={draftNotes}
                      onChange={(event) => setDraftNotes(event.target.value)}
                      className={`min-h-[280px] w-full rounded-lg border p-3 text-sm leading-6 outline-none focus:border-amber-400 ${field}`}
                    />
                  </label>
                </div>
              </div>
            ) : (
              <div className={`flex min-h-[420px] items-center justify-center text-sm ${muted}`}>Select or create a recording.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DenRecorder;
