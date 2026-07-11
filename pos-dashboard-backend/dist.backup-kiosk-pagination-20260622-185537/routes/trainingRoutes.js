"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerTrainingRoutes = registerTrainingRoutes;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const TRAINING_MEDIA_DIR = path_1.default.resolve(__dirname, "..", "..", "training-media");
const MAX_STREAM_CHUNK_BYTES = 4 * 1024 * 1024;
const TRAINING_MEDIA = {
    "jackson-feature-catnapper.mp4": {
        fileName: "jackson-feature-catnapper.mp4",
        mimeType: "video/mp4",
    },
};
function parseByteRange(rangeHeader, fileSize) {
    const raw = String(rangeHeader || "").trim();
    if (!raw)
        return { start: 0 };
    const match = raw.match(/^bytes=(\d*)-(\d*)$/);
    if (!match)
        return null;
    const startRaw = match[1] || "";
    const endRaw = match[2] || "";
    if (!startRaw && !endRaw)
        return null;
    if (!startRaw) {
        const suffixLength = Number(endRaw);
        if (!Number.isFinite(suffixLength) || suffixLength <= 0)
            return null;
        return { start: Math.max(fileSize - suffixLength, 0), end: fileSize - 1 };
    }
    const start = Number(startRaw);
    if (!Number.isFinite(start) || start < 0 || start >= fileSize)
        return null;
    if (!endRaw)
        return { start };
    const end = Number(endRaw);
    if (!Number.isFinite(end) || end < start)
        return null;
    return { start, end: Math.min(end, fileSize - 1) };
}
function registerTrainingRoutes(app) {
    app.get("/api/training/media/:fileName", async (req, res) => {
        if (!req.authUser)
            return res.status(401).json({ ok: false, error: "unauthorized" });
        const media = TRAINING_MEDIA[String(req.params.fileName || "")];
        if (!media)
            return res.status(404).json({ ok: false, error: "not_found" });
        const mediaPath = path_1.default.join(TRAINING_MEDIA_DIR, media.fileName);
        let stat;
        try {
            stat = await fs_1.default.promises.stat(mediaPath);
        }
        catch {
            return res.status(404).json({ ok: false, error: "not_found" });
        }
        const fileSize = stat.size;
        const requestedRange = parseByteRange(req.headers.range, fileSize);
        if (!requestedRange) {
            res.setHeader("Content-Range", `bytes */${fileSize}`);
            return res.status(416).end();
        }
        const start = requestedRange.start;
        const requestedEnd = requestedRange.end ?? fileSize - 1;
        const end = Math.min(requestedEnd, start + MAX_STREAM_CHUNK_BYTES - 1, fileSize - 1);
        const contentLength = end - start + 1;
        res.status(206);
        res.setHeader("Accept-Ranges", "bytes");
        res.setHeader("Cache-Control", "private, no-store, no-cache, must-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
        res.setHeader("Content-Type", media.mimeType);
        res.setHeader("Content-Length", String(contentLength));
        res.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);
        res.setHeader("Content-Disposition", `inline; filename="${media.fileName}"`);
        res.setHeader("X-Content-Type-Options", "nosniff");
        const stream = fs_1.default.createReadStream(mediaPath, { start, end });
        stream.on("error", () => {
            if (!res.headersSent)
                res.status(500).json({ ok: false, error: "stream_failed" });
            else
                res.destroy();
        });
        stream.pipe(res);
    });
}
//# sourceMappingURL=trainingRoutes.js.map