function formatUserError(err, defaultMsg = "Unable to process this file. Try another supported format or a smaller file.") {
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

import {
  mergePdfs,
  splitPdf,
  pdfToImages,
  imagesToPdf,
  rotatePdf,
  watermarkPdf,
  triggerDownload,
  formatSize
} from './pdf-tools.js';

import {
  convertImageFormat,
  resizeImage
} from './image-tools.js';

/**
 * Target-Size Studio - Main Application Controller
 * Manages Video/GIF, Image, PDF Shrinker & Document Converter
 */

import { PRESETS, formatBytes, formatDuration, calculateCompressionPlan } from './calculator.js';
import { compressMedia, abortCompression } from './compressor.js';
import { generateSampleMedia } from './sample-generator.js';
import { IMAGE_PRESETS, compressImageToTarget } from './image-shrinker.js';
import { PDF_PRESETS, compressPdfToTarget } from './pdf-shrinker.js';
import { convertPdfToWord, convertWordToPdf } from './doc-converter.js';

// SVG Platform Icons for Video presets
const ICONS = {
  discord: `<svg width="22" height="22" viewBox="0 0 24 24" fill="#5865F2"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>`,
  nitro: `<svg width="22" height="22" viewBox="0 0 24 24" fill="#EB459E"><path d="M5.8 2.5L2 9.5l10 12 10-12-3.8-7H5.8zm1.9 2h8.6l2.7 5H5L7.7 4.5zM12 11.2l4.8-1.7-4.8 8.8-4.8-8.8 4.8 1.7z"/></svg>`,
  slack: `<svg width="22" height="22" viewBox="0 0 24 24"><path fill="#36C5F0" d="M6 15a2 2 0 0 1-2 2H2a2 2 0 0 1 0-4h2a2 2 0 0 1 2 2zm1-2a2 2 0 0 1 2-2 2 2 0 0 1 2 2v5a2 2 0 0 1-4 0v-5z"/><path fill="#2EB67D" d="M9 6a2 2 0 0 1-2-2 2 2 0 0 1 2-2 2 2 0 0 1 2 2v2a2 2 0 0 1-2 2zm2 1a2 2 0 0 1 2 2 2 2 0 0 1-2 2H6a2 2 0 0 1 0-4h5z"/><path fill="#ECB22E" d="M18 9a2 2 0 0 1 2-2h2a2 2 0 0 1 0 4h-2a2 2 0 0 1-2-2zm-1 2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V6a2 2 0 0 1 4 0v5z"/><path fill="#E01E5A" d="M15 18a2 2 0 0 1 2 2 2 2 0 0 1-2 2 2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2zm-2-1a2 2 0 0 1-2-2 2 2 0 0 1 2-2h5a2 2 0 0 1 0 4h-5z"/></svg>`,
  github: `<svg width="22" height="22" viewBox="0 0 24 24" fill="#ffffff"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>`,
  email: `<svg width="22" height="22" viewBox="0 0 24 24" fill="#EA4335"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>`,
  whatsapp: `<svg width="22" height="22" viewBox="0 0 24 24" fill="#25D366"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2m.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.196 8.196 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24M8.53 7.33c-.16 0-.35.03-.53.28-.18.25-.69.67-.69 1.64 0 .97.71 1.91.81 2.05.1.14 1.39 2.12 3.37 2.97.47.2.84.32 1.12.41.47.15.9.13 1.24.08.38-.06 1.16-.47 1.32-.93.16-.46.16-.85.11-.93-.05-.08-.18-.13-.37-.22s-1.16-.57-1.34-.64c-.18-.07-.31-.1-.44.1-.13.2-.5.64-.61.77-.11.13-.23.15-.42.05-.19-.1-.8-.29-1.52-.94-.56-.5-.94-1.12-1.05-1.31-.11-.19-.01-.29.08-.39.08-.09.19-.23.28-.35.09-.12.13-.2.19-.34.06-.14.03-.26-.02-.36-.05-.1-.44-1.06-.61-1.45-.16-.39-.33-.33-.45-.34-.11-.01-.25-.01-.39-.01z"/></svg>`,
  custom: `<svg width="22" height="22" viewBox="0 0 24 24" fill="#00D2FF"><path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"/></svg>`
};


/**
 * AdSense Zero-CLS Fill Manager
 * Ensures ad containers remain 0 height and collapsed until an ad is confirmed filled.
 * Never displays placeholder text.
 */
function initAdManager() {
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

    // Monitor for AdSense rendering changes
    const observer = new MutationObserver(() => evaluateAdSlot(wrapper));
    observer.observe(ins, { attributes: true, childList: true, subtree: true });

    // Periodic evaluation checks
    setTimeout(() => evaluateAdSlot(wrapper), 1500);
    setTimeout(() => evaluateAdSlot(wrapper), 3500);
    setTimeout(() => evaluateAdSlot(wrapper), 7000);
  });
}

export function initApp() {
  initTabNavigation();
  initVideoTab();
  initImageTab();
  initPdfTab();
  initConverterTab();

  // Initialize 8 New Tools
  initImagesToPdfTab();
  initMergePdfTab();
  initSplitPdfTab();
  initPdfToImagesTab();
  initRotatePdfTab();
  initWatermarkPdfTab();
  initImageConverterTab();
  initImageResizerTab();
  initAdManager();
}

/**
 * Top-Level Tool Navigation Tabs
 */

