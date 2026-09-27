import { ensurePdfLib, ensurePdfJs, ensureJsZip } from './script-loader.js';

/**
 * TargetCompress - Comprehensive Client-Side PDF Tools
 * 100% In-Browser Privacy - Powered by PDF-Lib, PDF.js, and JSZip.
 */

// Helper to download any blob cleanly
export function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// Format bytes
export function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 1. MERGE PDFs
 * Combines 2 or more PDF files into a single document in specified order.
 */
export async function mergePdfs(pdfFiles, onProgress = () => {}) {
  await ensurePdfLib();
  if (!pdfFiles || pdfFiles.length < 2) throw new Error('Please select at least 2 PDF files to merge.');

  onProgress(10, 'Initializing PDF merger...');
  const mergedPdf = await window.PDFLib.PDFDocument.create();

  for (let i = 0; i < pdfFiles.length; i++) {
    const file = pdfFiles[i];
    const pct = Math.round(15 + ((i + 1) / pdfFiles.length) * 75);
    onProgress(pct, `Merging "${file.name}" (${i + 1} of ${pdfFiles.length})...`);

    const fileBuffer = await file.arrayBuffer();
    const srcDoc = await window.PDFLib.PDFDocument.load(fileBuffer, { ignoreEncryption: true });
    const copiedPages = await mergedPdf.copyPages(srcDoc, srcDoc.getPageIndices());
    copiedPages.forEach(page => mergedPdf.addPage(page));
  }

  onProgress(95, 'Finalizing merged PDF document...');
  const pdfBytes = await mergedPdf.save();
  onProgress(100, 'Merge complete!');

  return new Blob([pdfBytes], { type: 'application/pdf' });
}

/**
 * 2. SPLIT PDF
 * Extracts specific pages, ranges (e.g. "1-3, 5, 7-10"), or every page.
 */
export async function splitPdf(file, pageRangeString, onProgress = () => {}) {
  await ensurePdfLib();
  if (!file) throw new Error('No PDF file provided.');

  onProgress(10, 'Loading PDF for page extraction...');
  const fileBuffer = await file.arrayBuffer();
  const srcDoc = await window.PDFLib.PDFDocument.load(fileBuffer, { ignoreEncryption: true });
  const totalPages = srcDoc.getPageCount();

  // Parse page range string (1-indexed from user)
  const selectedIndices = parsePageRanges(pageRangeString, totalPages);
  if (selectedIndices.length === 0) {
    throw new Error(`Invalid page range. Please specify valid pages between 1 and ${totalPages}.`);
  }

  onProgress(40, `Extracting ${selectedIndices.length} page(s) from document...`);
  const newPdf = await window.PDFLib.PDFDocument.create();
  const copiedPages = await newPdf.copyPages(srcDoc, selectedIndices);
  copiedPages.forEach(p => newPdf.addPage(p));

  onProgress(85, 'Building extracted PDF...');
  const pdfBytes = await newPdf.save();
  onProgress(100, 'Extraction complete!');

  return new Blob([pdfBytes], { type: 'application/pdf' });
}

export function parsePageRanges(rangeStr, totalPages) {
  if (!rangeStr || !rangeStr.trim()) {
    // Default to all pages
    return Array.from({ length: totalPages }, (_, i) => i);
  }

  const indices = new Set();
  const parts = rangeStr.split(',');

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    if (trimmed.includes('-')) {
      const [startStr, endStr] = trimmed.split('-');
      const start = Math.max(1, parseInt(startStr, 10));
      const end = Math.min(totalPages, parseInt(endStr, 10));
      if (!isNaN(start) && !isNaN(end) && start <= end) {
        for (let p = start; p <= end; p++) {
          indices.add(p - 1);
        }
      }
    } else {
      const p = parseInt(trimmed, 10);
      if (!isNaN(p) && p >= 1 && p <= totalPages) {
        indices.add(p - 1);
      }
    }
  }

  return Array.from(indices).sort((a, b) => a - b);
}

/**
 * 3. PDF TO IMAGES
 * Converts PDF pages into JPG or PNG images. Bundles into ZIP if multiple pages.
 */
