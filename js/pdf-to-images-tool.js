/**
 * TargetCompress - Dedicated PDF to Images Controller
 */

import { pdfToImages, triggerDownload, formatSize } from '/pdf-tools.js';
import { initAdManager, formatUserError, setupDragDrop, escapeHtml } from '/js/ad-manager.js';

function initPdfToImagesTab() {
  const dropZone = document.getElementById('pdfImgDropZone');
  const fileInput = document.getElementById('pdfImgFileInput');
  const browseBtn = document.getElementById('pdfImgBrowseBtn');
  const changeBtn = document.getElementById('pdfImgChangeBtn');
  const workspace = document.getElementById('pdfImgWorkspace');
  const metaName = document.getElementById('pdfImgMetaName');
  const metaPages = document.getElementById('pdfImgMetaPages');
  const formatPills = document.querySelectorAll('#pdfImgFormatGroup .option-pill-btn');
  const startBtn = document.getElementById('pdfImgStartBtn');
  const progressBox = document.getElementById('pdfImgProgressBox');
  const progressStatus = document.getElementById('pdfImgProgressStatus');
  const progressBar = document.getElementById('pdfImgProgressBar');
  const progressPercent = document.getElementById('pdfImgProgressPercent');
  const resultBox = document.getElementById('pdfImgResultBox');
  const downloadBtn = document.getElementById('pdfImgDownloadBtn');
  const newBtn = document.getElementById('pdfImgNewBtn');

  if (!dropZone) return;

  let currentFile = null;
  let selectedFormat = 'jpeg';
  let conversionResult = null;

  formatPills.forEach(pill => {
    pill.addEventListener('click', () => {
      formatPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      selectedFormat = pill.dataset.val;
    });
  });

  browseBtn.addEventListener('click', () => fileInput.click());
  changeBtn.addEventListener('click', () => fileInput.click());
  newBtn.addEventListener('click', () => {
    currentFile = null;
    conversionResult = null;
    workspace.classList.add('hidden');
    dropZone.classList.remove('hidden');
    fileInput.value = '';
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
  });

  setupDragDrop(dropZone, (files) => {
    const pdf = files.find(f => f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf');
    if (pdf) handleFile(pdf);
  });

  async function handleFile(file) {
    currentFile = file;
    metaName.textContent = file.name;
    metaPages.textContent = 'Detecting...';
    workspace.classList.remove('hidden');
    dropZone.classList.add('hidden');
    resultBox.classList.add('hidden');

    try {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = './pdf.worker.min.js';
      const doc = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
      metaPages.textContent = `${doc.numPages} Page${doc.numPages > 1 ? 's' : ''}`;
    } catch (err) {
      metaPages.textContent = 'Ready';
    }
  }

  startBtn.addEventListener('click', async () => {
    if (!currentFile) return;

    startBtn.disabled = true;
    progressBox.classList.remove('hidden');
    resultBox.classList.add('hidden');

    try {
      conversionResult = await pdfToImages(currentFile, selectedFormat, 1.5, (pct, status) => {
        progressBar.style.width = pct + '%';
        progressPercent.textContent = pct + '%';
        progressStatus.textContent = status;
      });

      downloadBtn.textContent = conversionResult.isZip ? '⬇️ Download Images (ZIP)' : '⬇️ Download Image (JPG)';
      resultBox.classList.remove('hidden');
    } catch (err) {
      alert(formatUserError(err, "Unable to convert PDF pages to images. Please check that the PDF is valid."));
    } finally {
      startBtn.disabled = false;
      progressBox.classList.add('hidden');
    }
  });

  downloadBtn.addEventListener('click', () => {
    if (conversionResult) {
      triggerDownload(conversionResult.blob, conversionResult.filename);
    }
  });
}

/**
 * ============================================================================
 * NEW TOOL 5: ROTATE PDF (pdf-rotate-tab)
 * ============================================================================
 */

export function init() {
  initAdManager();
  initPdfToImagesTab();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
