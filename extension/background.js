// SoundCloud Background Service Worker (Manifest V3)
// Handles native creation of playlists with authentic browser TLS and cookies

// Automatically unblock SoundCloud in Russia via Smart PAC routing (no full VPN needed)
function setupSmartProxy() {
  if (chrome.proxy && chrome.proxy.settings) {
    const config = {
      mode: "pac_script",
      pacScript: {
        data: `
          function FindProxyForURL(url, host) {
            if (shExpMatch(host, "*.soundcloud.com") || shExpMatch(host, "*.sndcdn.com") || host === "soundcloud.com") {
              return "HTTPS proxy.antizapret.prostovpn.org:8443; PROXY proxy.antizapret.prostovpn.org:3128; DIRECT";
            }
            return "DIRECT";
          }
        `
      }
    };
    chrome.proxy.settings.set({ value: config, scope: 'regular' }, () => {
      console.log('⚡ YM Transfer: Smart Proxy for SoundCloud enabled');
    });
  }
}

chrome.runtime.onInstalled.addListener(() => {
  setupSmartProxy();
});
chrome.runtime.onStartup.addListener(() => {
  setupSmartProxy();
});
setupSmartProxy();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'CHECK_EXTENSION') {
    sendResponse({ installed: true, version: '2.0' });
    return true;
  }

  if (request.type === 'CREATE_PLAYLIST') {
    handleCreatePlaylist(request)
      .then(res => sendResponse(res))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // Keep channel open for async response
  }
});

async function getCookies() {
  const tokenCookie = await chrome.cookies.get({ url: 'https://soundcloud.com', name: 'oauth_token' });
  const datadomeCookie = await chrome.cookies.get({ url: 'https://soundcloud.com', name: 'datadome' });
  return {
    token: tokenCookie ? tokenCookie.value : null,
    datadome: datadomeCookie ? datadomeCookie.value : null
  };
}

async function handleCreatePlaylist({ title, trackIds }) {
  const { token, datadome } = await getCookies();
  if (!token) {
    return {
      success: false,
      error: 'Вы не вошли в SoundCloud. Откройте soundcloud.com и войдите в свой профиль.'
    };
  }

  const clientId = 'cUfk83W6dFJv2UFUorAW0CTHgyptuEmP';
  const chunkSize = 480;
  const chunks = [];
  for (let i = 0; i < trackIds.length; i += chunkSize) {
    chunks.push(trackIds.slice(i, i + chunkSize));
  }

  const createdPlaylists = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const partNum = i + 1;
    const partTitle = chunks.length === 1 ? title : `${title} (Часть ${partNum} из ${chunks.length})`;

    const headers = {
      'Authorization': `OAuth ${token.replace(/^OAuth /i, '')}`,
      'Content-Type': 'application/json'
    };
    if (datadome) {
      headers['Cookie'] = `datadome=${datadome}`;
    }

    const res = await fetch(`https://api-v2.soundcloud.com/playlists?client_id=${clientId}`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        playlist: {
          title: partTitle,
          sharing: 'public',
          tracks: chunk
        }
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        success: false,
        error: `SoundCloud вернул ошибку HTTP ${res.status}: ${errText.slice(0, 100)}`
      };
    }

    const data = await res.json();
    createdPlaylists.push(data);
  }

  return {
    success: true,
    playlists: createdPlaylists,
    permalink_url: createdPlaylists[0] ? createdPlaylists[0].permalink_url : null,
    total_parts: createdPlaylists.length
  };
}
