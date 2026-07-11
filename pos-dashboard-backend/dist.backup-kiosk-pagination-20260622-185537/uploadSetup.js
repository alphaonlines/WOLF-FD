"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUpload = createUpload;
const multer_1 = __importDefault(require("multer"));
function createUpload(uploadsDir) {
    return (0, multer_1.default)({
        storage: multer_1.default.diskStorage({
            destination: (_req, _file, cb) => cb(null, uploadsDir),
            filename: (_req, file, cb) => {
                const safeName = file.originalname.replace(/[^\w.\- ()]/g, "_");
                cb(null, `${Date.now()}_${safeName}`);
            },
        }),
        fileFilter: (_req, file, cb) => {
            const ok = /\.(xlsx|xls)$/i.test(file.originalname);
            cb((ok ? null : new Error("Only .xlsx or .xls files are accepted")), ok);
        },
        limits: { fileSize: 50 * 1024 * 1024 },
    });
}
//# sourceMappingURL=uploadSetup.js.map