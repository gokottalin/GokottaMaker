const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

function extensionFromUpload(filename, dataUrl) {
  const lower = String(filename || "").toLowerCase();
  const ext = path.extname(lower);
  if ([".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext)) return ext;
  const match = String(dataUrl || "").match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,/);
  if (!match) return "";
  return match[1] === "jpeg" ? ".jpg" : `.${match[1]}`;
}

function createUploadStore(uploadDir) {
  function saveUpload(payload) {
    const dataUrl = String(payload.dataUrl || "");
    const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,(.+)$/);
    if (!match) {
      const error = new Error("仅支持 PNG、JPG、WebP、GIF 图片");
      error.status = 400;
      throw error;
    }

    const ext = extensionFromUpload(payload.filename, dataUrl);
    if (!ext) {
      const error = new Error("无法识别图片格式");
      error.status = 400;
      throw error;
    }

    const bytes = Buffer.from(match[2], "base64");
    if (bytes.length > 8 * 1024 * 1024) {
      const error = new Error("图片不能超过 8MB");
      error.status = 400;
      throw error;
    }

    const filename = `${new Date().toISOString().slice(0, 10)}-${crypto.randomBytes(8).toString("hex")}${ext}`;
    fs.writeFileSync(path.join(uploadDir, filename), bytes);
    return `./uploads/${filename}`;
  }

  function uploads() {
    if (!fs.existsSync(uploadDir)) return [];
    return fs
      .readdirSync(uploadDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.(png|jpe?g|webp|gif)$/i.test(entry.name))
      .map((entry) => {
        const stats = fs.statSync(path.join(uploadDir, entry.name));
        return {
          name: entry.name,
          url: `./uploads/${entry.name}`,
          size: stats.size,
          updatedAt: stats.mtime.toISOString()
        };
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  return {
    saveUpload,
    uploads
  };
}

module.exports = {
  createUploadStore
};
