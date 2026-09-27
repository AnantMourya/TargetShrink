/**
 * TargetCompress - Dedicated Image Resizer Controller
 */

import { resizeImage } from '/image-tools.js';
import { triggerDownload, formatSize } from '/pdf-tools.js';
import { initAdManager, formatUserError, setupDragDrop, escapeHtml } from '/js/ad-manager.js';

function initImageResizerTab() {
  const dropZone = document.getElementById('resizeDropZone');
  const fileInput = document.getElementById('resizeFileInput');
  const browseBtn = document.getElementById('resizeBrowseBtn');
  const changeBtn = document.getElementById('resizeChangeBtn');
  const workspace = document.getElementById('resizeWorkspace');
  const origDim = document.getElementById('resizeOrigDim');
  const origSize = document.getElementById('resizeOrigSize');
  const widthInput = document.getElementById('resizeWidthInput');
  const heightInput = document.getElementById('resizeHeightInput');
  const lockAspect = document.getElementById('resizeLockAspect');
  const scalePills = document.querySelectorAll('#resizeScaleGroup .option-pill-btn');
  const startBtn = document.getElementById('resizeStartBtn');
  const progressBox = document.getElementById('resizeProgressBox');
  const progressStatus = document.getElementById('resizeProgressStatus');
  const progressBar = document.getElementById('resizeProgressBar');
  const progressPercent = document.getElementById('resizeProgressPercent');
  const resultBox = document.getElementById('resizeResultBox');
  const downloadBtn = document.getElementById('resizeDownloadBtn');
  const newBtn = document.getElementById('resizeNewBtn');

  if (!dropZone) return;

  let currentFile = null;
  let naturalW = 0;
  let naturalH = 0;
  let aspectRatio = 1;
  let resizeResult = null;

  browseBtn.addEventListener('click', () => fileInput.click());
  changeBtn.addEventListener('click', () => fileInput.click());
  newBtn.addEventListener('click', () => {
    currentFile = null;
    resizeResult = null;
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
    origSize.textContent = formatSize(file.size);

    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      naturalW = img.naturalWidth;
      naturalH = img.naturalHeight;
      aspectRatio = naturalW / naturalH;

      origDim.textContent = `${naturalW} × ${naturalH} px`;
      widthInput.value = naturalW;
      heightInput.value = naturalH;

      workspace.classList.remove('hidden');
      dropZone.classList.add('hidden');
      resultBox.classList.add('hidden');
    };
    img.src = url;
  }

  // Proportional resize logic
  widthInput.addEventListener('input', () => {
    if (lockAspect.checked && aspectRatio > 0) {
      const w = parseFloat(widthInput.value) || 0;
      heightInput.value = Math.round(w / aspectRatio);
    }
  });

  heightInput.addEventListener('input', () => {
    if (lockAspect.checked && aspectRatio > 0) {
      const h = parseFloat(heightInput.value) || 0;
      widthInput.value = Math.round(h * aspectRatio);
    }
  });

  // Scale preset buttons
  scalePills.forEach(pill => {
    pill.addEventListener('click', () => {
      const scale = parseFloat(pill.dataset.scale);
      if (naturalW > 0 && naturalH > 0 && scale > 0) {
        widthInput.value = Math.round(naturalW * scale);
        heightInput.value = Math.round(naturalH * scale);
      }
    });
  });

  startBtn.addEventListener('click', async () => {
    const targetW = parseInt(widthInput.value, 10);
    const targetH = parseInt(heightInput.value, 10);

    if (!currentFile || !targetW || !targetH) {
      alert('Please enter valid width and height numbers.');
      return;
    }

    startBtn.disabled = true;
    progressBox.classList.remove('hidden');
    resultBox.classList.add('hidden');

    try {
      resizeResult = await resizeImage({
        file: currentFile,
        targetWidth: targetW,
        targetHeight: targetH,
        quality: 0.92,
        onProgress: (pct, status) => {
          progressBar.style.width = pct + '%';
          progressPercent.textContent = pct + '%';
          progressStatus.textContent = status;
        }
      });

      resultBox.classList.remove('hidden');
    } catch (err) {
      alert(formatUserError(err, "Image resizing failed. Please enter valid positive pixel dimensions."));
    } finally {
      startBtn.disabled = false;
      progressBox.classList.add('hidden');
    }
  });

  downloadBtn.addEventListener('click', () => {
    if (resizeResult) {
      triggerDownload(resizeResult.blob, resizeResult.filename);
    }
  });
}

export function init() {
  initAdManager();
  initImageResizerTab();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
