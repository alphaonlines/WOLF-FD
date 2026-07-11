"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSystemRoutes = registerSystemRoutes;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
function registerSystemRoutes({ app, pool, upload, uploadsDir, importerPath, pythonBin, execFileAsync, }) {
    // Health
    app.get("/health", async (_req, res) => {
        const r = await pool.query("SELECT 1 AS ok");
        res.json({ ok: true, db: r.rows[0].ok });
    });
    app.post("/api/import/upload", upload.array("files", 25), async (req, res) => {
        const rawFiles = req.files;
        const files = Array.isArray(rawFiles) ? rawFiles : [];
        if (!files.length) {
            res.status(400).json({ ok: false, error: "No files uploaded" });
            return;
        }
        const manufacturer = typeof req.body?.manufacturer === "string" ? req.body.manufacturer.trim() : "";
        let importOutput = "";
        let importError = "";
        const tempDir = fs_1.default.mkdtempSync(path_1.default.join(uploadsDir, "upload-"));
        try {
            for (const file of files) {
                const src = path_1.default.join(uploadsDir, file.filename);
                const dest = path_1.default.join(tempDir, file.filename);
                if (fs_1.default.existsSync(src)) {
                    fs_1.default.renameSync(src, dest);
                }
            }
            const importerArgs = [importerPath, "--incoming", tempDir, "--no-move"];
            if (manufacturer) {
                importerArgs.push("--manufacturer", manufacturer);
            }
            const { stdout, stderr } = await execFileAsync(pythonBin, importerArgs, { timeout: 5 * 60 * 1000 });
            importOutput = stdout?.toString() || "";
            importError = stderr?.toString() || "";
        }
        catch (err) {
            importError = err?.stderr?.toString?.() || String(err?.message || err);
        }
        finally {
            try {
                fs_1.default.rmSync(tempDir, { recursive: true, force: true });
            }
            catch {
                // ignore cleanup errors
            }
        }
        res.json({
            ok: true,
            saved_to: uploadsDir,
            files: files.map((f) => ({
                original_name: f.originalname,
                stored_name: f.filename,
                size: f.size,
            })),
            import: {
                ok: importError ? false : true,
                stdout: importOutput,
                stderr: importError,
            },
        });
    });
}
//# sourceMappingURL=systemRoutes.js.map