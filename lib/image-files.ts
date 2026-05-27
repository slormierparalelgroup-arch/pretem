const maxImageSize = 1400;
const jpegQuality = 0.76;

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image."));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", jpegQuality);
  });
}

export async function prepareVerificationImage(file: File, name: string) {
  if (!file.type.startsWith("image/")) return file;

  try {
    const image = await loadImage(file);
    const ratio = Math.min(1, maxImageSize / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * ratio));
    const height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) return file;

    canvas.width = width;
    canvas.height = height;
    context.drawImage(image, 0, 0, width, height);

    const blob = await canvasToBlob(canvas);
    if (!blob) return file;

    return new File([blob], `${name}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}

export async function createVerificationImageFromVideo(video: HTMLVideoElement, name: string) {
  const sourceWidth = video.videoWidth || 1280;
  const sourceHeight = video.videoHeight || 720;
  const ratio = Math.min(1, maxImageSize / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * ratio));
  const height = Math.max(1, Math.round(sourceHeight * ratio));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) return null;

  canvas.width = width;
  canvas.height = height;
  context.drawImage(video, 0, 0, width, height);

  const blob = await canvasToBlob(canvas);
  if (!blob) return null;

  return new File([blob], `${name}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
}
