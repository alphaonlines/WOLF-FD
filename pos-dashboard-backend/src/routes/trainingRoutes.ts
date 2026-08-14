import fs from "fs";
import path from "path";
import type { Express } from "express";

const MEDIA_DIR = path.resolve(process.cwd(), "training-media");
const ALLOWED_MEDIA = new Map<string, string>([
  ["jackson-feature-catnapper.mp4", "video/mp4"],
  ["archbold-deep-dive.mp4", "video/mp4"],
  ["tempur-pedic-deep-dive.mp4", "video/mp4"],
]);

export function registerTrainingRoutes(app: Express) {
  app.get("/api/training/media/:filename", (req, res) => {
    const filename = String(req.params.filename || "");
    const contentType = ALLOWED_MEDIA.get(filename);
    if (!contentType) return res.status(404).json({ ok: false, error: "not_found" });

    const filePath = path.join(MEDIA_DIR, filename);
    if (!filePath.startsWith(`${MEDIA_DIR}${path.sep}`)) return res.status(404).json({ ok: false, error: "not_found" });

    let stat: fs.Stats;
    try {
      stat = fs.statSync(filePath);
    } catch {
      return res.status(404).json({ ok: false, error: "not_found" });
    }

    const size = stat.size;
    const range = req.headers.range;
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "private, max-age=3600");

    if (!range) {
      res.setHeader("Content-Length", size);
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match) {
      res.status(416).setHeader("Content-Range", `bytes */${size}`);
      res.end();
      return;
    }

    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Number(match[2]) : size - 1;
    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) {
      res.status(416).setHeader("Content-Range", `bytes */${size}`);
      res.end();
      return;
    }

    const safeEnd = Math.min(end, size - 1);
    res.status(206);
    res.setHeader("Content-Range", `bytes ${start}-${safeEnd}/${size}`);
    res.setHeader("Content-Length", safeEnd - start + 1);
    fs.createReadStream(filePath, { start, end: safeEnd }).pipe(res);
  });
}
