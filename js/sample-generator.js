/**
 * Canvas & Web Audio Synthetic Media Generator
 * Generates instant realistic sample video and animation files in the browser
 * so users can test platform shrink targets immediately with zero uploads.
 */

export async function generateSampleMedia({
  type = 'video', // 'video' (1080p motion) or 'emoji' (square animation)
  durationSec = 5,
  onProgress = () => {}
}) {
  const isEmoji = type === 'emoji';
  const width = isEmoji ? 400 : 1280;
  const height = isEmoji ? 400 : 720;
  const fps = 30;
  const totalFrames = durationSec * fps;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Setup Web Audio
  let audioCtx = null;
  let audioDest = null;
  let oscillator = null;
  let gainNode = null;
  let audioStream = null;

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
      audioDest = audioCtx.createMediaStreamDestination();
      gainNode = audioCtx.createGain();
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.connect(audioDest);
      audioStream = audioDest.stream;
    }
  } catch (e) {
    console.warn('Audio synthesis not supported in this context:', e);
  }

  // Create particles for visual complexity (gives realistic video bitrate test)
  const particles = [];
  const particleCount = isEmoji ? 25 : 80;
  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 6,
      vy: (Math.random() - 0.5) * 6,
      radius: Math.random() * (isEmoji ? 8 : 14) + 4,
      color: `hsl(${Math.floor(Math.random() * 360)}, 85%, 65%)`
    });
  }

  // Canvas Stream
  const canvasStream = canvas.captureStream(fps);
  const combinedStream = new MediaStream();
  canvasStream.getVideoTracks().forEach(t => combinedStream.addTrack(t));
  if (audioStream && audioStream.getAudioTracks().length > 0) {
    audioStream.getAudioTracks().forEach(t => combinedStream.addTrack(t));
  }

  // Select mime type
  let mimeType = 'video/webm;codecs=vp9,opus';
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = 'video/webm;codecs=vp8,opus';
  }
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = 'video/webm';
  }
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = 'video/mp4';
  }

  // High bitrate target for the source sample so it's a good test candidate
  const recorderOptions = {
    mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : undefined,
    videoBitsPerSecond: isEmoji ? 2_000_000 : 12_000_000
  };

  const recorder = new MediaRecorder(combinedStream, recorderOptions);
  const chunks = [];

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const recordingPromise = new Promise((resolve, reject) => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' });
      resolve(blob);
    };
    recorder.onerror = reject;
  });

  recorder.start();

  // Play subtle periodic audio chords
  let nextToneTime = 0;
  const playTone = (timeSec) => {
    if (!audioCtx || !gainNode) return;
    if (timeSec >= nextToneTime) {
      nextToneTime += 1.0;
      try {
        const osc = audioCtx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320 + (timeSec % 4) * 110, audioCtx.currentTime);
        osc.connect(gainNode);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
      } catch (err) {}
    }
  };

  // Render loop
  let frame = 0;
  const interval = 1000 / fps;

  return new Promise((resolve, reject) => {
    const renderNextFrame = () => {
      if (frame >= totalFrames) {
        recorder.stop();
        if (audioCtx) audioCtx.close().catch(() => {});
        recordingPromise.then((blob) => {
          const filename = isEmoji ? 'sample-emoji-reaction.webm' : 'sample-1080p-clip.webm';
          const file = new File([blob], filename, { type: blob.type });
          resolve(file);
        }).catch(reject);
        return;
      }

      const t = frame / fps;
      playTone(t);

      // 1. Background gradient animation
      const grad = ctx.createLinearGradient(
        0, 0,
        width * (0.8 + 0.2 * Math.sin(t * 1.5)),
        height * (0.8 + 0.2 * Math.cos(t * 1.5))
      );
      if (isEmoji) {
        grad.addColorStop(0, '#1a0933');
        grad.addColorStop(0.5, '#40135d');
        grad.addColorStop(1, '#ff3366');
      } else {
        grad.addColorStop(0, '#0a0d1a');
        grad.addColorStop(0.5, '#12182d');
        grad.addColorStop(1, '#1e294e');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // 2. Draw complex particles
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = p.color;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // 3. Central graphic
      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.rotate(t * 1.2);

      if (isEmoji) {
        // Rotating party emoji / star
        ctx.fillStyle = '#FFD700';
        ctx.font = '72px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚡🔥', 0, 0);
      } else {
        // Futuristic geometric radar ring
        ctx.strokeStyle = '#00f3ff';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 110 + 20 * Math.sin(t * 4), 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = '#ff007b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.rect(-80, -80, 160, 160);
        ctx.stroke();
      }
      ctx.restore();

      // 4. On-screen diagnostics text (tests edge sharpness)
      ctx.fillStyle = '#ffffff';
      ctx.font = isEmoji ? 'bold 18px monospace' : 'bold 26px monospace';
      ctx.textAlign = 'center';
      const label = isEmoji ? 'SAMPLE SLACK EMOJI' : 'TARGET-SIZE MEDIA SHRINKER TEST CLIP';
      ctx.fillText(label, width / 2, isEmoji ? 40 : 60);

      ctx.fillStyle = '#00ffcc';
      ctx.font = isEmoji ? '14px monospace' : '18px monospace';
      ctx.fillText(`Frame ${frame + 1}/${totalFrames} | ${t.toFixed(2)}s / ${durationSec}s`, width / 2, isEmoji ? height - 30 : height - 40);

      frame++;
      onProgress(Math.round((frame / totalFrames) * 100));
      setTimeout(renderNextFrame, interval);
    };

    renderNextFrame();
  });
}
