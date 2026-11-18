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

  /* ==========================================================================
     Генерация скрипта сборки закладки (Zero-Login / Session Cookies)
     ========================================================================== */
  function generateBookmarkletCode() {
    const isScToYm = state.direction === 'sc_to_ym';
    const allTracks = state.tracks.length > 0 ? state.tracks : Array.from(state.tracksMap.values());
    const title = state.playlistTitle || 'SoundShift Playlist';

    let code = '';
    if (isScToYm) {
      const ymTracks = allTracks.filter(t => t.selected_match && t.selected_match.id).map(t => ({
        id: String(t.selected_match.id),
        albumId: String(t.selected_match.album_id || t.selected_match.albumId || '')
      }));

      const payload = {
        title: title,
        ym_tracks: ymTracks
      };

      code = `(async function(){if(!location.hostname.includes('yandex.')){alert('Пожалуйста, откройте вкладку music.yandex.ru перед нажатием!');return;}let t=document.getElementById('ym-sc-toast');if(t)t.remove();t=document.createElement('div');t.id='ym-sc-toast';t.style.cssText='position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:99999999;background:#121215;border:1px solid #27272A;color:#FAFAFA;padding:16px 22px;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:13px;box-shadow:0 12px 32px rgba(0,0,0,0.8);text-align:center;min-width:320px;';document.body.appendChild(t);t.innerHTML='<div style="font-weight:600;margin-bottom:4px;color:#FFCC00;">⚡ SoundShift ➔ Яндекс Музыка</div><div>Создание плейлиста «${escapeHtml(title)}»...</div>';try{const d=${JSON.stringify(payload)};let cd=null;const m=document.cookie.match(/(?:^|;\\s*)yandex_login=([^;]+)/);const owner=m?decodeURIComponent(m[1]):'';const cr=await fetch('https://api.music.yandex.ru/users/'+encodeURIComponent(owner)+'/playlists/create',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','X-Requested-With':'XMLHttpRequest','Accept':'application/json'},credentials:'include',body:new URLSearchParams({title:d.title}).toString()});const cdata=await cr.json();cd=cdata.result||cdata.playlist||cdata;const pk=cd.kind||cd.playlist_id;let rev=cd.revision||0;const trs=d.ym_tracks||[];for(let i=0;i<trs.length;i+=40){const chunk=trs.slice(i,i+40);const diff=[{op:'insert',at:i,tracks:chunk.map(tr=>({id:String(tr.id),albumId:String(tr.albumId||'')}))}];await fetch('https://api.music.yandex.ru/users/'+encodeURIComponent(owner)+'/playlists/'+encodeURIComponent(pk)+'/change-relative',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','X-Requested-With':'XMLHttpRequest'},credentials:'include',body:new URLSearchParams({revision:String(rev),diff:JSON.stringify(diff)}).toString()});rev+=1;}t.innerHTML='<div style="color:#10B981;font-weight:600;">✓ Успешно! Создан плейлист с '+trs.length+' треками.</div>';setTimeout(()=>{location.reload();},2000);}catch(err){t.innerHTML='<div style="color:#EF4444;">✕ Ошибка: '+err.message+'</div>';setTimeout(()=>t.remove(),8000);}})();`;
    } else {
      const scIds = allTracks.filter(t => t.selected_match && t.selected_match.id).map(t => t.selected_match.id);
      code = `(async function(){if(!location.hostname.includes('soundcloud.com')){alert('Пожалуйста, откройте вкладку soundcloud.com перед нажатием!');return;}let t=document.getElementById('ym-sc-toast');if(t)t.remove();t=document.createElement('div');t.id='ym-sc-toast';t.style.cssText='position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:99999999;background:#121215;border:1px solid #27272A;color:#FAFAFA;padding:16px 22px;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:13px;box-shadow:0 12px 32px rgba(0,0,0,0.8);text-align:center;min-width:320px;';document.body.appendChild(t);t.innerHTML='<div style="font-weight:600;margin-bottom:4px;color:#FF5500;">⚡ SoundShift ➔ SoundCloud</div><div>Создание плейлиста «${escapeHtml(title)}»...</div>';try{let tok=null;const m=document.cookie.match(/oauth_token=([^;]+)/);if(m)tok=decodeURIComponent(m[1]);if(!tok)throw new Error('Вы не вошли в аккаунт на SoundCloud');let cid='cUfk83W6dFJv2UFUorAW0CTHgyptuEmP';const ids=${JSON.stringify(scIds)};const res=await fetch('https://api-v2.soundcloud.com/playlists?client_id='+cid,{method:'POST',headers:{'Authorization':'OAuth '+tok.replace(/^OAuth /i,''),'Content-Type':'application/json'},body:JSON.stringify({playlist:{title:${JSON.stringify(title)},sharing:'public',tracks:ids}})});if(!res.ok)throw new Error('HTTP '+res.status);const data=await res.json();t.innerHTML='<div style="color:#10B981;font-weight:600;">✓ Создан плейлист «${escapeHtml(title)}»!</div><a href="'+data.permalink_url+'" style="color:#FF5500;font-weight:600;margin-top:6px;display:inline-block;">Открыть плейлист ↗</a>';}catch(err){t.innerHTML='<div style="color:#EF4444;">✕ Ошибка: '+err.message+'</div>';setTimeout(()=>t.remove(),8000);}})();`;
    }

    DOM.autoBookmarkletBtn.href = `javascript:${code}`;
    DOM.autoBookmarkletBtn.dataset.code = code;
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