export const ROUTE_MAP = {
  '/': {
    tabId: 'all-tools-tab',
    title: 'Compress Images, PDFs & Videos to Your Target Size — TargetCompress',
    desc: 'Compress images, PDFs and videos to your exact target size (20KB, 50KB, 100KB, 200KB, 500KB, 1MB, 10MB) directly in your browser. Files never leave your device. 100% free.'
  },
  // Dedicated Image Target Size Routes
  '/compress-image-to-20kb': {
    tabId: 'image-tab',
    title: 'Compress Image to 20KB Online Free | TargetCompress',
    desc: 'Compress JPG, PNG and WebP pictures strictly to 20KB or below directly in your browser. Perfect for signatures, exam forms and portal uploads. No server uploads.',
    target: { type: 'image', value: 20, unit: 'KB' }
  },
  '/compress-image-to-50kb': {
    tabId: 'image-tab',
    title: 'Compress Image to 50KB Online Free | TargetCompress',
    desc: 'Reduce JPG, PNG, and WebP photos to 50KB or below directly in your browser without uploading to external servers. Ideal for government & visa forms.',
    target: { type: 'image', value: 50, unit: 'KB' }
  },
  '/compress-image-to-100kb': {
    tabId: 'image-tab',
    title: 'Compress Image to 100KB Online Free | TargetCompress',
    desc: 'Compress images to 100KB or below directly in your browser. Maintain crisp visual quality for admission cards, resume photos and online portals.',
    target: { type: 'image', value: 100, unit: 'KB' }
  },
  '/compress-image-to-200kb': {
    tabId: 'image-tab',
    title: 'Compress Image to 200KB Online Free | TargetCompress',
    desc: 'Shrink photos and pictures to 200KB or below in your browser. Perfect for LinkedIn profile pictures, ATS job applications, and student IDs.',
    target: { type: 'image', value: 200, unit: 'KB' }
  },
  '/compress-image-to-500kb': {
    tabId: 'image-tab',
    title: 'Compress Image to 500KB Online Free | TargetCompress',
    desc: 'Compress high-resolution images to 500KB or below for web assets, blogs, and email attachments with client-side canvas processing.',
    target: { type: 'image', value: 500, unit: 'KB' }
  },
  '/compress-signature-to-20kb': {
    tabId: 'image-tab',
    title: 'Compress Signature to 20KB Online Free | TargetCompress',
    desc: 'Compress scanned signature images to under 20KB with high contrast and sharp legibility. 100% private in-browser tool for online forms.',
    target: { type: 'image', value: 20, unit: 'KB' }
  },

  // Dedicated PDF Target Size Routes
  '/compress-pdf-to-50kb': {
    tabId: 'pdf-tab',
    title: 'Compress PDF to 50KB Online Free | TargetCompress',
    desc: 'Compress PDF files to 50KB or below directly in your browser. Downscale images and optimize streams for strict portal upload caps with zero server uploads.',
    target: { type: 'pdf', value: 50, unit: 'KB' }
  },
  '/compress-pdf-to-100kb': {
    tabId: 'pdf-tab',
    title: 'Compress PDF to 100KB Online Free | TargetCompress',
    desc: 'Reduce PDF document file size to 100KB or below for government job portals, university admissions, and visa applications. Private and free.',
    target: { type: 'pdf', value: 100, unit: 'KB' }
  },
  '/compress-pdf-to-200kb': {
    tabId: 'pdf-tab',
    title: 'Compress PDF to 200KB Online Free | TargetCompress',
    desc: 'Shrink multi-page certificates, marksheets, and documents strictly below 200KB directly in your browser with zero data sent to external servers.',
    target: { type: 'pdf', value: 200, unit: 'KB' }
  },
  '/compress-pdf-to-500kb': {
    tabId: 'pdf-tab',
    title: 'Compress PDF to 500KB Online Free | TargetCompress',
    desc: 'Compress resumes, scanned portfolios, and reports to 500KB or below. Ideal for recruiter emails and ATS job application portals.',
    target: { type: 'pdf', value: 500, unit: 'KB' }
  },
  '/compress-pdf-to-1mb': {
    tabId: 'pdf-tab',
    title: 'Compress PDF to 1MB Online Free | TargetCompress',
    desc: 'Reduce large PDF documents to 1MB or below directly in your browser. Clean page-by-page stream optimization without watermarks.',
    target: { type: 'pdf', value: 1, unit: 'MB' }
  },

  // Dedicated Video Target Size Routes
  '/compress-video-to-10mb': {
    tabId: 'video-tab',
    title: 'Compress Video to 10MB Online Free | TargetCompress',
    desc: 'Compress MP4, WebM and GIF video clips strictly under Discord Free 10MB limit with two-pass bitrate optimization directly in your browser.',
    target: { type: 'video', preset: 'discord-free' }
  },
  '/compress-video-to-25mb': {
    tabId: 'video-tab',
    title: 'Compress Video to 25MB Online Free | TargetCompress',
    desc: 'Compress videos to 25MB or below for Discord Nitro Basic and email attachment limits directly in your browser with WebAssembly FFmpeg.',
    target: { type: 'video', preset: 'discord-nitro' }
  },
  '/compress-video-to-50mb': {
    tabId: 'video-tab',
    title: 'Compress Video to 50MB Online Free | TargetCompress',
    desc: 'Reduce high-definition video clips to 50MB or below for Discord Boost servers and web portals with local client-side processing.',
    target: { type: 'video', preset: 'video-50m' }
  },

  // Direct Utility Routes
  '/resize-image': {
    tabId: 'img-resizer-tab',
    title: 'Resize Image Dimensions in Pixels | TargetCompress',
    desc: 'Resize photo width and height in pixels or scale by percentage with locked aspect ratio. Fast, private client-side image resizer.'
  },
  '/merge-pdf': {
    tabId: 'pdf-merge-tab',
    title: 'Merge PDF Files Online for Free | TargetCompress',
    desc: 'Combine multiple PDF documents into a single organized file in any order. Fast, secure, and 100% client-side with zero uploads.'
  },
  '/split-pdf': {
    tabId: 'pdf-split-tab',
    title: 'Split PDF & Extract Pages Online | TargetCompress',
    desc: 'Extract specific pages or page ranges from any PDF document without uploading your files. Fast, private in-browser PDF page splitter.'
  },
  '/pdf-to-word': {
    tabId: 'converter-tab',
    title: 'Convert PDF to Word Online Free | TargetCompress',
    desc: 'Convert PDF documents into editable Microsoft Word (.docx) files directly in your browser. 100% private client-side document conversion.'
  },
  '/word-to-pdf': {
    tabId: 'converter-tab',
    title: 'Convert Word to PDF Online Free | TargetCompress',
    desc: 'Convert Microsoft Word (.docx) files into clean, professional PDF documents directly in your browser without uploading to external servers.'
  },
  '/image-to-pdf': {
    tabId: 'img-to-pdf-tab',
    title: 'Convert Images to PDF Online Free | TargetCompress',
    desc: 'Combine multiple JPG, PNG, and WebP images or photo scans into one clean, high-quality PDF document with zero uploads. 100% client-side.'
  },

  // Standalone /tools/ routes
  '/tools/video-compressor': { tabId: 'video-tab', title: 'Compress Video & GIF to Exact KB / MB — TargetCompress', desc: 'Compress MP4, WebM, and GIF files to exact target limits like Discord 10MB or Slack 5MB directly in your browser.' },
  '/tools/pdf-compressor': { tabId: 'pdf-tab', title: 'Compress PDF to Exact KB / MB Online — TargetCompress', desc: 'Reduce PDF file size to exact KB or MB for government portals, job applications & visa forms. 100% private in-browser compression.' },
  '/tools/image-compressor': { tabId: 'image-tab', title: 'Compress Image to Exact KB Online — TargetCompress', desc: 'Compress JPG, PNG, and WebP pictures strictly under exact KB caps (50KB, 100KB) for exam forms, portals and resumes.' },
  '/tools/pdf-to-images': { tabId: 'pdf-to-img-tab', title: 'Convert PDF to JPG / PNG Images — TargetCompress', desc: 'Render every page of your PDF into crisp, high-resolution JPG or PNG pictures. Download individual images or a ZIP archive.' },
  '/tools/rotate-pdf': { tabId: 'pdf-rotate-tab', title: 'Rotate PDF Pages Online Permanently — TargetCompress', desc: 'Rotate upside-down or sideways PDF pages by 90, 180, or 270 degrees. Apply to all pages or custom ranges.' },
  '/tools/watermark-pdf': { tabId: 'pdf-watermark-tab', title: 'Add Watermark to PDF Online Free — TargetCompress', desc: 'Stamp customizable text watermarks like CONFIDENTIAL or DRAFT across your PDF pages with zero server uploads.' },
  '/tools/image-converter': { tabId: 'img-converter-tab', title: 'Convert Image Formats (JPG, PNG, WebP) — TargetCompress', desc: 'Convert between JPG, PNG, and WebP picture formats instantly in your browser with zero loss in visual clarity.' }
};

// Aliased for backwards compatibility
export const TOOL_ROUTES = ROUTE_MAP;

function applyRouteTarget(target) {
  if (!target) return;
  if (target.type === 'image') {
    const input = document.getElementById('imgTargetInput');
    const unit = document.getElementById('imgTargetUnit');
    if (input && unit) {
      input.value = target.value;
      unit.value = target.unit;
    }
  } else if (target.type === 'pdf') {
    const input = document.getElementById('pdfTargetInput');
    const unit = document.getElementById('pdfTargetUnit');
    if (input && unit) {
      input.value = target.value;
      unit.value = target.unit;
    }
  } else if (target.type === 'video' && target.preset) {
    const card = document.querySelector(`.preset-card[data-preset-id="${target.preset}"]`);
    if (card) card.click();
  }
}

