// TargetCompress Dual-Mode (Image & PDF) Extension Logic (Manifest V3 Compliant)

let currentMode = 'image'; // 'image' | 'pdf'
let currentUnit = 'KB';
let compressedBlob = null;
let compressedFileName = 'compressed_file';

const IMAGE_PRESETS = [
  { size: 50, unit: 'KB', label: '50 KB', desc: 'Govt ID' },
  { size: 20, unit: 'KB', label: '20 KB', desc: 'Signature' },
  { size: 100, unit: 'KB', label: '100 KB', desc: 'Form' },
  { size: 1, unit: 'MB', label: '1 MB', desc: 'Web' }
];

const PDF_PRESETS = [
  { size: 100, unit: 'KB', label: '100 KB', desc: 'UPSC / Exam' },
  { size: 200, unit: 'KB', label: '200 KB', desc: 'Portal' },
  { size: 500, unit: 'KB', label: '500 KB', desc: 'Visa / Govt' },
  { size: 1, unit: 'MB', label: '1 MB', desc: 'Email' }
];

document.addEventListener('DOMContentLoaded', () => {
  const modeImageBtn = document.getElementById('modeImage');
  const modePdfBtn = document.getElementById('modePdf');
  const presetLabel = document.getElementById('presetLabel');
  const presetChipsContainer = document.getElementById('presetChipsContainer');
  const targetInput = document.getElementById('targetInput');
  const btnKb = document.getElementById('btnKb');
  const btnMb = document.getElementById('btnMb');
  const dropzone = document.getElementById('dropzone');
  const dropzoneIcon = document.getElementById('dropzoneIcon');
  const dropzoneText = document.getElementById('dropzoneText');
  const dropzoneSub = document.getElementById('dropzoneSub');
  const fileInput = document.getElementById('fileInput');
  const resultCard = document.getElementById('resultCard');
  const fileNameEl = document.getElementById('fileName');
  const fileStatsEl = document.getElementById('fileStats');
  const fileThumbEl = document.getElementById('fileThumb');
  const downloadBtn = document.getElementById('downloadBtn');

  // 1. Initialize Presets UI
  function renderPresets() {
    presetChipsContainer.innerHTML = '';
    const presets = currentMode === 'image' ? IMAGE_PRESETS : PDF_PRESETS;
    presetLabel.textContent = currentMode === 'image' ? 'Image Presets:' : 'PDF Presets:';

    presets.forEach((p, idx) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `preset-chip ${idx === 0 ? 'active' : ''}`;
      chip.dataset.size = p.size;
      chip.dataset.unit = p.unit;
      chip.innerHTML = `${p.label} <span class="preset-desc">${p.desc}</span>`;
      chip.addEventListener('click', () => {
        document.querySelectorAll('.preset-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        targetInput.value = p.size;
        setUnit(p.unit);
      });
      presetChipsContainer.appendChild(chip);
    });

    // Default to first preset
    targetInput.value = presets[0].size;
    setUnit(presets[0].unit);
  }

  // 2. Mode Toggle
  modeImageBtn.addEventListener('click', () => switchMode('image'));
  modePdfBtn.addEventListener('click', () => switchMode('pdf'));

  function switchMode(mode) {
    currentMode = mode;
    modeImageBtn.classList.toggle('active', mode === 'image');
    modePdfBtn.classList.toggle('active', mode === 'pdf');
    resultCard.style.display = 'none';
    compressedBlob = null;

    if (mode === 'image') {
      fileInput.accept = 'image/jpeg,image/png,image/webp,image/avif';
      dropzoneIcon.textContent = '📸';
      dropzoneText.innerHTML = 'Drop image here, or <span>Browse</span>';
      dropzoneSub.textContent = 'JPG, PNG, WEBP • Zero cloud upload';
    } else {
      fileInput.accept = 'application/pdf';
      dropzoneIcon.textContent = '📄';
      dropzoneText.innerHTML = 'Drop PDF here, or <span>Browse</span>';
      dropzoneSub.textContent = 'Standard PDF documents • 100% Client-Side';
    }
    renderPresets();
  }

  // 3. Unit Toggle
  btnKb.addEventListener('click', () => setUnit('KB'));
  btnMb.addEventListener('click', () => setUnit('MB'));

  function setUnit(unit) {
    currentUnit = unit;
    btnKb.classList.toggle('active', unit === 'KB');
    btnMb.classList.toggle('active', unit === 'MB');
  }

  // 4. Dropzone events
  dropzone.addEventListener('click', () => fileInput.click());

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files.length > 0) {
      processSelectedFile(fileInput.files[0]);
    }
  });

  // 5. File Processing Router
  async function processSelectedFile(file) {
    const val = parseFloat(targetInput.value) || (currentMode === 'image' ? 50 : 100);
    const targetBytes = currentUnit === 'MB' ? val * 1024 * 1024 : val * 1024;

    resultCard.style.display = 'block';
    fileNameEl.textContent = file.name;
    fileStatsEl.textContent = 'Compressing in browser...';
    downloadBtn.disabled = true;
    downloadBtn.textContent = '⏳ Calculating optimal bit budget...';

    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      fileThumbEl.textContent = '📄';
      await processPdf(file, targetBytes, val);
    } else if (file.type.startsWith('image/')) {
      fileThumbEl.textContent = '🖼️';
      await processImage(file, targetBytes, val);
    } else {
      alert('Unsupported file format. Please upload an image or PDF.');
      resultCard.style.display = 'none';
    }
  }

  // 6. Image Compression Algorithm
  async function processImage(file, targetBytes, targetVal) {
    try {
      const result = await compressImageToTarget(file, targetBytes);
      compressedBlob = result.blob;
      
      const ext = file.name.substring(file.name.lastIndexOf('.')) || '.jpg';
      const base = file.name.substring(0, file.name.lastIndexOf('.')) || 'image';
      compressedFileName = `${base}_${targetVal}${currentUnit}${ext}`;

      const origSizeStr = formatBytes(file.size);
      const outSizeStr = formatBytes(result.blob.size);
      const savings = Math.max(0, Math.round(((file.size - result.blob.size) / file.size) * 100));

      fileStatsEl.textContent = `${origSizeStr} ➔ ${outSizeStr} (${savings}% saved)`;
      downloadBtn.disabled = false;
      downloadBtn.textContent = `⚡ Download ${outSizeStr} Image`;
    } catch (err) {
      console.error('Image compression failed:', err);
      fileStatsEl.textContent = 'Error: could not compress image.';
      downloadBtn.disabled = true;
    }
  }

  function compressImageToTarget(file, targetBytes) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = async () => {
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            let width = img.naturalWidth;
            let height = img.naturalHeight;

            const maxDim = 3840;
            if (width > maxDim || height > maxDim) {
              const ratio = Math.min(maxDim / width, maxDim / height);
              width = Math.round(width * ratio);
              height = Math.round(height * ratio);
            }

            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);

            let minQ = 0.05;
            let maxQ = 0.95;
            let bestBlob = null;
            let iterations = 0;

            const format = file.type === 'image/png' ? 'image/jpeg' : file.type;

            while (iterations < 7) {
              const midQ = (minQ + maxQ) / 2;
              const blob = await canvasToBlob(canvas, format, midQ);

              if (blob.size <= targetBytes) {
                bestBlob = blob;
                minQ = midQ;
              } else {
                maxQ = midQ;
              }
              iterations++;
            }

            if (!bestBlob || bestBlob.size > targetBytes) {
              let scale = 0.85;
              while (scale >= 0.2) {
                canvas.width = Math.round(width * scale);
                canvas.height = Math.round(height * scale);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const blob = await canvasToBlob(canvas, format, 0.6);
                if (blob.size <= targetBytes) {
                  bestBlob = blob;
                  break;
                }
                scale -= 0.15;
              }
            }

            if (!bestBlob) {
              bestBlob = await canvasToBlob(canvas, format, 0.1);
            }

            resolve({ blob: bestBlob });
          } catch (err) {
            reject(err);
          }
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function canvasToBlob(canvas, format, quality) {
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), format, quality);
    });
  }

  // 7. PDF Compression via pdf-lib
  async function processPdf(file, targetBytes, targetVal) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      
      if (typeof PDFLib === 'undefined') {
        throw new Error('PDFLib not loaded');
      }

      // Load document
      const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      
      // Save with object deduplication & stream compression
      const compressedBytes = await pdfDoc.save({ useObjectStreams: true });
      let outputBlob = new Blob([compressedBytes], { type: 'application/pdf' });

      // If already below target or savings achieved
      const base = file.name.substring(0, file.name.lastIndexOf('.')) || 'document';
      compressedFileName = `${base}_${targetVal}${currentUnit}.pdf`;
      compressedBlob = outputBlob;

      const origSizeStr = formatBytes(file.size);
      const outSizeStr = formatBytes(outputBlob.size);
      const savings = Math.max(0, Math.round(((file.size - outputBlob.size) / file.size) * 100));

      fileStatsEl.textContent = `${origSizeStr} ➔ ${outSizeStr} (${savings}% saved)`;
      downloadBtn.disabled = false;
      downloadBtn.textContent = `⚡ Download ${outSizeStr} PDF`;
    } catch (err) {
      console.error('PDF compression failed:', err);
      fileStatsEl.textContent = 'Could not compress this specific PDF locally.';
      downloadBtn.disabled = true;
    }
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  // 8. Download Trigger
  downloadBtn.addEventListener('click', async () => {
    if (!compressedBlob) return;
    const url = URL.createObjectURL(compressedBlob);
    try {
      await chrome.downloads.download({
        url: url,
        filename: compressedFileName,
        saveAs: false
      });
    } catch (e) {
      const a = document.createElement('a');
      a.href = url;
      a.download = compressedFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  });

  // 9. External Links
  document.querySelectorAll('a[target="_blank"]').forEach(a => {
    a.addEventListener('click', async (e) => {
      e.preventDefault();
      await chrome.tabs.create({ url: a.href });
    });
  });

  // Initial render
  renderPresets();
});
