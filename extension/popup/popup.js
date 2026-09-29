// TargetCompress Extension Popup Logic (Manifest V3 Compliant)

let currentUnit = 'KB';
let compressedBlob = null;
let compressedFileName = 'compressed_image.jpg';

document.addEventListener('DOMContentLoaded', () => {
  const targetInput = document.getElementById('targetInput');
  const btnKb = document.getElementById('btnKb');
  const btnMb = document.getElementById('btnMb');
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const resultCard = document.getElementById('resultCard');
  const fileNameEl = document.getElementById('fileName');
  const fileStatsEl = document.getElementById('fileStats');
  const downloadBtn = document.getElementById('downloadBtn');
  const presetChips = document.querySelectorAll('.preset-chip');

  // 1. Preset chip clicks
  presetChips.forEach(chip => {
    chip.addEventListener('click', () => {
      presetChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      targetInput.value = chip.dataset.size;
      setUnit(chip.dataset.unit);
    });
  });

  // 2. Unit toggle
  btnKb.addEventListener('click', () => setUnit('KB'));
  btnMb.addEventListener('click', () => setUnit('MB'));

  function setUnit(unit) {
    currentUnit = unit;
    btnKb.classList.toggle('active', unit === 'KB');
    btnMb.classList.toggle('active', unit === 'MB');
  }

  // 3. Dropzone interactions
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
      processFile(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files.length > 0) {
      processFile(fileInput.files[0]);
    }
  });

  // 4. Client-Side Mathematical Compression Algorithm
  async function processFile(file) {
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (JPG, PNG, WebP).');
      return;
    }

    const val = parseFloat(targetInput.value) || 50;
    const targetBytes = currentUnit === 'MB' ? val * 1024 * 1024 : val * 1024;

    resultCard.style.display = 'block';
    fileNameEl.textContent = file.name;
    fileStatsEl.textContent = 'Calculating optimal compression...';
    downloadBtn.disabled = true;
    downloadBtn.textContent = '⏳ Compressing in browser...';

    try {
      const result = await compressImageToTarget(file, targetBytes);
      compressedBlob = result.blob;
      
      const ext = file.name.substring(file.name.lastIndexOf('.')) || '.jpg';
      const base = file.name.substring(0, file.name.lastIndexOf('.')) || 'image';
      compressedFileName = `${base}_${val}${currentUnit}${ext}`;

      const origSizeStr = formatBytes(file.size);
      const outSizeStr = formatBytes(result.blob.size);
      const savings = Math.max(0, Math.round(((file.size - result.blob.size) / file.size) * 100));

      fileStatsEl.textContent = `${origSizeStr} ➔ ${outSizeStr} (${savings}% saved)`;
      downloadBtn.disabled = false;
      downloadBtn.textContent = `⚡ Download ${outSizeStr} File`;
    } catch (err) {
      console.error('Compression failed:', err);
      fileStatsEl.textContent = 'Error: could not compress image.';
      downloadBtn.disabled = true;
    }
  }

  // 5. Binary Search Bisection Compressor
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

            // If image is huge, apply initial sensible scale
            const maxDim = 3840;
            if (width > maxDim || height > maxDim) {
              const ratio = Math.min(maxDim / width, maxDim / height);
              width = Math.round(width * ratio);
              height = Math.round(height * ratio);
            }

            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);

            // Binary search on quality
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
                minQ = midQ; // try to get higher quality
              } else {
                maxQ = midQ; // file too large, lower quality
              }
              iterations++;
            }

            // If still too large after quality bisection, downscale dimensions
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

            // Fallback to lowest possible output if target was extremely small
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

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  // 6. Download Trigger
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
      // Fallback
      const a = document.createElement('a');
      a.href = url;
      a.download = compressedFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  });

  // 7. External link handling for tabs
  document.querySelectorAll('a[target="_blank"]').forEach(a => {
    a.addEventListener('click', async (e) => {
      e.preventDefault();
      await chrome.tabs.create({ url: a.href });
    });
  });
});