export function switchTab(targetTabId, updateHistory = true, targetPath = null) {
  const contents = document.querySelectorAll('.tab-content');
  const pills = document.querySelectorAll('.hub-pill');

  contents.forEach(c => c.classList.remove('active'));
  const targetContent = document.getElementById(targetTabId);
  if (targetContent) {
    targetContent.classList.add('active');
  }

  // Update category pill active states
  pills.forEach(p => {
    if (p.dataset.tab === targetTabId) {
      p.classList.add('active');
    } else if (targetTabId !== 'all-tools-tab' && p.dataset.category) {
      p.classList.remove('active');
    }
  });

  // Find route info
  let routePath = targetPath;
  let routeInfo = null;

  if (routePath && ROUTE_MAP[routePath]) {
    routeInfo = ROUTE_MAP[routePath];
  } else {
    // Lookup by tabId
    for (const [p, info] of Object.entries(ROUTE_MAP)) {
      if (info.tabId === targetTabId) {
        routePath = p;
        routeInfo = info;
        break;
      }
    }
  }

  if (routeInfo) {
    document.title = routeInfo.title;

    const descMeta = document.querySelector('meta[name="description"]');
    if (descMeta) descMeta.setAttribute('content', routeInfo.desc);

    const canonicalLink = document.querySelector('link[rel="canonical"]');
    if (canonicalLink) canonicalLink.setAttribute('href', 'https://www.targetcompress.in' + (routePath === '/' ? '/' : routePath));

    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', routeInfo.title);

    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute('content', 'https://www.targetcompress.in' + (routePath === '/' ? '/' : routePath));

    if (routeInfo.target) {
      applyRouteTarget(routeInfo.target);
    }

    if (updateHistory) {
      try {
        history.pushState({ tab: targetTabId, path: routePath }, routeInfo.title, routePath);
      } catch (e) {
        history.replaceState(null, '', '#' + targetTabId.replace('-tab', ''));
      }
    }
  }

  // Scroll smoothly
  const main = document.querySelector('main');
  if (main) {
    main.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function initTabNavigation() {
  const pills = document.querySelectorAll('.hub-pill');
  const hubCards = document.querySelectorAll('.tool-hub-card');
  const backButtons = document.querySelectorAll('.back-to-hub-btn');

  // 1. Hub Category Filter Pills
  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      const category = pill.dataset.category;
      const targetTab = pill.dataset.tab;

      pills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');

      if (targetTab) {
        switchTab(targetTab);
        filterHubCategory('all');
        return;
      }

      switchTab('all-tools-tab');
      filterHubCategory(category);
    });
  });

  function filterHubCategory(cat) {
    const headers = document.querySelectorAll('.category-group-header');
    const grids = document.querySelectorAll('.tools-hub-grid');

    headers.forEach(h => {
      if (cat === 'all' || h.dataset.categoryGroup === cat) {
        h.style.display = 'flex';
      } else {
        h.style.display = 'none';
      }
    });

    grids.forEach(g => {
      if (cat === 'all' || g.dataset.categoryGroup === cat) {
        g.style.display = 'grid';
      } else {
        g.style.display = 'none';
      }
    });
  }

  // 2. Hub Cards Click -> Launch Tool
  // 2. Launch Tool on any element with data-launch-tab
  document.querySelectorAll('[data-launch-tab]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const tabId = el.dataset.launchTab;
      if (tabId) {
        switchTab(tabId);
      }
    });
  });

  // 3. "← All Tools" Back Buttons
  backButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab('all-tools-tab');
      filterHubCategory('all');
      pills.forEach(p => {
        if (p.dataset.tab === 'all-tools-tab') p.classList.add('active');
        else p.classList.remove('active');
      });
    });
  });

  // 3b. Intercept Internal Route Links for seamless SPA transitions
  document.querySelectorAll('a[href^="/"]').forEach(link => {
    const href = link.getAttribute('href');
    if (ROUTE_MAP[href]) {
      link.addEventListener('click', (e) => {
        if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
          e.preventDefault();
          const info = ROUTE_MAP[href];
          switchTab(info.tabId, true, href);
          if (info.target) applyRouteTarget(info.target);
        }
      });
    }
  });

  // 4. Handle browser Back / Forward (Popstate)
  window.addEventListener('popstate', (e) => {
    if (e.state && e.state.tab) {
      switchTab(e.state.tab, false);
    } else {
      resolveRouteFromUrl(false);
    }
  });

  // 5. Initial Route Resolution from Pathname or Hash
  resolveRouteFromUrl(false);
}

function resolveRouteFromUrl(updateHistory = false) {
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  
  // Check exact route in ROUTE_MAP
  if (ROUTE_MAP[path]) {
    const info = ROUTE_MAP[path];
    switchTab(info.tabId, updateHistory, path);
    if (info.target) applyRouteTarget(info.target);
    return;
  }

  // Check ending match
  for (const [routePath, info] of Object.entries(ROUTE_MAP)) {
    if (routePath !== '/' && path.endsWith(routePath)) {
      switchTab(info.tabId, updateHistory, routePath);
      if (info.target) applyRouteTarget(info.target);
      return;
    }
  }

  // Fallback to hash if present
  if (window.location.hash) {
    const hash = window.location.hash.replace('#', '');
    const candidateTab = hash.endsWith('-tab') ? hash : hash + '-tab';
    const target = document.getElementById(candidateTab);
    if (target) {
      switchTab(candidateTab, updateHistory);
      return;
    }
  }

  // Default to all-tools-tab
  const activeTab = document.querySelector('.tab-content.active');
  if (!activeTab) {
    switchTab('all-tools-tab', false, '/');
  }
}


/**
 * ============================================================================
 * TAB 1: VIDEO & GIF SHRINKER
 * ============================================================================
 */
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
      abortCompression();
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
function initImageTab() {
  let imgFile = null;
  let imgResult = null;

  const dropZone = document.getElementById('imgDropZone');
  const browseBtn = document.getElementById('imgBrowseBtn');
  const fileInput = document.getElementById('imgFileInput');
  const uploadSection = document.getElementById('imgUploadSection');
  const workspaceSection = document.getElementById('imgWorkspaceSection');
  const resultSection = document.getElementById('imgResultSection');

  const sourcePreview = document.getElementById('imgSourcePreview');
  const metaName = document.getElementById('imgMetaName');
  const metaSize = document.getElementById('imgMetaSize');
  const metaDimensions = document.getElementById('imgMetaDimensions');
  const metaFormat = document.getElementById('imgMetaFormat');
  const changeBtn = document.getElementById('imgChangeBtn');

  const targetInput = document.getElementById('imgTargetInput');
  const targetUnit = document.getElementById('imgTargetUnit');
  const presetChips = document.getElementById('imgPresetChips');
  const outputFormat = document.getElementById('imgOutputFormat');
  const shrinkBtn = document.getElementById('imgShrinkBtn');

  const progressContainer = document.getElementById('imgProgressContainer');
  const progressBar = document.getElementById('imgProgressBar');
  const progressStatus = document.getElementById('imgProgressStatus');
  const progressPercent = document.getElementById('imgProgressPercent');

  const resultBadge = document.getElementById('imgResultBadge');
  const savingsBadge = document.getElementById('imgSavingsBadge');
  const origSize = document.getElementById('imgResultOrigSize');
  const newSize = document.getElementById('imgResultNewSize');
  const targetSizeVal = document.getElementById('imgResultTargetSize');
  const compareOrig = document.getElementById('imgCompareOrig');
  const compareNew = document.getElementById('imgCompareNew');
  const downloadBtn = document.getElementById('imgDownloadBtn');
  const copyBtn = document.getElementById('imgCopyBtn');
  const compressAgainBtn = document.getElementById('imgCompressAgainBtn');
  const newFileBtn = document.getElementById('imgNewFileBtn');

  function renderImagePresets() {
    presetChips.innerHTML = '';
    IMAGE_PRESETS.forEach(p => {
      const chip = document.createElement('button');
      chip.className = 'preset-chip';
      chip.type = 'button';
      chip.innerHTML = `<span>${p.name}</span> <strong style="color:#00d2ff;">(${p.label})</strong>`;
      chip.addEventListener('click', () => {
        document.querySelectorAll('#imgPresetChips .preset-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        if (p.targetBytes >= 1024 * 1024) {
          targetInput.value = (p.targetBytes / (1024 * 1024)).toFixed(1);
          targetUnit.value = 'MB';
        } else {
          targetInput.value = Math.round(p.targetBytes / 1024);
          targetUnit.value = 'KB';
        }
      });
      presetChips.appendChild(chip);
    });
  }

  function handleFile(file) {
    imgFile = file;
    metaName.textContent = file.name;
    metaSize.textContent = formatBytes(file.size);
    metaFormat.textContent = file.type || 'image/jpeg';

    const url = URL.createObjectURL(file);
    sourcePreview.src = url;

    const testImg = new Image();
    testImg.onload = () => {
      metaDimensions.textContent = `${testImg.naturalWidth} × ${testImg.naturalHeight}`;
      uploadSection.classList.add('hidden');
      workspaceSection.classList.remove('hidden');
      resultSection.classList.add('hidden');
    };
    testImg.src = url;
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

  shrinkBtn.addEventListener('click', async () => {
    if (!imgFile) return;

    const val = parseFloat(targetInput.value) || 200;
    const mult = targetUnit.value === 'MB' ? 1024 * 1024 : 1024;
    const targetBytes = Math.floor(val * mult);

    shrinkBtn.disabled = true;
    progressContainer.classList.remove('hidden');
    progressBar.style.width = '0%';

    try {
      imgResult = await compressImageToTarget({
        file: imgFile,
        targetBytes,
        outputFormat: outputFormat.value,
        onProgress: (pct, msg) => {
          progressBar.style.width = `${pct}%`;
          progressPercent.textContent = `${pct}%`;
          progressStatus.textContent = msg;
        }
      });

      workspaceSection.classList.add('hidden');
      resultSection.classList.remove('hidden');

      resultBadge.textContent = imgResult.isUnderLimit
        ? `✓ Target Achieved: ${formatBytes(imgResult.sizeBytes)} (Target: ${formatBytes(targetBytes)})`
        : `⚠️ Target could not be reached without quality loss (${formatBytes(imgResult.sizeBytes)})`;
      resultBadge.className = `status-badge ${imgResult.isUnderLimit ? 'verified' : 'failed'}`;

      savingsBadge.textContent = `-${imgResult.reductionPercent}% Size Reduction`;
      origSize.textContent = formatBytes(imgFile.size);
      newSize.textContent = formatBytes(imgResult.sizeBytes);
      targetSizeVal.textContent = formatBytes(targetBytes);

      compareOrig.src = URL.createObjectURL(imgFile);
      compareNew.src = imgResult.outputUrl;

    } catch (err) {
      alert(formatUserError(err, "Unable to compress this image. Try another supported image format (JPG, PNG, WebP) or a slightly larger target size."));
    } finally {
      shrinkBtn.disabled = false;
      progressContainer.classList.add('hidden');
    }
  });

  downloadBtn.addEventListener('click', () => {
    if (!imgResult) return;
    const a = document.createElement('a');
    a.href = imgResult.outputUrl;
    a.download = imgFile.name.replace(/\.[^.]+$/, '') + `_shrink_${targetInput.value}${targetUnit.value}.${imgResult.format}`;
    a.click();
  });

  copyBtn.addEventListener('click', async () => {
    if (!imgResult) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ [imgResult.blob.type]: imgResult.blob })]);
      copyBtn.textContent = '✅ Image Copied to Clipboard!';
      setTimeout(() => copyBtn.textContent = '📋 Copy Image to Clipboard', 2000);
    } catch (e) {
      alert('Use the Download button or right-click to copy.');
    }
  });

  compressAgainBtn.addEventListener('click', () => {
    resultSection.classList.add('hidden');
    workspaceSection.classList.remove('hidden');
  });

  newFileBtn.addEventListener('click', () => {
    resultSection.classList.add('hidden');
    workspaceSection.classList.add('hidden');
    uploadSection.classList.remove('hidden');
    fileInput.value = '';
  });

  renderImagePresets();
}

