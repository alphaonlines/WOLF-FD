import multer from "multer";

export function createUpload(uploadsDir: string) {
  return multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, uploadsDir),
      filename: (_req, file, cb) => {
        const safeName = file.originalname.replace(/[^\w.\- ()]/g, "_");
        cb(null, `${Date.now()}_${safeName}`);
      },
    }),
    fileFilter: (_req, file, cb) => {
      const ok = /\.(xlsx|xls)$/i.test(file.originalname);
      cb((ok ? null : new Error("Only .xlsx or .xls files are accepted")) as any, ok);
    },
    limits: { fileSize: 50 * 1024 * 1024 },
  });
}
