/**
 * TargetCompress - Homepage Hub Controller
 * Pure directory navigation and ad manager - Zero WASM, Zero heavy libraries.
 */

import { initAdManager } from '/js/ad-manager.js';

export function initHome() {
  initAdManager();

  // Category filter pills for Tools Directory (syncs both navbar and table pills)
  const pills = document.querySelectorAll('.hub-pill');
  const groupHeaders = document.querySelectorAll('.category-group-header');
  const groupGrids = document.querySelectorAll('.tools-hub-grid');

  function applyCategoryFilter(cat, shouldScroll = false) {
    pills.forEach(p => {
      if (p.dataset.category === cat) {
        p.classList.add('active');
      } else {
        p.classList.remove('active');
      }
    });

    groupHeaders.forEach(h => {
      if (cat === 'all' || h.dataset.categoryGroup === cat) {
        h.style.display = 'flex';
      } else {
        h.style.display = 'none';
      }
    });

    groupGrids.forEach(g => {
      if (cat === 'all' || g.dataset.categoryGroup === cat) {
        g.style.display = 'grid';
      } else {
        g.style.display = 'none';
      }
    });

    if (shouldScroll) {
      const target = document.getElementById('all-tools');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  pills.forEach(pill => {
    pill.addEventListener('click', (e) => {
      e.preventDefault();
      const cat = pill.dataset.category;
      const isTopBar = pill.closest('#categoryPillBar') !== null;
      applyCategoryFilter(cat, isTopBar);
    });
  });

  // Global delegation safeguard for any data-launch-tab elements
  document.addEventListener('click', (e) => {
    const launchEl = e.target.closest('[data-launch-tab]');
    if (launchEl) {
      const tab = launchEl.getAttribute('data-launch-tab');
      const tabUrlMap = {
        'image-tab': '/tools/image-compressor',
        'pdf-tab': '/tools/pdf-compressor',
        'video-tab': '/tools/video-compressor',
        'converter-tab': '/pdf-to-word',
        'img-to-pdf-tab': '/image-to-pdf',
        'pdf-merge-tab': '/merge-pdf',
        'pdf-split-tab': '/split-pdf',
        'pdf-to-img-tab': '/tools/pdf-to-images',
        'pdf-rotate-tab': '/tools/rotate-pdf',
        'pdf-watermark-tab': '/tools/watermark-pdf',
        'img-converter-tab': '/tools/image-converter',
        'img-resizer-tab': '/resize-image'
      };
      if (tabUrlMap[tab]) {
        window.location.href = tabUrlMap[tab];
      }
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initHome);
} else {
  initHome();
}