/**
 * ============================================================================
 * TAB 3: PDF SIZE REDUCER (DIRECT EXACT KB / MB INPUT)
 * ============================================================================
 */
function initPdfTab() {
  let pdfFile = null;
  let pdfResult = null;

  const dropZone = document.getElementById('pdfDropZone');
  const browseBtn = document.getElementById('pdfBrowseBtn');
  const fileInput = document.getElementById('pdfFileInput');
  const uploadSection = document.getElementById('pdfUploadSection');
  const workspaceSection = document.getElementById('pdfWorkspaceSection');
  const resultSection = document.getElementById('pdfResultSection');

  const metaName = document.getElementById('pdfMetaName');
  const metaSize = document.getElementById('pdfMetaSize');
  const metaPages = document.getElementById('pdfMetaPages');
  const changeBtn = document.getElementById('pdfChangeBtn');

  const targetInput = document.getElementById('pdfTargetInput');
  const targetUnit = document.getElementById('pdfTargetUnit');
  const presetChips = document.getElementById('pdfPresetChips');
  const shrinkBtn = document.getElementById('pdfShrinkBtn');

  const progressContainer = document.getElementById('pdfProgressContainer');
  const progressBar = document.getElementById('pdfProgressBar');
  const progressStatus = document.getElementById('pdfProgressStatus');
  const progressPercent = document.getElementById('pdfProgressPercent');

  const resultBadge = document.getElementById('pdfResultBadge');
  const savingsBadge = document.getElementById('pdfSavingsBadge');
  const origSize = document.getElementById('pdfResultOrigSize');
  const newSize = document.getElementById('pdfResultNewSize');
  const targetSizeVal = document.getElementById('pdfResultTargetSize');
  const downloadBtn = document.getElementById('pdfDownloadBtn');
  const compressAgainBtn = document.getElementById('pdfCompressAgainBtn');
  const newFileBtn = document.getElementById('pdfNewFileBtn');

  function renderPdfPresets() {
    presetChips.innerHTML = '';
    PDF_PRESETS.forEach(p => {
      const chip = document.createElement('button');
      chip.className = 'preset-chip';
      chip.type = 'button';
      chip.innerHTML = `<span>${p.name}</span> <strong style="color:#00d2ff;">(${p.label})</strong>`;
      chip.addEventListener('click', () => {
        document.querySelectorAll('#pdfPresetChips .preset-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        if (p.targetBytes >= 1024 * 1024) {
          targetInput.value = (p.targetBytes / (1024 * 1024)).toFixed(1);
          targetUnit.value = 'MB';
        } else {
          targetInput.value = Math.round(p.targetBytes / 1024);
          targetUnit.value = 'KB';
        }
      });
      presetChips.appendChild(chip);
    });
  }

  async function handleFile(file) {
    pdfFile = file;
    metaName.textContent = file.name;
    metaSize.textContent = formatBytes(file.size);

    metaPages.textContent = 'Counting pages...';
    uploadSection.classList.add('hidden');
    workspaceSection.classList.remove('hidden');
    resultSection.classList.add('hidden');

    try {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = './pdf.worker.min.js';
        const doc = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
        metaPages.textContent = `${doc.numPages} Page${doc.numPages > 1 ? 's' : ''}`;
      } else {
        metaPages.textContent = 'Ready';
      }
    } catch (e) {
      metaPages.textContent = '1+ Pages';
    }
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

  shrinkBtn.addEventListener('click', async () => {
    if (!pdfFile) return;

    const val = parseFloat(targetInput.value) || 500;
    const mult = targetUnit.value === 'MB' ? 1024 * 1024 : 1024;
    const targetBytes = Math.floor(val * mult);

    shrinkBtn.disabled = true;
    progressContainer.classList.remove('hidden');
    progressBar.style.width = '0%';

    try {
      pdfResult = await compressPdfToTarget({
        file: pdfFile,
        targetBytes,
        onProgress: (pct, msg) => {
          progressBar.style.width = `${pct}%`;
          progressPercent.textContent = `${pct}%`;
          progressStatus.textContent = msg;
        }
      });

      workspaceSection.classList.add('hidden');
      resultSection.classList.remove('hidden');

      resultBadge.textContent = pdfResult.isUnderLimit
        ? `✓ Target Achieved: ${formatBytes(pdfResult.sizeBytes)} (Target: ${formatBytes(targetBytes)})`
        : `⚠️ Target could not be reached without quality loss (${formatBytes(pdfResult.sizeBytes)})`;
      resultBadge.className = `status-badge ${pdfResult.isUnderLimit ? 'verified' : 'failed'}`;

      savingsBadge.textContent = `-${pdfResult.reductionPercent}% Size Reduction`;
      origSize.textContent = formatBytes(pdfFile.size);
      newSize.textContent = formatBytes(pdfResult.sizeBytes);
      targetSizeVal.textContent = formatBytes(targetBytes);

    } catch (err) {
      alert(formatUserError(err, "Unable to compress this PDF. Try selecting a slightly larger target size or verify the document is not password-protected."));
    } finally {
      shrinkBtn.disabled = false;
      progressContainer.classList.add('hidden');
    }
  });

  downloadBtn.addEventListener('click', () => {
    if (!pdfResult) return;
    const a = document.createElement('a');
    a.href = pdfResult.outputUrl;
    a.download = pdfResult.filename;
    a.click();
  });

  compressAgainBtn.addEventListener('click', () => {
    resultSection.classList.add('hidden');
    workspaceSection.classList.remove('hidden');
  });

  newFileBtn.addEventListener('click', () => {
    resultSection.classList.add('hidden');
    workspaceSection.classList.add('hidden');
    uploadSection.classList.remove('hidden');
    fileInput.value = '';
  });

  renderPdfPresets();
}

