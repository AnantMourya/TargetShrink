/**
 * TargetCompress - Dedicated Merge PDF Controller
 */

import { mergePdfs, triggerDownload, formatSize } from '/pdf-tools.js';
import { initAdManager, formatUserError, setupDragDrop, escapeHtml } from '/js/ad-manager.js';

function initMergePdfTab() {
  const dropZone = document.getElementById('mergeDropZone');
  const fileInput = document.getElementById('mergeFileInput');
  const browseBtn = document.getElementById('mergeBrowseBtn');
  const addMoreBtn = document.getElementById('mergeAddMoreBtn');
  const workspace = document.getElementById('mergeWorkspace');
  const listContainer = document.getElementById('mergeList');
  const countEl = document.getElementById('mergeCount');
  const startBtn = document.getElementById('mergeStartBtn');
  const progressBox = document.getElementById('mergeProgressBox');
  const progressStatus = document.getElementById('mergeProgressStatus');
  const progressBar = document.getElementById('mergeProgressBar');
  const progressPercent = document.getElementById('mergeProgressPercent');
  const resultBox = document.getElementById('mergeResultBox');
  const downloadBtn = document.getElementById('mergeDownloadBtn');
  const newBtn = document.getElementById('mergeNewBtn');

  if (!dropZone) return;

  let pdfFiles = [];
  let resultBlob = null;

  browseBtn.addEventListener('click', () => fileInput.click());
  addMoreBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files));
      fileInput.value = '';
    }
  });

  setupDragDrop(dropZone, (files) => {
    const pdfs = files.filter(f => f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf');
    if (pdfs.length > 0) addFiles(pdfs);
  });

  function addFiles(newFiles) {
    pdfFiles = pdfFiles.concat(newFiles);
    renderList();
    workspace.classList.remove('hidden');
    resultBox.classList.add('hidden');
  }

  function renderList() {
    listContainer.innerHTML = '';
    countEl.textContent = pdfFiles.length;

    if (pdfFiles.length === 0) {
      workspace.classList.add('hidden');
      return;
    }

    pdfFiles.forEach((file, idx) => {
      const item = document.createElement('div');
      item.className = 'file-list-item';
      item.innerHTML = `
        <div class="file-item-info">
          <span class="file-item-icon">📄</span>
          <div style="min-width: 0;">
            <div class="file-item-name">${escapeHtml(file.name)}</div>
            <div class="file-item-meta">${formatSize(file.size)} • Document #${idx + 1}</div>
          </div>
        </div>
        <div class="file-item-actions">
          <button class="file-action-btn move-up" title="Move Up" aria-label="Move file up in order" ${idx === 0 ? 'disabled style="opacity:0.3"' : ''}>▲</button>
          <button class="file-action-btn move-down" title="Move Down" aria-label="Move file down in order" ${idx === pdfFiles.length - 1 ? 'disabled style="opacity:0.3"' : ''}>▼</button>
          <button class="file-action-btn delete" title="Remove" aria-label="Remove file from list">✕</button>
        </div>
      `;

      item.querySelector('.move-up').addEventListener('click', (e) => {
        e.stopPropagation();
        if (idx > 0) {
          const temp = pdfFiles[idx];
          pdfFiles[idx] = pdfFiles[idx - 1];
          pdfFiles[idx - 1] = temp;
          renderList();
        }
      });

      item.querySelector('.move-down').addEventListener('click', (e) => {
        e.stopPropagation();
        if (idx < pdfFiles.length - 1) {
          const temp = pdfFiles[idx];
          pdfFiles[idx] = pdfFiles[idx + 1];
          pdfFiles[idx + 1] = temp;
          renderList();
        }
      });

      item.querySelector('.delete').addEventListener('click', (e) => {
        e.stopPropagation();
        pdfFiles.splice(idx, 1);
        renderList();
      });

      listContainer.appendChild(item);
    });
  }

  startBtn.addEventListener('click', async () => {
    if (pdfFiles.length < 2) {
      alert('Please add at least 2 PDF files to merge.');
      return;
    }

    startBtn.disabled = true;
    progressBox.classList.remove('hidden');
    resultBox.classList.add('hidden');

    try {
      resultBlob = await mergePdfs(pdfFiles, (pct, status) => {
        progressBar.style.width = pct + '%';
        progressPercent.textContent = pct + '%';
        progressStatus.textContent = status;
      });

      resultBox.classList.remove('hidden');
    } catch (err) {
      alert(formatUserError(err, "Unable to merge PDFs. Please verify the documents are not password-protected."));
    } finally {
      startBtn.disabled = false;
      progressBox.classList.add('hidden');
    }
  });

  downloadBtn.addEventListener('click', () => {
    if (resultBlob) {
      triggerDownload(resultBlob, 'merged_document.pdf');
    }
  });

  newBtn.addEventListener('click', () => {
    pdfFiles = [];
    resultBlob = null;
    renderList();
  });
}

/**
 * ============================================================================
 * NEW TOOL 3: SPLIT PDF (pdf-split-tab)
 * ============================================================================
 */

export function init() {
  initAdManager();
  initMergePdfTab();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
