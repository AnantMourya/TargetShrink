/**
 * TargetCompress - Dedicated Video & GIF Compressor Controller
 * Strictly lazy-loads FFmpeg WASM only when compression is initiated.
 */

import { PRESETS, formatBytes, formatDuration, calculateCompressionPlan } from '/calculator.js';
import { generateSampleMedia } from '/sample-generator.js';
import { initAdManager, formatUserError } from '/js/ad-manager.js';


let compressorMod = null;
async function getCompressor() {
  if (!compressorMod) {
    compressorMod = await import('/compressor.js');
  }
  return compressorMod;
}


const ICONS = {
  discord: `<svg width="22" height="22" viewBox="0 0 24 24" fill="#5865F2"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>`,
  nitro: `<svg width="22" height="22" viewBox="0 0 24 24" fill="#EB459E"><path d="M5.8 2.5L2 9.5l10 12 10-12-3.8-7H5.8zm1.9 2h8.6l2.7 5H5L7.7 4.5zM12 11.2l4.8-1.7-4.8 8.8-4.8-8.8 4.8 1.7z"/></svg>`,
  slack: `<svg width="22" height="22" viewBox="0 0 24 24"><path fill="#36C5F0" d="M6 15a2 2 0 0 1-2 2H2a2 2 0 0 1 0-4h2a2 2 0 0 1 2 2zm1-2a2 2 0 0 1 2-2 2 2 0 0 1 2 2v5a2 2 0 0 1-4 0v-5z"/><path fill="#2EB67D" d="M9 6a2 2 0 0 1-2-2 2 2 0 0 1 2-2 2 2 0 0 1 2 2v2a2 2 0 0 1-2 2zm2 1a2 2 0 0 1 2 2 2 2 0 0 1-2 2H6a2 2 0 0 1 0-4h5z"/><path fill="#ECB22E" d="M18 9a2 2 0 0 1 2-2h2a2 2 0 0 1 0 4h-2a2 2 0 0 1-2-2zm-1 2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V6a2 2 0 0 1 4 0v5z"/><path fill="#E01E5A" d="M15 18a2 2 0 0 1 2 2 2 2 0 0 1-2 2 2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2zm-2-1a2 2 0 0 1-2-2 2 2 0 0 1 2-2h5a2 2 0 0 1 0 4h-5z"/></svg>`,
  github: `<svg width="22" height="22" viewBox="0 0 24 24" fill="#ffffff"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>`,
  email: `<svg width="22" height="22" viewBox="0 0 24 24" fill="#EA4335"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>`,
  whatsapp: `<svg width="22" height="22" viewBox="0 0 24 24" fill="#25D366"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2m.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.196 8.196 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24M8.53 7.33c-.16 0-.35.03-.53.28-.18.25-.69.67-.69 1.64 0 .97.71 1.91.81 2.05.1.14 1.39 2.12 3.37 2.97.47.2.84.32 1.12.41.47.15.9.13 1.24.08.38-.06 1.16-.47 1.32-.93.16-.46.16-.85.11-.93-.05-.08-.18-.13-.37-.22s-1.16-.57-1.34-.64c-.18-.07-.31-.1-.44.1-.13.2-.5.64-.61.77-.11.13-.23.15-.42.05-.19-.1-.8-.29-1.52-.94-.56-.5-.94-1.12-1.05-1.31-.11-.19-.01-.29.08-.39.08-.09.19-.23.28-.35.09-.12.13-.2.19-.34.06-.14.03-.26-.02-.36-.05-.1-.44-1.06-.61-1.45-.16-.39-.33-.33-.45-.34-.11-.01-.25-.01-.39-.01z"/></svg>`,
  custom: `<svg width="22" height="22" viewBox="0 0 24 24" fill="#00D2FF"><path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"/></svg>`
};

