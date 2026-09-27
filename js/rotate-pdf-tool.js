/**
 * TargetCompress - Dedicated Rotate PDF Controller
 */

import { rotatePdf, triggerDownload, formatSize } from '/pdf-tools.js';
import { initAdManager, formatUserError, setupDragDrop, escapeHtml } from '/js/ad-manager.js';

function initRotatePdfTab() {
  const dropZone = document.getElementById('rotateDropZone');
  const fileInput = document.getElementById('rotateFileInput');
  const browseBtn = document.getElementById('rotateBrowseBtn');
  const changeBtn = document.getElementById('rotateChangeBtn');
  const workspace = document.getElementById('rotateWorkspace');
  const metaName = document.getElementById('rotateMetaName');
  const metaPages = document.getElementById('rotateMetaPages');
  const anglePills = document.querySelectorAll('#rotateAngleGroup .option-pill-btn');
  const targetPills = document.querySelectorAll('#rotateTargetGroup .option-pill-btn');
  const startBtn = document.getElementById('rotateStartBtn');
  const progressBox = document.getElementById('rotateProgressBox');
  const progressStatus = document.getElementById('rotateProgressStatus');
  const progressBar = document.getElementById('rotateProgressBar');
  const progressPercent = document.getElementById('rotateProgressPercent');
  const resultBox = document.getElementById('rotateResultBox');
  const downloadBtn = document.getElementById('rotateDownloadBtn');
  const newBtn = document.getElementById('rotateNewBtn');

  if (!dropZone) return;

  let currentFile = null;
  let selectedAngle = 90;
  let selectedTarget = 'all';
  let resultBlob = null;

  anglePills.forEach(pill => {
    pill.addEventListener('click', () => {
      anglePills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      selectedAngle = parseInt(pill.dataset.val, 10);
    });
  });

  targetPills.forEach(pill => {
    pill.addEventListener('click', () => {
      targetPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      selectedTarget = pill.dataset.val;
    });
  });

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
      resultBlob = await rotatePdf(currentFile, selectedAngle, selectedTarget, (pct, status) => {
        progressBar.style.width = pct + '%';
        progressPercent.textContent = pct + '%';
        progressStatus.textContent = status;
      });

      resultBox.classList.remove('hidden');
    } catch (err) {
      alert(formatUserError(err, "Unable to rotate PDF pages. Please verify the document."));
    } finally {
      startBtn.disabled = false;
      progressBox.classList.add('hidden');
    }
  });

  downloadBtn.addEventListener('click', () => {
    if (resultBlob && currentFile) {
      const base = currentFile.name.replace(/\.[^/.]+$/, '');
      triggerDownload(resultBlob, `${base}_rotated.pdf`);
    }
  });
}

/**
 * ============================================================================
 * NEW TOOL 6: WATERMARK PDF (pdf-watermark-tab)
 * ============================================================================
 */

export function init() {
  initAdManager();
  initRotatePdfTab();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
