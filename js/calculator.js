/**
 * Target-Size Media Shrinker - Reverse Engineering Calculator Engine
 * Calculates the exact optimal bitrates, resolutions, framerates, and palettes
 * to compress media to the highest possible visual quality strictly below platform limits.
 */

export const PRESETS = {
  'discord-free': {
    id: 'discord-free',
    name: 'Discord Free',
    platform: 'Discord',
    icon: 'discord',
    badge: '10 MB Cap',
    limitBytes: 10 * 1024 * 1024, // 10,485,760 bytes
    targetBytes: Math.floor(10 * 1024 * 1024 * 0.96), // 9.6 MB (4% safety margin)
    format: 'mp4',
    description: 'Strictly fits Discord Free 10 MB upload ceiling with zero rejections.',
    color: '#5865F2'
  },
  'discord-nitro': {
    id: 'discord-nitro',
    name: 'Discord Nitro Basic',
    platform: 'Discord',
    icon: 'nitro',
    badge: '25 MB Cap',
    limitBytes: 25 * 1024 * 1024, // 26,214,400 bytes
    targetBytes: Math.floor(25 * 1024 * 1024 * 0.96), // 24.0 MB (4% safety margin)
    format: 'mp4',
    description: 'For Nitro Basic or Tier 1 boosted Discord servers.',
    color: '#EB459E'
  },
  'slack-emoji': {
    id: 'slack-emoji',
    name: 'Slack Custom Emoji',
    platform: 'Slack',
    icon: 'slack',
    badge: '128 KB Cap',
    limitBytes: 128 * 1024, // 131,072 bytes
    targetBytes: Math.floor(128 * 1024 * 0.95), // 121.6 KB (5% safety margin)
    format: 'gif',
    forceSquare: true,
    maxDimension: 128,
    description: 'Sub-128 KB, 128x128px animated reaction emoji for Slack.',
    color: '#E01E5A'
  },
  'github-readme': {
    id: 'github-readme',
    name: 'GitHub README Asset',
    platform: 'GitHub',
    icon: 'github',
    badge: 'Fast Load (<5 MB)',
    limitBytes: 5 * 1024 * 1024, // 5,242,880 bytes
    targetBytes: Math.floor(5 * 1024 * 1024 * 0.95), // 4.75 MB
    format: 'mp4',
    description: 'Zero-lag preview asset optimized for GitHub READMEs & docs.',
    color: '#2EA44F'
  },
  'email-attachment': {
    id: 'email-attachment',
    name: 'Email Attachment',
    platform: 'Email',
    icon: 'email',
    badge: '20 MB Safe',
    limitBytes: 20 * 1024 * 1024, // 20,971,520 bytes (accounts for Base64 +33% overhead in 25MB mail servers)
    targetBytes: Math.floor(18.5 * 1024 * 1024),
    format: 'mp4',
    description: 'Safe for Gmail & Outlook 25 MB limits after base64 encoding.',
    color: '#EA4335'
  },
  'whatsapp': {
    id: 'whatsapp',
    name: 'WhatsApp Media',
    platform: 'WhatsApp',
    icon: 'whatsapp',
    badge: '16 MB Cap',
    limitBytes: 16 * 1024 * 1024, // 16,777,216 bytes
    targetBytes: Math.floor(16 * 1024 * 1024 * 0.95), // 15.2 MB
    format: 'mp4',
    description: 'Strictly fits standard WhatsApp direct video share limit.',
    color: '#25D366'
  },
  'custom': {
    id: 'custom',
    name: 'Custom Target Size',
    platform: 'Custom',
    icon: 'custom',
    badge: 'Exact Target',
    limitBytes: 8 * 1024 * 1024,
    targetBytes: Math.floor(8 * 1024 * 1024 * 0.96),
    format: 'mp4',
    description: 'Specify an exact target in Megabytes (MB) or Kilobytes (KB).',
    color: '#00D2FF'
  }
};

/**
 * Format bytes to readable string (KB, MB, GB)
 */
export function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 B';
  if (!bytes || isNaN(bytes)) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Format seconds to mm:ss.ms
 */