export async function pdfToImages(file, format = 'jpeg', scale = 1.5, onProgress = () => {}) {
  await ensurePdfJs();
  await ensureJsZip();

  window.pdfjsLib.GlobalWorkerOptions.workerSrc = './pdf.worker.min.js';
  onProgress(5, 'Reading PDF pages...');

  const fileData = await file.arrayBuffer();
  const pdfDoc = await window.pdfjsLib.getDocument({ data: fileData }).promise;
  const numPages = pdfDoc.numPages;

  const images = [];
  const baseName = file.name.replace(/\.[^/.]+$/, '');

  for (let i = 1; i <= numPages; i++) {
    const pct = Math.round(5 + (i / numPages) * 85);
    onProgress(pct, `Rendering page ${i} of ${numPages}...`);

    const page = await pdfDoc.getPage(i);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    // Fill white background for clean rendering
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx, viewport }).promise;

    const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
    const ext = format === 'png' ? 'png' : 'jpg';

    const blob = await new Promise(resolve => canvas.toBlob(resolve, mimeType, 0.92));
    images.push({
      page: i,
      name: `${baseName}_page_${i}.${ext}`,
      blob
    });
  }

  onProgress(95, 'Packaging images...');

  if (images.length === 1) {
    onProgress(100, 'Page converted successfully!');
    return {
      isZip: false,
      blob: images[0].blob,
      filename: images[0].name,
      totalPages: 1
    };
  }

  // Multi-page: create zip archive
  const zip = new window.JSZip();
  images.forEach(img => {
    zip.file(img.name, img.blob);
  });

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  onProgress(100, 'All pages converted to images!');

  return {
    isZip: true,
    blob: zipBlob,
    filename: `${baseName}_images.zip`,
    totalPages: numPages
  };
}

/**
 * 4. IMAGES TO PDF
 * Combines 1 or more images (JPG, PNG, WebP) into a clean, uniform PDF document.
 */
export async function imagesToPdf(imageFiles, orientation = 'auto', margin = 10, onProgress = () => {}) {
  await ensurePdfLib();
  if (!imageFiles || imageFiles.length === 0) throw new Error('Please select at least one image.');

  onProgress(10, 'Creating PDF document...');
  const pdfDoc = await window.PDFLib.PDFDocument.create();

  for (let i = 0; i < imageFiles.length; i++) {
    const file = imageFiles[i];
    const pct = Math.round(15 + ((i + 1) / imageFiles.length) * 75);
    onProgress(pct, `Processing image ${i + 1} of ${imageFiles.length}: "${file.name}"...`);

    // Standardize image to PNG via canvas so all formats (WebP, SVG, BMP, JPG) embed reliably
    const imgData = await fileToCanvasBytes(file);

    let embeddedImg;
    if (imgData.isJpg) {
      embeddedImg = await pdfDoc.embedJpg(imgData.bytes);
    } else {
      embeddedImg = await pdfDoc.embedPng(imgData.bytes);
    }

    const imgWidth = embeddedImg.width;
    const imgHeight = embeddedImg.height;

    // Determine page dimensions
    let pageWidth, pageHeight;
    const isLandscape = imgWidth > imgHeight;

    if (orientation === 'landscape') {
      pageWidth = 842; pageHeight = 595; // A4 Landscape
    } else if (orientation === 'portrait') {
      pageWidth = 595; pageHeight = 842; // A4 Portrait
    } else {
      // Auto: match orientation of image
      if (isLandscape) {
        pageWidth = 842; pageHeight = 595;
      } else {
        pageWidth = 595; pageHeight = 842;
      }
    }

    const page = pdfDoc.addPage([pageWidth, pageHeight]);

    // Calculate fitted dimensions within margin
    const availWidth = pageWidth - (margin * 2);
    const availHeight = pageHeight - (margin * 2);

    const scale = Math.min(availWidth / imgWidth, availHeight / imgHeight, 1);
    const drawWidth = imgWidth * scale;
    const drawHeight = imgHeight * scale;

    const x = margin + (availWidth - drawWidth) / 2;
    const y = margin + (availHeight - drawHeight) / 2;

    page.drawImage(embeddedImg, {
      x,
      y,
      width: drawWidth,
      height: drawHeight
    });
  }

  onProgress(95, 'Compiling PDF...');
  const pdfBytes = await pdfDoc.save();
  onProgress(100, 'PDF created successfully!');

  return new Blob([pdfBytes], { type: 'application/pdf' });
}

