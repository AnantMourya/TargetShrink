/**
 * TargetCompress - Dedicated Image Converter Controller
 */

import { convertImageFormat } from '/image-tools.js';
import { triggerDownload, formatSize } from '/pdf-tools.js';
import { initAdManager, formatUserError, setupDragDrop, escapeHtml } from '/js/ad-manager.js';

function initImageConverterTab() {
  const dropZone = document.getElementById('convImgDropZone');
  const fileInput = document.getElementById('convImgFileInput');
  const browseBtn = document.getElementById('convImgBrowseBtn');
  const changeBtn = document.getElementById('convImgChangeBtn');
  const workspace = document.getElementById('convImgWorkspace');
  const metaName = document.getElementById('convImgMetaName');
  const metaSize = document.getElementById('convImgMetaSize');
  const formatPills = document.querySelectorAll('#convImgFormatGroup .option-pill-btn');
  const startBtn = document.getElementById('convImgStartBtn');
  const progressBox = document.getElementById('convImgProgressBox');
  const progressStatus = document.getElementById('convImgProgressStatus');
  const progressBar = document.getElementById('convImgProgressBar');
  const progressPercent = document.getElementById('convImgProgressPercent');
  const resultBox = document.getElementById('convImgResultBox');
  const downloadBtn = document.getElementById('convImgDownloadBtn');
  const newBtn = document.getElementById('convImgNewBtn');

  if (!dropZone) return;

  let currentFile = null;
  let targetFormat = 'png';
  let conversionResult = null;

  formatPills.forEach(pill => {
    pill.addEventListener('click', () => {
      formatPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      targetFormat = pill.dataset.val;
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
    const img = files.find(f => f.type.startsWith('image/'));
    if (img) handleFile(img);
  });

  function handleFile(file) {
    currentFile = file;
    metaName.textContent = file.name;
    metaSize.textContent = formatSize(file.size);
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
      conversionResult = await convertImageFormat(currentFile, targetFormat, 0.92, (pct, status) => {
        progressBar.style.width = pct + '%';
        progressPercent.textContent = pct + '%';
        progressStatus.textContent = status;
      });

      resultBox.classList.remove('hidden');
    } catch (err) {
      alert(formatUserError(err, "Image format conversion failed. Please try a different image."));
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
 * NEW TOOL 8: IMAGE RESIZER (img-resizer-tab)
 * ============================================================================
 */

export function init() {
  initAdManager();
  initImageConverterTab();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