/**
 * ============================================================================
 * TAB 4: PDF ⇄ WORD CONVERTER
 * ============================================================================
 */
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
function initImagesToPdfTab() {
  const dropZone = document.getElementById('imgPdfDropZone');
  const fileInput = document.getElementById('imgPdfFileInput');
  const browseBtn = document.getElementById('imgPdfBrowseBtn');
  const addMoreBtn = document.getElementById('imgPdfAddMoreBtn');
  const workspace = document.getElementById('imgPdfWorkspace');
  const listContainer = document.getElementById('imgPdfList');
  const countEl = document.getElementById('imgPdfCount');
  const convertBtn = document.getElementById('imgPdfConvertBtn');
  const progressBox = document.getElementById('imgPdfProgressBox');
  const progressStatus = document.getElementById('imgPdfProgressStatus');
  const progressBar = document.getElementById('imgPdfProgressBar');
  const progressPercent = document.getElementById('imgPdfProgressPercent');
  const resultBox = document.getElementById('imgPdfResultBox');
  const downloadBtn = document.getElementById('imgPdfDownloadBtn');
  const newBtn = document.getElementById('imgPdfNewBtn');
  const orientationPills = document.querySelectorAll('#imgPdfOrientationGroup .option-pill-btn');

  if (!dropZone) return;

  let imageFiles = [];
  let currentOrientation = 'auto';
  let resultBlob = null;

  // Option pills
  orientationPills.forEach(pill => {
    pill.addEventListener('click', () => {
      orientationPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentOrientation = pill.dataset.val;
    });
  });

  browseBtn.addEventListener('click', () => fileInput.click());
  addMoreBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files));
      fileInput.value = '';
    }
  });

  setupDragDrop(dropZone, (files) => {
    const imgs = files.filter(f => f.type.startsWith('image/'));
    if (imgs.length > 0) addFiles(imgs);
  });

  function addFiles(newFiles) {
    imageFiles = imageFiles.concat(newFiles);
    renderList();
    workspace.classList.remove('hidden');
    resultBox.classList.add('hidden');
  }

  function renderList() {
    listContainer.innerHTML = '';
    countEl.textContent = imageFiles.length;

    if (imageFiles.length === 0) {
      workspace.classList.add('hidden');
      return;
    }

    imageFiles.forEach((file, idx) => {
      const item = document.createElement('div');
      item.className = 'file-list-item';

      const thumbUrl = URL.createObjectURL(file);
      item.innerHTML = `
        <div class="file-item-info">
          <img src="${thumbUrl}" style="width: 32px; height: 32px; object-fit: cover; border-radius: 4px; border: 1px solid var(--border-subtle);">
          <div style="min-width: 0;">
            <div class="file-item-name">${escapeHtml(file.name)}</div>
            <div class="file-item-meta">${formatSize(file.size)} • Page ${idx + 1}</div>
          </div>
        </div>
        <div class="file-item-actions">
          <button class="file-action-btn move-up" title="Move Up" aria-label="Move file up in order" ${idx === 0 ? 'disabled style="opacity:0.3"' : ''}>▲</button>
          <button class="file-action-btn move-down" title="Move Down" aria-label="Move file down in order" ${idx === imageFiles.length - 1 ? 'disabled style="opacity:0.3"' : ''}>▼</button>
          <button class="file-action-btn delete" title="Remove" aria-label="Remove file from list">✕</button>
        </div>
      `;

      item.querySelector('.move-up').addEventListener('click', (e) => {
        e.stopPropagation();
        if (idx > 0) {
          const temp = imageFiles[idx];
          imageFiles[idx] = imageFiles[idx - 1];
          imageFiles[idx - 1] = temp;
          renderList();
        }
      });

      item.querySelector('.move-down').addEventListener('click', (e) => {
        e.stopPropagation();
        if (idx < imageFiles.length - 1) {
          const temp = imageFiles[idx];
          imageFiles[idx] = imageFiles[idx + 1];
          imageFiles[idx + 1] = temp;
          renderList();
        }
      });

      item.querySelector('.delete').addEventListener('click', (e) => {
        e.stopPropagation();
        imageFiles.splice(idx, 1);
        renderList();
      });

      listContainer.appendChild(item);
    });
  }

  convertBtn.addEventListener('click', async () => {
    if (imageFiles.length === 0) return;

    convertBtn.disabled = true;
    progressBox.classList.remove('hidden');
    resultBox.classList.add('hidden');

    try {
      resultBlob = await imagesToPdf(imageFiles, currentOrientation, 10, (pct, status) => {
        progressBar.style.width = pct + '%';
        progressPercent.textContent = pct + '%';
        progressStatus.textContent = status;
      });

      resultBox.classList.remove('hidden');
    } catch (err) {
      alert(formatUserError(err, "Unable to create PDF from selected images. Please verify your images are valid JPG, PNG, or WebP files."));
    } finally {
      convertBtn.disabled = false;
      progressBox.classList.add('hidden');
    }
  });

  downloadBtn.addEventListener('click', () => {
    if (resultBlob) {
      triggerDownload(resultBlob, 'images_combined.pdf');
    }
  });

  newBtn.addEventListener('click', () => {
    imageFiles = [];
    resultBlob = null;
    renderList();
  });
}

/**
 * ============================================================================
 * NEW TOOL 2: MERGE PDFs (pdf-merge-tab)
 * ============================================================================
 */