// Convert any image file to clean embeddable bytes
async function fileToCanvasBytes(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');

      // White background for transparency safety
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      canvas.toBlob(blob => {
        blob.arrayBuffer().then(buffer => {
          resolve({
            bytes: new Uint8Array(buffer),
            isJpg: true
          });
        });
      }, 'image/jpeg', 0.92);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to decode image: ${file.name}`));
    };

    img.src = url;
  });
}

/**
 * 5. ROTATE PDF
 * Rotates all or targeted pages by 90°, 180°, or 270°.
 */
export async function rotatePdf(file, rotateAngle = 90, targetMode = 'all', onProgress = () => {}) {
  await ensurePdfLib();
  if (!file) throw new Error('No PDF file provided.');

  onProgress(15, 'Loading PDF for rotation...');
  const fileBuffer = await file.arrayBuffer();
  const pdfDoc = await window.PDFLib.PDFDocument.load(fileBuffer, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();
  const total = pages.length;

  onProgress(45, `Rotating pages by ${rotateAngle}°...`);

  pages.forEach((page, idx) => {
    const pageNum = idx + 1;
    let shouldRotate = false;

    if (targetMode === 'all') shouldRotate = true;
    else if (targetMode === 'odd' && pageNum % 2 !== 0) shouldRotate = true;
    else if (targetMode === 'even' && pageNum % 2 === 0) shouldRotate = true;

    if (shouldRotate) {
      const currentRotation = page.getRotation().angle;
      const newRotation = (currentRotation + rotateAngle) % 360;
      page.setRotation(window.PDFLib.degrees(newRotation));
    }
  });

  onProgress(85, 'Saving rotated PDF document...');
  const pdfBytes = await pdfDoc.save();
  onProgress(100, 'Rotation complete!');

  return new Blob([pdfBytes], { type: 'application/pdf' });
}

/**
 * 6. WATERMARK PDF
 * Injects a custom diagonal or horizontal text watermark across all pages.
 */
export async function watermarkPdf({
  file,
  text = 'CONFIDENTIAL',
  opacity = 0.25,
  fontSize = 48,
  color = 'gray',
  onProgress = () => {}
}) {
  await ensurePdfLib();
  if (!file) throw new Error('No PDF file provided.');
  if (!text.trim()) throw new Error('Watermark text cannot be empty.');

  onProgress(15, 'Loading PDF document...');
  const fileBuffer = await file.arrayBuffer();
  const pdfDoc = await window.PDFLib.PDFDocument.load(fileBuffer, { ignoreEncryption: true });
  const font = await pdfDoc.embedFont(window.PDFLib.StandardFonts.HelveticaBold);
  const pages = pdfDoc.getPages();

  let rgbColor;
  switch (color) {
    case 'red': rgbColor = window.PDFLib.rgb(0.9, 0.1, 0.1); break;
    case 'blue': rgbColor = window.PDFLib.rgb(0.1, 0.3, 0.9); break;
    case 'black': rgbColor = window.PDFLib.rgb(0.0, 0.0, 0.0); break;
    default: rgbColor = window.PDFLib.rgb(0.5, 0.5, 0.5); break; // gray
  }

  onProgress(45, `Watermarking ${pages.length} pages...`);

  const textWidth = font.widthOfTextAtSize(text, fontSize);
  const textHeight = font.heightAtSize(fontSize);

  pages.forEach((page, idx) => {
    const { width, height } = page.getSize();

    // Center diagonal watermark
    page.drawText(text, {
      x: (width - textWidth * 0.7) / 2,
      y: (height - textHeight * 0.7) / 2,
      size: fontSize,
      font,
      color: rgbColor,
      opacity: Math.max(0.05, Math.min(0.9, opacity)),
      rotate: window.PDFLib.degrees(45)
    });
  });

  onProgress(85, 'Finalizing watermarked PDF...');
  const pdfBytes = await pdfDoc.save();
  onProgress(100, 'Watermark applied successfully!');

  return new Blob([pdfBytes], { type: 'application/pdf' });
}
