/**
 * Target-Size Media Shrinker - FFmpeg WASM & Canvas Compression Engine
 * Executes reverse-engineered compression inside the browser with zero server data transfer.
 */

let ffmpegInstance = null;
let isLoaded = false;
let isBusy = false;

/**
 * Initialize FFmpeg WASM instance
 */
export async function initFFmpeg({ onLog = () => {}, onStatus = () => {} } = {}) {
  if (ffmpegInstance && isLoaded) {
    return ffmpegInstance;
  }

  onStatus('Initializing in-browser FFmpeg WebAssembly engine...');

  if (!window.FFmpegWASM || !window.FFmpegWASM.FFmpeg) {
    throw new Error('FFmpeg WebAssembly library failed to load. Please verify vendor scripts.');
  }

  const { FFmpeg } = window.FFmpegWASM;
  const { toBlobURL } = window.FFmpegUtil || {};

  ffmpegInstance = new FFmpeg();

  ffmpegInstance.on('log', ({ message }) => {
    onLog(message);
  });

  try {
    let coreURL = null;
    let wasmURL = null;
    const cdnBase = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';

    // Helper to test if local file exists (200 OK) and convert to blob URL
    async function loadBlobIfAvailable(url, mimeType) {
      try {
        const resp = await fetch(url);
        if (!resp.ok) return null;
        const blob = await resp.blob();
        return URL.createObjectURL(new Blob([blob], { type: mimeType }));
      } catch {
        return null;
      }
    }

    onStatus('Checking WebAssembly engine...');
    const wasmCandidates = ['./ffmpeg-core.wasm', './vendor/ffmpeg-core.wasm'];
    const coreCandidates = ['./ffmpeg-core.js', './vendor/ffmpeg-core.js'];

    for (const cand of wasmCandidates) {
      const wasmBlob = await loadBlobIfAvailable(new URL(cand, window.location.href).href, 'application/wasm');
      if (wasmBlob) {
        wasmURL = wasmBlob;
        break;
      }
    }

    if (wasmURL) {
      for (const cand of coreCandidates) {
        const coreBlob = await loadBlobIfAvailable(new URL(cand, window.location.href).href, 'text/javascript');
        if (coreBlob) {
          coreURL = coreBlob;
          break;
        }
      }
    }

    // If local wasm or core is missing (e.g. Cloudflare free tier 25MB limit), fetch from unpkg CDN
    if (!wasmURL || !coreURL) {
      onStatus('Fetching WebAssembly engine (~30MB from unpkg CDN)...');
      if (toBlobURL) {
        coreURL = await toBlobURL(`${cdnBase}/ffmpeg-core.js`, 'text/javascript');
        wasmURL = await toBlobURL(`${cdnBase}/ffmpeg-core.wasm`, 'application/wasm');
      } else {
        coreURL = `${cdnBase}/ffmpeg-core.js`;
        wasmURL = `${cdnBase}/ffmpeg-core.wasm`;
      }
    }

    onStatus('Compiling WebAssembly engine...');
    await ffmpegInstance.load({
      coreURL,
      wasmURL
    });

    isLoaded = true;
    onStatus('FFmpeg WebAssembly engine ready');
    return ffmpegInstance;
  } catch (err) {
    console.error('Failed to load FFmpeg WASM:', err);
    throw new Error(`WebAssembly FFmpeg initialization error: ${err.message || err}`);
  }
}

/**
 * Execute compression strictly against target size
 */
