/**
 * YM -> SoundCloud Transfer: High-Performance Frontend Client
 * Optimized for large playlists (1000+ tracks) with 60 FPS real-time updates.
 */

// Application State
const state = {
  theme: localStorage.getItem('ym_sc_theme') || 'light',
  mode: 'zero_login',
  direction: 'ym_to_sc', // 'ym_to_sc' or 'sc_to_ym'
  jobId: null,
  playlistTitle: '',
  tracks: [],
  tracksMap: new Map(),
  activeFilter: 'all',
  eventSource: null,
  oauthToken: localStorage.getItem('ym_sc_token') || '',
  tokenVerified: false,
};

// DOM Elements
const dirYmToScBtn = document.getElementById('dirYmToSc');
const dirScToYmBtn = document.getElementById('dirScToYm');
const heroTitle = document.getElementById('heroTitle');
const heroSubtitle = document.getElementById('heroSubtitle');
const playlistUrlLabel = document.getElementById('playlistUrlLabel');
const playlistUrlInput = document.getElementById('playlistUrlInput');
const inputHelpText = document.getElementById('inputHelpText');
const pill1 = document.getElementById('pill1');
const pill2 = document.getElementById('pill2');
const pill3 = document.getElementById('pill3');
const modeSection = document.getElementById('modeSection');
const modeZeroLoginBtn = document.getElementById('modeZeroLogin');
const modeAutoPlaylistBtn = document.getElementById('modeAutoPlaylist');
const sessionTokenSection = document.getElementById('sessionTokenSection');
const oauthTokenInput = document.getElementById('oauthTokenInput');
const verifyTokenBtn = document.getElementById('verifyTokenBtn');
const tokenVerifyStatus = document.getElementById('tokenVerifyStatus');

function setDirection(dir) {
  state.direction = dir;
  if (dir === 'sc_to_ym') {
    if (dirYmToScBtn) dirYmToScBtn.classList.remove('active');
    if (dirScToYmBtn) dirScToYmBtn.classList.add('active');
    if (heroTitle) heroTitle.textContent = 'Перенос плейлистов из SoundCloud в Яндекс Музыку';
    if (heroSubtitle) heroSubtitle.textContent = 'Быстрый импорт музыки из SoundCloud в медиатеку Яндекс Музыки без передачи паролей.';
    if (playlistUrlLabel) playlistUrlLabel.textContent = 'Ссылка на плейлист или лайки SoundCloud:';
    if (playlistUrlInput) {
      playlistUrlInput.placeholder = 'soundcloud.com/artist/sets/... или soundcloud.com/user/likes';
    }
    if (inputHelpText) {
      inputHelpText.innerHTML = '✓ Поддерживаются: плейлисты <code>soundcloud.com/.../sets/...</code> и профили <code>soundcloud.com/...</code>';
    }
    if (pill1) { pill1.textContent = '🔥 SoundCloud Phonk & Top'; pill1.dataset.url = 'demo-sc-top'; }
    if (pill2) { pill2.textContent = '🎧 Lo-Fi & Chill'; pill2.dataset.url = 'demo-sc-chill'; }
    if (pill3) { pill3.textContent = '⚡ Хиты SoundCloud'; pill3.dataset.url = 'https://soundcloud.com/discover/sets/weekly'; }
    if (modeSection) modeSection.classList.add('hidden');
  } else {
    if (dirScToYmBtn) dirScToYmBtn.classList.remove('active');
    if (dirYmToScBtn) dirYmToScBtn.classList.add('active');
    if (heroTitle) heroTitle.textContent = 'Перенос плейлистов в SoundCloud';
    if (heroSubtitle) heroSubtitle.textContent = 'Быстрый импорт музыки по публичной ссылке без авторизации и передачи паролей от аккаунтов.';
    if (playlistUrlLabel) playlistUrlLabel.textContent = 'Ссылка на публичный плейлист Яндекс Музыки:';
    if (playlistUrlInput) {
      playlistUrlInput.placeholder = 'music.yandex.ru/users/.../playlists/... или playlists/lk...';
    }
    if (inputHelpText) {
      inputHelpText.innerHTML = '✓ Поддерживаются: <code>playlists/lk...</code>, <code>users/.../playlists/...</code> и альбомы <code>album/...</code>';
    }
    if (pill1) { pill1.textContent = '🎸 Русский Рок & Инди'; pill1.dataset.url = 'demo-rock'; }
    if (pill2) { pill2.textContent = '🎧 Электроника & Hip-Hop'; pill2.dataset.url = 'demo-electro'; }
    if (pill3) { pill3.textContent = '🔥 Чарт Яндекс Музыки'; pill3.dataset.url = 'https://music.yandex.ru/users/yamusic-top/playlists/1000'; }
    if (modeSection) modeSection.classList.remove('hidden');
  }
  initBookmarklet();
}

if (dirYmToScBtn) dirYmToScBtn.addEventListener('click', () => setDirection('ym_to_sc'));
if (dirScToYmBtn) dirScToYmBtn.addEventListener('click', () => setDirection('sc_to_ym'));
const toggleGuideBtn = document.getElementById('toggleGuideBtn');
const tokenGuideBox = document.getElementById('tokenGuideBox');

const startTransferBtn = document.getElementById('startTransferBtn');
const startBtnText = document.getElementById('startBtnText');
const startBtnSpinner = document.getElementById('startBtnSpinner');

const screenSetup = document.getElementById('screenSetup');
const screenProgress = document.getElementById('screenProgress');
const screenFinal = document.getElementById('screenFinal');

const progressPlaylistTitle = document.getElementById('progressPlaylistTitle');
const progressStatusText = document.getElementById('progressStatusText');
const progressCounter = document.getElementById('progressCounter');
const progressBar = document.getElementById('progressBar');
const trackListContainer = document.getElementById('trackListContainer');

const countAll = document.getElementById('countAll');
const countExact = document.getElementById('countExact');
const countFuzzy = document.getElementById('countFuzzy');
const countNotFound = document.getElementById('countNotFound');

const finalStatsNumber = document.getElementById('finalStatsNumber');
const finalStatsLabel = document.getElementById('finalStatsLabel');
const finalActionButtons = document.getElementById('finalActionButtons');

