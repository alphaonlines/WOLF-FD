"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerDenRecordingRoutes = registerDenRecordingRoutes;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = require("crypto");
const multer_1 = __importDefault(require("multer"));
const runtimeConfig_1 = require("../runtimeConfig");
const SOURCE_TYPES = new Set(["mic", "display"]);
const MAX_CHUNK_BYTES = 75 * 1024 * 1024;
function authUserFromReq(req) {
    const user = req.authUser;
    return user?.id ? user : null;
}
function numericUserId(user) {
    const value = Number(user?.id);
    return Number.isFinite(value) ? value : null;
}
function isManager(user) {
    const roles = new Set((user?.roles || []).map((role) => String(role)));
    return roles.has("Owner") || roles.has("Manager");
}
function canUseDen(user) {
    if (!user)
        return false;
    if (isManager(user))
        return true;
    const permissions = new Set((user.permissions || []).map((permission) => String(permission)));
    return permissions.has("module.wolfden");
}
function recordingDir(root, recordingId) {
    return path_1.default.resolve(root, recordingId);
}
function ensureRecordingPath(root, recordingId, fileName) {
    const dir = recordingDir(root, recordingId);
    const resolved = path_1.default.resolve(dir, fileName);
    if (!resolved.startsWith(dir + path_1.default.sep)) {
        throw new Error("invalid recording path");
    }
    return resolved;
}
function sanitizeTitle(raw) {
    const title = typeof raw === "string" ? raw.trim() : "";
    return title.slice(0, 160) || `Den recording ${new Date().toLocaleString("en-US")}`;
}
function mapRecordingRow(row) {
    return {
        id: String(row.id),
        ownerUserId: String(row.owner_user_id),
        title: String(row.title || ""),
        sourceType: String(row.source_type || "mic"),
        status: String(row.status || "created"),
        durationSec: Number(row.duration_sec || 0),
        mimeType: row.mime_type ? String(row.mime_type) : "",
        fileSizeBytes: Number(row.file_size_bytes || 0),
        transcriptText: String(row.transcript_text || ""),
        summary: typeof row.summary_json === "object" && row.summary_json ? row.summary_json : {},
        notes: String(row.notes || ""),
        modelProvider: row.model_provider ? String(row.model_provider) : "",
        modelName: row.model_name ? String(row.model_name) : "",
        errorMessage: row.error_message ? String(row.error_message) : "",
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        finishedAt: row.finished_at,
    };
}
async function loadRecording(pool, recordingId) {
    const result = await pool.query("SELECT * FROM den_recordings WHERE id = $1 LIMIT 1", [recordingId]);
    return result.rows[0] || null;
}
function canAccessRecording(user, row) {
    if (!user || !row)
        return false;
    if (isManager(user))
        return true;
    const userId = numericUserId(user);
    return userId !== null && Number(row.owner_user_id) === userId;
}
async function addRecordingEvent(pool, recordingId, eventType, message, meta = {}) {
    await pool.query(`
      INSERT INTO den_recording_events (recording_id, event_type, message, meta_json, created_at)
      VALUES ($1, $2, $3, $4::jsonb, now())
    `, [recordingId, eventType, message, meta]).catch(() => undefined);
}
function extractWhisperText(payload) {
    if (!payload)
        return "";
    if (typeof payload === "string")
        return payload.trim();
    if (typeof payload.text === "string")
        return payload.text.trim();
    if (typeof payload.transcription === "string")
        return payload.transcription.trim();
    if (Array.isArray(payload.segments)) {
        return payload.segments
            .map((segment) => String(segment?.text || "").trim())
            .filter(Boolean)
            .join(" ")
            .trim();
    }
    return "";
}
async function transcribeAudio(audioPath, mimeType) {
    const form = new FormData();
    const fileBuffer = await fs_1.default.promises.readFile(audioPath);
    const fileBlob = new Blob([fileBuffer], { type: mimeType || "audio/webm" });
    form.append("file", fileBlob, path_1.default.basename(audioPath));
    form.append("response_format", "json");
    form.append("temperature", "0.0");
    form.append("temperature_inc", "0.2");
    const baseUrl = runtimeConfig_1.MEETILY_WHISPER_BASE_URL.replace(/\/+$/, "");
    const response = await fetch(`${baseUrl}/inference`, {
        method: "POST",
        body: form,
    });
    const bodyText = await response.text();
    if (!response.ok) {
        throw new Error(`Whisper ${response.status}: ${bodyText.slice(0, 240)}`);
    }
    const parsed = bodyText ? JSON.parse(bodyText) : {};
    return extractWhisperText(parsed);
}
function buildSummaryPrompt(transcript) {
    return [
        "You are summarizing a private WOLF Den recording.",
        "Return strict JSON with keys: cleanSummary, planIdeas, decisions, actionItems, risksQuestions, followUps.",
        "Each key should be an array of concise strings except cleanSummary, which should be one concise paragraph.",
        "Do not invent facts. If an area is empty, use an empty array.",
        "",
        transcript,
    ].join("\n");
}
async function summarizeTranscript(transcript) {
    const response = await fetch(`${runtimeConfig_1.OLLAMA_BASE_URL.replace(/\/+$/, "")}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
            model: runtimeConfig_1.OLLAMA_PRIMARY_MODEL,
            stream: false,
            format: "json",
            messages: [
                {
                    role: "user",
                    content: buildSummaryPrompt(transcript),
                },
            ],
        }),
    });
    const bodyText = await response.text();
    if (!response.ok) {
        throw new Error(`Ollama ${response.status}: ${bodyText.slice(0, 240)}`);
    }
    const parsed = bodyText ? JSON.parse(bodyText) : {};
    const content = String(parsed?.message?.content || "{}");
    try {
        return JSON.parse(content);
    }
    catch {
        return { cleanSummary: content, planIdeas: [], decisions: [], actionItems: [], risksQuestions: [], followUps: [] };
    }
}
async function processRecording(pool, recordingId) {
    const row = await loadRecording(pool, recordingId);
    if (!row?.audio_path)
        return;
    try {
        await pool.query("UPDATE den_recordings SET status = $2, error_message = NULL, updated_at = now() WHERE id = $1", [
            recordingId,
            runtimeConfig_1.DEN_RECORDING_TRANSCRIPTION_ENABLED ? "transcribing" : "uploaded",
        ]);
        await addRecordingEvent(pool, recordingId, "processing_started", "Recording processing started");
        let transcript = String(row.transcript_text || "");
        if (runtimeConfig_1.DEN_RECORDING_TRANSCRIPTION_ENABLED) {
            transcript = await transcribeAudio(String(row.audio_path), String(row.mime_type || "audio/webm"));
            await pool.query("UPDATE den_recordings SET transcript_text = $2, status = $3, model_provider = $4, updated_at = now() WHERE id = $1", [recordingId, transcript, runtimeConfig_1.DEN_RECORDING_SUMMARY_ENABLED ? "summarizing" : "complete", "meetily-whisper"]);
            await addRecordingEvent(pool, recordingId, "transcribed", "Whisper transcription complete");
        }
        if (runtimeConfig_1.DEN_RECORDING_SUMMARY_ENABLED && transcript.trim()) {
            const summary = await summarizeTranscript(transcript);
            await pool.query(`
          UPDATE den_recordings
          SET summary_json = $2::jsonb,
              status = 'complete',
              model_provider = 'ollama',
              model_name = $3,
              error_message = NULL,
              updated_at = now()
          WHERE id = $1
        `, [recordingId, summary, runtimeConfig_1.OLLAMA_PRIMARY_MODEL]);
            await addRecordingEvent(pool, recordingId, "summarized", "Ollama summary complete");
            return;
        }
        await pool.query("UPDATE den_recordings SET status = 'complete', updated_at = now() WHERE id = $1", [recordingId]);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await pool.query("UPDATE den_recordings SET status = 'failed', error_message = $2, updated_at = now() WHERE id = $1", [recordingId, message.slice(0, 1000)]);
        await addRecordingEvent(pool, recordingId, "processing_failed", message.slice(0, 1000));
    }
}
function registerDenRecordingRoutes({ app, pool, recordingsDir }) {
    fs_1.default.mkdirSync(recordingsDir, { recursive: true });
    const upload = (0, multer_1.default)({
        storage: multer_1.default.memoryStorage(),
        limits: { fileSize: MAX_CHUNK_BYTES, files: 1 },
    });
    app.get("/api/den-recordings", async (req, res) => {
        const user = authUserFromReq(req);
        if (!canUseDen(user))
            return res.status(403).json({ ok: false, error: "forbidden" });
        const userId = numericUserId(user);
        const values = [];
        const where = isManager(user) ? "" : "WHERE owner_user_id = $1";
        if (!isManager(user))
            values.push(userId);
        const result = await pool.query(`
        SELECT *
        FROM den_recordings
        ${where}
        ORDER BY created_at DESC
        LIMIT 100
      `, values);
        res.json({ ok: true, rows: result.rows.map(mapRecordingRow) });
    });
    app.post("/api/den-recordings", async (req, res) => {
        const user = authUserFromReq(req);
        if (!canUseDen(user))
            return res.status(403).json({ ok: false, error: "forbidden" });
        const userId = numericUserId(user);
        if (userId === null)
            return res.status(401).json({ ok: false, error: "unauthorized" });
        const id = (0, crypto_1.randomUUID)();
        const sourceType = SOURCE_TYPES.has(String(req.body?.sourceType)) ? String(req.body.sourceType) : "mic";
        const title = sanitizeTitle(req.body?.title);
        const dir = recordingDir(recordingsDir, id);
        await fs_1.default.promises.mkdir(dir, { recursive: true });
        const result = await pool.query(`
        INSERT INTO den_recordings (id, owner_user_id, title, source_type, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, 'created', now(), now())
        RETURNING *
      `, [id, userId, title, sourceType]);
        await addRecordingEvent(pool, id, "created", "Recording session created");
        res.status(201).json({ ok: true, row: mapRecordingRow(result.rows[0]) });
    });
    app.post("/api/den-recordings/:id/chunks", upload.single("chunk"), async (req, res) => {
        const user = authUserFromReq(req);
        if (!canUseDen(user))
            return res.status(403).json({ ok: false, error: "forbidden" });
        const row = await loadRecording(pool, req.params.id);
        if (!canAccessRecording(user, row))
            return res.status(404).json({ ok: false, error: "not_found" });
        if (!req.file?.buffer?.length)
            return res.status(400).json({ ok: false, error: "chunk_required" });
        const index = Math.max(Number(req.body?.index || 0), 0);
        const chunkPath = ensureRecordingPath(recordingsDir, req.params.id, `chunk-${String(index).padStart(6, "0")}.webm`);
        await fs_1.default.promises.mkdir(path_1.default.dirname(chunkPath), { recursive: true });
        await fs_1.default.promises.writeFile(chunkPath, req.file.buffer);
        await pool.query("UPDATE den_recordings SET status = 'uploading', mime_type = $2, updated_at = now() WHERE id = $1", [
            req.params.id,
            req.file.mimetype || "audio/webm",
        ]);
        res.json({ ok: true, index, bytes: req.file.size });
    });
    app.post("/api/den-recordings/:id/finish", async (req, res) => {
        const user = authUserFromReq(req);
        if (!canUseDen(user))
            return res.status(403).json({ ok: false, error: "forbidden" });
        const row = await loadRecording(pool, req.params.id);
        if (!canAccessRecording(user, row))
            return res.status(404).json({ ok: false, error: "not_found" });
        const dir = recordingDir(recordingsDir, req.params.id);
        const entries = await fs_1.default.promises.readdir(dir).catch(() => []);
        const chunks = entries.filter((name) => /^chunk-\d+\.webm$/.test(name)).sort();
        if (!chunks.length)
            return res.status(400).json({ ok: false, error: "no_chunks" });
        const audioPath = ensureRecordingPath(recordingsDir, req.params.id, "audio.webm");
        const output = fs_1.default.createWriteStream(audioPath);
        for (const chunk of chunks) {
            const chunkPath = ensureRecordingPath(recordingsDir, req.params.id, chunk);
            await new Promise((resolve, reject) => {
                const input = fs_1.default.createReadStream(chunkPath);
                input.on("error", reject);
                input.on("end", resolve);
                input.pipe(output, { end: false });
            });
        }
        await new Promise((resolve, reject) => {
            output.end((error) => (error ? reject(error) : resolve()));
        });
        const stat = await fs_1.default.promises.stat(audioPath);
        const durationSec = Math.max(Number(req.body?.durationSec || 0), 0);
        const result = await pool.query(`
        UPDATE den_recordings
        SET status = 'uploaded',
            audio_path = $2,
            duration_sec = $3,
            file_size_bytes = $4,
            finished_at = now(),
            updated_at = now()
        WHERE id = $1
        RETURNING *
      `, [req.params.id, audioPath, Math.round(durationSec), stat.size]);
        await addRecordingEvent(pool, req.params.id, "uploaded", "Audio chunks assembled", { chunks: chunks.length });
        void processRecording(pool, req.params.id);
        res.json({ ok: true, row: mapRecordingRow(result.rows[0]) });
    });
    app.get("/api/den-recordings/:id", async (req, res) => {
        const user = authUserFromReq(req);
        if (!canUseDen(user))
            return res.status(403).json({ ok: false, error: "forbidden" });
        const row = await loadRecording(pool, req.params.id);
        if (!canAccessRecording(user, row))
            return res.status(404).json({ ok: false, error: "not_found" });
        res.json({ ok: true, row: mapRecordingRow(row) });
    });
    app.get("/api/den-recordings/:id/audio", async (req, res) => {
        const user = authUserFromReq(req);
        if (!canUseDen(user))
            return res.status(403).json({ ok: false, error: "forbidden" });
        const row = await loadRecording(pool, req.params.id);
        if (!canAccessRecording(user, row) || !row?.audio_path) {
            return res.status(404).json({ ok: false, error: "not_found" });
        }
        const audioPath = path_1.default.resolve(String(row.audio_path));
        if (!audioPath.startsWith(recordingDir(recordingsDir, req.params.id) + path_1.default.sep)) {
            return res.status(403).json({ ok: false, error: "forbidden" });
        }
        res.setHeader("Content-Type", String(row.mime_type || "audio/webm"));
        res.setHeader("Content-Disposition", `attachment; filename="${req.params.id}.webm"`);
        res.sendFile(audioPath);
    });
    app.patch("/api/den-recordings/:id", async (req, res) => {
        const user = authUserFromReq(req);
        if (!canUseDen(user))
            return res.status(403).json({ ok: false, error: "forbidden" });
        const row = await loadRecording(pool, req.params.id);
        if (!canAccessRecording(user, row))
            return res.status(404).json({ ok: false, error: "not_found" });
        const title = req.body?.title !== undefined ? sanitizeTitle(req.body.title) : row.title;
        const transcript = typeof req.body?.transcriptText === "string" ? req.body.transcriptText : row.transcript_text;
        const notes = typeof req.body?.notes === "string" ? req.body.notes : row.notes;
        const result = await pool.query(`
        UPDATE den_recordings
        SET title = $2, transcript_text = $3, notes = $4, updated_at = now()
        WHERE id = $1
        RETURNING *
      `, [req.params.id, title, transcript, notes]);
        res.json({ ok: true, row: mapRecordingRow(result.rows[0]) });
    });
    app.post("/api/den-recordings/:id/summarize", async (req, res) => {
        const user = authUserFromReq(req);
        if (!canUseDen(user))
            return res.status(403).json({ ok: false, error: "forbidden" });
        const row = await loadRecording(pool, req.params.id);
        if (!canAccessRecording(user, row))
            return res.status(404).json({ ok: false, error: "not_found" });
        if (!String(row.transcript_text || "").trim())
            return res.status(400).json({ ok: false, error: "missing_transcript" });
        await pool.query("UPDATE den_recordings SET status = 'summarizing', updated_at = now() WHERE id = $1", [req.params.id]);
        void processRecording(pool, req.params.id);
        res.json({ ok: true });
    });
    app.delete("/api/den-recordings/:id", async (req, res) => {
        const user = authUserFromReq(req);
        if (!canUseDen(user))
            return res.status(403).json({ ok: false, error: "forbidden" });
        const row = await loadRecording(pool, req.params.id);
        if (!canAccessRecording(user, row))
            return res.status(404).json({ ok: false, error: "not_found" });
        await pool.query("DELETE FROM den_recordings WHERE id = $1", [req.params.id]);
        await fs_1.default.promises.rm(recordingDir(recordingsDir, req.params.id), { recursive: true, force: true }).catch(() => undefined);
        res.json({ ok: true });
    });
}
//# sourceMappingURL=denRecordingRoutes.js.map