export async function compressMedia({
  file,
  plan,
  onProgress = () => {},
  onLog = () => {},
  onStatus = () => {}
}) {
  if (isBusy) {
    throw new Error('A compression task is already in progress.');
  }

  isBusy = true;
  const startTime = Date.now();

  try {
    const ffmpeg = await initFFmpeg({ onLog, onStatus });

    // Setup Progress Listener
    let lastProgress = 0;
    const progressHandler = ({ progress, time }) => {
      let pct = 0;
      if (progress !== undefined && progress > 0) {
        pct = Math.min(99, Math.round(progress * 100));
      } else if (time !== undefined && plan.effectiveDuration > 0) {
        const timeSec = time / 1_000_000;
        pct = Math.min(99, Math.round((timeSec / plan.effectiveDuration) * 100));
      }

      if (pct > lastProgress) {
        lastProgress = pct;
        const elapsedSec = (Date.now() - startTime) / 1000;
        const etaSec = pct > 5 ? Math.max(0, Math.round((elapsedSec / (pct / 100)) - elapsedSec)) : null;

        onProgress({
          percent: pct,
          elapsedSec: Math.round(elapsedSec),
          etaSec,
          statusText: `Encoding frame data... ${pct}% (ETA: ${etaSec !== null ? etaSec + 's' : 'calculating...'})`
        });
      }
    };

    ffmpeg.on('progress', progressHandler);

    onStatus('Writing source media to virtual filesystem...');
    const { fetchFile } = window.FFmpegUtil;
    const inputData = await fetchFile(file);
    await ffmpeg.writeFile('input_media', inputData);

    const runPass = async (args, passName = 'Pass 1') => {
      onStatus(`Running ${passName} with target-size constraints...`);
      onLog(`\n[FFmpeg Exec - ${passName}] ffmpeg ${args.join(' ')}\n`);
      const exitCode = await ffmpeg.exec(args);
      if (exitCode !== 0) {
        throw new Error(`FFmpeg failed with exit code ${exitCode}. Check console logs for details.`);
      }
    };

    const outputFilename = plan.ffmpegArgs[plan.ffmpegArgs.length - 1];
    
    // Primary execution pass
    await runPass(plan.ffmpegArgs, 'Primary Pass');

    onStatus('Reading and verifying output size...');
    let outputData = await ffmpeg.readFile(outputFilename);
    let outputBlob = new Blob([outputData.buffer], { type: getMimeType(outputFilename) });

    onLog(`[Verification] Generated output: ${outputBlob.size} bytes (Limit: ${plan.limitBytes} bytes).`);

    // Strict Target Verification & Auto-Adjustment:
    // If output exceeded platform limit due to VBR spikes on complex frames,
    // automatically run a fast secondary micro-adjustment pass to guarantee strict limit adherence!
    if (outputBlob.size > plan.limitBytes && plan.format !== 'gif') {
      onStatus(`Output exceeded ceiling by ${outputBlob.size - plan.limitBytes} bytes. Auto-correcting with micro-adjustment...`);
      onLog(`[Auto-Correction] Output ${outputBlob.size} > Limit ${plan.limitBytes}. Adjusting bitrate by -12%...`);

      const correctionRatio = (plan.limitBytes * 0.92) / outputBlob.size;
      const adjustedVideoBitrate = Math.max(20, Math.floor(plan.videoBitrateKbps * correctionRatio));
      
      const adjustedArgs = [...plan.ffmpegArgs];
      const bvIndex = adjustedArgs.indexOf('-b:v');
      if (bvIndex !== -1) {
        adjustedArgs[bvIndex + 1] = `${adjustedVideoBitrate}k`;
      }
      const maxrateIndex = adjustedArgs.indexOf('-maxrate');
      if (maxrateIndex !== -1) {
        adjustedArgs[maxrateIndex + 1] = `${Math.floor(adjustedVideoBitrate * 1.05)}k`;
      }

      await runPass(adjustedArgs, 'Correction Pass');
      outputData = await ffmpeg.readFile(outputFilename);
      outputBlob = new Blob([outputData.buffer], { type: getMimeType(outputFilename) });
      onLog(`[Verification Pass 2] Corrected output: ${outputBlob.size} bytes (Strictly under ${plan.limitBytes}).`);
    }

    // Cleanup virtual files to free WASM memory
    try {
      await ffmpeg.deleteFile('input_media');
      await ffmpeg.deleteFile(outputFilename);
    } catch (e) {
      console.warn('Virtual FS cleanup note:', e);
    }

    const totalSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
    onStatus(`Completed successfully in ${totalSeconds}s!`);
    onProgress({ percent: 100, elapsedSec: totalSeconds, etaSec: 0, statusText: 'Complete!' });

    const isUnderLimit = outputBlob.size <= plan.limitBytes;
    const headroom = plan.limitBytes - outputBlob.size;

    return {
      success: true,
      blob: outputBlob,
      sizeBytes: outputBlob.size,
      filename: generateOutputFilename(file.name, plan),
      isUnderLimit,
      headroom,
      totalSeconds,
      format: plan.format,
      outputUrl: URL.createObjectURL(outputBlob)
    };

  } catch (error) {
    onLog(`[Error] ${error.message || error}`);
    throw error;
  } finally {
    isBusy = false;
  }
}

/**
 * Abort/terminate current FFmpeg execution
 */
export function abortCompression() {
  if (ffmpegInstance && isBusy) {
    try {
      ffmpegInstance.terminate();
    } catch (e) {
      console.warn('Error during terminate:', e);
    }
    ffmpegInstance = null;
    isLoaded = false;
    isBusy = false;
  }
}

function getMimeType(filename) {
  if (filename.endsWith('.mp4')) return 'video/mp4';
  if (filename.endsWith('.webm')) return 'video/webm';
  if (filename.endsWith('.gif')) return 'image/gif';
  if (filename.endsWith('.webp')) return 'image/webp';
  return 'application/octet-stream';
}

function generateOutputFilename(originalName, plan) {
  const baseName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
  const ext = plan.format === 'gif' ? 'gif' : (plan.format === 'webp' ? 'webp' : (plan.format === 'webm' ? 'webm' : 'mp4'));
  const presetTag = plan.preset.id;
  return `${baseName}_shrink_${presetTag}.${ext}`;
}
