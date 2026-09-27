/**
 * TargetCompress - Dynamic Script / Heavy Asset Lazy Loader
 * Ensures heavy WASM and vendor scripts are only fetched when a specific tool is opened.
 */

const loadedScripts = new Set();
const pendingLoads = new Map();

export function loadScript(src) {
  // Normalize path
  const key = src.startsWith('/') ? src : '/' + src.replace(/^\.\//, '');

  if (loadedScripts.has(key)) {
    return Promise.resolve();
  }

  if (pendingLoads.has(key)) {
    return pendingLoads.get(key);
  }

  // Check if already in DOM
  const existing = document.querySelector(`script[src="${src}"], script[src="${key}"]`);
  if (existing) {
    loadedScripts.add(key);
    return Promise.resolve();
  }

  const promise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = key;
    s.async = true;
    s.onload = () => {
      loadedScripts.add(key);
      pendingLoads.delete(key);
      resolve();
    };
    s.onerror = (err) => {
      pendingLoads.delete(key);
      reject(new Error(`Failed to load asset: ${key}`));
    };
    document.head.appendChild(s);
  });

  pendingLoads.set(key, promise);
  return promise;
}

export async function ensurePdfLib() {
  if (!window.PDFLib) {
    await loadScript('/pdf-lib.min.js');
  }
}

export async function ensurePdfJs() {
  if (!window.pdfjsLib) {
    await loadScript('/pdf.min.js');
  }
  if (window.pdfjsLib && !window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
  }
}

export async function ensureJsZip() {
  if (!window.JSZip) {
    await loadScript('/jszip.min.js');
  }
}

export async function ensureMammoth() {
  if (!window.mammoth) {
    await loadScript('/mammoth.browser.min.js');
  }
}

export async function ensureJsPdf() {
  if (!window.jspdf) {
    await loadScript('/jspdf.umd.min.js');
  }
}

export async function ensureFFmpegScripts() {
  if (!window.FFmpegWASM || !window.FFmpegWASM.FFmpeg) {
    await loadScript('/ffmpeg-util.js');
    await loadScript('/ffmpeg.js');
  }
}
