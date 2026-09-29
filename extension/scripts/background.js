// TargetCompress Background Service Worker (Manifest V3)

chrome.runtime.onInstalled.addListener(() => {
  // Create context menu for images
  chrome.contextMenus.create({
    id: 'compress-image-menu',
    title: 'Compress this image with TargetCompress',
    contexts: ['image']
  });

  chrome.contextMenus.create({
    id: 'open-targetcompress-menu',
    title: 'Open TargetCompress Studio',
    contexts: ['page', 'action']
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'compress-image-menu') {
    const targetUrl = 'https://www.targetcompress.in/compress-image-to-50kb';
    await chrome.tabs.create({ url: targetUrl });
  } else if (info.menuItemId === 'open-targetcompress-menu') {
    await chrome.tabs.create({ url: 'https://www.targetcompress.in/' });
  }
});
