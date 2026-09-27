/**
 * TargetCompress - Dedicated PDF Shrinker Controller
 * Lazy loads pdf.js and pdf-lib only on demand when compression runs.
 */

import { formatBytes } from '/calculator.js';
import { PDF_PRESETS, compressPdfToTarget } from '/pdf-shrinker.js';
import { initAdManager, formatUserError } from '/js/ad-manager.js';

function initPdfTab() {
  let pdfFile = null;
  let pdfResult = null;

  const dropZone = document.getElementById('pdfDropZone');
  const browseBtn = document.getElementById('pdfBrowseBtn');
  const fileInput = document.getElementById('pdfFileInput');
  const uploadSection = document.getElementById('pdfUploadSection');
  const workspaceSection = document.getElementById('pdfWorkspaceSection');
  const resultSection = document.getElementById('pdfResultSection');

  const metaName = document.getElementById('pdfMetaName');
  const metaSize = document.getElementById('pdfMetaSize');
  const metaPages = document.getElementById('pdfMetaPages');
  const changeBtn = document.getElementById('pdfChangeBtn');

  const targetInput = document.getElementById('pdfTargetInput');
  const targetUnit = document.getElementById('pdfTargetUnit');
  const presetChips = document.getElementById('pdfPresetChips');
  const shrinkBtn = document.getElementById('pdfShrinkBtn');

  const progressContainer = document.getElementById('pdfProgressContainer');
  const progressBar = document.getElementById('pdfProgressBar');
  const progressStatus = document.getElementById('pdfProgressStatus');
  const progressPercent = document.getElementById('pdfProgressPercent');

  const resultBadge = document.getElementById('pdfResultBadge');
  const savingsBadge = document.getElementById('pdfSavingsBadge');
  const origSize = document.getElementById('pdfResultOrigSize');
  const newSize = document.getElementById('pdfResultNewSize');
  const targetSizeVal = document.getElementById('pdfResultTargetSize');
  const downloadBtn = document.getElementById('pdfDownloadBtn');
  const compressAgainBtn = document.getElementById('pdfCompressAgainBtn');
  const newFileBtn = document.getElementById('pdfNewFileBtn');

  function renderPdfPresets() {
    presetChips.innerHTML = '';
    PDF_PRESETS.forEach(p => {
      const chip = document.createElement('button');
      chip.className = 'preset-chip';
      chip.type = 'button';
      chip.innerHTML = `<span>${p.name}</span> <strong style="color:#00d2ff;">(${p.label})</strong>`;
      chip.addEventListener('click', () => {
        document.querySelectorAll('#pdfPresetChips .preset-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        if (p.targetBytes >= 1024 * 1024) {
          targetInput.value = (p.targetBytes / (1024 * 1024)).toFixed(1);
          targetUnit.value = 'MB';
        } else {
          targetInput.value = Math.round(p.targetBytes / 1024);
          targetUnit.value = 'KB';
        }
      });
      presetChips.appendChild(chip);
    });
  }

  async function handleFile(file) {
    pdfFile = file;
    metaName.textContent = file.name;
    metaSize.textContent = formatBytes(file.size);

    metaPages.textContent = 'Counting pages...';
    uploadSection.classList.add('hidden');
    workspaceSection.classList.remove('hidden');
    resultSection.classList.add('hidden');

    try {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
        const doc = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
        metaPages.textContent = `${doc.numPages} Page${doc.numPages > 1 ? 's' : ''}`;
      } else {
        metaPages.textContent = 'Ready';
      }
    } catch (e) {
      metaPages.textContent = '1+ Pages';
    }
  }

  dropZone.addEventListener('click', (e) => { if (e.target !== browseBtn) fileInput.click(); });
  if (browseBtn) browseBtn.addEventListener('click', (e) => { e.stopPropagation(); fileInput.click(); });
  fileInput.addEventListener('change', (e) => { if (e.target.files[0]) handleFile(e.target.files[0]); });
  changeBtn.addEventListener('click', () => fileInput.click());

  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-active'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-active'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-active');
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });

  shrinkBtn.addEventListener('click', async () => {
    if (!pdfFile) return;

    const val = parseFloat(targetInput.value) || 500;
    const mult = targetUnit.value === 'MB' ? 1024 * 1024 : 1024;
    const targetBytes = Math.floor(val * mult);

    shrinkBtn.disabled = true;
    progressContainer.classList.remove('hidden');
    progressBar.style.width = '0%';

    try {
      pdfResult = await compressPdfToTarget({
        file: pdfFile,
        targetBytes,
        onProgress: (pct, msg) => {
          progressBar.style.width = `${pct}%`;
          progressPercent.textContent = `${pct}%`;
          progressStatus.textContent = msg;
        }
      });

      workspaceSection.classList.add('hidden');
      resultSection.classList.remove('hidden');

      resultBadge.textContent = pdfResult.isUnderLimit
        ? `✓ Target Achieved: ${formatBytes(pdfResult.sizeBytes)} (Target: ${formatBytes(targetBytes)})`
        : `⚠️ Target could not be reached without quality loss (${formatBytes(pdfResult.sizeBytes)})`;
      resultBadge.className = `status-badge ${pdfResult.isUnderLimit ? 'verified' : 'failed'}`;

      savingsBadge.textContent = `-${pdfResult.reductionPercent}% Size Reduction`;
      origSize.textContent = formatBytes(pdfFile.size);
      newSize.textContent = formatBytes(pdfResult.sizeBytes);
      targetSizeVal.textContent = formatBytes(targetBytes);

    } catch (err) {
      alert(formatUserError(err, "Unable to compress this PDF. Try selecting a slightly larger target size or verify the document is not password-protected."));
    } finally {
      shrinkBtn.disabled = false;
      progressContainer.classList.add('hidden');
    }
  });

  downloadBtn.addEventListener('click', () => {
    if (!pdfResult) return;
    const a = document.createElement('a');
    a.href = pdfResult.outputUrl;
    a.download = pdfResult.filename;
    a.click();
  });

  compressAgainBtn.addEventListener('click', () => {
    resultSection.classList.add('hidden');
    workspaceSection.classList.remove('hidden');
  });

  newFileBtn.addEventListener('click', () => {
    resultSection.classList.add('hidden');
    workspaceSection.classList.add('hidden');
    uploadSection.classList.remove('hidden');
    fileInput.value = '';
  });

  renderPdfPresets();
}

/**
 * ============================================================================
 * TAB 4: PDF ⇄ WORD CONVERTER
 * ============================================================================
 */

export function init() {
  initAdManager();
  initPdfTab();

  // Auto-apply initial target preset if defined on page
  const targetVal = window.INITIAL_TARGET_VAL || (document.getElementById('pdfTargetInput') && document.getElementById('pdfTargetInput').value);
  const targetUnit = window.INITIAL_TARGET_UNIT || (document.getElementById('pdfTargetUnit') && document.getElementById('pdfTargetUnit').value);
  if (targetVal) {
    const valInput = document.getElementById('pdfTargetInput');
    const unitInput = document.getElementById('pdfTargetUnit');
    if (valInput) valInput.value = targetVal;
    if (unitInput && targetUnit) unitInput.value = targetUnit;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
