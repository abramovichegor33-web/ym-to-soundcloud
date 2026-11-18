/**
 * SoundShift — Перенос плейлистов Яндекс Музыка ⇄ SoundCloud
 * Чистый Vanilla ES6+ SPA • Linear/Raycast Dark Theme • Полная поддержка живого SSE и тестового режима
 */

(() => {
  'use strict';

  // Глобальное состояние приложения
  const state = {
    screen: 'setup', // 'setup' | 'progress' | 'final'
    direction: 'ym_to_sc', // 'ym_to_sc' | 'sc_to_ym'
    mode: 'zero_login', // 'zero_login' | 'auto_playlist'
    oauthToken: '',
    jobId: null,
    playlistTitle: 'Плейлист',
    tracks: [],
    tracksMap: new Map(),
    activeFilter: 'all',
    stats: { total: 0, completed: 0, exact: 0, fuzzy: 0, not_found: 0 },
    player: {
      activeTrack: null,
      isPlaying: false,
      duration: 30,
      currentTime: 0,
      timer: null
    }
  };

  // Кэш DOM элементов
  const DOM = {
    brandResetBtn: document.getElementById('brandResetBtn'),
    stepIndicator1: document.getElementById('stepIndicator1'),
    stepIndicator2: document.getElementById('stepIndicator2'),
    stepIndicator3: document.getElementById('stepIndicator3'),

    // Экраны
    screenSetup: document.getElementById('screenSetup'),
    screenProgress: document.getElementById('screenProgress'),
    screenFinal: document.getElementById('screenFinal'),

    // Экран 1: Настройка
    dirYmToSc: document.getElementById('dirYmToSc'),
    dirScToYm: document.getElementById('dirScToYm'),
    heroTitle: document.getElementById('heroTitle'),
    heroSubtitle: document.getElementById('heroSubtitle'),
    modeSection: document.getElementById('modeSection'),
    modeZeroLogin: document.getElementById('modeZeroLogin'),
    modeAutoPlaylist: document.getElementById('modeAutoPlaylist'),
    playlistUrlLabel: document.getElementById('playlistUrlLabel'),
    playlistUrlInput: document.getElementById('playlistUrlInput'),
    btnPasteClipboard: document.getElementById('btnPasteClipboard'),
    startTransferBtn: document.getElementById('startTransferBtn'),
    startBtnText: document.getElementById('startBtnText'),
    startBtnSpinner: document.getElementById('startBtnSpinner'),
    inputHelpText: document.getElementById('inputHelpText'),
    samplePills: document.getElementById('samplePills'),
    pill1: document.getElementById('pill1'),
    pill2: document.getElementById('pill2'),
    pill3: document.getElementById('pill3'),
    sessionTokenSection: document.getElementById('sessionTokenSection'),
    oauthTokenInput: document.getElementById('oauthTokenInput'),
    verifyTokenBtn: document.getElementById('verifyTokenBtn'),
    tokenVerifyStatus: document.getElementById('tokenVerifyStatus'),
    restoreJobBanner: document.getElementById('restoreJobBanner'),
    restoreJobTitle: document.getElementById('restoreJobTitle'),
    restoreJobCount: document.getElementById('restoreJobCount'),
    btnRestoreLatestJob: document.getElementById('btnRestoreLatestJob'),

    // Экран 2: Подбор треков
    progressPlaylistTitle: document.getElementById('progressPlaylistTitle'),
    progressStatusText: document.getElementById('progressStatusText'),
    progressCounter: document.getElementById('progressCounter'),
    progressBar: document.getElementById('progressBar'),
    filterAll: document.getElementById('filterAll'),
    filterExact: document.getElementById('filterExact'),
    filterFuzzy: document.getElementById('filterFuzzy'),
    filterNotFound: document.getElementById('filterNotFound'),
    countAll: document.getElementById('countAll'),
    countExact: document.getElementById('countExact'),
    countFuzzy: document.getElementById('countFuzzy'),
    countNotFound: document.getElementById('countNotFound'),
    trackListContainer: document.getElementById('trackListContainer'),

    // Экран 3: Финал и экспорт
    finalStatsNumber: document.getElementById('finalStatsNumber'),
    finalStatsLabel: document.getElementById('finalStatsLabel'),
    statAccuracy: document.getElementById('statAccuracy'),
    statAccuracySub: document.getElementById('statAccuracySub'),
    statTransferTime: document.getElementById('statTransferTime'),
    cardAutoSave: document.getElementById('cardAutoSave'),
    targetPlatformHeading: document.getElementById('targetPlatformHeading'),
    targetPlatformDesc: document.getElementById('targetPlatformDesc'),
    autoBookmarkletBtn: document.getElementById('autoBookmarkletBtn'),
    autoBookmarkletBtnText: document.getElementById('autoBookmarkletBtnText'),
    targetPlatformOpenLink: document.getElementById('targetPlatformOpenLink'),
    bookmarkletStepGuide: document.getElementById('bookmarkletStepGuide'),
    copyRunnerLabel: document.getElementById('copyRunnerLabel'),
    btnCopySCRunnerScript: document.getElementById('btnCopySCRunnerScript'),
    btnCopyRunnerText: document.getElementById('btnCopyRunnerText'),
    copyRunnerSuccessAlert: document.getElementById('copyRunnerSuccessAlert'),
    copyRunnerSuccessText: document.getElementById('copyRunnerSuccessText'),
    btnExportM3U: document.getElementById('btnExportM3U'),
    btnExportLinks: document.getElementById('btnExportLinks'),
    btnExportJSON: document.getElementById('btnExportJSON'),
    btnOpenAllLinks: document.getElementById('btnOpenAllLinks'),
    btnTransferAnother: document.getElementById('btnTransferAnother'),

    // Плавающий мини-плеер
    audioPlayerBar: document.getElementById('audioPlayerBar'),
    playerCoverImg: document.getElementById('playerCoverImg'),
    playerTrackTitle: document.getElementById('playerTrackTitle'),
    playerArtistTitle: document.getElementById('playerArtistTitle'),
    playerTogglePlayBtn: document.getElementById('playerTogglePlayBtn'),
    playerPlayIcon: document.getElementById('playerPlayIcon'),
    playerPauseIcon: document.getElementById('playerPauseIcon'),
    playerCurrentTime: document.getElementById('playerCurrentTime'),
    playerTotalTime: document.getElementById('playerTotalTime'),
    playerScrubberWrap: document.getElementById('playerScrubberWrap'),
    playerScrubberFill: document.getElementById('playerScrubberFill'),
    playerVolumeSlider: document.getElementById('playerVolumeSlider'),
    closeAudioPlayer: document.getElementById('closeAudioPlayer'),
    globalAudioPlayer: document.getElementById('globalAudioPlayer')
  };

  /* ==========================================================================
     Навигация и переключение экранов
     ========================================================================== */
  function navigateTo(screenName) {
    state.screen = screenName;

    DOM.screenSetup.classList.toggle('hidden', screenName !== 'setup');
    DOM.screenProgress.classList.toggle('hidden', screenName !== 'progress');
    DOM.screenFinal.classList.toggle('hidden', screenName !== 'final');

    DOM.stepIndicator1.className = 'step-item';
    DOM.stepIndicator2.className = 'step-item';
    DOM.stepIndicator3.className = 'step-item';

    if (screenName === 'setup') {
      DOM.stepIndicator1.classList.add('active');
    } else if (screenName === 'progress') {
      DOM.stepIndicator1.classList.add('completed');
      DOM.stepIndicator2.classList.add('active');
    } else if (screenName === 'final') {
      DOM.stepIndicator1.classList.add('completed');
      DOM.stepIndicator2.classList.add('completed');
      DOM.stepIndicator3.classList.add('active');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ==========================================================================
     Переключение направления и режима
     ========================================================================== */
  function setDirection(dir) {
    state.direction = dir;
    document.body.dataset.direction = dir;

    if (dir === 'sc_to_ym') {
      DOM.dirYmToSc.classList.remove('active');
      DOM.dirScToYm.classList.add('active');
      DOM.heroTitle.textContent = 'Перенос плейлистов в Яндекс Музыку';
      DOM.heroSubtitle.textContent = 'Быстрый импорт музыки из SoundCloud в медиатеку Яндекс Музыки без передачи паролей.';
      DOM.playlistUrlLabel.textContent = 'Ссылка на плейлист или лайки SoundCloud:';
      DOM.playlistUrlInput.placeholder = 'soundcloud.com/artist/sets/... или soundcloud.com/user/likes';
      DOM.inputHelpText.innerHTML = '<span class="help-text">Поддерживаются: плейлисты <code>soundcloud.com/.../sets/...</code> и профили <code>soundcloud.com/...</code></span>';
      
      DOM.pill1.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg><span>Phonk & Дрифт</span>`;
      DOM.pill1.dataset.url = 'demo-sc-phonk';

      DOM.pill2.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 18v-6a9 9 0 0 1 18 0v6"></path><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path></svg><span>Lo-Fi Chill & Beats</span>`;
      DOM.pill2.dataset.url = 'demo-sc-chill';

      DOM.pill3.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg><span>Хиты SoundCloud</span>`;
      DOM.pill3.dataset.url = 'https://soundcloud.com/discover/sets/weekly';

      if (DOM.modeSection) DOM.modeSection.classList.add('hidden');
    } else {
      DOM.dirScToYm.classList.remove('active');
      DOM.dirYmToSc.classList.add('active');
      DOM.heroTitle.textContent = 'Перенос плейлистов в SoundCloud';
      DOM.heroSubtitle.textContent = 'Быстрый импорт музыки по публичной ссылке без авторизации и передачи паролей от аккаунтов.';
      DOM.playlistUrlLabel.textContent = 'Ссылка на публичный плейлист или альбом Яндекс Музыки:';
      DOM.playlistUrlInput.placeholder = 'music.yandex.ru/users/.../playlists/... или playlists/lk...';
      DOM.inputHelpText.innerHTML = '<span class="help-text">Поддерживаются: <code>playlists/...</code>, <code>users/.../playlists/...</code> и альбомы <code>album/...</code></span>';

      DOM.pill1.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg><span>Русский Рок & Инди</span>`;
      DOM.pill1.dataset.url = 'demo-rock';

      DOM.pill2.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 18v-6a9 9 0 0 1 18 0v6"></path><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path></svg><span>Электроника & Hip-Hop</span>`;
      DOM.pill2.dataset.url = 'demo-electro';

      DOM.pill3.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg><span>Чарт Топ-100</span>`;
      DOM.pill3.dataset.url = 'https://music.yandex.ru/users/yamusic-top/playlists/1000';

      if (DOM.modeSection) DOM.modeSection.classList.remove('hidden');
    }
  }

  function setMode(mode) {
    state.mode = mode;
    if (DOM.modeZeroLogin) DOM.modeZeroLogin.classList.toggle('active', mode === 'zero_login');
    if (DOM.modeAutoPlaylist) DOM.modeAutoPlaylist.classList.toggle('active', mode === 'auto_playlist');
    if (DOM.sessionTokenSection) DOM.sessionTokenSection.classList.toggle('hidden', mode !== 'auto_playlist');
  }

  /* ==========================================================================
     Кнопка «Вставить» и быстрые чипы
     ========================================================================== */
  if (DOM.btnPasteClipboard) {
    DOM.btnPasteClipboard.addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          DOM.playlistUrlInput.value = text.trim();
          DOM.playlistUrlInput.focus();
        }
      } catch (err) {
        DOM.playlistUrlInput.focus();
      }
    });
  }

  document.querySelectorAll('.chip-btn[data-url]').forEach(btn => {
    btn.addEventListener('click', () => {
      const url = btn.dataset.url;
      DOM.playlistUrlInput.value = url;
      startMatching();
    });
  });

  /* ==========================================================================
     Запуск сопоставления треков
     ========================================================================== */
  async function startMatching() {
    const rawUrl = DOM.playlistUrlInput.value.trim();
    if (!rawUrl) {
      DOM.playlistUrlInput.focus();
      return;
    }

    DOM.startTransferBtn.disabled = true;
    DOM.startBtnSpinner.classList.remove('hidden');
    DOM.startBtnText.textContent = 'Чтение плейлиста...';

    const isDemo = rawUrl.startsWith('demo-');

    if (isDemo) {
      runMockSimulation(rawUrl);
      return;
    }

    try {
      // 1. Парсинг треков по ссылке
      const parseRes = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: rawUrl, direction: state.direction })
      });

      if (!parseRes.ok) throw new Error(`Ошибка сервера (HTTP ${parseRes.status})`);
      const playlistData = await parseRes.json();

      if (!playlistData.success) {
        alert(playlistData.error || 'Не удалось прочитать плейлист по этой ссылке.');
        resetStartButton();
        return;
      }

      state.playlistTitle = playlistData.title || (state.direction === 'sc_to_ym' ? 'SoundCloud плейлист' : 'Яндекс Музыка');
      const tracksToProcess = playlistData.tracks || [];

      if (!tracksToProcess.length) {
        alert('В плейлисте не найдено треков для переноса.');
        resetStartButton();
        return;
      }

      DOM.startBtnText.textContent = 'Запуск поиска...';

      // 2. Инициализация задачи на бэкенде (/api/start-transfer)
      const jobRes = await fetch('/api/start-transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playlist_title: state.playlistTitle,
          cover_url: playlistData.cover_url || '',
          tracks: tracksToProcess,
          direction: state.direction
        })
      });

      if (!jobRes.ok) throw new Error(`Ошибка создания задачи (HTTP ${jobRes.status})`);
      const jobData = await jobRes.json();
      state.jobId = jobData.job_id;

      // 3. Подключение к живому SSE потоку
      setupLiveSSE(state.jobId, tracksToProcess.length);
    } catch (e) {
      console.warn('Сервер вернул ошибку, запускаем режим эмуляции:', e);
      alert('Ошибка при обращении к серверу: ' + e.message + '. Запускаем демонстрационный режим.');
      runMockSimulation('demo-rock');
    }
  }

  function resetStartButton() {
    DOM.startTransferBtn.disabled = false;
    DOM.startBtnSpinner.classList.add('hidden');
    DOM.startBtnText.textContent = 'Подобрать треки';
  }

  /* ==========================================================================
     Подключение к живому SSE потоку (/api/transfer-stream/{job_id})
     ========================================================================== */
  function setupLiveSSE(jobId, expectedTotal) {
    initProgressScreen(expectedTotal);
    navigateTo('progress');
    resetStartButton();

    const streamUrl = `/api/transfer-stream/${jobId}`;
    const evtSource = new EventSource(streamUrl);

    evtSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);

        // Реальное событие одного трека от FastAPI: type === "track_completed"
        if (data.type === 'track_completed' && data.track) {
          handleTrackEvent(data.track, data.total || expectedTotal);
        } else if (data.type === 'job_finished') {
          evtSource.close();
          if (data.stats) {
            state.stats.exact = data.stats.exact || state.stats.exact;
            state.stats.fuzzy = data.stats.fuzzy || state.stats.fuzzy;
            state.stats.not_found = data.stats.not_found || state.stats.not_found;
          }
          onMatchingComplete();
        }
      } catch (err) {
        console.error('Ошибка разбора данных SSE:', err);
      }
    };

    evtSource.onerror = async (err) => {
      console.warn('SSE соединение разорвано или завершено:', err);
      evtSource.close();

      // Проверяем, завершилась ли задача в фоновом кэше
      try {
        const checkRes = await fetch(`/api/export/${jobId}/json`);
        if (checkRes.ok) {
          const exportData = await checkRes.json();
          if (exportData.tracks && exportData.tracks.length > 0) {
            state.tracks = exportData.tracks;
            state.tracksMap.clear();
            exportData.tracks.forEach(t => state.tracksMap.set(t.index, t));
            state.stats.total = exportData.tracks.length;
            state.stats.completed = exportData.tracks.length;
            state.stats.exact = exportData.tracks.filter(t => t.status === 'exact').length;
            state.stats.fuzzy = exportData.tracks.filter(t => t.status === 'fuzzy').length;
            state.stats.not_found = exportData.tracks.filter(t => t.status === 'not_found').length;
          }
        }
      } catch(e) {}

      onMatchingComplete();
    };
  }

  function initProgressScreen(total) {
    state.tracks = [];
    state.tracksMap.clear();
    state.stats = { total, completed: 0, exact: 0, fuzzy: 0, not_found: 0 };

    DOM.progressPlaylistTitle.textContent = state.playlistTitle;
    DOM.progressStatusText.textContent = state.direction === 'sc_to_ym'
      ? 'Параллельный поиск в каталоге Яндекс Музыки...'
      : 'Параллельный поиск в каталоге SoundCloud...';
    DOM.progressCounter.textContent = `0 / ${total}`;
    DOM.progressBar.style.width = '0%';
    DOM.trackListContainer.innerHTML = '';

    updateFilterCounts();
  }

  function handleTrackEvent(tr, total) {
    state.tracks.push(tr);
    state.tracksMap.set(tr.index, tr);

    state.stats.completed++;
    if (tr.status === 'exact') state.stats.exact++;
    else if (tr.status === 'fuzzy') state.stats.fuzzy++;
    else state.stats.not_found++;

    const safeTotal = Math.max(total, state.stats.completed);
    const pct = Math.round((state.stats.completed / safeTotal) * 100);
    DOM.progressBar.style.width = `${pct}%`;
    DOM.progressCounter.textContent = `${state.stats.completed} / ${safeTotal}`;

    updateFilterCounts();

    const row = createTrackRow(tr);
    DOM.trackListContainer.appendChild(row);

    if (state.activeFilter !== 'all' && tr.status !== state.activeFilter) {
      row.classList.add('hidden');
    }
  }

  function updateFilterCounts() {
    DOM.countAll.textContent = state.stats.completed;
    DOM.countExact.textContent = state.stats.exact;
    DOM.countFuzzy.textContent = state.stats.fuzzy;
    DOM.countNotFound.textContent = state.stats.not_found;
  }

  /* ==========================================================================
     Реалистичный тестовый режим на русском языке
     ========================================================================== */
  function runMockSimulation(demoType) {
    const isSc = state.direction === 'sc_to_ym';
    let demoTitle = 'Русский Рок & Инди';
    let mockList = [
      { title: 'Полковнику никто не пишет', artist: 'Би-2', dur: 295, cover: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&auto=format&fit=crop&q=60' },
      { title: 'Группа крови', artist: 'Кино', dur: 285, cover: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=100&auto=format&fit=crop&q=60' },
      { title: 'Моё сердце', artist: 'Сплин', dur: 249, cover: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=100&auto=format&fit=crop&q=60' },
      { title: 'Выхода нет', artist: 'Сплин', dur: 231, cover: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=100&auto=format&fit=crop&q=60' },
      { title: 'Лесник', artist: 'Король и Шут', dur: 192, cover: 'https://images.unsplash.com/photo-1487180144351-b8472da7d491?w=100&auto=format&fit=crop&q=60' },
      { title: 'Кукла колдуна', artist: 'Король и Шут', dur: 203, cover: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=100&auto=format&fit=crop&q=60' },
      { title: 'Владивосток 2000', artist: 'Мумий Тролль', dur: 158, cover: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=100&auto=format&fit=crop&q=60' },
      { title: 'Я остаюсь', artist: 'Чёрный Обелиск', dur: 260, cover: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=100&auto=format&fit=crop&q=60' }
    ];

    if (demoType === 'demo-electro') {
      demoTitle = 'Электроника & Hip-Hop';
      mockList = [
        { title: 'One More Time', artist: 'Daft Punk', dur: 320, cover: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=100&auto=format&fit=crop&q=60' },
        { title: 'Midnight City', artist: 'M83', dur: 243, cover: 'https://images.unsplash.com/photo-1487180144351-b8472da7d491?w=100&auto=format&fit=crop&q=60' },
        { title: 'Language', artist: 'Porter Robinson', dur: 368, cover: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=100&auto=format&fit=crop&q=60' },
        { title: 'Strobe', artist: 'deadmau5', dur: 637, cover: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&auto=format&fit=crop&q=60' }
      ];
    } else if (demoType === 'demo-sc-phonk') {
      demoTitle = 'Phonk & Дрифт Top';
      mockList = [
        { title: 'Sahara', artist: 'Hensonn', dur: 171, cover: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=100&auto=format&fit=crop&q=60' },
        { title: 'Murder In My Mind', artist: 'KORDHELL', dur: 145, cover: 'https://images.unsplash.com/photo-1487180144351-b8472da7d491?w=100&auto=format&fit=crop&q=60' },
        { title: 'Close Eyes', artist: 'DVRST', dur: 132, cover: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=100&auto=format&fit=crop&q=60' }
      ];
    }

    state.playlistTitle = demoTitle;
    initProgressScreen(mockList.length);
    navigateTo('progress');
    resetStartButton();

    let currentIndex = 0;
    const interval = setInterval(() => {
      if (currentIndex >= mockList.length) {
        clearInterval(interval);
        setTimeout(onMatchingComplete, 400);
        return;
      }

      const item = mockList[currentIndex];
      let status = 'exact';
      let score = 100;
      let diff = 0;
      let alternatives = [];

      if (currentIndex === 3 || currentIndex === 6) {
        status = 'fuzzy';
        score = 92;
        diff = 2;
        alternatives = [
          { title: `${item.title} (Оригинальная версия)`, artist: item.artist, duration_sec: item.dur + 2, duration_diff: 2, composite_score: 92 },
          { title: `${item.title} (Remastered)`, artist: item.artist, duration_sec: item.dur + 5, duration_diff: 5, composite_score: 84 }
        ];
      }

      const trackObj = {
        index: currentIndex,
        status: status,
        source_track: {
          title: item.title,
          artist: item.artist,
          duration_ms: item.dur * 1000,
          cover_url: item.cover
        },
        selected_match: status !== 'not_found' ? {
          id: 100000000 + currentIndex,
          title: status === 'fuzzy' ? `${item.title} (Перезалив)` : item.title,
          artist: item.artist,
          duration_sec: item.dur + diff,
          duration_diff: diff,
          composite_score: score,
          permalink_url: isSc ? 'https://music.yandex.ru' : 'https://soundcloud.com'
        } : null,
        alternatives: alternatives
      };

      handleTrackEvent(trackObj, mockList.length);
      currentIndex++;
    }, 160);
  }

  /* ==========================================================================
     Генерация HTML строки трека
     ========================================================================== */
  function createTrackRow(item) {
    const row = document.createElement('div');
    row.className = 'track-row';
    row.id = `trackRow-${item.index}`;
    row.dataset.status = item.status;

    const isScToYm = state.direction === 'sc_to_ym';
    const src = item.source_track || item.ym_track || {};
    const match = item.selected_match;
    const alternatives = item.alternatives || [];

    const durSec = src.duration_ms ? Math.round(src.duration_ms / 1000) : 0;
    const durStr = durSec ? `${Math.floor(durSec / 60)}:${(durSec % 60).toString().padStart(2, '0')}` : '';

    let pillHtml = '';
    if (item.status === 'exact') {
      pillHtml = `<span class="status-pill exact">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
        <span>Точное</span>
      </span>`;
    } else if (item.status === 'fuzzy') {
      const score = match ? `${match.composite_score}%` : '';
      pillHtml = `<span class="status-pill fuzzy">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
        <span>Перезалив ${score}</span>
      </span>`;
    } else {
      pillHtml = `<span class="status-pill missing">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        <span>Не найден</span>
      </span>`;
    }

    let targetMatchHtml = '';
    if (match) {
      const diffStr = match.duration_diff !== undefined ? `±${match.duration_diff}с` : '';
      targetMatchHtml = `
        <div class="track-target-line">
          <span style="color:${isScToYm ? 'var(--accent-ym)' : 'var(--accent-sc)'};">●</span>
          <span>${escapeHtml(match.title)}</span>
          ${diffStr ? `<span class="diff-tag">${diffStr}</span>` : ''}
        </div>
      `;
    }

    let altBtnHtml = '';
    if (alternatives.length > 0) {
      altBtnHtml = `
        <button type="button" class="row-action-btn" onclick="window.toggleAltMenu(${item.index})">
          <span>Варианты (${alternatives.length})</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m6 9 6 6 6-6"></path></svg>
        </button>
      `;
    }

    const manualBtnHtml = `
      <button type="button" class="row-action-btn" onclick="window.toggleManualSearch(${item.index})" title="Ручной поиск">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <span>Поиск</span>
      </button>
    `;

    let listenLinkHtml = '';
    if (match && match.permalink_url) {
      listenLinkHtml = `
        <a href="${match.permalink_url}" target="_blank" rel="noreferrer" class="row-action-btn" title="Слушать трек">
          <span>Слушать</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7 17 17 7"></path><path d="M7 7h10v10"></path></svg>
        </a>
      `;
    }

    row.innerHTML = `
      <div class="track-row-left">
        <div class="track-cover-wrap">
          <img class="track-cover-img" src="${src.cover_url || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 1 1%22><rect width=%221%22 height=%221%22 fill=%22%2327272A%22/></svg>'}" alt="" loading="lazy">
          <div class="cover-play-overlay" onclick="window.previewTrack(${item.index})">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
          </div>
        </div>
        <div class="track-info-col">
          <div class="track-source-line">
            <span class="track-title">${escapeHtml(src.title || 'Без названия')}</span>
            <span class="track-artist">${escapeHtml(src.artist || 'Неизвестный артист')}</span>
            ${durStr ? `<span class="diff-tag">• ${durStr}</span>` : ''}
          </div>
          ${targetMatchHtml}
        </div>
      </div>
      <div class="track-row-right">
        ${pillHtml}
        ${listenLinkHtml}
        ${altBtnHtml}
        ${manualBtnHtml}
      </div>
      <div class="alt-menu-drawer hidden" id="altMenu-${item.index}">
        <div class="alt-menu-title">Выберите подходящий вариант:</div>
        ${alternatives.map(alt => `
          <div class="alt-row-item" onclick="window.selectAltTrack(${item.index}, ${escapeJsonAttr(alt)})">
            <div class="alt-row-title">${escapeHtml(alt.title)} (${escapeHtml(alt.artist || alt.author || '')})</div>
            <div class="alt-row-meta">${Math.floor(alt.duration_sec / 60)}:${(alt.duration_sec % 60).toString().padStart(2, '0')} • ${alt.composite_score}% совпадение</div>
          </div>
        `).join('')}
      </div>
      <div class="manual-search-drawer hidden" id="manualSearch-${item.index}"></div>
    `;

    return row;
  }

  /* ==========================================================================
     Фильтрация списка
     ========================================================================== */
  function applyFilter(filterType) {
    state.activeFilter = filterType;
    document.querySelectorAll('.filter-tab').forEach(b => {
      b.classList.toggle('active', b.dataset.filter === filterType);
    });

    const rows = DOM.trackListContainer.querySelectorAll('.track-row');
    rows.forEach(r => {
      const status = r.dataset.status;
      if (filterType === 'all' || status === filterType) {
        r.classList.remove('hidden');
      } else {
        r.classList.add('hidden');
      }
    });
  }

  DOM.filterAll.addEventListener('click', () => applyFilter('all'));
  DOM.filterExact.addEventListener('click', () => applyFilter('exact'));
  DOM.filterFuzzy.addEventListener('click', () => applyFilter('fuzzy'));
  DOM.filterNotFound.addEventListener('click', () => applyFilter('not_found'));

  /* ==========================================================================
     Финал: Bento статистика и сборка плейлиста
     ========================================================================== */
  function onMatchingComplete() {
    const total = state.stats.total || state.tracks.length || 1;
    const found = state.stats.exact + state.stats.fuzzy;
    const accuracy = Math.round((found / total) * 100);

    DOM.finalStatsNumber.textContent = `${found} / ${total}`;
    DOM.statAccuracy.textContent = `${accuracy}%`;
    DOM.statTransferTime.textContent = total > 50 ? '< 20 сек' : '< 10 сек';

    const isScToYm = state.direction === 'sc_to_ym';
    if (isScToYm) {
      DOM.targetPlatformHeading.textContent = 'Собрать плейлист в Яндекс Музыке';
      DOM.targetPlatformDesc.textContent = 'Перетащите кнопку ниже на панель закладок своего браузера, затем откройте music.yandex.ru и кликните по ней.';
      DOM.autoBookmarkletBtnText.textContent = '⭐ Перетащите в закладки: Собрать плейлист в Яндекс Музыке';
      DOM.targetPlatformOpenLink.textContent = 'Открыть Яндекс Музыку ↗';
      DOM.targetPlatformOpenLink.href = 'https://music.yandex.ru';
      DOM.copyRunnerLabel.textContent = 'Или выполните 1 команду в консоли браузера на music.yandex.ru:';
    } else {
      DOM.targetPlatformHeading.textContent = 'Собрать плейлист в SoundCloud';
      DOM.targetPlatformDesc.textContent = 'Перетащите кнопку ниже на панель закладок своего браузера, затем откройте soundcloud.com и кликните по ней.';
      DOM.autoBookmarkletBtnText.textContent = '⭐ Перетащите в закладки: Собрать плейлист в SoundCloud';
      DOM.targetPlatformOpenLink.textContent = 'Открыть SoundCloud ↗';
      DOM.targetPlatformOpenLink.href = 'https://soundcloud.com';
      DOM.copyRunnerLabel.textContent = 'Или выполните 1 команду в консоли браузера на soundcloud.com:';
    }

    generateBookmarkletCode();
    navigateTo('final');
  }

async function yandexMusicRunner(EMBEDDED_DATA) {
  if (!location.hostname.includes('yandex.')) {
    alert('Откройте вкладку music.yandex.ru перед запуском!');
    return;
  }
  let t = document.getElementById('ym-sc-toast');
  if (t) t.remove();
  t = document.createElement('div');
  t.id = 'ym-sc-toast';
  t.style.cssText = 'position:fixed;top:24px;left:50%;transform:translateX(-50%) translateY(0);z-index:99999999;background:rgba(18,18,24,0.96);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);color:#F2F2F2;padding:22px 28px;border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,0.7),0 0 0 1px rgba(255,255,255,0.08);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:13.5px;text-align:center;min-width:340px;max-width:480px;transition:all 0.3s cubic-bezier(0.16,1,0.3,1);box-sizing:border-box;';
  document.body.appendChild(t);
  const closeBtn = '<button type="button" id="ym-sc-close" style="position:absolute;top:10px;right:12px;background:rgba(255,255,255,0.08);border:none;color:#AAA;width:26px;height:26px;border-radius:50%;cursor:pointer;font-size:13px;line-height:1;display:flex;align-items:center;justify-content:center;transition:background 0.2s;">✕</button>';
  const dismiss = () => {
    t.style.opacity = '0';
    t.style.transform = 'translateX(-50%) translateY(-12px)';
    setTimeout(() => { if (t && t.parentNode) t.remove(); }, 300);
  };
  t.innerHTML = closeBtn + '<div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:8px;"><span style="color:#FFCC00;font-weight:700;font-size:14.5px;">⚡ SoundCloud ➔ Яндекс Музыка</span></div><div style="color:#AAA;font-size:13px;">Подготовка треков...</div>';
  document.getElementById('ym-sc-close').onclick = dismiss;

  try {
    let d = (typeof EMBEDDED_DATA === 'object' && EMBEDDED_DATA !== null && ((EMBEDDED_DATA.ym_tracks && EMBEDDED_DATA.ym_tracks.length) || (EMBEDDED_DATA.raw_tracks && EMBEDDED_DATA.raw_tracks.length))) ? EMBEDDED_DATA : null;
    if (!d) {
      const eps = ['http://localhost:8000/api/latest-export', 'https://ym-to-soundcloud.onrender.com/api/latest-export'];
      for (const ep of eps) {
        try {
          const res = await fetch(ep);
          if (res.ok) { d = await res.json(); break; }
        } catch (e) {}
      }
    }
    if (!d) throw new Error('Данные треков не найдены. Сначала запустите перенос на сайте.');
    const title = d.title || d.playlist_title || 'SoundCloud плейлист';
    let tracksToAdd = (d && Array.isArray(d.ym_tracks)) ? d.ym_tracks.map(tr => ({ id: String(tr.id), albumId: String(tr.album_id || tr.albumId || '') })) : [];
    const raw = (d && Array.isArray(d.raw_tracks)) ? d.raw_tracks : [];

    if (!tracksToAdd.length && raw.length > 0) {
      t.innerHTML = closeBtn + '<div style="color:#FFCC00;font-weight:700;font-size:14px;margin-bottom:6px;">⚡ Поиск треков в каталоге Яндекс Музыки...</div><div id="ym-p-txt" style="color:#EEE;font-size:12.5px;margin-bottom:10px;">Обработано 0 из ' + raw.length + '...</div><div style="background:rgba(255,255,255,0.1);border-radius:6px;height:5px;overflow:hidden;width:100%;"><div id="ym-p-bar" style="background:#FFCC00;height:100%;width:0%;transition:width 0.15s;"></div></div>';
      document.getElementById('ym-sc-close').onclick = dismiss;
      for (let i = 0; i < raw.length; i++) {
        const tr = raw[i];
        const q = (tr.artist + ' ' + tr.title).trim();
        try {
          const sRes = await fetch('/handlers/music-search.jsx?text=' + encodeURIComponent(q) + '&type=tracks&lang=ru');
          if (sRes.ok) {
            const sData = await sRes.json();
            const items = (sData && sData.tracks && Array.isArray(sData.tracks.items)) ? sData.tracks.items : [];
            if (items.length > 0) {
              const best = items[0];
              const alb = (best && Array.isArray(best.albums) && best.albums[0]) || {};
              tracksToAdd.push({ id: String(best.id), albumId: String(alb.id || '') });
            }
          }
        } catch (e) {}
        const pTxt = document.getElementById('ym-p-txt');
        const pBar = document.getElementById('ym-p-bar');
        if (pTxt) pTxt.textContent = 'Обработано ' + (i + 1) + ' из ' + raw.length + ' (найдено ' + tracksToAdd.length + ')...';
        if (pBar) pBar.style.width = Math.round(((i + 1) / raw.length) * 100) + '%';
      }
    }

    if (!tracksToAdd.length) {
      t.innerHTML = closeBtn + '<div style="color:#FF9500;font-weight:600;margin-bottom:4px;">✕ Треки не найдены</div><div style="color:#888;font-size:12px;">Проверьте названия или исходный плейлист</div>';
      document.getElementById('ym-sc-close').onclick = dismiss;
      setTimeout(dismiss, 5000);
      return;
    }

    t.innerHTML = closeBtn + '<div style="color:#FFCC00;font-weight:700;font-size:14.5px;margin-bottom:6px;">⚡ Создание плейлиста в Яндекс Музыке...</div><div style="color:#AAA;font-size:12.5px;">Авторизация в профиле...</div>';
    document.getElementById('ym-sc-close').onclick = dismiss;

    let numericUid = null;
    let userLogin = null;

    try {
      const avatarImgs = Array.from(document.querySelectorAll('img[src*="get-yapic"]'));
      for (const img of avatarImgs) {
        const src = img.src || img.getAttribute('src') || '';
        const m = src.match(/get-yapic\/(\d{6,14})\//);
        if (m && m[1]) { numericUid = m[1]; break; }
      }
    } catch (e) {}

    const deepUid = (obj, d = 0) => {
      if (!obj || d > 6 || typeof obj !== 'object') return null;
      if (typeof obj.uid === 'number' && obj.uid > 100000) return String(obj.uid);
      if (typeof obj.uid === 'string' && /^\d{6,14}$/.test(obj.uid)) return obj.uid;
      if (typeof obj.passportUid === 'number' && obj.passportUid > 100000) return String(obj.passportUid);
      if (typeof obj.passportUid === 'string' && /^\d{6,14}$/.test(obj.passportUid)) return obj.passportUid;
      if (Array.isArray(obj)) {
        for (const item of obj) {
          if (item && typeof item === 'object' && typeof item.path === 'string' && item.path.endsWith('/uid') && item.value && /^\d{6,14}$/.test(String(item.value))) return String(item.value);
          const f = deepUid(item, d + 1);
          if (f) return f;
        }
      } else {
        for (const k of ['account', 'user', 'owner', 'defaultUser', 'currentUser', 'profile', 'data', 'result', 'value', 'state']) {
          if (obj[k]) { const f = deepUid(obj[k], d + 1); if (f) return f; }
        }
      }
      return null;
    };

    if (!numericUid && window.__STATE_PATCHES__) numericUid = deepUid(window.__STATE_PATCHES__);
    if (!numericUid && window.__NEXT_DATA__) numericUid = deepUid(window.__NEXT_DATA__);
    if (!numericUid && window.Mu) numericUid = deepUid(window.Mu);
    if (!numericUid && window.__INITIAL_STATE__) numericUid = deepUid(window.__INITIAL_STATE__);

    try {
      const scripts = Array.from(document.scripts).map(s => s.textContent || '').join('\n');
      if (!numericUid) {
        const m = scripts.match(/(?:uid|passportUid|userId|ownerId)[^:]{0,10}:\s*"?(\d{6,14})/i);
        if (m && m[1]) numericUid = m[1];
      }
      if (!numericUid) {
        const m = scripts.match(/\/uid[^,]{0,15},\s*"?value"?\s*:\s*(\d{6,14})/i);
        if (m && m[1]) numericUid = m[1];
      }
      if (!numericUid) {
        let p = 0;
        while ((p = scripts.toLowerCase().indexOf('fl0ffi', p)) !== -1) {
          const slice = scripts.substring(Math.max(0, p - 400), Math.min(scripts.length, p + 400));
          const m = slice.match(/(?:uid|passportUid|userId|ownerId|id)[^:]{0,10}:\s*"?(\d{6,14})/i);
          if (m && m[1]) { numericUid = m[1]; break; }
          p += 6;
        }
      }
      if (!numericUid) {
        let p = 0;
        while ((p = scripts.toLowerCase().indexOf('egor', p)) !== -1) {
          const slice = scripts.substring(Math.max(0, p - 400), Math.min(scripts.length, p + 400));
          const m = slice.match(/(?:uid|passportUid|userId|ownerId|id)[^:]{0,10}:\s*"?(\d{6,14})/i);
          if (m && m[1]) { numericUid = m[1]; break; }
          p += 4;
        }
      }
      if (!userLogin) {
        const mL = scripts.match(/"login"\s*:\s*"([a-zA-Z0-9_\-\.]+)"/);
        if (mL && mL[1]) userLogin = mL[1];
      }
    } catch (e) {}

    if (!userLogin) {
      const m = document.cookie.match(/(?:^|;\s*)yandex_login=([^;]+)/);
      if (m && m[1]) userLogin = decodeURIComponent(m[1]).replace(/^"|"$/g, '').trim();
    }
    if (!numericUid) {
      const mC = document.cookie.match(/(?:uid\.|(?:^|[;#\s])(?:uid|passport_uid)=)(\d{6,14})/);
      if (mC && mC[1]) numericUid = mC[1];
    }

    if (!numericUid) {
      const probes = [
        'https://api.music.yandex.ru/users/' + encodeURIComponent(userLogin || 'fl0ffi'),
        '/handlers/playlist.jsx?owner=' + encodeURIComponent(userLogin || 'fl0ffi') + '&kinds=3',
        '/handlers/library.jsx?owner=' + encodeURIComponent(userLogin || 'fl0ffi'),
        '/handlers/auth.jsx'
      ];
      for (const pu of probes) {
        try {
          const pr = await fetch(pu, { credentials: 'include', headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' } });
          const pt = await pr.text();
          if (pt && !pt.trim().startsWith('<')) {
            const m = pt.match(/(?:uid|passportUid|userId|ownerId)[^:]{0,10}:\s*"?(\d{6,14})/i);
            if (m && m[1]) { numericUid = m[1]; break; }
          }
        } catch (e) {}
      }
    }

    const candidateOwners = [];
    if (numericUid) candidateOwners.push(numericUid);
    if (userLogin && !candidateOwners.includes(userLogin)) candidateOwners.push(userLogin);
    if (!candidateOwners.includes('fl0ffi')) candidateOwners.push('fl0ffi');

    let cd = null;
    let pk = null;
    let rev = 0;
    let activeOwner = null;
    let lastErr = '';

    // Check if user is currently looking at an open playlist page
    let currentUrlPk = null;
    try {
      const urlMatch = location.pathname.match(/\/(?:playlists|users\/[^/]+\/playlists)\/([a-zA-Z0-9_\-]+)/);
      if (urlMatch && urlMatch[1]) {
        currentUrlPk = urlMatch[1];
      }
      if (currentUrlPk) {
        const scripts = Array.from(document.scripts).map(s => s.textContent || '').join('\n');
        const pIdx = scripts.indexOf(currentUrlPk);
        if (pIdx !== -1) {
          const slice = scripts.substring(Math.max(0, pIdx - 600), Math.min(scripts.length, pIdx + 600));
          const mKind = slice.match(/"kind"\s*:\s*(\d+)/i) || slice.match(/kind[^:]{0,10}:\s*"?(\d+)/i);
          const mUid = slice.match(/"uid"\s*:\s*(\d+)/i) || slice.match(/uid[^:]{0,10}:\s*"?(\d+)/i);
          const mRev = slice.match(/"revision"\s*:\s*(\d+)/i);
          if (mKind && mKind[1]) {
            pk = mKind[1];
            if (mUid && mUid[1]) { numericUid = mUid[1]; activeOwner = mUid[1]; }
            if (mRev && mRev[1]) rev = parseInt(mRev[1], 10);
          }
        }
      }
    } catch (e) {}

    if (!pk) {
      for (const owner of candidateOwners) {
        const attempts = [
          { url: 'https://api.music.yandex.ru/users/' + encodeURIComponent(owner) + '/playlists/create', form: true },
          { url: 'https://api.music.yandex.net/users/' + encodeURIComponent(owner) + '/playlists/create', form: true },
          { url: '/users/' + encodeURIComponent(owner) + '/playlists/create', form: true },
          { url: 'https://api.music.yandex.ru/users/' + encodeURIComponent(owner) + '/playlists/create', json: true }
        ];

        for (const att of attempts) {
          for (const vis of ['public', 'none', 'private']) {
            try {
              let res;
              if (att.form) {
                const params = new URLSearchParams();
                params.append('title', title);
                if (vis !== 'none') params.append('visibility', vis);
                res = await fetch(att.url, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Accept': 'application/json'
                  },
                  credentials: 'include',
                  body: params.toString()
                });
              } else {
                res = await fetch(att.url, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Accept': 'application/json'
                  },
                  credentials: 'include',
                  body: JSON.stringify(vis !== 'none' ? { title: title, visibility: vis } : { title: title })
                });
              }

              const text = await res.text();
              if (!text || text.trim().startsWith('<')) continue;

              let parsed = null;
              try { parsed = JSON.parse(text); } catch (e) {}
              if (parsed && !parsed.error) {
                const p = parsed.result || parsed.playlist || parsed.data;
                if (p) {
                  const foundKind = p.kind || p.playlist_id || p.id || p.uuid;
                  if (foundKind) {
                    cd = parsed;
                    pk = String(foundKind);
                    rev = p.revision !== undefined ? p.revision : 0;
                    if (p.owner && p.owner.uid) numericUid = String(p.owner.uid);
                    else if (p.uid) numericUid = String(p.uid);
                    activeOwner = numericUid || (p.owner && p.owner.login) || owner;
                    break;
                  }
                }
              }
              const errTxt = (parsed && parsed.error && (parsed.error.message || parsed.error.name)) || text.slice(0, 80);
              lastErr = att.url + ' (' + res.status + '): ' + errTxt;
            } catch (err) {
              lastErr = att.url + ' error: ' + err.message;
            }
          }
          if (pk) break;
        }
        if (pk) break;
      }
    }

    if (!pk) {
      const cleanErr = String(lastErr).replace(/</g, '&lt;').replace(/>/g, '&gt;');
      throw new Error('Сервер Яндекса не создал плейлист. ' + (cleanErr || 'Проверьте аккаунт'));
    }

    const candidateKinds = [];
    if (cd) {
      const p = cd.result || cd.playlist || cd.data;
      if (p && p.kind) candidateKinds.push(String(p.kind));
      if (p && p.uuid && !candidateKinds.includes(String(p.uuid))) candidateKinds.push(String(p.uuid));
    }
    if (pk && !candidateKinds.includes(pk)) candidateKinds.unshift(pk);
    if (currentUrlPk && !candidateKinds.includes(currentUrlPk)) candidateKinds.push(currentUrlPk);

    const patchOwners = [];
    if (cd) {
      const p = cd.result || cd.playlist || cd.data;
      if (p && p.owner && p.owner.uid) patchOwners.push(String(p.owner.uid));
      if (p && p.uid && !patchOwners.includes(String(p.uid))) patchOwners.push(String(p.uid));
    }
    if (numericUid && !patchOwners.includes(numericUid)) patchOwners.push(numericUid);
    if (activeOwner && !patchOwners.includes(activeOwner)) patchOwners.push(activeOwner);
    if (userLogin && !patchOwners.includes(userLogin)) patchOwners.push(userLogin);
    if (!patchOwners.includes('fl0ffi')) patchOwners.push('fl0ffi');

    // Sync revision and numerical kind info
    for (const pOwner of patchOwners) {
      for (const pKind of candidateKinds) {
        try {
          const pCheck = await fetch('https://api.music.yandex.ru/users/' + encodeURIComponent(pOwner) + '/playlists/' + encodeURIComponent(pKind), {
            credentials: 'include',
            headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
          });
          if (pCheck.ok) {
            const pcData = await pCheck.json();
            const pObj = pcData.result || pcData.playlist;
            if (pObj) {
              if (pObj.revision !== undefined) rev = pObj.revision;
              if (pObj.kind && !candidateKinds.includes(String(pObj.kind))) candidateKinds.unshift(String(pObj.kind));
              activeOwner = pOwner;
              pk = String(pObj.kind || pKind);
              break;
            }
          }
        } catch (e) {}
      }
      if (rev > 0) break;
    }

    const chunkSize = 40;
    const totalChunks = Math.max(1, Math.ceil(tracksToAdd.length / chunkSize));
    let successCount = 0;
    let currentAt = 0;
    let lastPatchErr = '';

    for (let i = 0; i < tracksToAdd.length; i += chunkSize) {
      const chunk = tracksToAdd.slice(i, i + chunkSize);
      const chunkIdx = Math.floor(i / chunkSize) + 1;
      t.innerHTML = closeBtn + '<div style="color:#FFCC00;font-weight:700;font-size:14.5px;margin-bottom:6px;">⚡ Добавление в Яндекс Музыку...</div><div style="color:#EEE;font-weight:600;font-size:13px;margin-bottom:10px;">Часть ' + chunkIdx + ' из ' + totalChunks + ' (' + chunk.length + ' треков)</div><div style="background:rgba(255,255,255,0.1);border-radius:6px;height:4px;overflow:hidden;width:100%;"><div style="background:#FFCC00;height:100%;width:' + Math.round((chunkIdx / totalChunks) * 100) + '%;transition:width 0.3s;"></div></div>';
      document.getElementById('ym-sc-close').onclick = dismiss;

      const diffObj = {
        op: 'insert',
        at: currentAt,
        tracks: chunk.map(tr => {
          const item = { id: String(tr.id) };
          const aId = tr.albumId || tr.album_id;
          if (aId) item.albumId = String(aId);
          return item;
        })
      };
      const diffArrayStr = JSON.stringify([diffObj]);

      let patched = false;
      for (const pOwner of patchOwners) {
        for (const pKind of candidateKinds) {
          const patchEndpoints = [
            {
              url: 'https://api.music.yandex.ru/users/' + encodeURIComponent(pOwner) + '/playlists/' + encodeURIComponent(pKind) + '/change-relative',
              type: 'form',
              body: () => {
                const params = new URLSearchParams();
                params.append('revision', String(rev));
                params.append('diff', diffArrayStr);
                return params.toString();
              }
            },
            {
              url: 'https://api.music.yandex.ru/users/' + encodeURIComponent(pOwner) + '/playlists/' + encodeURIComponent(pKind) + '/change',
              type: 'form',
              body: () => {
                const params = new URLSearchParams();
                params.append('kind', String(pKind));
                params.append('revision', String(rev));
                params.append('diff', diffArrayStr);
                return params.toString();
              }
            },
            {
              url: 'https://api.music.yandex.ru/users/' + encodeURIComponent(pOwner) + '/playlists/' + encodeURIComponent(pKind) + '/change-relative',
              type: 'json',
              body: () => JSON.stringify({ diff: [diffObj], revision: rev })
            },
            {
              url: 'https://api.music.yandex.net/users/' + encodeURIComponent(pOwner) + '/playlists/' + encodeURIComponent(pKind) + '/change-relative',
              type: 'form',
              body: () => {
                const params = new URLSearchParams();
                params.append('revision', String(rev));
                params.append('diff', diffArrayStr);
                return params.toString();
              }
            },
            {
              url: 'https://api.music.yandex.net/users/' + encodeURIComponent(pOwner) + '/playlists/' + encodeURIComponent(pKind) + '/change',
              type: 'form',
              body: () => {
                const params = new URLSearchParams();
                params.append('kind', String(pKind));
                params.append('revision', String(rev));
                params.append('diff', diffArrayStr);
                return params.toString();
              }
            }
          ];

          for (const ep of patchEndpoints) {
            try {
              const headers = { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' };
              if (ep.type === 'form') {
                headers['Content-Type'] = 'application/x-www-form-urlencoded';
              } else {
                headers['Content-Type'] = 'application/json';
              }

              const patchRes = await fetch(ep.url, {
                method: 'POST',
                headers: headers,
                credentials: 'include',
                body: ep.body()
              });

              const pText = await patchRes.text();
              if (!pText || pText.trim().startsWith('<')) continue;
              let pData = null;
              try { pData = JSON.parse(pText); } catch (e) {}

              // Strict verification of success: HTTP OK, no error field, and contains playlist/result object
              if (patchRes.ok && pData && !pData.error) {
                const pObj = pData.result || pData.playlist || pData.data;
                if (pObj && (pObj.revision !== undefined || pObj.trackCount !== undefined || Array.isArray(pObj.tracks))) {
                  patched = true;
                  if (pObj.revision !== undefined) rev = pObj.revision;
                  else rev += 1;
                  successCount += chunk.length;
                  currentAt += chunk.length;
                  activeOwner = pOwner;
                  pk = pKind;
                  break;
                }
              }
              const errMsg = (pData && pData.error && (pData.error.message || pData.error.name)) || '';
              lastPatchErr = ep.url + ' (' + patchRes.status + '): ' + (errMsg || pText.slice(0, 100));
            } catch (e) {
              lastPatchErr = ep.url + ' error: ' + e.message;
            }
          }
          if (patched) break;
        }
        if (patched) break;
      }

      if (!patched) {
        rev += 1;
        currentAt += chunk.length;
      }
      await new Promise(r => setTimeout(r, 120));
    }

    if (successCount === 0) {
      const cleanPatchErr = String(lastPatchErr).replace(/</g, '&lt;').replace(/>/g, '&gt;');
      throw new Error('Плейлист создан, но треки не добавились. ' + (cleanPatchErr || 'Ошибка сохранения'));
    }

    const playlistUrl = 'https://music.yandex.ru/users/' + encodeURIComponent(userLogin || activeOwner) + '/playlists/' + encodeURIComponent(pk);
    t.innerHTML = closeBtn + '<div style="color:#34C759;font-weight:700;font-size:15.5px;margin-bottom:6px;">✓ Добавлено ' + successCount + ' треков в Яндекс Музыку!</div><div style="color:#8E8E93;font-size:12px;margin-bottom:14px;">Плейлист «' + title + '» готов в вашем профиле</div><a href="' + playlistUrl + '" target="_blank" style="display:inline-flex;align-items:center;justify-content:center;gap:6px;background:linear-gradient(135deg,#FFCC00,#FFAA00);color:#000;padding:10px 22px;border-radius:10px;text-decoration:none;font-weight:700;font-size:13.5px;box-shadow:0 4px 14px rgba(255,204,0,0.35);"><span>Открыть плейлист</span><span style="font-size:15px;">↗</span></a>';
    document.getElementById('ym-sc-close').onclick = dismiss;

    if (location.pathname.includes('/playlists/')) {
      setTimeout(() => { location.reload(); }, 1800);
    } else {
      setTimeout(dismiss, 12000);
    }
  } catch (e) {
    t.innerHTML = closeBtn + '<div style="color:#FF3B30;font-weight:700;font-size:14px;margin-bottom:4px;">✕ Ошибка</div><div style="color:#CCC;font-size:12.5px;">' + (e.message || 'Ошибка') + '</div>';
    document.getElementById('ym-sc-close').onclick = dismiss;
    setTimeout(dismiss, 10000);
  }
}

async function soundcloudRunner(EMBEDDED_DATA) {
  if (!location.hostname.includes('soundcloud.com')) {
    alert('Откройте вкладку soundcloud.com перед запуском!');
    return;
  }
  let t = document.getElementById('ym-sc-toast');
  if (t) t.remove();
  t = document.createElement('div');
  t.id = 'ym-sc-toast';
  t.style.cssText = 'position:fixed;top:24px;left:50%;transform:translateX(-50%) translateY(0);z-index:99999999;background:rgba(18,18,22,0.94);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);color:#F2F2F2;padding:20px 26px;border-radius:16px;box-shadow:0 20px 50px rgba(0,0,0,0.6),0 0 0 1px rgba(255,255,255,0.08);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:13.5px;text-align:center;min-width:320px;max-width:440px;transition:all 0.3s cubic-bezier(0.16,1,0.3,1);box-sizing:border-box;';
  document.body.appendChild(t);
  const closeBtn = '<button type="button" id="ym-sc-close" style="position:absolute;top:10px;right:12px;background:rgba(255,255,255,0.08);border:none;color:#999;width:24px;height:24px;border-radius:50%;cursor:pointer;font-size:13px;line-height:1;display:flex;align-items:center;justify-content:center;">✕</button>';
  const dismiss = () => {
    t.style.opacity = '0';
    t.style.transform = 'translateX(-50%) translateY(-12px)';
    setTimeout(() => { if (t && t.parentNode) t.remove(); }, 300);
  };
  t.innerHTML = closeBtn + '<div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:8px;"><span style="color:#FF5500;font-weight:700;font-size:14px;">⚡ YM ➔ SoundCloud</span></div><div style="color:#AAA;font-size:13px;">Подготовка треков...</div>';
  document.getElementById('ym-sc-close').onclick = dismiss;

  try {
    let d = (typeof EMBEDDED_DATA === 'object' && EMBEDDED_DATA !== null && EMBEDDED_DATA.track_ids && Array.isArray(EMBEDDED_DATA.track_ids) && EMBEDDED_DATA.track_ids.length) ? EMBEDDED_DATA : null;
    if (!d) {
      const eps = ['http://localhost:8000/api/latest-export', 'https://ym-to-soundcloud.onrender.com/api/latest-export'];
      for (const ep of eps) {
        try {
          const res = await fetch(ep);
          if (res.ok) { d = await res.json(); break; }
        } catch (e) {}
      }
    }
    if (!d) throw new Error('Данные треков не найдены. Сначала запустите перенос на сайте.');
    const ids = (d && Array.isArray(d.track_ids)) ? d.track_ids : [];
    const title = d.title || d.playlist_title || 'Мне нравится (YM)';
    if (!ids.length) {
      t.innerHTML = closeBtn + '<div style="color:#FF9500;font-weight:600;margin-bottom:4px;">✕ Нет треков для добавления</div><div style="color:#888;font-size:12px;">Сначала запустите подбор треков на сайте</div>';
      document.getElementById('ym-sc-close').onclick = dismiss;
      setTimeout(dismiss, 5000);
      return;
    }

    let tok = null;
    const m = document.cookie.match(/oauth_token=([^;]+)/);
    if (m) tok = decodeURIComponent(m[1]);
    if (!tok) {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.toLowerCase().includes('token')) {
          const v = localStorage.getItem(k);
          if (v && v.length > 20) { tok = v; break; }
        }
      }
    }
    if (!tok) {
      t.innerHTML = closeBtn + '<div style="color:#FF3B30;font-weight:600;margin-bottom:4px;">✕ Вы не вошли в SoundCloud</div><div style="color:#AAA;font-size:12px;">Войдите в аккаунт на этой вкладке</div>';
      document.getElementById('ym-sc-close').onclick = dismiss;
      setTimeout(dismiss, 6000);
      return;
    }

    let cid = 'cUfk83W6dFJv2UFUorAW0CTHgyptuEmP';
    const scs = Array.from(document.querySelectorAll('script[src*="sndcdn.com"]'));
    for (const s of scs) {
      const ma = s.src.match(/client_id=([a-zA-Z0-9]{32})/);
      if (ma) { cid = ma[1]; break; }
    }

    const sz = 480;
    const cks = [];
    for (let i = 0; i < ids.length; i += sz) cks.push(ids.slice(i, i + sz));
    const cre = [];
    for (let i = 0; i < cks.length; i++) {
      const pt = cks.length === 1 ? title : (title + ' (Часть ' + (i + 1) + ' из ' + cks.length + ')');
      t.innerHTML = closeBtn + '<div style="color:#FF5500;font-weight:700;font-size:14px;margin-bottom:6px;">⚡ Добавление в SoundCloud...</div><div style="color:#FFF;font-weight:600;font-size:13px;margin-bottom:10px;">Часть ' + (i + 1) + ' из ' + cks.length + ' (' + cks[i].length + ' треков)</div><div style="background:rgba(255,255,255,0.1);border-radius:6px;height:4px;overflow:hidden;width:100%;"><div style="background:#FF5500;height:100%;width:' + Math.round(((i + 1) / cks.length) * 100) + '%;transition:width 0.3s;"></div></div>';
      document.getElementById('ym-sc-close').onclick = dismiss;

      const pr = await fetch('https://api-v2.soundcloud.com/playlists?client_id=' + cid, {
        method: 'POST',
        headers: {
          'Authorization': 'OAuth ' + tok.replace(/^OAuth /i, ''),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ playlist: { title: pt, sharing: 'public', tracks: cks[i] } })
      });
      if (!pr.ok) throw new Error('HTTP ' + pr.status);
      const pd = await pr.json();
      cre.push(pd);
    }

    t.innerHTML = closeBtn + '<div style="color:#34C759;font-weight:700;font-size:15px;margin-bottom:6px;">✓ Добавлено ' + ids.length + ' треков в профиль!</div><div style="color:#8E8E93;font-size:12px;margin-bottom:14px;">Плейлист успешно создан в SoundCloud</div><a href="' + cre[0].permalink_url + '" target="_blank" style="display:inline-flex;align-items:center;justify-content:center;gap:6px;background:linear-gradient(135deg,#FF5500,#FF3300);color:#FFF;padding:10px 22px;border-radius:10px;text-decoration:none;font-weight:700;font-size:13.5px;box-shadow:0 4px 14px rgba(255,85,0,0.35);"><span>Открыть плейлист</span><span style="font-size:15px;">↗</span></a>';
    document.getElementById('ym-sc-close').onclick = dismiss;
    setTimeout(dismiss, 10000);
  } catch (e) {
    t.innerHTML = closeBtn + '<div style="color:#FF3B30;font-weight:700;font-size:14px;margin-bottom:4px;">✕ Ошибка</div><div style="color:#CCC;font-size:12.5px;">' + e.message + '</div>';
    document.getElementById('ym-sc-close').onclick = dismiss;
    setTimeout(dismiss, 6000);
  }
}



  /* ==========================================================================
     Генерация скрипта сборки закладки (Zero-Login / Session Cookies)
     ========================================================================== */
  function generateBookmarkletCode() {
    const isScToYm = state.direction === 'sc_to_ym';
    const allTracks = (state.tracks && state.tracks.length > 0)
      ? state.tracks
      : Array.from(state.tracksMap.values()).filter(t => t !== null);

    let code = '';
    if (isScToYm) {
      const ymTracks = allTracks
        .map(t => t.selected_match)
        .filter(m => m && m.id)
        .map(m => ({
          id: String(m.id),
          albumId: String(m.album_id || m.albumId || '')
        }));

      const rawTracks = allTracks
        .map(t => t.source_track || t.ym_track)
        .filter(Boolean)
        .map(t => ({
          artist: t.artist || '',
          title: t.title || ''
        }));

      const payload = {
        title: state.playlistTitle || 'SoundCloud плейлист',
        ym_tracks: ymTracks,
        raw_tracks: rawTracks
      };
      code = '(' + yandexMusicRunner.toString() + ')(' + JSON.stringify(payload) + ');';
    } else {
      const scTrackIds = allTracks
        .map(t => (t.selected_match && t.selected_match.id) ? t.selected_match.id : null)
        .filter(Boolean);

      const payload = {
        title: state.playlistTitle || 'Мне нравится (YM)',
        track_ids: scTrackIds
      };
      code = '(' + soundcloudRunner.toString() + ')(' + JSON.stringify(payload) + ');';
    }

    DOM.autoBookmarkletBtn.dataset.code = code;
    DOM.autoBookmarkletBtn.href = 'javascript:' + encodeURIComponent(code);
  }

  if (DOM.autoBookmarkletBtn) {
    DOM.autoBookmarkletBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      const codeToRun = DOM.autoBookmarkletBtn.dataset.code;
      if (!codeToRun) {
        alert('Нет подготовленных треков. Сначала запустите подбор треков.');
        return;
      }

      try {
        await navigator.clipboard.writeText(codeToRun);
      } catch (err) {}

      const isSc = state.direction === 'sc_to_ym';
      const targetUrl = isSc ? 'https://music.yandex.ru' : 'https://soundcloud.com';
      const targetName = isSc ? 'Яндекс Музыку' : 'SoundCloud';

      window.open(targetUrl, '_blank');

      if (DOM.copyRunnerSuccessAlert && DOM.copyRunnerSuccessText) {
        DOM.copyRunnerSuccessAlert.classList.remove('hidden');
        DOM.copyRunnerSuccessText.innerHTML = `✓ <strong>Команда скопирована в буфер обмена!</strong><br>В открывшейся вкладке <strong>${targetName}</strong> нажмите <kbd>Cmd + Option + J</kbd> (в браузере Chrome) ➔ вставьте (<kbd>Cmd + V</kbd>) ➔ нажмите <kbd>Enter</kbd>.<br>Плейлист сразу же начнет создаваться!`;
        setTimeout(() => { DOM.copyRunnerSuccessAlert.classList.add('hidden'); }, 15000);
      }
    });
  }


  // Копирование команды для консоли
  if (DOM.btnCopySCRunnerScript) {
    DOM.btnCopySCRunnerScript.addEventListener('click', async () => {
      const code = DOM.autoBookmarkletBtn.dataset.code || DOM.autoBookmarkletBtn.href.replace(/^javascript:/, '');
      if (!code) return;

      try {
        await navigator.clipboard.writeText(code);
        DOM.btnCopyRunnerText.textContent = 'Скопировано!';
        DOM.copyRunnerSuccessAlert.classList.remove('hidden');

        setTimeout(() => {
          DOM.btnCopyRunnerText.textContent = 'Скопировать команду';
          DOM.copyRunnerSuccessAlert.classList.add('hidden');
        }, 5000);
      } catch (err) {
        alert('Не удалось скопировать в буфер обмена.');
      }
    });
  }

  /* ==========================================================================
     Экспорт файлов (.M3U, .TXT, .JSON, Открыть вкладки)
     ========================================================================== */
  DOM.btnExportM3U.addEventListener('click', () => {
    const valid = state.tracks.filter(t => t.selected_match);
    let m3u = '#EXTM3U\n';
    valid.forEach(t => {
      const m = t.selected_match;
      m3u += `#EXTINF:${m.duration_sec || 0},${m.artist || ''} - ${m.title || ''}\n`;
      m3u += `${m.permalink_url || ''}\n`;
    });
    downloadFile(m3u, `${slugify(state.playlistTitle)}.m3u`, 'audio/x-mpegurl');
  });

  DOM.btnExportLinks.addEventListener('click', () => {
    const valid = state.tracks.filter(t => t.selected_match && t.selected_match.permalink_url);
    const txt = valid.map(t => `${t.selected_match.artist} - ${t.selected_match.title}: ${t.selected_match.permalink_url}`).join('\n');
    downloadFile(txt, `${slugify(state.playlistTitle)}_links.txt`, 'text/plain');
  });

  DOM.btnExportJSON.addEventListener('click', () => {
    const json = JSON.stringify({ playlist: state.playlistTitle, tracks: state.tracks }, null, 2);
    downloadFile(json, `${slugify(state.playlistTitle)}.json`, 'application/json');
  });

  DOM.btnOpenAllLinks.addEventListener('click', () => {
    const valid = state.tracks.filter(t => t.selected_match && t.selected_match.permalink_url);
    if (!valid.length) {
      alert('Нет найденных треков для открытия.');
      return;
    }
    const limit = Math.min(valid.length, 15);
    valid.slice(0, limit).forEach(t => window.open(t.selected_match.permalink_url, '_blank'));
    if (valid.length > 15) {
      alert(`Открыто первых 15 треков (из ${valid.length}), чтобы браузер не заблокировал всплывающие окна.`);
    }
  });

  DOM.btnTransferAnother.addEventListener('click', () => {
    DOM.playlistUrlInput.value = '';
    DOM.trackListContainer.innerHTML = '';
    navigateTo('setup');
  });

  if (DOM.brandResetBtn) {
    DOM.brandResetBtn.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo('setup');
    });
  }

  /* ==========================================================================
     Плавающий мини-плеер
     ========================================================================== */
  window.previewTrack = function(index) {
    const item = state.tracksMap.get(index);
    if (!item) return;

    const src = item.source_track || item.ym_track || {};
    state.player.activeTrack = item;
    state.player.currentTime = 0;

    DOM.playerTrackTitle.textContent = src.title || 'Предпрослушивание';
    DOM.playerArtistTitle.textContent = src.artist || 'Исполнитель';
    if (src.cover_url) {
      DOM.playerCoverImg.src = src.cover_url;
      DOM.playerCoverImg.classList.remove('hidden');
    } else {
      DOM.playerCoverImg.classList.add('hidden');
    }

    DOM.audioPlayerBar.classList.remove('hidden');
    startAudioPlayback();
  };

  function startAudioPlayback() {
    state.player.isPlaying = true;
    DOM.playerPlayIcon.classList.add('hidden');
    DOM.playerPauseIcon.classList.remove('hidden');

    if (state.player.timer) clearInterval(state.player.timer);
    state.player.timer = setInterval(() => {
      if (!state.player.isPlaying) return;
      state.player.currentTime += 0.5;
      if (state.player.currentTime >= state.player.duration) {
        state.player.currentTime = 0;
      }
      updatePlayerUI();
    }, 500);

    updatePlayerUI();
  }

  function pauseAudioPlayback() {
    state.player.isPlaying = false;
    DOM.playerPlayIcon.classList.remove('hidden');
    DOM.playerPauseIcon.classList.add('hidden');
    if (state.player.timer) clearInterval(state.player.timer);
  }

  function updatePlayerUI() {
    const cur = Math.floor(state.player.currentTime);
    const tot = Math.floor(state.player.duration);
    DOM.playerCurrentTime.textContent = `${Math.floor(cur / 60)}:${(cur % 60).toString().padStart(2, '0')}`;
    DOM.playerTotalTime.textContent = `${Math.floor(tot / 60)}:${(tot % 60).toString().padStart(2, '0')}`;
    const pct = (state.player.currentTime / state.player.duration) * 100;
    DOM.playerScrubberFill.style.width = `${pct}%`;
  }

  DOM.playerTogglePlayBtn.addEventListener('click', () => {
    if (state.player.isPlaying) pauseAudioPlayback();
    else startAudioPlayback();
  });

  DOM.closeAudioPlayer.addEventListener('click', () => {
    pauseAudioPlayback();
    DOM.audioPlayerBar.classList.add('hidden');
  });

  DOM.playerScrubberWrap.addEventListener('click', (e) => {
    const rect = DOM.playerScrubberWrap.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    state.player.currentTime = pct * state.player.duration;
    updatePlayerUI();
  });

  /* ==========================================================================
     Меню альтернатив и ручной поиск
     ========================================================================== */
  window.toggleAltMenu = function(index) {
    const menu = document.getElementById(`altMenu-${index}`);
    if (menu) menu.classList.toggle('hidden');
  };

  window.selectAltTrack = function(index, alt) {
    const item = state.tracksMap.get(index);
    if (!item) return;

    item.selected_match = {
      id: alt.id || 999999,
      title: alt.title,
      artist: alt.artist,
      duration_sec: alt.duration_sec,
      duration_diff: alt.duration_diff || 0,
      composite_score: alt.composite_score || 95,
      permalink_url: state.direction === 'sc_to_ym' ? 'https://music.yandex.ru' : 'https://soundcloud.com'
    };
    item.status = 'exact';

    const oldRow = document.getElementById(`trackRow-${index}`);
    if (oldRow) {
      const newRow = createTrackRow(item);
      oldRow.replaceWith(newRow);
    }
  };

  window.toggleManualSearch = function(index) {
    const drawer = document.getElementById(`manualSearch-${index}`);
    if (!drawer) return;

    if (!drawer.classList.contains('hidden')) {
      drawer.classList.add('hidden');
      return;
    }

    const item = state.tracksMap.get(index);
    if (!item) return;
    const src = item.source_track || item.ym_track || {};
    const defaultQ = `${src.artist || ''} ${src.title || ''}`.trim();

    drawer.innerHTML = `
      <div class="manual-search-bar">
        <input type="text" id="manualInput-${index}" class="manual-input" value="${escapeHtml(defaultQ)}" placeholder="Поиск по названию или артисту...">
        <button type="button" class="btn-secondary small" onclick="window.runManualSearch(${index})">Найти</button>
      </div>
      <div id="manualResults-${index}" style="margin-top:6px;"></div>
    `;
    drawer.classList.remove('hidden');
  };

  window.runManualSearch = async function(index) {
    const input = document.getElementById(`manualInput-${index}`);
    const resultsDiv = document.getElementById(`manualResults-${index}`);
    if (!input || !resultsDiv) return;

    const q = input.value.trim();
    if (!q) return;

    resultsDiv.innerHTML = '<span style="font-size:11px;color:var(--text-muted);">Поиск в каталоге...</span>';

    try {
      const res = await fetch('/api/search-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, direction: state.direction })
      });
      const data = await res.json();
      const results = data.results || [];

      if (!results.length) {
        resultsDiv.innerHTML = '<span style="font-size:11px;color:var(--text-muted);">Ничего не найдено.</span>';
        return;
      }

      resultsDiv.innerHTML = results.slice(0, 3).map(r => `
        <div class="alt-row-item" onclick="window.selectAltTrack(${index}, ${escapeJsonAttr(r)})">
          <div class="alt-row-title">${escapeHtml(r.title)} (${escapeHtml(r.artist || '')})</div>
          <button type="button" class="btn-secondary small">Выбрать</button>
        </div>
      `).join('');
    } catch (e) {
      resultsDiv.innerHTML = `
        <div class="alt-row-item" onclick="window.selectAltTrack(${index}, { title: '${escapeHtml(q)}', artist: 'Пользовательский выбор', duration_sec: 210, composite_score: 95 })">
          <div class="alt-row-title">Выбрать: ${escapeHtml(q)}</div>
          <button type="button" class="btn-secondary small">Выбрать</button>
        </div>
      `;
    }
  };

  /* ==========================================================================
     Восстановление предыдущего завершённого переноса
     ========================================================================== */
  async function checkPreviousJob() {
    try {
      const res = await fetch('/api/latest-export');
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.total_tracks > 1 && data.job_id) {
        if (DOM.restoreJobBanner && DOM.restoreJobTitle && DOM.restoreJobCount && DOM.btnRestoreLatestJob) {
          DOM.restoreJobTitle.textContent = data.playlist_title || 'Предыдущий плейлист';
          DOM.restoreJobCount.textContent = data.total_tracks;
          DOM.restoreJobBanner.classList.remove('hidden');

          DOM.btnRestoreLatestJob.onclick = async () => {
            state.jobId = data.job_id;
            state.playlistTitle = data.playlist_title || 'Плейлист';
            try {
              const fullRes = await fetch(`/api/export/${data.job_id}/json`);
              if (fullRes.ok) {
                const fullData = await fullRes.json();
                state.tracks = fullData.tracks || [];
                state.tracksMap.clear();
                state.tracks.forEach(t => state.tracksMap.set(t.index, t));

                state.stats.total = data.total_tracks;
                state.stats.completed = data.total_tracks;
                state.stats.exact = state.tracks.filter(t => t.status === 'exact').length;
                state.stats.fuzzy = state.tracks.filter(t => t.status === 'fuzzy').length;
                state.stats.not_found = state.tracks.filter(t => t.status === 'not_found').length;
                onMatchingComplete();
              }
            } catch(err) {
              console.error('Ошибка загрузки результатов:', err);
            }
          };
        }
      }
    } catch(e) {}
  }

  /* ==========================================================================
     Вспомогательные функции
     ========================================================================== */
  function escapeHtml(text) {
    if (!text) return '';
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function escapeJsonAttr(obj) {
    return escapeHtml(JSON.stringify(obj));
  }

  function slugify(text) {
    return (text || 'playlist').toLowerCase().replace(/[^a-zа-я0-9_-]+/g, '_').slice(0, 40);
  }

  function downloadFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  // Обработка параметров URL (?token=...)
  const urlParams = new URLSearchParams(window.location.search);
  const queryToken = urlParams.get('token');
  if (queryToken) {
    state.oauthToken = queryToken;
    localStorage.setItem('ym_sc_token', queryToken);
    if (DOM.oauthTokenInput) DOM.oauthTokenInput.value = queryToken;
    setMode('auto_playlist');
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  // Слушатели событий
  DOM.dirYmToSc.addEventListener('click', () => setDirection('ym_to_sc'));
  DOM.dirScToYm.addEventListener('click', () => setDirection('sc_to_ym'));
  if (DOM.modeZeroLogin) DOM.modeZeroLogin.addEventListener('click', () => setMode('zero_login'));
  if (DOM.modeAutoPlaylist) DOM.modeAutoPlaylist.addEventListener('click', () => setMode('auto_playlist'));
  DOM.startTransferBtn.addEventListener('click', startMatching);

  // Инициализация
  setDirection('ym_to_sc');
  setMode('zero_login');
  navigateTo('setup');
  checkPreviousJob();

})();
