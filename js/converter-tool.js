/**
 * TargetCompress - Dedicated PDF <-> Word Converter Controller
 */

import { formatBytes } from '/calculator.js';
import { convertPdfToWord, convertWordToPdf } from '/doc-converter.js';
import { initAdManager, formatUserError } from '/js/ad-manager.js';

function initConverterTab() {
  let docMode = 'pdf-to-word'; // or 'word-to-pdf'
  let docFile = null;
  let docResult = null;

  const modePdfToWord = document.getElementById('modePdfToWord');
  const modeWordToPdf = document.getElementById('modeWordToPdf');
  const dropZone = document.getElementById('docDropZone');
  const dropIcon = document.getElementById('docDropIcon');
  const dropTitle = document.getElementById('docDropTitle');
  const dropDesc = document.getElementById('docDropDesc');
  const browseBtn = document.getElementById('docBrowseBtn');
  const fileInput = document.getElementById('docFileInput');

  const uploadSection = document.getElementById('docUploadSection');
  const workspaceSection = document.getElementById('docWorkspaceSection');
  const metaName = document.getElementById('docMetaName');
  const metaSize = document.getElementById('docMetaSize');
  const changeBtn = document.getElementById('docChangeBtn');

  const convertBtn = document.getElementById('docConvertBtn');
  const progressContainer = document.getElementById('docProgressContainer');
  const progressBar = document.getElementById('docProgressBar');
  const progressStatus = document.getElementById('docProgressStatus');
  const progressPercent = document.getElementById('docProgressPercent');

  const resultBox = document.getElementById('docResultBox');
  const downloadBtn = document.getElementById('docDownloadBtn');
  const newBtn = document.getElementById('docNewBtn');

  function setMode(mode) {
    docMode = mode;
    modePdfToWord.classList.toggle('active', mode === 'pdf-to-word');
    modeWordToPdf.classList.toggle('active', mode === 'word-to-pdf');

    if (mode === 'pdf-to-word') {
      dropIcon.textContent = '📄';
      dropTitle.textContent = 'Drag & Drop PDF File Here';
      dropDesc.textContent = 'Converts PDF text & layout into editable Microsoft Word (.docx)';
      fileInput.accept = '.pdf';
      convertBtn.textContent = '⚡ Convert PDF to Word (.docx)';
    } else {
      dropIcon.textContent = '📑';
      dropTitle.textContent = 'Drag & Drop Word Document (.docx) Here';
      dropDesc.textContent = 'Converts Word document into clean, shareable PDF';
      fileInput.accept = '.docx';
      convertBtn.textContent = '⚡ Convert Word to PDF (.pdf)';
    }

    workspaceSection.classList.add('hidden');
    uploadSection.classList.remove('hidden');
    resultBox.classList.add('hidden');
    docFile = null;
  }

  modePdfToWord.addEventListener('click', () => setMode('pdf-to-word'));
  modeWordToPdf.addEventListener('click', () => setMode('word-to-pdf'));

  function handleFile(file) {
    docFile = file;
    metaName.textContent = file.name;
    metaSize.textContent = formatBytes(file.size);

    uploadSection.classList.add('hidden');
    workspaceSection.classList.remove('hidden');
    resultBox.classList.add('hidden');
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

  convertBtn.addEventListener('click', async () => {
    if (!docFile) return;

    convertBtn.disabled = true;
    progressContainer.classList.remove('hidden');
    progressBar.style.width = '0%';

    try {
      if (docMode === 'pdf-to-word') {
        docResult = await convertPdfToWord({
          file: docFile,
          onProgress: (pct, msg) => {
            progressBar.style.width = `${pct}%`;
            progressPercent.textContent = `${pct}%`;
            progressStatus.textContent = msg;
          }
        });
      } else {
        docResult = await convertWordToPdf({
          file: docFile,
          onProgress: (pct, msg) => {
            progressBar.style.width = `${pct}%`;
            progressPercent.textContent = `${pct}%`;
            progressStatus.textContent = msg;
          }
        });
      }

      resultBox.classList.remove('hidden');
      convertBtn.classList.add('hidden');

    } catch (err) {
      alert(formatUserError(err, "Document conversion failed. Please verify the file is a valid PDF or Word (.docx) document."));
    } finally {
      convertBtn.disabled = false;
      progressContainer.classList.add('hidden');
    }
  });

  downloadBtn.addEventListener('click', () => {
    if (!docResult) return;
    const a = document.createElement('a');
    a.href = docResult.outputUrl;
    a.download = docResult.filename;
    a.click();
  });

  newBtn.addEventListener('click', () => {
    workspaceSection.classList.add('hidden');
    uploadSection.classList.remove('hidden');
    resultBox.classList.add('hidden');
    convertBtn.classList.remove('hidden');
    fileInput.value = '';
    docFile = null;
  });
}


/**
 * ============================================================================
 * NEW TOOL 1: IMAGES TO PDF (img-to-pdf-tab)
 * ============================================================================
 */

export function init() {
  initAdManager();
  initConverterTab();

  // Check if default mode requested (e.g. word-to-pdf)
  if (window.INITIAL_CONVERTER_MODE === 'word-to-pdf') {
    const btn = document.getElementById('modeWordToPdf');
    if (btn) btn.click();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
