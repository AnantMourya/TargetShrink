/**
 * TargetCompress - Dedicated Images to PDF Controller
 */

import { imagesToPdf, triggerDownload, formatSize } from '/pdf-tools.js';
import { initAdManager, formatUserError, setupDragDrop, escapeHtml } from '/js/ad-manager.js';

function initImagesToPdfTab() {
  const dropZone = document.getElementById('imgPdfDropZone');
  const fileInput = document.getElementById('imgPdfFileInput');
  const browseBtn = document.getElementById('imgPdfBrowseBtn');
  const addMoreBtn = document.getElementById('imgPdfAddMoreBtn');
  const workspace = document.getElementById('imgPdfWorkspace');
  const listContainer = document.getElementById('imgPdfList');
  const countEl = document.getElementById('imgPdfCount');
  const convertBtn = document.getElementById('imgPdfConvertBtn');
  const progressBox = document.getElementById('imgPdfProgressBox');
  const progressStatus = document.getElementById('imgPdfProgressStatus');
  const progressBar = document.getElementById('imgPdfProgressBar');
  const progressPercent = document.getElementById('imgPdfProgressPercent');
  const resultBox = document.getElementById('imgPdfResultBox');
  const downloadBtn = document.getElementById('imgPdfDownloadBtn');
  const newBtn = document.getElementById('imgPdfNewBtn');
  const orientationPills = document.querySelectorAll('#imgPdfOrientationGroup .option-pill-btn');

  if (!dropZone) return;

  let imageFiles = [];
  let currentOrientation = 'auto';
  let resultBlob = null;

  // Option pills
  orientationPills.forEach(pill => {
    pill.addEventListener('click', () => {
      orientationPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentOrientation = pill.dataset.val;
    });
  });

  browseBtn.addEventListener('click', () => fileInput.click());
  addMoreBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files));
      fileInput.value = '';
    }
  });

  setupDragDrop(dropZone, (files) => {
    const imgs = files.filter(f => f.type.startsWith('image/'));
    if (imgs.length > 0) addFiles(imgs);
  });

  function addFiles(newFiles) {
    imageFiles = imageFiles.concat(newFiles);
    renderList();
    workspace.classList.remove('hidden');
    resultBox.classList.add('hidden');
  }

  function renderList() {
    listContainer.innerHTML = '';
    countEl.textContent = imageFiles.length;

    if (imageFiles.length === 0) {
      workspace.classList.add('hidden');
      return;
    }

    imageFiles.forEach((file, idx) => {
      const item = document.createElement('div');
      item.className = 'file-list-item';

      const thumbUrl = URL.createObjectURL(file);
      item.innerHTML = `
        <div class="file-item-info">
          <img src="${thumbUrl}" style="width: 32px; height: 32px; object-fit: cover; border-radius: 4px; border: 1px solid var(--border-subtle);">
          <div style="min-width: 0;">
            <div class="file-item-name">${escapeHtml(file.name)}</div>
            <div class="file-item-meta">${formatSize(file.size)} • Page ${idx + 1}</div>
          </div>
        </div>
        <div class="file-item-actions">
          <button class="file-action-btn move-up" title="Move Up" aria-label="Move file up in order" ${idx === 0 ? 'disabled style="opacity:0.3"' : ''}>▲</button>
          <button class="file-action-btn move-down" title="Move Down" aria-label="Move file down in order" ${idx === imageFiles.length - 1 ? 'disabled style="opacity:0.3"' : ''}>▼</button>
          <button class="file-action-btn delete" title="Remove" aria-label="Remove file from list">✕</button>
        </div>
      `;

      item.querySelector('.move-up').addEventListener('click', (e) => {
        e.stopPropagation();
        if (idx > 0) {
          const temp = imageFiles[idx];
          imageFiles[idx] = imageFiles[idx - 1];
          imageFiles[idx - 1] = temp;
          renderList();
        }
      });

      item.querySelector('.move-down').addEventListener('click', (e) => {
        e.stopPropagation();
        if (idx < imageFiles.length - 1) {
          const temp = imageFiles[idx];
          imageFiles[idx] = imageFiles[idx + 1];
          imageFiles[idx + 1] = temp;
          renderList();
        }
      });

      item.querySelector('.delete').addEventListener('click', (e) => {
        e.stopPropagation();
        imageFiles.splice(idx, 1);
        renderList();
      });

      listContainer.appendChild(item);
    });
  }

  convertBtn.addEventListener('click', async () => {
    if (imageFiles.length === 0) return;

    convertBtn.disabled = true;
    progressBox.classList.remove('hidden');
    resultBox.classList.add('hidden');

    try {
      resultBlob = await imagesToPdf(imageFiles, currentOrientation, 10, (pct, status) => {
        progressBar.style.width = pct + '%';
        progressPercent.textContent = pct + '%';
        progressStatus.textContent = status;
      });

      resultBox.classList.remove('hidden');
    } catch (err) {
      alert(formatUserError(err, "Unable to create PDF from selected images. Please verify your images are valid JPG, PNG, or WebP files."));
    } finally {
      convertBtn.disabled = false;
      progressBox.classList.add('hidden');
    }
  });

  downloadBtn.addEventListener('click', () => {
    if (resultBlob) {
      triggerDownload(resultBlob, 'images_combined.pdf');
    }
  });

  newBtn.addEventListener('click', () => {
    imageFiles = [];
    resultBlob = null;
    renderList();
  });
}

/**
 * ============================================================================
 * NEW TOOL 2: MERGE PDFs (pdf-merge-tab)
 * ============================================================================
 */

export function init() {
  initAdManager();
  initImagesToPdfTab();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
