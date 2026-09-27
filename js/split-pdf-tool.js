/**
 * TargetCompress - Dedicated Split PDF Controller
 */

import { splitPdf, triggerDownload, formatSize } from '/pdf-tools.js';
import { initAdManager, formatUserError, setupDragDrop, escapeHtml } from '/js/ad-manager.js';

function initSplitPdfTab() {
  const dropZone = document.getElementById('splitDropZone');
  const fileInput = document.getElementById('splitFileInput');
  const browseBtn = document.getElementById('splitBrowseBtn');
  const changeBtn = document.getElementById('splitChangeBtn');
  const workspace = document.getElementById('splitWorkspace');
  const metaName = document.getElementById('splitMetaName');
  const metaPages = document.getElementById('splitMetaPages');
  const rangeInput = document.getElementById('splitRangeInput');
  const startBtn = document.getElementById('splitStartBtn');
  const progressBox = document.getElementById('splitProgressBox');
  const progressStatus = document.getElementById('splitProgressStatus');
  const progressBar = document.getElementById('splitProgressBar');
  const progressPercent = document.getElementById('splitProgressPercent');
  const resultBox = document.getElementById('splitResultBox');
  const downloadBtn = document.getElementById('splitDownloadBtn');
  const newBtn = document.getElementById('splitNewBtn');

  if (!dropZone) return;

  let currentFile = null;
  let totalPages = 0;
  let resultBlob = null;

  browseBtn.addEventListener('click', () => fileInput.click());
  changeBtn.addEventListener('click', () => fileInput.click());
  newBtn.addEventListener('click', () => {
    currentFile = null;
    resultBlob = null;
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
      totalPages = doc.numPages;
      metaPages.textContent = `${totalPages} Page${totalPages > 1 ? 's' : ''}`;
      rangeInput.value = `1-${totalPages}`;
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
      resultBlob = await splitPdf(currentFile, rangeInput.value, (pct, status) => {
        progressBar.style.width = pct + '%';
        progressPercent.textContent = pct + '%';
        progressStatus.textContent = status;
      });

      resultBox.classList.remove('hidden');
    } catch (err) {
      alert(formatUserError(err, "Unable to split PDF. Please check your page range (e.g. 1-3, 5)."));
    } finally {
      startBtn.disabled = false;
      progressBox.classList.add('hidden');
    }
  });

  downloadBtn.addEventListener('click', () => {
    if (resultBlob && currentFile) {
      const base = currentFile.name.replace(/\.[^/.]+$/, '');
      triggerDownload(resultBlob, `${base}_extracted.pdf`);
    }
  });
}

/**
 * ============================================================================
 * NEW TOOL 4: PDF TO IMAGES (pdf-to-img-tab)
 * ============================================================================
 */

export function init() {
  initAdManager();
  initSplitPdfTab();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
