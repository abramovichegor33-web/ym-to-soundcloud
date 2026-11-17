// Bridge script injected on http://localhost:8000/*
// Connects web app with background extension capabilities

(function() {
  // Mark extension presence
  document.documentElement.dataset.scExtension = 'true';
  window.postMessage({ type: 'YM_SC_EXTENSION_READY' }, '*');

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;

    if (event.data && event.data.type === 'CHECK_YM_SC_EXTENSION') {
      window.postMessage({ type: 'YM_SC_EXTENSION_READY' }, '*');
    }

    if (event.data && event.data.type === 'YM_SC_CREATE_PLAYLIST') {
      chrome.runtime.sendMessage({
        type: 'CREATE_PLAYLIST',
        title: event.data.title,
        trackIds: event.data.trackIds
      }, (response) => {
        window.postMessage({
          type: 'YM_SC_PLAYLIST_RESULT',
          result: response || { success: false, error: 'Нет ответа от расширения' }
        }, '*');
      });
    }
  });
})();
