/**
 * Target-Size Image Shrinker
 * Uses HTML5 Canvas and a binary search optimization solver to compress
 * images to the highest possible visual quality strictly below user-specified KB/MB.
 */

export const IMAGE_PRESETS = [
  { id: 'photo-20k', name: 'Photo / Signature', targetBytes: 20 * 1024, label: '20 KB Max', desc: 'Strict digital signatures & exam photo cap' },
  { id: 'gov-50k', name: 'Govt / Visa Portal', targetBytes: 50 * 1024, label: '50 KB Max', desc: 'Strict passport & visa upload cap' },
  { id: 'portal-100k', name: 'Exam / College Portal', targetBytes: 100 * 1024, label: '100 KB Max', desc: 'Standard student & admit card limit' },
  { id: 'resume-200k', name: 'Resume / Job Photo', targetBytes: 200 * 1024, label: '200 KB Max', desc: 'Ideal for ATS & LinkedIn profile assets' },
  { id: 'web-500k', name: 'Web & Blog Asset', targetBytes: 500 * 1024, label: '500 KB Max', desc: 'Fast LCP load time with crisp quality' },
  { id: 'email-1m', name: 'Email Friendly', targetBytes: 1024 * 1024, label: '1.0 MB Max', desc: 'Safe for high-res email attachments' },
  { id: 'custom', name: 'Custom Exact Size', targetBytes: 250 * 1024, label: 'Custom', desc: 'Direct user input in KB or MB' }
];

export async function compressImageToTarget({
  file,
  targetBytes,
  outputFormat = 'auto',
  onProgress = () => {}
}) {
  onProgress(10, 'Loading image into Canvas...');

  const img = await loadImageFromFile(file);
  const originalWidth = img.naturalWidth || img.width;
  const originalHeight = img.naturalHeight || img.height;
  const originalSize = file.size;

  // Determine output MIME type
  let mimeType = 'image/jpeg';
  if (outputFormat === 'webp') {
    mimeType = 'image/webp';
  } else if (outputFormat === 'png') {
    mimeType = 'image/png';
  } else {
    // Auto: use webp if supported and target is tight, otherwise jpeg
    mimeType = (file.type === 'image/webp') ? 'image/webp' : 'image/jpeg';
  }

  // If input is PNG and target is extremely tight (< 300KB for large photo),
  // PNG cannot compress lossily below its deflate limit, so JPEG/WebP is required.
  const isLosslessPng = mimeType === 'image/png';

  onProgress(25, 'Calculating reverse-engineered resolution & quality...');

  let curWidth = originalWidth;
  let curHeight = originalHeight;
  let bestBlob = null;
  let bestQuality = 0.85;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { alpha: !mimeType.includes('jpeg') });

  // Safety buffer of 3% so OS file system differences never exceed limit
  const safetyTargetBytes = Math.floor(targetBytes * 0.97);

  // Helper to render at dimensions and test quality
  async function testCandidate(w, h, q) {
    canvas.width = w;
    canvas.height = h;

    // High quality scaling
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    if (mimeType === 'image/jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.clearRect(0, 0, w, h);
    }
    ctx.drawImage(img, 0, 0, w, h);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), mimeType, q);
    });
  }

  // 1. Initial quick test at 100% resolution with medium-high quality
  onProgress(35, 'Testing native resolution...');
  let testBlob = await testCandidate(curWidth, curHeight, 0.82);

  if (testBlob.size <= safetyTargetBytes) {
    bestBlob = testBlob;
    bestQuality = 0.82;

    // Try pushing quality higher if we have significant headroom!
    if (testBlob.size < safetyTargetBytes * 0.75) {
      let lowQ = 0.82;
      let highQ = 0.98;
      for (let iter = 0; iter < 4; iter++) {
        const midQ = (lowQ + highQ) / 2;
        const candidate = await testCandidate(curWidth, curHeight, midQ);
        if (candidate.size <= safetyTargetBytes) {
          bestBlob = candidate;
          bestQuality = midQ;
          lowQ = midQ;
        } else {
          highQ = midQ;
        }
      }
    }
  } else {
    // Current native resolution exceeds budget at 0.82 quality
    // Binary search on Quality first
    onProgress(50, 'Solving optimal compression curve...');
    let lowQ = 0.15;
    let highQ = 0.80;
    let candidate = null;

    for (let iter = 0; iter < 5; iter++) {
      const midQ = (lowQ + highQ) / 2;
      candidate = await testCandidate(curWidth, curHeight, midQ);
      if (candidate.size <= safetyTargetBytes) {
        bestBlob = candidate;
        bestQuality = midQ;
        lowQ = midQ; // try higher
      } else {
        highQ = midQ; // lower quality needed
      }
    }

    // If even quality 0.15 is still larger than target (huge megapixel image),
    // downscale dimensions iteratively!
    if (!bestBlob || bestBlob.size > safetyTargetBytes) {
      onProgress(70, 'Downscaling dimensions to preserve sharp pixel density...');
      while (curWidth > 150 && curHeight > 150) {
        // Calculate smart scale factor
        const lastSize = (candidate && candidate.size) ? candidate.size : testBlob.size;
        const ratio = Math.sqrt(safetyTargetBytes / lastSize);
        const scaleFactor = Math.min(0.85, Math.max(0.4, ratio));

        curWidth = Math.max(128, Math.round(curWidth * scaleFactor));
        curHeight = Math.max(128, Math.round(curHeight * scaleFactor));

        // Test at quality 0.75 with new dimensions
        candidate = await testCandidate(curWidth, curHeight, 0.75);
        if (candidate.size <= safetyTargetBytes) {
          bestBlob = candidate;
          bestQuality = 0.75;
          break;
        }
      }

      // If finally beneath target, refine quality
      if (bestBlob && bestBlob.size < safetyTargetBytes * 0.75) {
        let lowQ = 0.75;
        let highQ = 0.95;
        for (let iter = 0; iter < 3; iter++) {
          const midQ = (lowQ + highQ) / 2;
          const refined = await testCandidate(curWidth, curHeight, midQ);
          if (refined.size <= safetyTargetBytes) {
            bestBlob = refined;
            bestQuality = midQ;
            lowQ = midQ;
          } else {
            highQ = midQ;
          }
        }
      }
    }
  }

  // Fallback guarantee: if still no blob, force extreme candidate
  if (!bestBlob) {
    bestBlob = await testCandidate(curWidth, curHeight, 0.2);
  }

  onProgress(100, 'Image compression complete!');

  return {
    success: true,
    blob: bestBlob,
    sizeBytes: bestBlob.size,
    originalSize,
    targetBytes,
    width: curWidth,
    height: curHeight,
    quality: Math.round(bestQuality * 100),
    reductionPercent: Math.round((1 - bestBlob.size / originalSize) * 100),
    isUnderLimit: bestBlob.size <= targetBytes,
    headroomBytes: targetBytes - bestBlob.size,
    outputUrl: URL.createObjectURL(bestBlob),
    format: mimeType.split('/')[1]
  };
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}
