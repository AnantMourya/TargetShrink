/**
 * TargetCompress - Dedicated Image Shrinker Controller
 * 100% In-Browser Canvas Processing - Zero Server Uploads, Zero WASM.
 */

import { formatBytes } from '/calculator.js';
import { IMAGE_PRESETS, compressImageToTarget } from '/image-shrinker.js';
import { initAdManager, formatUserError } from '/js/ad-manager.js';

function initImageTab() {
  let imgFile = null;
  let imgResult = null;

  const dropZone = document.getElementById('imgDropZone');
  const browseBtn = document.getElementById('imgBrowseBtn');
  const fileInput = document.getElementById('imgFileInput');
  const uploadSection = document.getElementById('imgUploadSection');
  const workspaceSection = document.getElementById('imgWorkspaceSection');
  const resultSection = document.getElementById('imgResultSection');

  const sourcePreview = document.getElementById('imgSourcePreview');
  const metaName = document.getElementById('imgMetaName');
  const metaSize = document.getElementById('imgMetaSize');
  const metaDimensions = document.getElementById('imgMetaDimensions');
  const metaFormat = document.getElementById('imgMetaFormat');
  const changeBtn = document.getElementById('imgChangeBtn');

  const targetInput = document.getElementById('imgTargetInput');
  const targetUnit = document.getElementById('imgTargetUnit');
  const presetChips = document.getElementById('imgPresetChips');
  const outputFormat = document.getElementById('imgOutputFormat');
  const shrinkBtn = document.getElementById('imgShrinkBtn');

  const progressContainer = document.getElementById('imgProgressContainer');
  const progressBar = document.getElementById('imgProgressBar');
  const progressStatus = document.getElementById('imgProgressStatus');
  const progressPercent = document.getElementById('imgProgressPercent');

  const resultBadge = document.getElementById('imgResultBadge');
  const savingsBadge = document.getElementById('imgSavingsBadge');
  const origSize = document.getElementById('imgResultOrigSize');
  const newSize = document.getElementById('imgResultNewSize');
  const targetSizeVal = document.getElementById('imgResultTargetSize');
  const compareOrig = document.getElementById('imgCompareOrig');
  const compareNew = document.getElementById('imgCompareNew');
  const downloadBtn = document.getElementById('imgDownloadBtn');
  const copyBtn = document.getElementById('imgCopyBtn');
  const compressAgainBtn = document.getElementById('imgCompressAgainBtn');
  const newFileBtn = document.getElementById('imgNewFileBtn');

  function renderImagePresets() {
    presetChips.innerHTML = '';
    IMAGE_PRESETS.forEach(p => {
      const chip = document.createElement('button');
      chip.className = 'preset-chip';
      chip.type = 'button';
      chip.innerHTML = `<span>${p.name}</span> <strong style="color:#00d2ff;">(${p.label})</strong>`;
      chip.addEventListener('click', () => {
        document.querySelectorAll('#imgPresetChips .preset-chip').forEach(c => c.classList.remove('active'));
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

  function handleFile(file) {
    imgFile = file;
    metaName.textContent = file.name;
    metaSize.textContent = formatBytes(file.size);
    metaFormat.textContent = file.type || 'image/jpeg';

    const url = URL.createObjectURL(file);
    sourcePreview.src = url;

    const testImg = new Image();
    testImg.onload = () => {
      metaDimensions.textContent = `${testImg.naturalWidth} × ${testImg.naturalHeight}`;
      uploadSection.classList.add('hidden');
      workspaceSection.classList.remove('hidden');
      resultSection.classList.add('hidden');
    };
    testImg.src = url;
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
    if (!imgFile) return;

    const val = parseFloat(targetInput.value) || 200;
    const mult = targetUnit.value === 'MB' ? 1024 * 1024 : 1024;
    const targetBytes = Math.floor(val * mult);

    shrinkBtn.disabled = true;
    progressContainer.classList.remove('hidden');
    progressBar.style.width = '0%';

    try {
      imgResult = await compressImageToTarget({
        file: imgFile,
        targetBytes,
        outputFormat: outputFormat.value,
        onProgress: (pct, msg) => {
          progressBar.style.width = `${pct}%`;
          progressPercent.textContent = `${pct}%`;
          progressStatus.textContent = msg;
        }
      });

      workspaceSection.classList.add('hidden');
      resultSection.classList.remove('hidden');

      resultBadge.textContent = imgResult.isUnderLimit
        ? `✓ Target Achieved: ${formatBytes(imgResult.sizeBytes)} (Target: ${formatBytes(targetBytes)})`
        : `⚠️ Target could not be reached without quality loss (${formatBytes(imgResult.sizeBytes)})`;
      resultBadge.className = `status-badge ${imgResult.isUnderLimit ? 'verified' : 'failed'}`;

      savingsBadge.textContent = `-${imgResult.reductionPercent}% Size Reduction`;
      origSize.textContent = formatBytes(imgFile.size);
      newSize.textContent = formatBytes(imgResult.sizeBytes);
      targetSizeVal.textContent = formatBytes(targetBytes);

      compareOrig.src = URL.createObjectURL(imgFile);
      compareNew.src = imgResult.outputUrl;

    } catch (err) {
      alert(formatUserError(err, "Unable to compress this image. Try another supported image format (JPG, PNG, WebP) or a slightly larger target size."));
    } finally {
      shrinkBtn.disabled = false;
      progressContainer.classList.add('hidden');
    }
  });

  downloadBtn.addEventListener('click', () => {
    if (!imgResult) return;
    const a = document.createElement('a');
    a.href = imgResult.outputUrl;
    a.download = imgFile.name.replace(/\.[^.]+$/, '') + `_shrink_${targetInput.value}${targetUnit.value}.${imgResult.format}`;
    a.click();
  });

  copyBtn.addEventListener('click', async () => {
    if (!imgResult) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ [imgResult.blob.type]: imgResult.blob })]);
      copyBtn.textContent = '✅ Image Copied to Clipboard!';
      setTimeout(() => copyBtn.textContent = '📋 Copy Image to Clipboard', 2000);
    } catch (e) {
      alert('Use the Download button or right-click to copy.');
    }
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

  renderImagePresets();
}

/**
 * ============================================================================
 * TAB 3: PDF SIZE REDUCER (DIRECT EXACT KB / MB INPUT)
 * ============================================================================
 */

export function init() {
  initAdManager();
  initImageTab();

  // Auto-apply initial target preset if defined on page
  const targetVal = window.INITIAL_TARGET_VAL || (document.getElementById('imgTargetInput') && document.getElementById('imgTargetInput').value);
  const targetUnit = window.INITIAL_TARGET_UNIT || (document.getElementById('imgTargetUnit') && document.getElementById('imgTargetUnit').value);
  if (targetVal) {
    const valInput = document.getElementById('imgTargetInput');
    const unitInput = document.getElementById('imgTargetUnit');
    if (valInput) valInput.value = targetVal;
    if (unitInput && targetUnit) unitInput.value = targetUnit;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
