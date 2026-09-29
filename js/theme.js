/**
 * TargetCompress — Theme Toggle System
 * Handles dark/light theme switching with localStorage persistence.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'tc-theme';
  var DARK = 'dark';
  var LIGHT = 'light';
  var lastToggle = 0;

  // Immediate check to apply saved theme
  try {
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved === LIGHT || saved === DARK) {
      document.documentElement.setAttribute('data-theme', saved);
    } else {
      document.documentElement.setAttribute('data-theme', DARK);
    }
  } catch (e) {
    document.documentElement.setAttribute('data-theme', DARK);
  }

  function toggleTheme(e) {
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }
    // Guard against duplicate invocation within 250ms
    var now = Date.now();
    if (now - lastToggle < 250) return;
    lastToggle = now;

    var current = document.documentElement.getAttribute('data-theme') || DARK;
    var next = current === DARK ? LIGHT : DARK;
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (err) {}
    updateAllIcons();

    // Dispatch event for any interactive widgets that may need to update
    try {
      window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: next } }));
    } catch (err) {}
  }

  function updateAllIcons() {
    var isDark = (document.documentElement.getAttribute('data-theme') || DARK) === DARK;
    document.querySelectorAll('.theme-toggle-icon').forEach(function (icon) {
      icon.textContent = isDark ? '\u{1F319}' : '\u{2600}\u{FE0F}';
    });
    document.querySelectorAll('.theme-toggle-btn').forEach(function (btn) {
      var label = isDark ? 'Switch to light theme' : 'Switch to dark theme';
      btn.setAttribute('aria-label', label);
      btn.setAttribute('title', label);
    });
  }

  function init() {
    updateAllIcons();
    // Only bind event listener if the element lacks inline onclick
    document.querySelectorAll('.theme-toggle-wrapper').forEach(function (wrapper) {
      if (!wrapper.hasAttribute('onclick')) {
        wrapper.addEventListener('click', toggleTheme);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Global export
  window.toggleTheme = toggleTheme;
})();