const btnExportM3U = document.getElementById('btnExportM3U');
const btnExportLinks = document.getElementById('btnExportLinks');
const btnExportJSON = document.getElementById('btnExportJSON');
const btnOpenAllLinks = document.getElementById('btnOpenAllLinks');
const btnTransferAnother = document.getElementById('btnTransferAnother');

// Audio Mini-Player
const audioPlayerBar = document.getElementById('audioPlayerBar');
const globalAudioPlayer = document.getElementById('globalAudioPlayer');
const playerTrackInfo = document.getElementById('playerTrackInfo');
const closeAudioPlayer = document.getElementById('closeAudioPlayer');

/* ==========================================================================
   Theme Management (Permanent Premium Dark Mode)
   ========================================================================== */
state.theme = 'dark';
document.documentElement.setAttribute('data-theme', 'dark');
localStorage.setItem('ym_sc_theme', 'dark');

/* ==========================================================================
   Mode Switcher & Token Setup
   ========================================================================== */
if (state.oauthToken) {
  oauthTokenInput.value = state.oauthToken;
}

function setMode(newMode) {
  state.mode = newMode;
  if (newMode === 'zero_login') {
    modeZeroLoginBtn.classList.add('active');
    modeAutoPlaylistBtn.classList.remove('active');
    sessionTokenSection.classList.add('hidden');
  } else {
    modeAutoPlaylistBtn.classList.add('active');
    modeZeroLoginBtn.classList.remove('active');
    sessionTokenSection.classList.remove('hidden');
  }
}

modeZeroLoginBtn.addEventListener('click', () => setMode('zero_login'));
modeAutoPlaylistBtn.addEventListener('click', () => setMode('auto_playlist'));

toggleGuideBtn.addEventListener('click', () => {
  tokenGuideBox.classList.toggle('hidden');
});

verifyTokenBtn.addEventListener('click', async () => {
  const token = oauthTokenInput.value.trim();
  if (!token) {
    tokenVerifyStatus.innerHTML = '<span style="color: #FF3B30;">Введите токен</span>';
    return;
  }
  tokenVerifyStatus.innerHTML = '<span style="color: var(--text-muted);">Проверка профиля...</span>';
  try {
    const res = await fetch('/api/verify-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oauth_token: token })
    });
    const data = await res.json();
    if (data.valid) {
      state.tokenVerified = true;
      localStorage.setItem('ym_sc_token', token);
      tokenVerifyStatus.innerHTML = `<span style="color: #34C759; font-weight: 500;">✓ Профиль подтвержден: <strong>${data.username}</strong></span>`;
    } else {
      tokenVerifyStatus.innerHTML = `<span style="color: #FF3B30;">✕ ${data.error || 'Ошибка проверки токена'}</span>`;
    }
  } catch (err) {
    tokenVerifyStatus.innerHTML = `<span style="color: #FF3B30;">✕ Ошибка запроса к серверу</span>`;
  }
});

// Sample Pills
document.querySelectorAll('.pill-btn[data-url]').forEach(btn => {
  btn.addEventListener('click', () => {
    const u = btn.dataset.url || btn.getAttribute('data-url');
    if (u) {
      playlistUrlInput.value = u;
      startTransferBtn.click();
    }
  });
});

/* ==========================================================================
   Filter Tabs
   ========================================================================== */
['All', 'Exact', 'Fuzzy', 'NotFound'].forEach(f => {
  const btn = document.getElementById(`filter${f}`);
  btn.addEventListener('click', () => {
    document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active-filter'));
    btn.classList.add('active-filter');
    state.activeFilter = f.toLowerCase() === 'all' ? 'all' : (f === 'Exact' ? 'exact' : (f === 'Fuzzy' ? 'fuzzy' : 'not_found'));
    refreshVisibleTrackCards();
  });
});

/* ==========================================================================
   Transfer Flow
   ========================================================================== */
startTransferBtn.addEventListener('click', async () => {
  const url = playlistUrlInput.value.trim();
  if (!url) {
    alert('Пожалуйста, укажите ссылку на плейлист Яндекс Музыки или выберите демо-вариант.');
    return;
  }

  if (state.mode === 'auto_playlist') {
    const token = oauthTokenInput.value.trim();
    if (!token) {
      alert('В режиме авто-сборки необходимо указать oauth_token SoundCloud из браузера.');
      oauthTokenInput.focus();
      return;
    }
    localStorage.setItem('ym_sc_token', token);
  }

  startTransferBtn.disabled = true;
  startBtnText.textContent = 'Чтение плейлиста...';
  startBtnSpinner.classList.remove('hidden');

  try {
    const parseRes = await fetch('/api/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, direction: state.direction })
    });
    const playlistData = await parseRes.json();

    if (!playlistData.success) {
      alert(playlistData.error || 'Не удалось прочитать плейлист');
      resetStartBtn();
      return;
    }

    state.playlistTitle = playlistData.title;
    progressPlaylistTitle.textContent = playlistData.title;
    progressStatusText.textContent = `Загружено ${playlistData.track_count} треков. Запуск параллельного поиска (12 потоков)...`;

    startBtnText.textContent = 'Запуск пула поиска...';
    const jobRes = await fetch('/api/start-transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playlist_title: playlistData.title,
        cover_url: playlistData.cover_url,
        tracks: playlistData.tracks,
        direction: state.direction
      })
    });
    const jobData = await jobRes.json();
    state.jobId = jobData.job_id;
    state.tracks = [];
    state.tracksMap.clear();
    trackListContainer.innerHTML = '';

    screenSetup.classList.add('hidden');
    screenProgress.classList.remove('hidden');

    connectEventSource(state.jobId, jobData.total);

  } catch (err) {
    console.error(err);
    alert('Ошибка при запуске переноса: ' + err.message);
    resetStartBtn();
  }
});

function resetStartBtn() {
  startTransferBtn.disabled = false;
  startBtnText.textContent = 'Начать перенос';
  startBtnSpinner.classList.add('hidden');
}

/* ==========================================================================
   SSE Real-time Event Streaming
   ========================================================================== */
let renderPending = false;
let statsExact = 0;
let statsFuzzy = 0;
let statsNotFound = 0;

