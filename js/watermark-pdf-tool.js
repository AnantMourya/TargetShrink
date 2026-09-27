/**
 * TargetCompress - Dedicated Watermark PDF Controller
 */

import { watermarkPdf, triggerDownload, formatSize } from '/pdf-tools.js';
import { initAdManager, formatUserError, setupDragDrop, escapeHtml } from '/js/ad-manager.js';

function initWatermarkPdfTab() {
  const dropZone = document.getElementById('wmDropZone');
  const fileInput = document.getElementById('wmFileInput');
  const browseBtn = document.getElementById('wmBrowseBtn');
  const changeBtn = document.getElementById('wmChangeBtn');
  const workspace = document.getElementById('wmWorkspace');
  const textInput = document.getElementById('wmTextInput');
  const opacityInput = document.getElementById('wmOpacityInput');
  const opacityVal = document.getElementById('wmOpacityVal');
  const colorPills = document.querySelectorAll('#wmColorGroup .option-pill-btn');
  const startBtn = document.getElementById('wmStartBtn');
  const progressBox = document.getElementById('wmProgressBox');
  const progressStatus = document.getElementById('wmProgressStatus');
  const progressBar = document.getElementById('wmProgressBar');
  const progressPercent = document.getElementById('wmProgressPercent');
  const resultBox = document.getElementById('wmResultBox');
  const downloadBtn = document.getElementById('wmDownloadBtn');
  const newBtn = document.getElementById('wmNewBtn');

  if (!dropZone) return;

  let currentFile = null;
  let selectedColor = 'gray';
  let resultBlob = null;

  colorPills.forEach(pill => {
    pill.addEventListener('click', () => {
      colorPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      selectedColor = pill.dataset.val;
    });
  });

  opacityInput.addEventListener('input', () => {
    opacityVal.textContent = Math.round(parseFloat(opacityInput.value) * 100) + '%';
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

  function handleFile(file) {
    currentFile = file;
    workspace.classList.remove('hidden');
    dropZone.classList.add('hidden');
    resultBox.classList.add('hidden');
  }

  startBtn.addEventListener('click', async () => {
    if (!currentFile) return;

    startBtn.disabled = true;
    progressBox.classList.remove('hidden');
    resultBox.classList.add('hidden');

    try {
      resultBlob = await watermarkPdf({
        file: currentFile,
        text: textInput.value || 'CONFIDENTIAL',
        opacity: parseFloat(opacityInput.value),
        fontSize: 48,
        color: selectedColor,
        onProgress: (pct, status) => {
          progressBar.style.width = pct + '%';
          progressPercent.textContent = pct + '%';
          progressStatus.textContent = status;
        }
      });

      resultBox.classList.remove('hidden');
    } catch (err) {
      alert(formatUserError(err, "Unable to apply watermark to PDF."));
    } finally {
      startBtn.disabled = false;
      progressBox.classList.add('hidden');
    }
  });

  downloadBtn.addEventListener('click', () => {
    if (resultBlob && currentFile) {
      const base = currentFile.name.replace(/\.[^/.]+$/, '');
      triggerDownload(resultBlob, `${base}_watermarked.pdf`);
    }
  });
}

/**
 * ============================================================================
 * NEW TOOL 7: IMAGE FORMAT CONVERTER (img-converter-tab)
 * ============================================================================
 */

export function init() {
  initAdManager();
  initWatermarkPdfTab();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
