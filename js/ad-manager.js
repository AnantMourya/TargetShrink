/**
 * TargetCompress - Shared Ad Manager, User Error Formatter & DOM Utilities
 */

export function formatUserError(err, defaultMsg = "Unable to process this file. Try another supported format or a smaller file.") {
  if (!err) return defaultMsg;
  const msg = (err.message || String(err)).toLowerCase();
  if (msg.includes('format') || msg.includes('unsupported') || msg.includes('decode') || msg.includes('mime')) {
    return "Unsupported format. Please select a supported file format (JPG, PNG, WebP, PDF, MP4).";
  }
  if (msg.includes('target') || msg.includes('reach') || msg.includes('limit') || msg.includes('quality') || msg.includes('quota')) {
    return "The requested target could not be reached without significant quality loss. Try a slightly larger target size.";
  }
  if (msg.includes('memory') || msg.includes('allocation') || msg.includes('buffer') || msg.includes('rangeerror')) {
    return "The file is too large for your browser's available memory. Please try a smaller file or close background tabs.";
  }
  return defaultMsg;
}

export function setupDragDrop(el, onFiles) {
  if (!el) return;
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
    el.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  });

  ['dragenter', 'dragover'].forEach(evt => {
    el.addEventListener(evt, () => el.classList.add('drag-active'));
  });

  ['dragleave', 'drop'].forEach(evt => {
    el.addEventListener(evt, () => el.classList.remove('drag-active'));
  });

  el.addEventListener('drop', (e) => {
    if (e.dataTransfer && e.dataTransfer.files) {
      onFiles(Array.from(e.dataTransfer.files));
    }
  });
}

export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function initAdManager() {
  const adWrappers = document.querySelectorAll('.ad-slot-wrapper');
  if (adWrappers.length === 0) return;

  function evaluateAdSlot(wrapper) {
    const ins = wrapper.querySelector('ins.adsbygoogle');
    if (!ins) return;

    const status = ins.getAttribute('data-ad-status');
    const iframe = ins.querySelector('iframe');
    const isFilled = status === 'filled' || (iframe && iframe.offsetHeight > 10);

    if (isFilled) {
      wrapper.classList.remove('ad-collapsed');
      wrapper.classList.add('ad-filled');
    } else if (status === 'unfilled') {
      wrapper.classList.add('ad-collapsed');
      wrapper.classList.remove('ad-filled');
    }
  }

  adWrappers.forEach(wrapper => {
    const ins = wrapper.querySelector('ins.adsbygoogle');
    if (!ins) return;

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {}

    const observer = new MutationObserver(() => evaluateAdSlot(wrapper));
    observer.observe(ins, { attributes: true, childList: true, subtree: true });

    setTimeout(() => evaluateAdSlot(wrapper), 1500);
    setTimeout(() => evaluateAdSlot(wrapper), 3500);
    setTimeout(() => evaluateAdSlot(wrapper), 7000);
  });
}
