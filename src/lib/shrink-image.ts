// Shrinks a photo in the browser before upload: longest side 1600 px, JPEG
// at 80% quality. A 4 MB phone photo becomes roughly 200–400 KB, which
// uploads quickly on mobile data and is still sharp enough to read an NIC.

const MAX_SIDE = 1600;
const QUALITY = 0.8;

export async function shrinkImage(file: File): Promise<Blob> {
  // imageOrientation: rotates photos the way the camera held them.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.fillStyle = "#fff"; // transparent PNGs get a white background, not black
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
  if (!blob) throw new Error("Couldn't encode the photo");
  // Keep the original if shrinking somehow made it bigger (tiny images).
  return blob.size < file.size || file.type !== "image/jpeg" ? blob : file;
}