function initMergePdfTab() {
  const dropZone = document.getElementById('mergeDropZone');
  const fileInput = document.getElementById('mergeFileInput');
  const browseBtn = document.getElementById('mergeBrowseBtn');
  const addMoreBtn = document.getElementById('mergeAddMoreBtn');
  const workspace = document.getElementById('mergeWorkspace');
  const listContainer = document.getElementById('mergeList');
  const countEl = document.getElementById('mergeCount');
  const startBtn = document.getElementById('mergeStartBtn');
  const progressBox = document.getElementById('mergeProgressBox');
  const progressStatus = document.getElementById('mergeProgressStatus');
  const progressBar = document.getElementById('mergeProgressBar');
  const progressPercent = document.getElementById('mergeProgressPercent');
  const resultBox = document.getElementById('mergeResultBox');
  const downloadBtn = document.getElementById('mergeDownloadBtn');
  const newBtn = document.getElementById('mergeNewBtn');

  if (!dropZone) return;

  let pdfFiles = [];
  let resultBlob = null;

  browseBtn.addEventListener('click', () => fileInput.click());
  addMoreBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files));
      fileInput.value = '';
    }
  });

  setupDragDrop(dropZone, (files) => {
    const pdfs = files.filter(f => f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf');
    if (pdfs.length > 0) addFiles(pdfs);
  });

  function addFiles(newFiles) {
    pdfFiles = pdfFiles.concat(newFiles);
    renderList();
    workspace.classList.remove('hidden');
    resultBox.classList.add('hidden');
  }

  function renderList() {
    listContainer.innerHTML = '';
    countEl.textContent = pdfFiles.length;

    if (pdfFiles.length === 0) {
      workspace.classList.add('hidden');
      return;
    }

    pdfFiles.forEach((file, idx) => {
      const item = document.createElement('div');
      item.className = 'file-list-item';
      item.innerHTML = `
        <div class="file-item-info">
          <span class="file-item-icon">📄</span>
          <div style="min-width: 0;">
            <div class="file-item-name">${escapeHtml(file.name)}</div>
            <div class="file-item-meta">${formatSize(file.size)} • Document #${idx + 1}</div>
          </div>
        </div>
        <div class="file-item-actions">
          <button class="file-action-btn move-up" title="Move Up" aria-label="Move file up in order" ${idx === 0 ? 'disabled style="opacity:0.3"' : ''}>▲</button>
          <button class="file-action-btn move-down" title="Move Down" aria-label="Move file down in order" ${idx === pdfFiles.length - 1 ? 'disabled style="opacity:0.3"' : ''}>▼</button>
          <button class="file-action-btn delete" title="Remove" aria-label="Remove file from list">✕</button>
        </div>
      `;

      item.querySelector('.move-up').addEventListener('click', (e) => {
        e.stopPropagation();
        if (idx > 0) {
          const temp = pdfFiles[idx];
          pdfFiles[idx] = pdfFiles[idx - 1];
          pdfFiles[idx - 1] = temp;
          renderList();
        }
      });

      item.querySelector('.move-down').addEventListener('click', (e) => {
        e.stopPropagation();
        if (idx < pdfFiles.length - 1) {
          const temp = pdfFiles[idx];
          pdfFiles[idx] = pdfFiles[idx + 1];
          pdfFiles[idx + 1] = temp;
          renderList();
        }
      });

      item.querySelector('.delete').addEventListener('click', (e) => {
        e.stopPropagation();
        pdfFiles.splice(idx, 1);
        renderList();
      });

      listContainer.appendChild(item);
    });
  }

  startBtn.addEventListener('click', async () => {
    if (pdfFiles.length < 2) {
      alert('Please add at least 2 PDF files to merge.');
      return;
    }

    startBtn.disabled = true;
    progressBox.classList.remove('hidden');
    resultBox.classList.add('hidden');

    try {
      resultBlob = await mergePdfs(pdfFiles, (pct, status) => {
        progressBar.style.width = pct + '%';
        progressPercent.textContent = pct + '%';
        progressStatus.textContent = status;
      });

      resultBox.classList.remove('hidden');
    } catch (err) {
      alert(formatUserError(err, "Unable to merge PDFs. Please verify the documents are not password-protected."));
    } finally {
      startBtn.disabled = false;
      progressBox.classList.add('hidden');
    }
  });

  downloadBtn.addEventListener('click', () => {
    if (resultBlob) {
      triggerDownload(resultBlob, 'merged_document.pdf');
    }
  });

  newBtn.addEventListener('click', () => {
    pdfFiles = [];
    resultBlob = null;
    renderList();
  });
}

/**
 * ============================================================================
 * NEW TOOL 3: SPLIT PDF (pdf-split-tab)
 * ============================================================================
 */