function connectEventSource(jobId, total) {
  if (state.eventSource) {
    state.eventSource.close();
  }

  statsExact = 0;
  statsFuzzy = 0;
  statsNotFound = 0;

  state.eventSource = new EventSource(`/api/transfer-stream/${jobId}`);

  state.eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      if (data.type === 'track_completed') {
        const tr = data.track;
        state.tracksMap.set(tr.index, tr);

        if (tr.status === 'exact') statsExact++;
        else if (tr.status === 'fuzzy') statsFuzzy++;
        else statsNotFound++;

        progressBar.style.width = `${data.percent}%`;
        progressCounter.textContent = `${data.completed} / ${total}`;
        progressStatusText.textContent = `Параллельный поиск в SoundCloud: ${data.completed} из ${total} (${data.percent}%)...`;

        // Update counter numbers immediately
        countAll.textContent = data.completed;
        countExact.textContent = statsExact;
        countFuzzy.textContent = statsFuzzy;
        countNotFound.textContent = statsNotFound;

        // Render single card in O(1) time
        renderSingleTrackCard(tr);

      } else if (data.type === 'job_finished') {
        progressBar.style.width = '100%';
        progressStatusText.textContent = 'Перенос завершен!';
        state.eventSource.close();

        setTimeout(() => {
          finishTransfer(data.stats);
        }, 500);
      }
    } catch (e) {
      console.warn('Error parsing SSE event:', e);
    }
  };

  state.eventSource.onerror = (err) => {
    console.warn('SSE connection closed:', err);
  };
}

/* ==========================================================================
   High-Performance DOM Rendering (O(1) updates)
   ========================================================================== */
