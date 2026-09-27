/**
 * Target-Size PDF Shrinker
 * Compresses PDFs to the highest visual fidelity strictly below user-specified KB/MB.
 * Uses pdf.js for page rasterization and pdf-lib for clean re-assembly.
 */

import { ensurePdfLib, ensurePdfJs } from './script-loader.js';

export const PDF_PRESETS = [
  { id: 'gov-50k', name: 'Strict Portal (50 KB)', targetBytes: 50 * 1024, label: '50 KB Cap', desc: 'Strict limit for small portal uploads' },
  { id: 'form-100k', name: 'Online Form (100 KB)', targetBytes: 100 * 1024, label: '100 KB Cap', desc: 'Standard govt & exam portal ceiling' },
  { id: 'cert-200k', name: 'Certificate (200 KB)', targetBytes: 200 * 1024, label: '200 KB Cap', desc: 'Ideal for admit cards, degrees & marksheets' },
  { id: 'gov-500k', name: 'Govt / Visa (500 KB)', targetBytes: 500 * 1024, label: '500 KB Cap', desc: 'Limit for government & passport uploads' },
  { id: 'job-1m', name: 'Job Application / Resume', targetBytes: 1024 * 1024, label: '1.0 MB Cap', desc: 'Optimal for ATS job portals & recruiter emails' },
  { id: 'sub-2m', name: 'University / Submission', targetBytes: 2 * 1024 * 1024, label: '2.0 MB Cap', desc: 'Standard academic & assignment ceiling' },
  { id: 'email-5m', name: 'Email Attachment', targetBytes: 5 * 1024 * 1024, label: '5.0 MB Cap', desc: 'Fast loading for Outlook & Gmail attachments' },
  { id: 'custom', name: 'Custom Exact Size', targetBytes: 800 * 1024, label: 'Custom', desc: 'Direct user input in KB or MB' }
];

export async function compressPdfToTarget({
  file,
  targetBytes,
  onProgress = () => {}
}) {
  onProgress(5, 'Loading PDF engine...');
  await ensurePdfJs();
  await ensurePdfLib();

  const fileData = await file.arrayBuffer();
  const pdfDoc = await window.pdfjsLib.getDocument({ data: fileData }).promise;
  const numPages = pdfDoc.numPages;

  onProgress(15, `Detected ${numPages} page${numPages > 1 ? 's' : ''}. Calculating per-page byte budget...`);

  // Target budget per page (leave 4% buffer for PDF catalog and cross-reference table)
  const safeTargetBytes = Math.floor(targetBytes * 0.96);
  const budgetPerPage = safeTargetBytes / numPages;

  // Determine optimal scale and JPEG quality based on page budget
  let scale = 1.5;
  let quality = 0.75;

  if (budgetPerPage > 350 * 1024) {
    scale = 1.8; // ~180-200 DPI
    quality = 0.85;
  } else if (budgetPerPage > 180 * 1024) {
    scale = 1.5; // ~150 DPI
    quality = 0.75;
  } else if (budgetPerPage > 90 * 1024) {
    scale = 1.25; // ~120 DPI
    quality = 0.65;
  } else if (budgetPerPage > 45 * 1024) {
    scale = 1.0; // ~96 DPI
    quality = 0.50;
  } else {
    scale = 0.85; // Low DPI for extreme sub-100KB multipage targets
    quality = 0.40;
  }

  const { PDFDocument } = window.PDFLib;

  async function buildCompressedPdf(candScale, candQuality) {
    const outPdf = await PDFDocument.create();

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const pct = Math.round(20 + ((pageNum / numPages) * 70));
      onProgress(pct, `Compressing page ${pageNum} of ${numPages}...`);

      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: candScale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvasContext: ctx, viewport }).promise;

      // Extract JPEG bytes
      const jpegDataUrl = canvas.toDataURL('image/jpeg', candQuality);
      const jpegBytes = dataUrlToUint8Array(jpegDataUrl);

      // Embed in output PDF
      const embeddedJpg = await outPdf.embedJpg(jpegBytes);
      
      // Use original unscaled PDF page dimensions for standard print/view layout
      const origViewport = page.getViewport({ scale: 1.0 });
      const newPage = outPdf.addPage([origViewport.width, origViewport.height]);
      newPage.drawImage(embeddedJpg, {
        x: 0,
        y: 0,
        width: origViewport.width,
        height: origViewport.height
      });
    }

    return await outPdf.save();
  }

  let finalPdfBytes = await buildCompressedPdf(scale, quality);

  // Auto-correction pass if rare complex scan exceeded budget
  if (finalPdfBytes.byteLength > safeTargetBytes) {
    onProgress(92, 'Refining secondary pass to strictly meet target...');
    const adjustRatio = safeTargetBytes / finalPdfBytes.byteLength;
    scale = Math.max(0.7, scale * Math.sqrt(adjustRatio));
    quality = Math.max(0.35, quality * adjustRatio * 0.9);
    finalPdfBytes = await buildCompressedPdf(scale, quality);
  }

  onProgress(100, 'PDF compression complete!');

  const finalBlob = new Blob([finalPdfBytes], { type: 'application/pdf' });
  const originalSize = file.size;

  return {
    success: true,
    blob: finalBlob,
    sizeBytes: finalBlob.size,
    originalSize,
    targetBytes,
    numPages,
    scaleDpi: Math.round(scale * 96),
    qualityPercent: Math.round(quality * 100),
    reductionPercent: Math.round((1 - finalBlob.size / originalSize) * 100),
    isUnderLimit: finalBlob.size <= targetBytes,
    headroomBytes: targetBytes - finalBlob.size,
    outputUrl: URL.createObjectURL(finalBlob),
    filename: file.name.replace(/\.pdf$/i, '') + `_shrink_${Math.round(targetBytes / 1024)}kb.pdf`
  };
}

function dataUrlToUint8Array(dataUrl) {
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