function initVideoTab() {
  const state = {
    currentFile: null,
    fileMeta: { name: '', size: 0, duration: 0, width: 0, height: 0, fps: 30, hasAudio: true, isGif: false },
    selectedPreset: 'discord-free',
    customLimitBytes: 8 * 1024 * 1024,
    safetyMargin: 0.04,
    forceMute: false,
    cropSquare: false,
    targetFormat: 'auto',
    qualityPreset: 'balanced',
    trimStart: 0,
    trimEnd: 0,
    currentPlan: null,
    isCompressing: false,
    result: null
  };

  const dropZone = document.getElementById('dropZone');
  const browseBtn = document.getElementById('browseBtn');
  const fileInput = document.getElementById('fileInput');
  const sampleVideoBtn = document.getElementById('sampleVideoBtn');
  const sampleEmojiBtn = document.getElementById('sampleEmojiBtn');
  const uploadSection = document.getElementById('uploadSection');
  const workspaceSection = document.getElementById('workspaceSection');
  const resultSection = document.getElementById('resultSection');

  const sourceFileName = document.getElementById('sourceFileName');
  const sourceFileSize = document.getElementById('sourceFileSize');
  const sourceDimensions = document.getElementById('sourceDimensions');
  const sourceDuration = document.getElementById('sourceDuration');
  const sourceAudioBadge = document.getElementById('sourceAudioBadge');
  const sourcePreviewVideo = document.getElementById('sourcePreviewVideo');
  const sourcePreviewImage = document.getElementById('sourcePreviewImage');
  const changeFileBtn = document.getElementById('changeFileBtn');

  const presetGrid = document.getElementById('presetGrid');
  const customSizeContainer = document.getElementById('customSizeContainer');
  const customSizeInput = document.getElementById('customSizeInput');
  const customUnitSelect = document.getElementById('customUnitSelect');

  const trimStartInput = document.getElementById('trimStartInput');
  const trimEndInput = document.getElementById('trimEndInput');
  const trimRangeTrack = document.getElementById('trimRangeTrack');
  const trimStartVal = document.getElementById('trimStartVal');
  const trimEndVal = document.getElementById('trimEndVal');
  const trimDurationVal = document.getElementById('trimDurationVal');
  const forceMuteToggle = document.getElementById('forceMuteToggle');
  const cropSquareToggle = document.getElementById('cropSquareToggle');
  const formatSelect = document.getElementById('formatSelect');
  const qualitySelect = document.getElementById('qualitySelect');
  const safetySlider = document.getElementById('safetySlider');
  const safetyVal = document.getElementById('safetyVal');

  const calcTargetCeiling = document.getElementById('calcTargetCeiling');
  const calcEstimatedSize = document.getElementById('calcEstimatedSize');
  const calcHeadroom = document.getElementById('calcHeadroom');
  const calcResolution = document.getElementById('calcResolution');
  const calcBitrate = document.getElementById('calcBitrate');
  const calcAudioBitrate = document.getElementById('calcAudioBitrate');
  const calcBppBadge = document.getElementById('calcBppBadge');
  const warningsContainer = document.getElementById('warningsContainer');
  const commandPreview = document.getElementById('commandPreview');

  const startShrinkBtn = document.getElementById('startShrinkBtn');
  const cancelShrinkBtn = document.getElementById('cancelShrinkBtn');
  const progressContainer = document.getElementById('progressContainer');
  const progressBar = document.getElementById('progressBar');
  const progressPercent = document.getElementById('progressPercent');
  const progressStatus = document.getElementById('progressStatus');
  const progressEta = document.getElementById('progressEta');
  const logDrawerToggle = document.getElementById('logDrawerToggle');
  const logDrawer = document.getElementById('logDrawer');
  const logOutput = document.getElementById('logOutput');
  const clearLogsBtn = document.getElementById('clearLogsBtn');

  const resultStatusBadge = document.getElementById('resultStatusBadge');
  const resultSavingsBadge = document.getElementById('resultSavingsBadge');
  const resultOriginalSize = document.getElementById('resultOriginalSize');
  const resultFinalSize = document.getElementById('resultFinalSize');
  const resultHeadroom = document.getElementById('resultHeadroom');
  const resultVideo = document.getElementById('resultVideo');
  const resultImage = document.getElementById('resultImage');
  const downloadBtn = document.getElementById('downloadBtn');
  const copyBtn = document.getElementById('copyBtn');
  const shrinkAgainBtn = document.getElementById('shrinkAgainBtn');
  const newFileBtn = document.getElementById('newFileBtn');
  const compareSyncBtn = document.getElementById('compareSyncBtn');
  const compareOriginalVideo = document.getElementById('compareOriginalVideo');
  const compareShrinkedVideo = document.getElementById('compareShrinkedVideo');

  function renderPresets() {
    presetGrid.innerHTML = '';
    Object.values(PRESETS).forEach((preset) => {
      const card = document.createElement('div');
      card.className = `preset-card ${state.selectedPreset === preset.id ? 'active' : ''}`;
      card.dataset.presetId = preset.id;
      const iconSvg = ICONS[preset.icon] || ICONS.custom;
      card.innerHTML = `
        <div class="preset-header">
          <span class="preset-icon" style="display:flex;align-items:center;">${iconSvg}</span>
          <span class="preset-badge">${preset.badge}</span>
        </div>
        <div class="preset-name">${preset.name}</div>
        <div class="preset-desc">${preset.description}</div>
      `;
      card.addEventListener('click', () => selectPreset(preset.id));
      presetGrid.appendChild(card);
    });
  }

  function selectPreset(presetId) {
    state.selectedPreset = presetId;
    document.querySelectorAll('.preset-card').forEach(c => c.classList.toggle('active', c.dataset.presetId === presetId));
    if (presetId === 'custom') {
      customSizeContainer.classList.remove('hidden');
    } else {
      customSizeContainer.classList.add('hidden');
    }
    if (presetId === 'slack-emoji') {
      state.cropSquare = true;
      cropSquareToggle.checked = true;
      state.targetFormat = 'gif';
      formatSelect.value = 'gif';
      state.forceMute = true;
      forceMuteToggle.checked = true;
    } else if (formatSelect.value === 'gif') {
      state.targetFormat = 'auto';
      formatSelect.value = 'auto';
    }
    recalculate();
  }

  function updateCustomLimit() {
    const num = parseFloat(customSizeInput.value) || 8;
    const unit = customUnitSelect.value;
    state.customLimitBytes = Math.floor(num * (unit === 'KB' ? 1024 : 1024 * 1024));
  }

  function recalculate() {
    if (!state.currentFile) return;
    const plan = calculateCompressionPlan({
      originalSize: state.fileMeta.size,
      duration: state.fileMeta.duration,
      width: state.fileMeta.width,
      height: state.fileMeta.height,
      fps: state.fileMeta.fps,
      hasAudio: state.fileMeta.hasAudio,
      isGif: state.fileMeta.isGif,
      presetId: state.selectedPreset,
      customLimitBytes: state.customLimitBytes,
      safetyMargin: state.safetyMargin,
      forceMute: state.forceMute,
      targetFormat: state.targetFormat,
      cropSquare: state.cropSquare,
      qualityPreset: state.qualityPreset,
      trimStart: state.trimStart,
      trimEnd: state.trimEnd
    });
    state.currentPlan = plan;

    calcTargetCeiling.textContent = plan.limitSizeFormatted;
    calcEstimatedSize.textContent = plan.estimatedSizeFormatted;
    calcHeadroom.textContent = `${plan.headroomFormatted} (${Math.round(plan.safetyMargin * 100)}% buffer)`;
    calcResolution.textContent = `${plan.targetWidth} × ${plan.targetHeight} @ ${plan.targetFps}fps`;
    calcBitrate.textContent = `${plan.videoBitrateKbps.toLocaleString()} kbps`;
    calcAudioBitrate.textContent = plan.willHaveAudio ? `${plan.audioBitrateKbps} kbps AAC` : 'Muted (0 kbps)';

    calcBppBadge.textContent = plan.bppQuality;
    calcBppBadge.className = `bpp-badge ${plan.bpp >= 0.08 ? 'optimal' : (plan.bpp >= 0.05 ? 'warning' : 'danger')}`;
    commandPreview.textContent = `ffmpeg ${plan.ffmpegArgs.join(' ')}`;

    warningsContainer.innerHTML = '';
    if (plan.warnings && plan.warnings.length > 0) {
      plan.warnings.forEach(w => {
        const div = document.createElement('div');
        div.className = `alert-item ${w.type}`;
        div.innerHTML = `<span class="alert-icon">💡</span><span>${w.text}</span>`;
        warningsContainer.appendChild(div);
      });
    }
  }

  function handleFileSelected(file) {
    state.currentFile = file;
    state.fileMeta.name = file.name;
    state.fileMeta.size = file.size;
    state.fileMeta.isGif = file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif');

    sourceFileName.textContent = file.name;
    sourceFileSize.textContent = formatBytes(file.size);

    const fileUrl = URL.createObjectURL(file);
    if (state.fileMeta.isGif) {
      sourcePreviewVideo.classList.add('hidden');
      sourcePreviewImage.classList.remove('hidden');
      sourcePreviewImage.src = fileUrl;
      sourceAudioBadge.textContent = '🔇 Silent';
      sourceAudioBadge.className = 'audio-badge mute';
      const img = new Image();
      img.onload = () => {
        state.fileMeta.width = img.naturalWidth || 400;
        state.fileMeta.height = img.naturalHeight || 400;
        state.fileMeta.duration = 3.0;
        state.fileMeta.hasAudio = false;
        finishMetadata();
      };
      img.src = fileUrl;
    } else {
      sourcePreviewImage.classList.add('hidden');
      sourcePreviewVideo.classList.remove('hidden');
      sourcePreviewVideo.src = fileUrl;
      sourcePreviewVideo.onloadedmetadata = () => {
        state.fileMeta.duration = sourcePreviewVideo.duration || 5;
        state.fileMeta.width = sourcePreviewVideo.videoWidth || 1280;
        state.fileMeta.height = sourcePreviewVideo.videoHeight || 720;
        state.fileMeta.hasAudio = true;
        sourceAudioBadge.textContent = '🔊 Has Audio';
        sourceAudioBadge.className = 'audio-badge active';
        finishMetadata();
      };
    }
  }

  function finishMetadata() {
    sourceDimensions.textContent = `${state.fileMeta.width} × ${state.fileMeta.height}`;
    sourceDuration.textContent = formatDuration(state.fileMeta.duration);
    state.trimStart = 0;
    state.trimEnd = state.fileMeta.duration;

    trimStartInput.min = 0;
    trimStartInput.max = state.fileMeta.duration;
    trimStartInput.value = 0;
    trimEndInput.min = 0;
    trimEndInput.max = state.fileMeta.duration;
    trimEndInput.value = state.fileMeta.duration;

    updateTrim();
    uploadSection.classList.add('hidden');
    workspaceSection.classList.remove('hidden');
    resultSection.classList.add('hidden');
    recalculate();
  }

  function updateTrim() {
    const dur = state.fileMeta.duration || 1;
    trimRangeTrack.style.left = `${(state.trimStart / dur) * 100}%`;
    trimRangeTrack.style.right = `${(1 - (state.trimEnd / dur)) * 100}%`;
    trimStartVal.textContent = formatDuration(state.trimStart);
    trimEndVal.textContent = formatDuration(state.trimEnd);
    trimDurationVal.textContent = `${(state.trimEnd - state.trimStart).toFixed(1)}s`;
  }

  // Bind Events
  dropZone.addEventListener('click', (e) => { if (e.target !== browseBtn) fileInput.click(); });
  if (browseBtn) browseBtn.addEventListener('click', (e) => { e.stopPropagation(); fileInput.click(); });
  fileInput.addEventListener('change', (e) => { if (e.target.files[0]) handleFileSelected(e.target.files[0]); });

  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-active'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-active'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-active');
    if (e.dataTransfer.files[0]) handleFileSelected(e.dataTransfer.files[0]);
  });

  sampleVideoBtn.addEventListener('click', async () => {
    dropZone.innerHTML = '<div class="spinner"></div><p>Synthesizing 1080p Clip in Canvas...</p>';
    const file = await generateSampleMedia({ type: 'video', durationSec: 5 });
    resetDropZone();
    selectPreset('discord-free');
    handleFileSelected(file);
  });

  sampleEmojiBtn.addEventListener('click', async () => {
    dropZone.innerHTML = '<div class="spinner"></div><p>Synthesizing Square Emoji in Canvas...</p>';
    const file = await generateSampleMedia({ type: 'emoji', durationSec: 3 });
    resetDropZone();
    selectPreset('slack-emoji');
    handleFileSelected(file);
  });

  function resetDropZone() {
    dropZone.innerHTML = `
      <div class="drop-icon">🎬</div>
      <h3>Drag & Drop Video or GIF Here</h3>
      <p>Supports MP4, WebM, MOV, MKV, AVI, GIF, WebP • 100% Private</p>
      <div class="drop-actions"><button class="btn btn-primary" id="browseBtn" type="button">Browse Local File</button></div>
    `;
    dropZone.querySelector('#browseBtn').addEventListener('click', (e) => { e.stopPropagation(); fileInput.click(); });
  }

  changeFileBtn.addEventListener('click', () => fileInput.click());
  customSizeInput.addEventListener('input', () => { updateCustomLimit(); recalculate(); });
  customUnitSelect.addEventListener('change', () => { updateCustomLimit(); recalculate(); });
  forceMuteToggle.addEventListener('change', (e) => { state.forceMute = e.target.checked; recalculate(); });
  cropSquareToggle.addEventListener('change', (e) => { state.cropSquare = e.target.checked; recalculate(); });
  formatSelect.addEventListener('change', (e) => { state.targetFormat = e.target.value; recalculate(); });
  qualitySelect.addEventListener('change', (e) => { state.qualityPreset = e.target.value; recalculate(); });
  safetySlider.addEventListener('input', (e) => {
    state.safetyMargin = parseInt(e.target.value, 10) / 100;
    safetyVal.textContent = `${e.target.value}%`;
    recalculate();
  });

  trimStartInput.addEventListener('input', () => {
    let s = parseFloat(trimStartInput.value);
    if (s >= state.trimEnd) s = Math.max(0, state.trimEnd - 0.2);
    state.trimStart = s;
    trimStartInput.value = s;
    if (sourcePreviewVideo) sourcePreviewVideo.currentTime = s;
    updateTrim();
    recalculate();
  });

  trimEndInput.addEventListener('input', () => {
    let ed = parseFloat(trimEndInput.value);
    if (ed <= state.trimStart) ed = Math.min(state.fileMeta.duration, state.trimStart + 0.2);
    state.trimEnd = ed;
    trimEndInput.value = ed;
    updateTrim();
    recalculate();
  });

  startShrinkBtn.addEventListener('click', async () => {
    if (!state.currentFile || !state.currentPlan || state.isCompressing) return;
    state.isCompressing = true;
    startShrinkBtn.classList.add('hidden');
    cancelShrinkBtn.classList.remove('hidden');
    progressContainer.classList.remove('hidden');

    try {
      const { compressMedia } = await getCompressor();
      const res = await compressMedia({
        file: state.currentFile,
        plan: state.currentPlan,
        onProgress: ({ percent, elapsedSec, etaSec, statusText }) => {
          progressBar.style.width = `${percent}%`;
          progressPercent.textContent = `${percent}%`;
          progressStatus.textContent = statusText;
          if (etaSec !== null) progressEta.textContent = `Elapsed: ${elapsedSec}s | ETA: ${etaSec}s`;
        },
        onLog: (m) => { logOutput.textContent += m + '\n'; logOutput.scrollTop = logOutput.scrollHeight; },
        onStatus: (st) => { progressStatus.textContent = st; }
      });

      state.result = res;
      workspaceSection.classList.add('hidden');
      resultSection.classList.remove('hidden');

      resultStatusBadge.textContent = res.isUnderLimit
        ? `✓ Target Achieved: ${formatBytes(res.sizeBytes)} (Target: ${state.currentPlan.limitSizeFormatted})`
        : `⚠️ Target could not be reached without quality loss (${formatBytes(res.sizeBytes)})`;
      resultStatusBadge.className = `status-badge ${res.isUnderLimit ? 'verified' : 'failed'}`;

      const red = Math.round((1 - (res.sizeBytes / state.fileMeta.size)) * 100);
      resultSavingsBadge.textContent = red >= 0 ? `-${red}% Size Reduction` : `+${Math.abs(red)}%`;
      resultOriginalSize.textContent = formatBytes(state.fileMeta.size);
      resultFinalSize.textContent = formatBytes(res.sizeBytes);
      resultHeadroom.textContent = `${formatBytes(Math.abs(res.headroom))} ${res.headroom >= 0 ? 'headroom' : 'over'}`;

      if (res.format === 'gif' || res.format === 'webp') {
        resultVideo.classList.add('hidden');
        resultImage.classList.remove('hidden');
        resultImage.src = res.outputUrl;
        compareSyncBtn.classList.add('hidden');
      } else {
        resultImage.classList.add('hidden');
        resultVideo.classList.remove('hidden');
        resultVideo.src = res.outputUrl;
        compareSyncBtn.classList.remove('hidden');
        compareOriginalVideo.src = URL.createObjectURL(state.currentFile);
        compareShrinkedVideo.src = res.outputUrl;
      }
    } catch (err) {
      alert(formatUserError(err, "Video compression was unable to complete. Try trimming dead footage or selecting a slightly larger target size."));
    } finally {
      state.isCompressing = false;
      startShrinkBtn.classList.remove('hidden');
      cancelShrinkBtn.classList.add('hidden');
      progressContainer.classList.add('hidden');
    }
  });

  cancelShrinkBtn.addEventListener('click', () => {
    if (confirm('Cancel video compression?')) {
      if (compressorMod) compressorMod.abortCompression();
      state.isCompressing = false;
      startShrinkBtn.classList.remove('hidden');
      cancelShrinkBtn.classList.add('hidden');
      progressContainer.classList.add('hidden');
    }
  });

  logDrawerToggle.addEventListener('click', () => {
    logDrawer.classList.toggle('open');
    logDrawerToggle.textContent = logDrawer.classList.contains('open') ? '▼ Hide FFmpeg Logs' : '▲ Show FFmpeg Logs';
  });
  clearLogsBtn.addEventListener('click', () => { logOutput.textContent = ''; });

  downloadBtn.addEventListener('click', () => {
    if (!state.result) return;
    const a = document.createElement('a');
    a.href = state.result.outputUrl;
    a.download = state.result.filename;
    a.click();
  });

  copyBtn.addEventListener('click', async () => {
    if (state.result && (state.result.format === 'gif' || state.result.format === 'webp')) {
      try {
        await navigator.clipboard.write([new ClipboardItem({ [state.result.blob.type]: state.result.blob })]);
        copyBtn.textContent = '✅ Copied to Clipboard!';
        setTimeout(() => copyBtn.textContent = '📋 Copy to Clipboard', 2000);
        return;
      } catch (e) {}
    }
    alert('Right-click media to copy or use the Download button.');
  });

  shrinkAgainBtn.addEventListener('click', () => {
    resultSection.classList.add('hidden');
    workspaceSection.classList.remove('hidden');
  });

  newFileBtn.addEventListener('click', () => {
    resultSection.classList.add('hidden');
    workspaceSection.classList.add('hidden');
    uploadSection.classList.remove('hidden');
    fileInput.value = '';
  });

  compareSyncBtn.addEventListener('click', () => {
    if (compareOriginalVideo.paused) {
      compareOriginalVideo.play();
      compareShrinkedVideo.play();
      compareSyncBtn.textContent = '⏸ Pause Both';
    } else {
      compareOriginalVideo.pause();
      compareShrinkedVideo.pause();
      compareSyncBtn.textContent = '▶ Sync Play Both';
    }
  });

  renderPresets();
}
/**
 * ============================================================================
 * TAB 2: IMAGE SIZE REDUCER (DIRECT EXACT KB / MB INPUT)
 * ============================================================================
 */

export function init() {
  initAdManager();
  initVideoTab();

  // Auto-apply preset if specified on page
  const presetId = window.INITIAL_VIDEO_PRESET;
  if (presetId) {
    const card = document.querySelector(`.preset-card[data-preset-id="${presetId}"]`);
    if (card) card.click();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