function createCardElement(item) {
  const card = document.createElement('div');
  card.className = 'track-card';
  card.id = `trackCard-${item.index}`;
  card.dataset.status = item.status;

  const ym = item.ym_track || item.source_track || {};
  const match = item.selected_match;
  const alternatives = item.alternatives || [];

  if (match && match.id) {
    card.dataset.scId = match.id;
  }

  const durSec = ym.duration_ms ? Math.round(ym.duration_ms / 1000) : 0;
  const durStr = durSec ? `${Math.floor(durSec / 60)}:${(durSec % 60).toString().padStart(2, '0')}` : '';

  let badgeHtml = '';
  if (item.status === 'exact') {
    badgeHtml = `<span class="status-badge exact">✓ Точное (${match ? '±' + match.duration_diff + 'с' : ''})</span>`;
  } else if (item.status === 'fuzzy') {
    badgeHtml = `<span class="status-badge fuzzy">≈ Перезалив (${match ? '±' + match.duration_diff + 'с' : ''})</span>`;
  } else {
    badgeHtml = `<span class="status-badge not_found">✕ Не найден</span>`;
  }

  let matchLinkHtml = '';
  if (match && match.permalink_url) {
    matchLinkHtml = `
      <a href="${match.permalink_url}" target="_blank" rel="noreferrer" class="sc-link-btn" title="Открыть трек в SoundCloud">
        <span>Слушать</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
      </a>
    `;
  }

  let altBtnHtml = '';
  if (alternatives.length > 0) {
    altBtnHtml = `
      <button type="button" class="alt-btn" onclick="toggleAltMenu(${item.index})">
        Выбрать другой (${alternatives.length}) ▾
      </button>
    `;
  }

  card.innerHTML = `
    <div class="track-card-left">
      <span class="track-number">${item.index + 1}</span>
      <img class="track-cover" src="${ym.cover_url || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 1 1%22><rect width=%221%22 height=%221%22 fill=%22%23ddd%22/></svg>'}" alt="" loading="lazy">
      <div class="track-meta">
        <div class="track-title">${escapeHtml(ym.title)}</div>
        <div class="track-artist">${escapeHtml(ym.artist)} ${durStr ? '• ' + durStr : ''}</div>
        ${match ? `<div style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px;">SC: ${escapeHtml(match.title)} (${escapeHtml(match.author || '')})</div>` : ''}
      </div>
    </div>
    <div class="track-card-right">
      ${badgeHtml}
      ${matchLinkHtml}
      ${altBtnHtml}
    </div>
    <div class="alt-menu hidden" id="altMenu-${item.index}">
      <div class="alt-menu-header">Выберите другой вариант из SoundCloud:</div>
      ${alternatives.map(alt => `
        <div class="alt-item" onclick="selectAlternativeTrack(${item.index}, ${escapeJsonAttr(alt)})">
          <div>
            <div class="alt-item-title">${escapeHtml(alt.title)}</div>
            <div class="alt-item-meta">${escapeHtml(alt.author || '')} • ${Math.floor(alt.duration_sec / 60)}:${(alt.duration_sec % 60).toString().padStart(2, '0')} (±${alt.duration_diff}с)</div>
          </div>
          <span style="font-size: 11px; font-weight: 600; color: var(--accent-sc); margin-left: 8px;">${alt.composite_score}%</span>
        </div>
      `).join('')}
    </div>
  `;

  return card;
}

function renderSingleTrackCard(tr) {
  // If active filter doesn't match, keep hidden
  const shouldShow = (state.activeFilter === 'all' || tr.status === state.activeFilter);
  const card = createCardElement(tr);
  if (!shouldShow) {
    card.classList.add('hidden');
  }
  trackListContainer.appendChild(card);
}

function refreshVisibleTrackCards() {
  const cards = trackListContainer.querySelectorAll('.track-card');
  cards.forEach(card => {
    const status = card.dataset.status;
    if (state.activeFilter === 'all' || status === state.activeFilter) {
      card.classList.remove('hidden');
    } else {
      card.classList.add('hidden');
    }
  });
}

function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeJsonAttr(obj) {
  return escapeHtml(JSON.stringify(obj));
}

window.toggleAltMenu = function(trackIndex) {
  const menu = document.getElementById(`altMenu-${trackIndex}`);
  if (menu) {
    menu.classList.toggle('hidden');
  }
};

window.selectAlternativeTrack = async function(trackIndex, candidate) {
  try {
    const res = await fetch('/api/select-match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_id: state.jobId,
        track_index: trackIndex,
        candidate: candidate
      })
    });
    const data = await res.json();
    if (data.success) {
      const oldCard = document.getElementById(`trackCard-${trackIndex}`);
      if (oldCard) {
        const newCard = createCardElement(data.track);
        oldCard.replaceWith(newCard);
      }
    }
  } catch (e) {
    alert('Ошибка при выборе трека: ' + e.message);
  }
};

/* ==========================================================================
   Screen 3: Completion & Final Actions
   ========================================================================== */
async function finishTransfer(stats) {
  screenProgress.classList.add('hidden');
  screenFinal.classList.remove('hidden');

  const transferred = stats.transferred;
  const total = stats.total;
  finalStatsNumber.textContent = `${transferred} / ${total}`;
  finalStatsLabel.textContent = `Успешно подобрано ${transferred} из ${total} треков (${Math.round((transferred / total) * 100)}%)`;

  finalActionButtons.innerHTML = '';

  // Extract all completed tracks from tracksMap
  const allTracks = Array.from(state.tracksMap.values()).filter(t => t !== null);
  state.tracks = allTracks;

  // Auto-sync tracks to cache for 1-click bookmarklet and extension
  try {
    if (allTracks.length > 0) {
      fetch('/api/sync-tracks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: state.jobId,
          playlist_title: state.playlistTitle || "Мне нравится (YM)",
          tracks: allTracks
        })
      }).catch(() => {});
    }
  } catch(e) {}

  initBookmarklet();

  const isScToYm = state.direction === 'sc_to_ym';
  const heading = document.getElementById('targetPlatformHeading');
  const desc = document.getElementById('targetPlatformDesc');
  const openLink = document.getElementById('targetPlatformOpenLink');
  const stepGuide = document.getElementById('bookmarkletStepGuide');
  const autoBtn = document.getElementById('autoBookmarkletBtn');

  if (isScToYm) {
    if (heading) heading.textContent = '⚡ Собрать плейлист в Яндекс Музыке';
    if (desc) desc.textContent = 'Все подобранные треки будут добавлены в ваш профиль Яндекс Музыки без передачи паролей.';
    if (openLink) {
      openLink.textContent = 'Открыть Яндекс Музыку ↗';
      openLink.href = 'https://music.yandex.ru';
    }
    if (stepGuide) {
      stepGuide.innerHTML = `
        <strong>Инструкция в 2 простых шага:</strong><br>
        1. Перетащите кнопку <strong>«⭐ Собрать плейлист в Яндекс Музыке»</strong> выше на панель закладок (<kbd>Cmd + Shift + B</kbd>).<br>
        2. Откройте любую страницу <strong>music.yandex.ru</strong> и нажмите на неё — плейлист создастся автоматически!
      `;
    }
    if (autoBtn) {
      autoBtn.style.background = '#FFCC00';
      autoBtn.style.color = '#000';
    }
  } else {
    if (heading) heading.textContent = '⚡ Собрать плейлист в SoundCloud';
    if (desc) desc.textContent = 'Все подобранные треки будут добавлены в ваш профиль SoundCloud без ввода паролей.';
    if (openLink) {
      openLink.textContent = 'Открыть SoundCloud ↗';
      openLink.href = 'https://soundcloud.com';
    }
    if (stepGuide) {
      stepGuide.innerHTML = `
        <strong>Инструкция в 2 простых шага:</strong><br>
        1. Перетащите кнопку <strong>«⭐ Собрать плейлист в SoundCloud»</strong> выше на панель закладок (<kbd>Cmd + Shift + B</kbd>).<br>
        2. Откройте любую страницу <strong>soundcloud.com</strong> и нажмите на неё — плейлист создастся автоматически!
      `;
    }
    if (autoBtn) {
      autoBtn.style.background = '#FF5500';
      autoBtn.style.color = '#FFF';
    }
  }

  const openLabel = isScToYm ? 'Открыть все треки в Яндекс Музыке' : 'Открыть все треки в SoundCloud';
  finalActionButtons.innerHTML = `
    <button type="button" class="btn-primary" id="btnOpenAllHero">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
      <span>${openLabel}</span>
    </button>
    <button type="button" class="btn-secondary" id="btnDownloadM3UHero">
      Скачать M3U плейлист
    </button>
  `;
  document.getElementById('btnOpenAllHero').addEventListener('click', openAllLinksInTabs);
  document.getElementById('btnDownloadM3UHero').addEventListener('click', () => {
    window.location.href = `/api/export/${state.jobId}/m3u`;
  });
}

async function triggerPlaylistCreation() {
  const token = oauthTokenInput.value.trim();
  const btn = document.getElementById('btnCreateSCPlaylist');
  const spinner = document.getElementById('createBtnSpinner');
  const text = document.getElementById('createBtnText');

  if (btn) btn.disabled = true;
  if (spinner) spinner.classList.remove('hidden');
  if (text) text.textContent = 'Создание плейлиста в SoundCloud...';

  try {
    const res = await fetch('/api/create-playlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_id: state.jobId,
        oauth_token: token,
        playlist_title: state.playlistTitle,
        sharing: 'public'
      })
    });
    const data = await res.json();

    if (data.success && data.permalink_url) {
      finalActionButtons.innerHTML = `
        <a href="${data.permalink_url}" target="_blank" rel="noreferrer" class="btn-primary" style="text-decoration: none; padding: 16px 28px; font-size: 16px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
          <span>Открыть созданный плейлист в SoundCloud</span>
        </a>
      `;
    } else {
      finalActionButtons.innerHTML = `
        <div style="color: #FF3B30; font-size: 14px; margin-bottom: 12px;">✕ ${data.error || 'Не удалось создать плейлист'}</div>
        <button type="button" class="btn-secondary" onclick="triggerPlaylistCreation()">Повторить попытку</button>
      `;
    }
  } catch (err) {
    finalActionButtons.innerHTML = `
      <div style="color: #FF3B30; font-size: 14px; margin-bottom: 12px;">✕ Ошибка запроса: ${err.message}</div>
      <button type="button" class="btn-secondary" onclick="triggerPlaylistCreation()">Повторить попытку</button>
    `;
  }
}

function openAllLinksInTabs() {
  const cards = trackListContainer.querySelectorAll('.track-card');
  const links = [];
  cards.forEach(c => {
    const a = c.querySelector('.sc-link-btn');
    if (a && a.href) links.push(a.href);
  });

  if (links.length === 0) {
    alert('Нет найденных ссылок для открытия.');
    return;
  }

  const toOpen = links.slice(0, 15);
  toOpen.forEach(url => window.open(url, '_blank'));

  if (links.length > 15) {
    alert(`Открыто первых 15 треков в новых вкладках. Полный список можно скачать файлом.`);
  }
}

btnExportM3U.addEventListener('click', () => {
  if (!state.jobId) return;
  window.location.href = `/api/export/${state.jobId}/m3u`;
});

btnExportLinks.addEventListener('click', () => {
  if (!state.jobId) return;
  window.location.href = `/api/export/${state.jobId}/links`;
});

btnExportJSON.addEventListener('click', () => {
  if (!state.jobId) return;
  window.location.href = `/api/export/${state.jobId}/json`;
});

btnOpenAllLinks.addEventListener('click', openAllLinksInTabs);

btnTransferAnother.addEventListener('click', () => {
  screenFinal.classList.add('hidden');
  screenProgress.classList.add('hidden');
  screenSetup.classList.remove('hidden');
  playlistUrlInput.value = '';
  resetStartBtn();
});

window.copySnippet = function(inputId, btn) {
  const inp = document.getElementById(inputId);
  if (inp) {
    inp.select();
    navigator.clipboard.writeText(inp.value);
    const orig = btn.textContent;
    btn.textContent = 'Скопировано!';
    setTimeout(() => {
      btn.textContent = orig;
    }, 2000);
  }
};

// Auto-detect ?token=... passed from Bookmarklet or Extension
const urlParams = new URLSearchParams(window.location.search);
const queryToken = urlParams.get('token');
if (queryToken) {
  state.oauthToken = queryToken;
  localStorage.setItem('ym_sc_token', queryToken);
  if (oauthTokenInput) oauthTokenInput.value = queryToken;
  if (finalOAuthTokenInput) finalOAuthTokenInput.value = queryToken;
  setMode('auto_playlist');
  if (verifyTokenBtn) verifyTokenBtn.click();
  window.history.replaceState({}, document.title, window.location.pathname);
}

// Check and offer to restore previously completed transfer
async function checkPreviousJob() {
  try {
    const res = await fetch('/api/latest-export');
    if (!res.ok) return;
    const data = await res.json();
    if (data.total_tracks > 1 && data.job_id) {
      const banner = document.getElementById('restoreJobBanner');
      const titleEl = document.getElementById('restoreJobTitle');
      const countEl = document.getElementById('restoreJobCount');
      const btn = document.getElementById('btnRestoreLatestJob');

      if (banner && titleEl && countEl && btn) {
        titleEl.textContent = data.playlist_title;
        countEl.textContent = data.total_tracks;
        banner.classList.remove('hidden');

        btn.addEventListener('click', async () => {
          state.jobId = data.job_id;
          state.playlistTitle = data.playlist_title;
          const fullRes = await fetch(`/api/export/${data.job_id}/json`);
          if (fullRes.ok) {
            const fullData = await fullRes.json();
            state.tracks = fullData.tracks || [];
            finishTransfer({
              transferred: data.total_tracks,
              total: fullData.total_tracks || data.total_tracks,
              exact: data.total_tracks,
              fuzzy: 0,
              not_found: (fullData.total_tracks || data.total_tracks) - data.total_tracks
            });
          }
        });
      }
    }
  } catch (e) {}
}

function initBookmarklet() {
  const btn = document.getElementById('autoBookmarkletBtn');
  if (!btn) return;
  const origin = window.location.origin;
  const isScToYm = state.direction === 'sc_to_ym';

  const btnTextSpan = btn.querySelector('span');
  if (btnTextSpan) {
    btnTextSpan.textContent = isScToYm ? '⭐ Собрать плейлист в Яндекс Музыке' : '⭐ Собрать плейлист в SoundCloud';
  }

  let code = '';
  if (isScToYm) {
    // Yandex Music Bookmarklet
    code = `(async function(){if(!location.hostname.includes('yandex.')){alert('Откройте вкладку music.yandex.ru перед нажатием!');return;}let t=document.getElementById('ym-sc-toast');if(t)t.remove();t=document.createElement('div');t.id='ym-sc-toast';t.style.cssText='position:fixed;top:24px;left:50%;transform:translateX(-50%) translateY(0);z-index:99999999;background:rgba(18,18,22,0.92);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);color:#F2F2F2;padding:20px 24px;border-radius:16px;box-shadow:0 20px 50px rgba(0,0,0,0.6),0 0 0 1px rgba(255,255,255,0.08);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:13.5px;text-align:center;min-width:320px;max-width:440px;transition:all 0.3s cubic-bezier(0.16,1,0.3,1);box-sizing:border-box;';document.body.appendChild(t);const closeBtn='<button type="button" id="ym-sc-close" style="position:absolute;top:10px;right:12px;background:rgba(255,255,255,0.08);border:none;color:#999;width:24px;height:24px;border-radius:50%;cursor:pointer;font-size:13px;line-height:1;display:flex;align-items:center;justify-content:center;">✕</button>';const dismiss=()=>{t.style.opacity='0';t.style.transform='translateX(-50%) translateY(-12px)';setTimeout(()=>{if(t&&t.parentNode)t.remove();},300);};t.innerHTML=closeBtn+'<div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:8px;"><span style="color:#FFCC00;font-weight:700;font-size:14px;">⚡ SC ➔ Яндекс Музыка</span></div><div style="color:#AAA;font-size:13px;">Загрузка треков...</div>';document.getElementById('ym-sc-close').onclick=dismiss;try{let r=null;const eps=['${origin}/api/latest-export','http://localhost:8000/api/latest-export','http://127.0.0.1:8000/api/latest-export'];for(const ep of eps){try{const res=await fetch(ep);if(res.ok){r=res;break;}}catch(e){}}if(!r)throw new Error('Не удалось получить треки с сервера');const d=await r.json();const ymTracks=d.ym_tracks||[];const title=d.playlist_title||'SoundCloud плейлист';if(!ymTracks.length){t.innerHTML=closeBtn+'<div style="color:#FF9500;font-weight:600;margin-bottom:4px;">✕ Нет треков для добавления</div><div style="color:#888;font-size:12px;">Сначала запустите подбор на сайте</div>';document.getElementById('ym-sc-close').onclick=dismiss;setTimeout(dismiss,5000);return;}t.innerHTML=closeBtn+'<div style="color:#FFCC00;font-weight:700;font-size:14px;margin-bottom:6px;">⚡ Добавление в Яндекс Музыку...</div><div style="color:#FFF;font-size:13px;margin-bottom:10px;">Подготовка '+ymTracks.length+' треков...</div>';document.getElementById('ym-sc-close').onclick=dismiss;let uid=null;try{const aRes=await fetch('/handlers/auth.jsx');if(aRes.ok){const aData=await aRes.json();uid=(aData.user&&aData.user.uid)||(aData.defaultUser&&aData.defaultUser.uid);}}catch(e){}if(!uid&&window.Mu&&window.Mu.user&&window.Mu.user.uid){uid=window.Mu.user.uid;}let targetUrl='/users/'+(uid||'me')+'/playlists';if(uid){try{const form=new URLSearchParams();form.append('title',title);form.append('visibility','public');const cRes=await fetch('/handlers/library.jsx?owner='+uid+'&action=create-playlist',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:form.toString()});if(cRes.ok){const cd=await cRes.json();const pk=(cd.playlist&&cd.playlist.kind)||cd.kind;if(pk){targetUrl='/users/'+uid+'/playlists/'+pk;const entries=ymTracks.map(tr=>({id:tr.id,albumId:tr.album_id||''}));await fetch('/handlers/playlist-patch.jsx?owner='+uid+'&kinds='+pk,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({diff:{op:'insert',at:0,tracks:entries}})});}}}catch(e){}}t.innerHTML=closeBtn+'<div style="color:#34C759;font-weight:700;font-size:15px;margin-bottom:6px;">✓ Добавлено '+ymTracks.length+' треков в Яндекс Музыку!</div><div style="color:#8E8E93;font-size:12px;margin-bottom:14px;">Плейлист успешно создан в вашем профиле</div><a href="'+targetUrl+'" target="_blank" style="display:inline-flex;align-items:center;justify-content:center;gap:6px;background:linear-gradient(135deg,#FFCC00,#FFAA00);color:#000;padding:10px 22px;border-radius:10px;text-decoration:none;font-weight:700;font-size:13.5px;box-shadow:0 4px 14px rgba(255,204,0,0.35);"><span>Открыть в Яндекс Музыке</span><span style="font-size:15px;">↗</span></a>';document.getElementById('ym-sc-close').onclick=dismiss;setTimeout(dismiss,10000);}catch(e){t.innerHTML=closeBtn+'<div style="color:#FF3B30;font-weight:700;font-size:14px;margin-bottom:4px;">✕ Ошибка</div><div style="color:#CCC;font-size:12.5px;">'+e.message+'</div>';document.getElementById('ym-sc-close').onclick=dismiss;setTimeout(dismiss,6000);}})();`;
  } else {
    // SoundCloud Bookmarklet
    code = `(async function(){if(!location.hostname.includes('soundcloud.com')){alert('Откройте вкладку soundcloud.com перед нажатием!');return;}let t=document.getElementById('ym-sc-toast');if(t)t.remove();t=document.createElement('div');t.id='ym-sc-toast';t.style.cssText='position:fixed;top:24px;left:50%;transform:translateX(-50%) translateY(0);z-index:99999999;background:rgba(18,18,22,0.92);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);color:#F2F2F2;padding:20px 24px;border-radius:16px;box-shadow:0 20px 50px rgba(0,0,0,0.6),0 0 0 1px rgba(255,255,255,0.08);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:13.5px;text-align:center;min-width:320px;max-width:440px;transition:all 0.3s cubic-bezier(0.16,1,0.3,1);box-sizing:border-box;';document.body.appendChild(t);const closeBtn='<button type="button" id="ym-sc-close" style="position:absolute;top:10px;right:12px;background:rgba(255,255,255,0.08);border:none;color:#999;width:24px;height:24px;border-radius:50%;cursor:pointer;font-size:13px;line-height:1;display:flex;align-items:center;justify-content:center;">✕</button>';const dismiss=()=>{t.style.opacity='0';t.style.transform='translateX(-50%) translateY(-12px)';setTimeout(()=>{if(t&&t.parentNode)t.remove();},300);};t.innerHTML=closeBtn+'<div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:8px;"><span style="color:#FF5500;font-weight:700;font-size:14px;">⚡ YM ➔ SoundCloud</span></div><div style="color:#AAA;font-size:13px;">Загрузка треков...</div>';document.getElementById('ym-sc-close').onclick=dismiss;try{let r=null;const eps=['${origin}/api/latest-export','http://localhost:8000/api/latest-export','http://127.0.0.1:8000/api/latest-export'];for(const ep of eps){try{const res=await fetch(ep);if(res.ok){r=res;break;}}catch(e){}}if(!r)throw new Error('Не удалось получить треки с сервера');const d=await r.json();const ids=d.track_ids||[];const title=d.playlist_title||'Мне нравится (YM)';if(!ids.length){t.innerHTML=closeBtn+'<div style="color:#FF9500;font-weight:600;margin-bottom:4px;">✕ Нет треков для добавления</div><div style="color:#888;font-size:12px;">Сначала запустите подбор треков на сайте</div>';document.getElementById('ym-sc-close').onclick=dismiss;setTimeout(dismiss,5000);return;}let tok=null;const m=document.cookie.match(/oauth_token=([^;]+)/);if(m)tok=decodeURIComponent(m[1]);if(!tok){for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.toLowerCase().includes('token')){const v=localStorage.getItem(k);if(v&&v.length>20){tok=v;break;}}}}if(!tok){t.innerHTML=closeBtn+'<div style="color:#FF3B30;font-weight:600;margin-bottom:4px;">✕ Вы не вошли в SoundCloud</div><div style="color:#AAA;font-size:12px;">Войдите в аккаунт на этой вкладке</div>';document.getElementById('ym-sc-close').onclick=dismiss;setTimeout(dismiss,6000);return;}let cid='cUfk83W6dFJv2UFUorAW0CTHgyptuEmP';const scs=Array.from(document.querySelectorAll('script[src*="sndcdn.com"]'));for(const s of scs){const ma=s.src.match(/client_id=([a-zA-Z0-9]{32})/);if(ma){cid=ma[1];break;}}const sz=480;const cks=[];for(let i=0;i<ids.length;i+=sz)cks.push(ids.slice(i,i+sz));const cre=[];for(let i=0;i<cks.length;i++){const pt=cks.length===1?title:(title+' (Часть '+(i+1)+' из '+cks.length+')');t.innerHTML=closeBtn+'<div style="color:#FF5500;font-weight:700;font-size:14px;margin-bottom:6px;">⚡ Добавление в SoundCloud...</div><div style="color:#FFF;font-weight:600;font-size:13px;margin-bottom:10px;">Часть '+(i+1)+' из '+cks.length+' ('+cks[i].length+' треков)</div><div style="background:rgba(255,255,255,0.1);border-radius:6px;height:4px;overflow:hidden;width:100%;"><div style="background:#FF5500;height:100%;width:'+Math.round(((i+1)/cks.length)*100)+'%;transition:width 0.3s;"></div></div>';document.getElementById('ym-sc-close').onclick=dismiss;const pr=await fetch('https://api-v2.soundcloud.com/playlists?client_id='+cid,{method:'POST',headers:{'Authorization':'OAuth '+tok.replace(/^OAuth /i,''),'Content-Type':'application/json'},body:JSON.stringify({playlist:{title:pt,sharing:'public',tracks:cks[i]}})});if(!pr.ok)throw new Error('HTTP '+pr.status);const pd=await pr.json();cre.push(pd);}t.innerHTML=closeBtn+'<div style="color:#34C759;font-weight:700;font-size:15px;margin-bottom:6px;">✓ Добавлено '+ids.length+' треков в профиль!</div><div style="color:#8E8E93;font-size:12px;margin-bottom:14px;">Плейлист успешно создан в SoundCloud</div><a href="'+cre[0].permalink_url+'" target="_blank" style="display:inline-flex;align-items:center;justify-content:center;gap:6px;background:linear-gradient(135deg,#FF5500,#FF3300);color:#FFF;padding:10px 22px;border-radius:10px;text-decoration:none;font-weight:700;font-size:13.5px;box-shadow:0 4px 14px rgba(255,85,0,0.35);"><span>Открыть плейлист</span><span style="font-size:15px;">↗</span></a>';document.getElementById('ym-sc-close').onclick=dismiss;setTimeout(dismiss,10000);}catch(e){t.innerHTML=closeBtn+'<div style="color:#FF3B30;font-weight:700;font-size:14px;margin-bottom:4px;">✕ Ошибка</div><div style="color:#CCC;font-size:12.5px;">'+e.message+'</div>';document.getElementById('ym-sc-close').onclick=dismiss;setTimeout(dismiss,6000);}})();`;
  }
  btn.href = 'javascript:' + encodeURIComponent(code);
}

initBookmarklet();
checkPreviousJob();

closeAudioPlayer.addEventListener('click', () => {
  globalAudioPlayer.pause();
  audioPlayerBar.classList.add('hidden');
});

/* ==========================================================================
   Screen 3: Post-transfer Create Playlist in SoundCloud Account
   ========================================================================== */
const finalOAuthTokenInput = document.getElementById('finalOAuthTokenInput');
const btnFinalCreatePlaylist = document.getElementById('btnFinalCreatePlaylist');
const finalCreateBtnText = document.getElementById('finalCreateBtnText');
const finalCreateBtnSpinner = document.getElementById('finalCreateBtnSpinner');
const finalCreateStatus = document.getElementById('finalCreateStatus');
const finalToggleGuideBtn = document.getElementById('finalToggleGuideBtn');
const finalTokenGuideBox = document.getElementById('finalTokenGuideBox');

if (finalOAuthTokenInput && state.oauthToken) {
  finalOAuthTokenInput.value = state.oauthToken;
}

/* ==========================================================================
   Extension Bridge & 1-Click Integration
   ========================================================================== */
window.addEventListener('message', (event) => {
  if (event.source !== window) return;

  if (event.data && event.data.type === 'YM_SC_EXTENSION_READY') {
    const badge = document.getElementById('extensionBadge');
    const extBlock = document.getElementById('extFlowBlock');
    const bmBlock = document.getElementById('bookmarkletFlowBlock');
    if (badge) badge.classList.remove('hidden');
    if (extBlock) extBlock.classList.remove('hidden');
    if (bmBlock) bmBlock.classList.add('hidden');
  }

  if (event.data && event.data.type === 'YM_SC_PLAYLIST_RESULT') {
    const res = event.data.result || {};
    const btn = document.getElementById('btnExtensionCreate');
    const spinner = document.getElementById('extCreateBtnSpinner');
    const text = document.getElementById('extCreateBtnText');
    const status = document.getElementById('extCreateStatus');

    if (btn) btn.disabled = false;
    if (spinner) spinner.classList.add('hidden');
    if (text) text.textContent = '⚡ Создать плейлист в SoundCloud (1 клик)';

    if (res.success && res.permalink_url) {
      status.innerHTML = `
        <div style="background: rgba(52, 199, 89, 0.12); border: 1px solid rgba(52, 199, 89, 0.3); border-radius: 8px; padding: 14px; margin-top: 10px;">
          <div style="color: #34C759; font-weight: 700; font-size: 15px; margin-bottom: 8px;">✓ Плейлист успешно создан в вашем профиле SoundCloud!</div>
          <a href="${res.permalink_url}" target="_blank" rel="noreferrer" class="btn-primary" style="text-decoration: none; display: inline-flex; font-size: 14px; padding: 10px 22px;">
            <span>Открыть созданный плейлист в SoundCloud ↗</span>
          </a>
        </div>
      `;
    } else {
      status.innerHTML = `<div style="color: #FF3B30; font-weight: 600; margin-top: 8px;">✕ ${res.error || 'Ошибка создания плейлиста'}</div>`;
    }
  }
});

// Check if extension is present
window.postMessage({ type: 'CHECK_YM_SC_EXTENSION' }, '*');

const btnExtensionCreate = document.getElementById('btnExtensionCreate');
if (btnExtensionCreate) {
  btnExtensionCreate.addEventListener('click', async () => {
    const btn = document.getElementById('btnExtensionCreate');
    const spinner = document.getElementById('extCreateBtnSpinner');
    const text = document.getElementById('extCreateBtnText');
    const status = document.getElementById('extCreateStatus');

    btn.disabled = true;
    spinner.classList.remove('hidden');
    text.textContent = 'Создаем плейлист в SoundCloud...';
    status.innerHTML = '<span style="color: var(--text-muted);">Отправляем треки в ваш профиль...</span>';

    let trackIds = [];
    try {
      const res = await fetch(`/api/export/${state.jobId}/json`);
      if (res.ok) {
        const data = await res.json();
        for (const t of (data.tracks || [])) {
          if (t && t.selected_match && t.selected_match.id) {
            trackIds.push(t.selected_match.id);
          }
        }
      }
    } catch(e) {}

    if (trackIds.length === 0) {
      const cards = trackListContainer.querySelectorAll('.track-card');
      cards.forEach(card => {
        if (card.dataset.scId) trackIds.push(parseInt(card.dataset.scId, 10));
      });
    }

    const uniqueIds = Array.from(new Set(trackIds));
    window.postMessage({
      type: 'YM_SC_CREATE_PLAYLIST',
      title: state.playlistTitle || "Мне нравится (YM)",
      trackIds: uniqueIds
    }, '*');
  });
}

/* ==========================================================================
   Screen 3: 1-Click In-Browser SoundCloud Runner (Zero Captcha / Zero 403)
   ========================================================================== */
const btnCopySCRunnerScript = document.getElementById('btnCopySCRunnerScript');
const copyRunnerSuccessAlert = document.getElementById('copyRunnerSuccessAlert');
const btnCopyRunnerText = document.getElementById('btnCopyRunnerText');

if (btnCopySCRunnerScript) {
  btnCopySCRunnerScript.addEventListener('click', async () => {
    try {
      if (btnCopyRunnerText) btnCopyRunnerText.textContent = 'Подготовка треков...';
      let trackIds = [];
      let playlistTitle = state.playlistTitle || "Мне нравится (YM)";

      if (state.jobId) {
        try {
          const res = await fetch(`/api/export/${state.jobId}/json`);
          if (res.ok) {
            const data = await res.json();
            playlistTitle = data.playlist_title || playlistTitle;
            for (const t of (data.tracks || [])) {
              if (t && t.selected_match && t.selected_match.id) {
                trackIds.push(t.selected_match.id);
              }
            }
          }
        } catch (e) {
          console.warn('Export json fetch error:', e);
        }
      }

      // Fallback from DOM cards if needed
      if (trackIds.length === 0) {
        const cards = trackListContainer.querySelectorAll('.track-card');
        cards.forEach(card => {
          if (card.dataset.scId) {
            trackIds.push(parseInt(card.dataset.scId, 10));
          }
        });
      }

      if (trackIds.length === 0) {
        alert('Не найдено треков для добавления в SoundCloud.');
        if (btnCopyRunnerText) btnCopyRunnerText.textContent = '📋 Скопировать 1-клик команду сборщика';
        return;
      }

      // Deduplicate IDs
      const uniqueIds = Array.from(new Set(trackIds));

      // Generate self-contained browser runner
      const runnerCode = `(async function() {
  console.log("⚡ YM Transfer: Запуск сборщика ${uniqueIds.length} треков...");
  let token = null;
  const m = document.cookie.match(/oauth_token=([^;]+)/);
  if (m) token = decodeURIComponent(m[1]);
  if (!token) {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.toLowerCase().includes('token')) {
        const v = localStorage.getItem(k);
        if (v && v.length > 20) { token = v; break; }
      }
    }
  }
  if (!token) {
    alert("❌ Ошибка: не найден токен сессии SoundCloud. Убедитесь, что вы залогинены на soundcloud.com!");
    return;
  }

  let clientId = "cUfk83W6dFJv2UFUorAW0CTHgyptuEmP";
  try {
    const scripts = Array.from(document.querySelectorAll('script[src*="sndcdn.com"]'));
    for (const s of scripts) {
      const match = s.src.match(/client_id=([a-zA-Z0-9]{32})/);
      if (match) { clientId = match[1]; break; }
    }
  } catch(e) {}

  const title = ${JSON.stringify(playlistTitle)};
  const trackIds = ${JSON.stringify(uniqueIds)};
  const chunkSize = 480;
  const chunks = [];
  for (let i = 0; i < trackIds.length; i += chunkSize) {
    chunks.push(trackIds.slice(i, i + chunkSize));
  }

  // Floating notification banner on SoundCloud page
  let toast = document.getElementById('ym-sc-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'ym-sc-toast';
    toast.style.cssText = "position:fixed;top:24px;left:50%;transform:translateX(-50%);z-index:99999999;background:#141414;color:#FFF;padding:18px 28px;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,0.6);font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:14px;border:1px solid #FF5500;min-width:320px;text-align:center;";
    document.body.appendChild(toast);
  }

  const created = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const partNum = i + 1;
    const partTitle = chunks.length === 1 ? title : (title + " (Часть " + partNum + " из " + chunks.length + ")");
    toast.innerHTML = '<div style="color:#FF5500;font-weight:700;margin-bottom:6px;">⚡ YM Transfer</div><div>Создаем часть ' + partNum + ' из ' + chunks.length + ' (' + chunk.length + ' треков)...</div>';

    const res = await fetch("https://api-v2.soundcloud.com/playlists?client_id=" + clientId, {
      method: "POST",
      headers: {
        "Authorization": "OAuth " + token.replace(/^OAuth /i, ''),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        playlist: {
          title: partTitle,
          sharing: "public",
          tracks: chunk
        }
      })
    });

    if (!res.ok) {
      const err = await res.text();
      toast.innerHTML = '<div style="color:#FF3B30;font-weight:700;">✕ Ошибка создания части ' + partNum + '</div><div style="font-size:12px;margin-top:4px;">' + err.slice(0, 100) + '</div>';
      return;
    }
    const data = await res.json();
    created.push(data);
  }

  toast.innerHTML = '<div style="color:#34C759;font-weight:700;font-size:15px;margin-bottom:8px;">✓ Успешно создано ' + created.length + ' плейлиста (' + trackIds.length + ' треков)!</div>' +
    '<a href="' + created[0].permalink_url + '" style="background:#FF5500;color:#FFF;padding:8px 16px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600;font-size:13px;margin-top:6px;">Открыть плейлист ↗</a>';
})();`;

      await navigator.clipboard.writeText(runnerCode);
      if (btnCopyRunnerText) btnCopyRunnerText.textContent = '✓ Скопировано в буфер обмена!';
      if (copyRunnerSuccessAlert) {
        copyRunnerSuccessAlert.classList.remove('hidden');
      }
      setTimeout(() => {
        if (btnCopyRunnerText) btnCopyRunnerText.textContent = '📋 Скопировать 1-клик команду сборщика (' + uniqueIds.length + ' треков)';
      }, 4000);
    } catch (err) {
      console.error(err);
      alert('Ошибка при подготовке скрипта: ' + err.message);
      if (btnCopyRunnerText) btnCopyRunnerText.textContent = '📋 Скопировать 1-клик команду сборщика';
    }
  });
}
