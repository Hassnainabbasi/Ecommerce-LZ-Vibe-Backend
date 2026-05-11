import dotenv from "dotenv";
import { v2 as cloudinary } from "cloudinary";

dotenv.config();

const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME?.trim();
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY?.trim();
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET?.trim();

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
});

console.log("🔍 Cloudinary ENV:", {
  name: CLOUDINARY_CLOUD_NAME || "❌ Missing",
  key: CLOUDINARY_API_KEY ? "✅ Loaded" : "❌ Missing",
  secret: CLOUDINARY_API_SECRET ? "✅ Loaded" : "❌ Missing",
});
console.log("✅ Cloudinary configured (utils/cloudinaryUpload.js, values trimmed)");

const IMAGE_TRANSFORM = [{ width: 800, height: 800, crop: "limit" }];

export function isCloudinaryConfigured() {
  return !!(CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET);
}

export function isOurCloudinaryDeliveryUrl(url) {
  const name = CLOUDINARY_CLOUD_NAME;
  if (!url || !name) return false;
  try {
    const u = new URL(url);
    if (u.hostname !== "res.cloudinary.com") return false;
    const parts = u.pathname.split("/").filter(Boolean);
    return (
      parts[0] === name && parts[1] === "image" && parts[2] === "upload"
    );
  } catch {
    return false;
  }
}

/**
 * Remote http(s) URL, Cloudinary fetch URL, or data:image/*;base64,... → uploads to Cloudinary.
 * Already-hosted assets on this Cloudinary cloud → returned unchanged.
 * Default placeholder path → returned unchanged.
 */
export async function uploadImageToCloudinary(source, folder) {
  const trimmed = typeof source === "string" ? source.trim() : "";
  if (!trimmed) return null;

  if (trimmed === "/images/placeholder.png") {
    return trimmed;
  }

  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    throw new Error(
      "Local image paths cannot be uploaded. Send a public image URL or base64 data URL."
    );
  }

  if (isOurCloudinaryDeliveryUrl(trimmed)) {
    return trimmed;
  }

  if (!isCloudinaryConfigured()) {
    throw new Error(
      "Cloudinary is not configured (set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)"
    );
  }

  const result = await cloudinary.uploader.upload(trimmed, {
    folder,
    allowed_formats: ["jpg", "jpeg", "png", "webp", "gif"],
    transformation: IMAGE_TRANSFORM,
  });

  return result.secure_url;
}

export { cloudinary };