export function formatDuration(seconds) {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms}`;
}

/**
 * Round number to nearest even integer (required by video encoders like libx264)
 */
export function toEven(n) {
  const rounded = Math.round(n);
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

/**
 * Core reverse-engineering computation
 */
export function calculateCompressionPlan({
  originalSize,
  duration,
  width,
  height,
  fps = 30,
  hasAudio = true,
  isGif = false,
  presetId = 'discord-free',
  customLimitBytes = null,
  safetyMargin = 0.04, // 4% default safety buffer
  forceMute = false,
  targetFormat = 'auto',
  cropSquare = false,
  qualityPreset = 'balanced',
  trimStart = 0,
  trimEnd = null
}) {
  const preset = PRESETS[presetId] || PRESETS['discord-free'];
  
  // 1. Effective Limit & Safety Budget
  let limitBytes = preset.limitBytes;
  if (presetId === 'custom' && customLimitBytes) {
    limitBytes = customLimitBytes;
  }
  
  const targetBytes = Math.floor(limitBytes * (1 - safetyMargin));
  const targetBits = targetBytes * 8;

  // 2. Effective Duration
  const effectiveTrimEnd = (trimEnd !== null && trimEnd > trimStart) ? trimEnd : duration;
  const effectiveDuration = Math.max(0.1, effectiveTrimEnd - trimStart);

  // 3. Format Resolution
  let format = preset.format;
  if (targetFormat && targetFormat !== 'auto') {
    format = targetFormat;
  }

  // 4. Determine if Audio is supported and needed
  const willHaveAudio = !forceMute && hasAudio && (format === 'mp4' || format === 'webm') && presetId !== 'slack-emoji';

  // 5. Total Bitrate Budget (bps)
  const totalBitrateBps = Math.floor(targetBits / effectiveDuration);
  const totalBitrateKbps = Math.floor(totalBitrateBps / 1000);

  // 6. Audio Bitrate Allocation
  let audioBitrateKbps = 0;
  if (willHaveAudio) {
    if (totalBitrateKbps < 250) {
      audioBitrateKbps = 32; // Ultra-compressed mono
    } else if (totalBitrateKbps < 600) {
      audioBitrateKbps = 64; // Good speech / low music
    } else if (totalBitrateKbps < 1500) {
      audioBitrateKbps = 96; // Standard web audio
    } else {
      audioBitrateKbps = 128; // High quality AAC
    }
    // Cap audio so it never eats more than 22% of total budget
    if (audioBitrateKbps > totalBitrateKbps * 0.22) {
      audioBitrateKbps = Math.max(24, Math.floor(totalBitrateKbps * 0.20));
    }
  }

  // 7. Video Bitrate Allocation
  const videoBitrateKbps = Math.max(20, totalBitrateKbps - audioBitrateKbps);

  // 8. Dimensional and Framerate Planning (Bits-Per-Pixel Heuristic)
  const originalWidth = width || 1280;
  const originalHeight = height || 720;
  const aspectRatio = originalWidth / originalHeight;

  let targetWidth = originalWidth;
  let targetHeight = originalHeight;
  let targetFps = Math.min(fps || 30, 30);
  let bpp = 0.1;
  let bppQuality = 'Optimal';
  let emojiPaletteColors = 128;
  let emojiDither = 'bayer';

  if (presetId === 'slack-emoji' || cropSquare || format === 'gif') {
    // Slack Emoji or GIF optimization
    targetWidth = 128;
    targetHeight = 128;
    
    // For GIFs, size is frames * resolution * color_table
    // 128 KB target:
    if (effectiveDuration <= 2) {
      targetFps = 20;
      emojiPaletteColors = 128;
    } else if (effectiveDuration <= 4) {
      targetFps = 15;
      emojiPaletteColors = 128;
    } else if (effectiveDuration <= 7) {
      targetFps = 12;
      emojiPaletteColors = 96;
      targetWidth = 112;
      targetHeight = 112;
    } else {
      // Very long emoji: scale down to 96x96, 10 fps, 64 colors
      targetFps = 10;
      emojiPaletteColors = 64;
      targetWidth = 96;
      targetHeight = 96;
    }

    if (presetId === 'slack-emoji') {
      bpp = (limitBytes / (effectiveDuration * targetFps * targetWidth * targetHeight));
      bppQuality = effectiveDuration > 6 ? 'Warning: Long Emoji' : 'Ready for Slack';
    }
  } else {
    // Standard Video Bitrate-Driven Resolution Scaling
    // Ideal BPP for H.264 is ~0.08 to 0.14
    // Candidate resolutions (height):
    const candidateHeights = [1080, 720, 540, 480, 360, 240];
    const candidateFps = [60, 30, 24];

    // Find best height and fps
    let bestH = Math.min(originalHeight, 720);
    let bestFps = Math.min(fps || 30, 30);
    let bestBpp = 0;

    for (const candH of candidateHeights) {
      if (candH > originalHeight) continue; // Do not upscale
      const candW = toEven(candH * aspectRatio);
      
      for (const candFps of candidateFps) {
        if (candFps > (fps || 30)) continue;
        const testBpp = (videoBitrateKbps * 1000) / (candW * candH * candFps);
        
        // Target sweet spot is BPP >= 0.075
        if (testBpp >= 0.075) {
          bestH = candH;
          bestFps = candFps;
          bestBpp = testBpp;
          break;
        }
      }
      if (bestBpp >= 0.075) break;
    }

    // If even smallest resolution didn't hit 0.075, pick 360p or 480p at 24fps
    if (bestBpp === 0) {
      bestH = Math.min(originalHeight, 360);
      bestFps = 24;
      const testW = toEven(bestH * aspectRatio);
      bestBpp = (videoBitrateKbps * 1000) / (testW * bestH * bestFps);
    }

    targetHeight = toEven(bestH);
    targetWidth = toEven(targetHeight * aspectRatio);
    targetFps = bestFps;
    bpp = bestBpp;

    if (bpp >= 0.12) {
      bppQuality = 'Pristine (High Fidelity)';
    } else if (bpp >= 0.08) {
      bppQuality = 'Crisp & Sharp';
    } else if (bpp >= 0.05) {
      bppQuality = 'Acceptable';
    } else {
      bppQuality = 'Low Bitrate (Trim suggested)';
    }
  }

  // 9. Projected Output File Size
  const estimatedSizeBytes = Math.round(
    ((videoBitrateKbps + audioBitrateKbps) * 1000 / 8) * effectiveDuration
  );

  // 10. Generate FFmpeg Arguments
  const ffmpegArgs = generateFFmpegArgs({
    format,
    targetWidth,
    targetHeight,
    targetFps,
    videoBitrateKbps,
    audioBitrateKbps,
    willHaveAudio,
    trimStart,
    trimEnd: effectiveTrimEnd,
    cropSquare,
    emojiPaletteColors,
    qualityPreset,
    presetId
  });

  return {
    preset,
    limitBytes,
    targetBytes,
    safetyMargin,
    effectiveDuration,
    format,
    totalBitrateKbps,
    videoBitrateKbps,
    audioBitrateKbps,
    willHaveAudio,
    targetWidth,
    targetHeight,
    targetFps,
    bpp: Number(bpp.toFixed(3)),
    bppQuality,
    emojiPaletteColors,
    estimatedSizeBytes,
    estimatedSizeFormatted: formatBytes(estimatedSizeBytes),
    limitSizeFormatted: formatBytes(limitBytes),
    headroomBytes: limitBytes - estimatedSizeBytes,
    headroomFormatted: formatBytes(limitBytes - estimatedSizeBytes),
    ffmpegArgs,
    warnings: generateWarnings({
      effectiveDuration,
      originalSize,
      limitBytes,
      bpp,
      presetId,
      format
    })
  };
}

/**
 * Build FFmpeg command-line argument array
 */
function generateFFmpegArgs({
  format,
  targetWidth,
  targetHeight,
  targetFps,
  videoBitrateKbps,
  audioBitrateKbps,
  willHaveAudio,
  trimStart,
  trimEnd,
  cropSquare,
  emojiPaletteColors,
  qualityPreset,
  presetId
}) {
  const args = [];

  // Trimming parameters before input for fast seek
  if (trimStart > 0) {
    args.push('-ss', trimStart.toString());
  }
  
  args.push('-i', 'input_media');

  if (trimEnd !== null && trimEnd > trimStart) {
    const duration = trimEnd - trimStart;
    args.push('-t', duration.toString());
  }

  // Video filter construction
  let vfParts = [];

  if (cropSquare) {
    // Crop center square
    vfParts.push("crop='min(iw,ih)':'min(iw,ih)'");
  }

  if (format === 'gif' || presetId === 'slack-emoji') {
    // High-quality palette generation for GIF
    // Scale and generate two-pass palette in single filtergraph
    const scaleStr = `fps=${targetFps},scale=${targetWidth}:${targetHeight}:flags=lanczos`;
    const filtergraph = `${scaleStr},split[s0][s1];[s0]palettegen=max_colors=${emojiPaletteColors}:reserve_transparent=1:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3`;
    args.push('-filter_complex', filtergraph);
    args.push('-loop', '0');
    args.push('output.gif');
    return args;
  }

  if (format === 'webp') {
    // Animated WebP
    vfParts.push(`fps=${targetFps}`);
    vfParts.push(`scale=${targetWidth}:${targetHeight}:flags=lanczos`);
    args.push('-vf', vfParts.join(','));
    args.push('-c:v', 'libwebp_anim', '-loop', '0', '-lossless', '0', '-q:v', '65');
    args.push('-an');
    args.push('output.webp');
    return args;
  }

  // MP4 / WebM video encoding
  vfParts.push(`fps=${targetFps}`);
  vfParts.push(`scale=${targetWidth}:${targetHeight}:flags=lanczos`);
  args.push('-vf', vfParts.join(','));

  if (format === 'webm') {
    args.push('-c:v', 'libvpx-vp9');
    args.push('-b:v', `${videoBitrateKbps}k`);
    args.push('-minrate', `${Math.floor(videoBitrateKbps * 0.85)}k`);
    args.push('-maxrate', `${Math.floor(videoBitrateKbps * 1.15)}k`);
    if (willHaveAudio) {
      args.push('-c:a', 'libopus', '-b:a', `${audioBitrateKbps}k`);
    } else {
      args.push('-an');
    }
    args.push('output.webm');
  } else {
    // Default MP4 (H.264 + AAC) - Universal compatibility for Discord, Slack, GitHub
    args.push('-c:v', 'libx264');
    
    // Preset tuning
    const speedPreset = qualityPreset === 'max_quality' ? 'slow' : (qualityPreset === 'fast' ? 'ultrafast' : 'medium');
    args.push('-preset', speedPreset);
    args.push('-tune', 'film');

    // Bitrate targeting
    args.push('-b:v', `${videoBitrateKbps}k`);
    args.push('-maxrate', `${Math.floor(videoBitrateKbps * 1.12)}k`);
    args.push('-bufsize', `${Math.floor(videoBitrateKbps * 1.8)}k`);

    // Standard YUV420p for Discord/browser instant previews
    args.push('-pix_fmt', 'yuv420p');

    // Faststart: moves moov atom to start of file for immediate web streaming
    args.push('-movflags', '+faststart');

    if (willHaveAudio) {
      args.push('-c:a', 'aac', '-b:a', `${audioBitrateKbps}k`, '-ac', '2');
    } else {
      args.push('-an');
    }

    args.push('output.mp4');
  }

  return args;
}

/**
 * Contextual warnings and pro-tips based on calculated plan
 */
function generateWarnings({ effectiveDuration, originalSize, limitBytes, bpp, presetId, format }) {
  const warnings = [];

  if (presetId === 'slack-emoji' && effectiveDuration > 5) {
    warnings.push({
      type: 'warning',
      text: `Your clip is ${effectiveDuration.toFixed(1)}s long. Slack emojis work best under 3 seconds. Trimming will dramatically increase sharpness!`
    });
  }

  if (bpp < 0.05 && (format === 'mp4' || format === 'webm')) {
    warnings.push({
      type: 'tip',
      text: `Heavy compression required to fit ${formatBytes(limitBytes)}. Trimming off a few seconds will boost video clarity by 2x–3x.`
    });
  }

  if (originalSize && originalSize < limitBytes) {
    warnings.push({
      type: 'info',
      text: `Original file (${formatBytes(originalSize)}) is already smaller than the platform cap (${formatBytes(limitBytes)}). Compression may not be necessary unless you want to save bandwidth.`
    });
  }

  return warnings;
}
