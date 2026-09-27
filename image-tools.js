/**
 * TargetCompress - Client-Side Image Tools (Format Converter & Resizer)
 * 100% In-Browser Privacy - Uses HTML5 Canvas API
 */

import { triggerDownload } from './pdf-tools.js';

/**
 * 1. FORMAT CONVERTER
 * Converts any image (PNG, JPG, WebP, GIF, BMP, SVG) to PNG, JPG, or WebP.
 */
export async function convertImageFormat(file, targetFormat = 'jpeg', quality = 0.9, onProgress = () => {}) {
  if (!file) throw new Error('No image file provided.');

  onProgress(20, 'Reading image...');
  const img = await loadImageFromFile(file);

  onProgress(50, `Converting to ${targetFormat.toUpperCase()}...`);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');

  // If converting to JPEG, fill white background to prevent transparent areas turning black
  if (targetFormat === 'jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.drawImage(img, 0, 0);

  const mimeType = targetFormat === 'png' ? 'image/png' : targetFormat === 'webp' ? 'image/webp' : 'image/jpeg';
  const ext = targetFormat === 'jpeg' ? 'jpg' : targetFormat;

  onProgress(85, 'Encoding converted image...');
  const blob = await new Promise(resolve => canvas.toBlob(resolve, mimeType, quality));

  const baseName = file.name.replace(/\.[^/.]+$/, '');
  const finalFilename = `${baseName}_converted.${ext}`;

  onProgress(100, 'Conversion complete!');

  return {
    blob,
    filename: finalFilename,
    width: canvas.width,
    height: canvas.height,
    size: blob.size
  };
}

/**
 * 2. IMAGE RESIZER
 * Resizes an image to exact pixel dimensions (width x height) or percentage.
 */
export async function resizeImage({
  file,
  targetWidth,
  targetHeight,
  quality = 0.9,
  format = 'auto',
  onProgress = () => {}
}) {
  if (!file) throw new Error('No image file provided.');
  if (!targetWidth || !targetHeight) throw new Error('Target width and height must be positive numbers.');

  onProgress(20, 'Decoding source image...');
  const img = await loadImageFromFile(file);

  onProgress(50, `Resizing image to ${targetWidth} × ${targetHeight}px...`);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(targetWidth);
  canvas.height = Math.round(targetHeight);
  const ctx = canvas.getContext('2d');

  // High quality interpolation
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  let mimeType = 'image/jpeg';
  let ext = 'jpg';

  if (format === 'auto') {
    if (file.type === 'image/png') {
      mimeType = 'image/png';
      ext = 'png';
    } else if (file.type === 'image/webp') {
      mimeType = 'image/webp';
      ext = 'webp';
    }
  } else if (format === 'png') {
    mimeType = 'image/png';
    ext = 'png';
  } else if (format === 'webp') {
    mimeType = 'image/webp';
    ext = 'webp';
  }

  if (mimeType === 'image/jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  onProgress(85, 'Encoding resized image...');
  const blob = await new Promise(resolve => canvas.toBlob(resolve, mimeType, quality));

  const baseName = file.name.replace(/\.[^/.]+$/, '');
  const finalFilename = `${baseName}_${canvas.width}x${canvas.height}.${ext}`;

  onProgress(100, 'Resize complete!');

  return {
    blob,
    filename: finalFilename,
    width: canvas.width,
    height: canvas.height,
    size: blob.size
  };
}

// Helper to load file as HTMLImageElement
function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image file. It may be corrupted or unsupported.'));
    };
    img.src = url;
  });
}