function initSplitPdfTab() {
  const dropZone = document.getElementById('splitDropZone');
  const fileInput = document.getElementById('splitFileInput');
  const browseBtn = document.getElementById('splitBrowseBtn');
  const changeBtn = document.getElementById('splitChangeBtn');
  const workspace = document.getElementById('splitWorkspace');
  const metaName = document.getElementById('splitMetaName');
  const metaPages = document.getElementById('splitMetaPages');
  const rangeInput = document.getElementById('splitRangeInput');
  const startBtn = document.getElementById('splitStartBtn');
  const progressBox = document.getElementById('splitProgressBox');
  const progressStatus = document.getElementById('splitProgressStatus');
  const progressBar = document.getElementById('splitProgressBar');
  const progressPercent = document.getElementById('splitProgressPercent');
  const resultBox = document.getElementById('splitResultBox');
  const downloadBtn = document.getElementById('splitDownloadBtn');
  const newBtn = document.getElementById('splitNewBtn');

  if (!dropZone) return;

  let currentFile = null;
  let totalPages = 0;
  let resultBlob = null;

  browseBtn.addEventListener('click', () => fileInput.click());
  changeBtn.addEventListener('click', () => fileInput.click());
  newBtn.addEventListener('click', () => {
    currentFile = null;
    resultBlob = null;
    workspace.classList.add('hidden');
    dropZone.classList.remove('hidden');
    fileInput.value = '';
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
  });

  setupDragDrop(dropZone, (files) => {
    const pdf = files.find(f => f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf');
    if (pdf) handleFile(pdf);
  });

  async function handleFile(file) {
    currentFile = file;
    metaName.textContent = file.name;
    metaPages.textContent = 'Detecting...';
    workspace.classList.remove('hidden');
    dropZone.classList.add('hidden');
    resultBox.classList.add('hidden');

    try {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = './pdf.worker.min.js';
      const doc = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
      totalPages = doc.numPages;
      metaPages.textContent = `${totalPages} Page${totalPages > 1 ? 's' : ''}`;
      rangeInput.value = `1-${totalPages}`;
    } catch (err) {
      metaPages.textContent = 'Ready';
    }
  }

  startBtn.addEventListener('click', async () => {
    if (!currentFile) return;

    startBtn.disabled = true;
    progressBox.classList.remove('hidden');
    resultBox.classList.add('hidden');

    try {
      resultBlob = await splitPdf(currentFile, rangeInput.value, (pct, status) => {
        progressBar.style.width = pct + '%';
        progressPercent.textContent = pct + '%';
        progressStatus.textContent = status;
      });

      resultBox.classList.remove('hidden');
    } catch (err) {
      alert(formatUserError(err, "Unable to split PDF. Please check your page range (e.g. 1-3, 5)."));
    } finally {
      startBtn.disabled = false;
      progressBox.classList.add('hidden');
    }
  });

  downloadBtn.addEventListener('click', () => {
    if (resultBlob && currentFile) {
      const base = currentFile.name.replace(/\.[^/.]+$/, '');
      triggerDownload(resultBlob, `${base}_extracted.pdf`);
    }
  });
}

/**
 * ============================================================================
 * NEW TOOL 4: PDF TO IMAGES (pdf-to-img-tab)
 * ============================================================================
 */
function initPdfToImagesTab() {
  const dropZone = document.getElementById('pdfImgDropZone');
  const fileInput = document.getElementById('pdfImgFileInput');
  const browseBtn = document.getElementById('pdfImgBrowseBtn');
  const changeBtn = document.getElementById('pdfImgChangeBtn');
  const workspace = document.getElementById('pdfImgWorkspace');
  const metaName = document.getElementById('pdfImgMetaName');
  const metaPages = document.getElementById('pdfImgMetaPages');
  const formatPills = document.querySelectorAll('#pdfImgFormatGroup .option-pill-btn');
  const startBtn = document.getElementById('pdfImgStartBtn');
  const progressBox = document.getElementById('pdfImgProgressBox');
  const progressStatus = document.getElementById('pdfImgProgressStatus');
  const progressBar = document.getElementById('pdfImgProgressBar');
  const progressPercent = document.getElementById('pdfImgProgressPercent');
  const resultBox = document.getElementById('pdfImgResultBox');
  const downloadBtn = document.getElementById('pdfImgDownloadBtn');
  const newBtn = document.getElementById('pdfImgNewBtn');

  if (!dropZone) return;

  let currentFile = null;
  let selectedFormat = 'jpeg';
  let conversionResult = null;

  formatPills.forEach(pill => {
    pill.addEventListener('click', () => {
      formatPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      selectedFormat = pill.dataset.val;
    });
  });

  browseBtn.addEventListener('click', () => fileInput.click());
  changeBtn.addEventListener('click', () => fileInput.click());
  newBtn.addEventListener('click', () => {
    currentFile = null;
    conversionResult = null;
    workspace.classList.add('hidden');
    dropZone.classList.remove('hidden');
    fileInput.value = '';
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
  });

  setupDragDrop(dropZone, (files) => {
    const pdf = files.find(f => f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf');
    if (pdf) handleFile(pdf);
  });

  async function handleFile(file) {
    currentFile = file;
    metaName.textContent = file.name;
    metaPages.textContent = 'Detecting...';
    workspace.classList.remove('hidden');
    dropZone.classList.add('hidden');
    resultBox.classList.add('hidden');

    try {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = './pdf.worker.min.js';
      const doc = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
      metaPages.textContent = `${doc.numPages} Page${doc.numPages > 1 ? 's' : ''}`;
    } catch (err) {
      metaPages.textContent = 'Ready';
    }
  }

  startBtn.addEventListener('click', async () => {
    if (!currentFile) return;

    startBtn.disabled = true;
    progressBox.classList.remove('hidden');
    resultBox.classList.add('hidden');

    try {
      conversionResult = await pdfToImages(currentFile, selectedFormat, 1.5, (pct, status) => {
        progressBar.style.width = pct + '%';
        progressPercent.textContent = pct + '%';
        progressStatus.textContent = status;
      });

      downloadBtn.textContent = conversionResult.isZip ? '⬇️ Download Images (ZIP)' : '⬇️ Download Image (JPG)';
      resultBox.classList.remove('hidden');
    } catch (err) {
      alert(formatUserError(err, "Unable to convert PDF pages to images. Please check that the PDF is valid."));
    } finally {
      startBtn.disabled = false;
      progressBox.classList.add('hidden');
    }
  });

  downloadBtn.addEventListener('click', () => {
    if (conversionResult) {
      triggerDownload(conversionResult.blob, conversionResult.filename);
    }
  });
}

/**
 * ============================================================================
 * NEW TOOL 5: ROTATE PDF (pdf-rotate-tab)
 * ============================================================================
 */
function initRotatePdfTab() {
  const dropZone = document.getElementById('rotateDropZone');
  const fileInput = document.getElementById('rotateFileInput');
  const browseBtn = document.getElementById('rotateBrowseBtn');
  const changeBtn = document.getElementById('rotateChangeBtn');
  const workspace = document.getElementById('rotateWorkspace');
  const metaName = document.getElementById('rotateMetaName');
  const metaPages = document.getElementById('rotateMetaPages');
  const anglePills = document.querySelectorAll('#rotateAngleGroup .option-pill-btn');
  const targetPills = document.querySelectorAll('#rotateTargetGroup .option-pill-btn');
  const startBtn = document.getElementById('rotateStartBtn');
  const progressBox = document.getElementById('rotateProgressBox');
  const progressStatus = document.getElementById('rotateProgressStatus');
  const progressBar = document.getElementById('rotateProgressBar');
  const progressPercent = document.getElementById('rotateProgressPercent');
  const resultBox = document.getElementById('rotateResultBox');
  const downloadBtn = document.getElementById('rotateDownloadBtn');
  const newBtn = document.getElementById('rotateNewBtn');

  if (!dropZone) return;

  let currentFile = null;
  let selectedAngle = 90;
  let selectedTarget = 'all';
  let resultBlob = null;

  anglePills.forEach(pill => {
    pill.addEventListener('click', () => {
      anglePills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      selectedAngle = parseInt(pill.dataset.val, 10);
    });
  });

  targetPills.forEach(pill => {
    pill.addEventListener('click', () => {
      targetPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      selectedTarget = pill.dataset.val;
    });
  });

  browseBtn.addEventListener('click', () => fileInput.click());
  changeBtn.addEventListener('click', () => fileInput.click());
  newBtn.addEventListener('click', () => {
    currentFile = null;
    resultBlob = null;
    workspace.classList.add('hidden');
    dropZone.classList.remove('hidden');
    fileInput.value = '';
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
  });

  setupDragDrop(dropZone, (files) => {
    const pdf = files.find(f => f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf');
    if (pdf) handleFile(pdf);
  });

  async function handleFile(file) {
    currentFile = file;
    metaName.textContent = file.name;
    metaPages.textContent = 'Detecting...';
    workspace.classList.remove('hidden');
    dropZone.classList.add('hidden');
    resultBox.classList.add('hidden');

    try {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = './pdf.worker.min.js';
      const doc = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
      metaPages.textContent = `${doc.numPages} Page${doc.numPages > 1 ? 's' : ''}`;
    } catch (err) {
      metaPages.textContent = 'Ready';
    }
  }

  startBtn.addEventListener('click', async () => {
    if (!currentFile) return;

    startBtn.disabled = true;
    progressBox.classList.remove('hidden');
    resultBox.classList.add('hidden');

    try {
      resultBlob = await rotatePdf(currentFile, selectedAngle, selectedTarget, (pct, status) => {
        progressBar.style.width = pct + '%';
        progressPercent.textContent = pct + '%';
        progressStatus.textContent = status;
      });

      resultBox.classList.remove('hidden');
    } catch (err) {
      alert(formatUserError(err, "Unable to rotate PDF pages. Please verify the document."));
    } finally {
      startBtn.disabled = false;
      progressBox.classList.add('hidden');
    }
  });

  downloadBtn.addEventListener('click', () => {
    if (resultBlob && currentFile) {
      const base = currentFile.name.replace(/\.[^/.]+$/, '');
      triggerDownload(resultBlob, `${base}_rotated.pdf`);
    }
  });
}

/**
 * ============================================================================
 * NEW TOOL 6: WATERMARK PDF (pdf-watermark-tab)
 * ============================================================================
 */
function initWatermarkPdfTab() {
  const dropZone = document.getElementById('wmDropZone');
  const fileInput = document.getElementById('wmFileInput');
  const browseBtn = document.getElementById('wmBrowseBtn');
  const changeBtn = document.getElementById('wmChangeBtn');
  const workspace = document.getElementById('wmWorkspace');
  const textInput = document.getElementById('wmTextInput');
  const opacityInput = document.getElementById('wmOpacityInput');
  const opacityVal = document.getElementById('wmOpacityVal');
  const colorPills = document.querySelectorAll('#wmColorGroup .option-pill-btn');
  const startBtn = document.getElementById('wmStartBtn');
  const progressBox = document.getElementById('wmProgressBox');
  const progressStatus = document.getElementById('wmProgressStatus');
  const progressBar = document.getElementById('wmProgressBar');
  const progressPercent = document.getElementById('wmProgressPercent');
  const resultBox = document.getElementById('wmResultBox');
  const downloadBtn = document.getElementById('wmDownloadBtn');
  const newBtn = document.getElementById('wmNewBtn');

  if (!dropZone) return;

  let currentFile = null;
  let selectedColor = 'gray';
  let resultBlob = null;

  colorPills.forEach(pill => {
    pill.addEventListener('click', () => {
      colorPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      selectedColor = pill.dataset.val;
    });
  });

  opacityInput.addEventListener('input', () => {
    opacityVal.textContent = Math.round(parseFloat(opacityInput.value) * 100) + '%';
  });

  browseBtn.addEventListener('click', () => fileInput.click());
  changeBtn.addEventListener('click', () => fileInput.click());
  newBtn.addEventListener('click', () => {
    currentFile = null;
    resultBlob = null;
    workspace.classList.add('hidden');
    dropZone.classList.remove('hidden');
    fileInput.value = '';
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
  });

  setupDragDrop(dropZone, (files) => {
    const pdf = files.find(f => f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf');
    if (pdf) handleFile(pdf);
  });

  function handleFile(file) {
    currentFile = file;
    workspace.classList.remove('hidden');
    dropZone.classList.add('hidden');
    resultBox.classList.add('hidden');
  }

  startBtn.addEventListener('click', async () => {
    if (!currentFile) return;

    startBtn.disabled = true;
    progressBox.classList.remove('hidden');
    resultBox.classList.add('hidden');

    try {
      resultBlob = await watermarkPdf({
        file: currentFile,
        text: textInput.value || 'CONFIDENTIAL',
        opacity: parseFloat(opacityInput.value),
        fontSize: 48,
        color: selectedColor,
        onProgress: (pct, status) => {
          progressBar.style.width = pct + '%';
          progressPercent.textContent = pct + '%';
          progressStatus.textContent = status;
        }
      });

      resultBox.classList.remove('hidden');
    } catch (err) {
      alert(formatUserError(err, "Unable to apply watermark to PDF."));
    } finally {
      startBtn.disabled = false;
      progressBox.classList.add('hidden');
    }
  });

  downloadBtn.addEventListener('click', () => {
    if (resultBlob && currentFile) {
      const base = currentFile.name.replace(/\.[^/.]+$/, '');
      triggerDownload(resultBlob, `${base}_watermarked.pdf`);
    }
  });
}

/**
 * ============================================================================
 * NEW TOOL 7: IMAGE FORMAT CONVERTER (img-converter-tab)
 * ============================================================================
 */
function initImageConverterTab() {
  const dropZone = document.getElementById('convImgDropZone');
  const fileInput = document.getElementById('convImgFileInput');
  const browseBtn = document.getElementById('convImgBrowseBtn');
  const changeBtn = document.getElementById('convImgChangeBtn');
  const workspace = document.getElementById('convImgWorkspace');
  const metaName = document.getElementById('convImgMetaName');
  const metaSize = document.getElementById('convImgMetaSize');
  const formatPills = document.querySelectorAll('#convImgFormatGroup .option-pill-btn');
  const startBtn = document.getElementById('convImgStartBtn');
  const progressBox = document.getElementById('convImgProgressBox');
  const progressStatus = document.getElementById('convImgProgressStatus');
  const progressBar = document.getElementById('convImgProgressBar');
  const progressPercent = document.getElementById('convImgProgressPercent');
  const resultBox = document.getElementById('convImgResultBox');
  const downloadBtn = document.getElementById('convImgDownloadBtn');
  const newBtn = document.getElementById('convImgNewBtn');

  if (!dropZone) return;

  let currentFile = null;
  let targetFormat = 'png';
  let conversionResult = null;

  formatPills.forEach(pill => {
    pill.addEventListener('click', () => {
      formatPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      targetFormat = pill.dataset.val;
    });
  });

  browseBtn.addEventListener('click', () => fileInput.click());
  changeBtn.addEventListener('click', () => fileInput.click());
  newBtn.addEventListener('click', () => {
    currentFile = null;
    conversionResult = null;
    workspace.classList.add('hidden');
    dropZone.classList.remove('hidden');
    fileInput.value = '';
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
  });

  setupDragDrop(dropZone, (files) => {
    const img = files.find(f => f.type.startsWith('image/'));
    if (img) handleFile(img);
  });

  function handleFile(file) {
    currentFile = file;
    metaName.textContent = file.name;
    metaSize.textContent = formatSize(file.size);
    workspace.classList.remove('hidden');
    dropZone.classList.add('hidden');
    resultBox.classList.add('hidden');
  }

  startBtn.addEventListener('click', async () => {
    if (!currentFile) return;

    startBtn.disabled = true;
    progressBox.classList.remove('hidden');
    resultBox.classList.add('hidden');

    try {
      conversionResult = await convertImageFormat(currentFile, targetFormat, 0.92, (pct, status) => {
        progressBar.style.width = pct + '%';
        progressPercent.textContent = pct + '%';
        progressStatus.textContent = status;
      });

      resultBox.classList.remove('hidden');
    } catch (err) {
      alert(formatUserError(err, "Image format conversion failed. Please try a different image."));
    } finally {
      startBtn.disabled = false;
      progressBox.classList.add('hidden');
    }
  });

  downloadBtn.addEventListener('click', () => {
    if (conversionResult) {
      triggerDownload(conversionResult.blob, conversionResult.filename);
    }
  });
}

/**
 * ============================================================================
 * NEW TOOL 8: IMAGE RESIZER (img-resizer-tab)
 * ============================================================================
 */
function initImageResizerTab() {
  const dropZone = document.getElementById('resizeDropZone');
  const fileInput = document.getElementById('resizeFileInput');
  const browseBtn = document.getElementById('resizeBrowseBtn');
  const changeBtn = document.getElementById('resizeChangeBtn');
  const workspace = document.getElementById('resizeWorkspace');
  const origDim = document.getElementById('resizeOrigDim');
  const origSize = document.getElementById('resizeOrigSize');
  const widthInput = document.getElementById('resizeWidthInput');
  const heightInput = document.getElementById('resizeHeightInput');
  const lockAspect = document.getElementById('resizeLockAspect');
  const scalePills = document.querySelectorAll('#resizeScaleGroup .option-pill-btn');
  const startBtn = document.getElementById('resizeStartBtn');
  const progressBox = document.getElementById('resizeProgressBox');
  const progressStatus = document.getElementById('resizeProgressStatus');
  const progressBar = document.getElementById('resizeProgressBar');
  const progressPercent = document.getElementById('resizeProgressPercent');
  const resultBox = document.getElementById('resizeResultBox');
  const downloadBtn = document.getElementById('resizeDownloadBtn');
  const newBtn = document.getElementById('resizeNewBtn');

  if (!dropZone) return;

  let currentFile = null;
  let naturalW = 0;
  let naturalH = 0;
  let aspectRatio = 1;
  let resizeResult = null;

  browseBtn.addEventListener('click', () => fileInput.click());
  changeBtn.addEventListener('click', () => fileInput.click());
  newBtn.addEventListener('click', () => {
    currentFile = null;
    resizeResult = null;
    workspace.classList.add('hidden');
    dropZone.classList.remove('hidden');
    fileInput.value = '';
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
  });

  setupDragDrop(dropZone, (files) => {
    const img = files.find(f => f.type.startsWith('image/'));
    if (img) handleFile(img);
  });

  function handleFile(file) {
    currentFile = file;
    origSize.textContent = formatSize(file.size);

    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      naturalW = img.naturalWidth;
      naturalH = img.naturalHeight;
      aspectRatio = naturalW / naturalH;

      origDim.textContent = `${naturalW} × ${naturalH} px`;
      widthInput.value = naturalW;
      heightInput.value = naturalH;

      workspace.classList.remove('hidden');
      dropZone.classList.add('hidden');
      resultBox.classList.add('hidden');
    };
    img.src = url;
  }

  // Proportional resize logic
  widthInput.addEventListener('input', () => {
    if (lockAspect.checked && aspectRatio > 0) {
      const w = parseFloat(widthInput.value) || 0;
      heightInput.value = Math.round(w / aspectRatio);
    }
  });

  heightInput.addEventListener('input', () => {
    if (lockAspect.checked && aspectRatio > 0) {
      const h = parseFloat(heightInput.value) || 0;
      widthInput.value = Math.round(h * aspectRatio);
    }
  });

  // Scale preset buttons
  scalePills.forEach(pill => {
    pill.addEventListener('click', () => {
      const scale = parseFloat(pill.dataset.scale);
      if (naturalW > 0 && naturalH > 0 && scale > 0) {
        widthInput.value = Math.round(naturalW * scale);
        heightInput.value = Math.round(naturalH * scale);
      }
    });
  });

  startBtn.addEventListener('click', async () => {
    const targetW = parseInt(widthInput.value, 10);
    const targetH = parseInt(heightInput.value, 10);

    if (!currentFile || !targetW || !targetH) {
      alert('Please enter valid width and height numbers.');
      return;
    }

    startBtn.disabled = true;
    progressBox.classList.remove('hidden');
    resultBox.classList.add('hidden');

    try {
      resizeResult = await resizeImage({
        file: currentFile,
        targetWidth: targetW,
        targetHeight: targetH,
        quality: 0.92,
        onProgress: (pct, status) => {
          progressBar.style.width = pct + '%';
          progressPercent.textContent = pct + '%';
          progressStatus.textContent = status;
        }
      });

      resultBox.classList.remove('hidden');
    } catch (err) {
      alert(formatUserError(err, "Image resizing failed. Please enter valid positive pixel dimensions."));
    } finally {
      startBtn.disabled = false;
      progressBox.classList.add('hidden');
    }
  });

  downloadBtn.addEventListener('click', () => {
    if (resizeResult) {
      triggerDownload(resizeResult.blob, resizeResult.filename);
    }
  });
}

// Utility: Drag and drop helper
function setupDragDrop(el, onFiles) {
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

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
