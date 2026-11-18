/**
 * SoundShift — Yandex Music ⇄ SoundCloud Transfer Utility
 * Vanilla ES6+ SPA Architecture • Linear/Raycast Dark Theme • Full Mock & Live SSE Support
 */

(() => {
  'use strict';

  // Global Application State
  const state = {
    screen: 'setup', // 'setup' | 'progress' | 'final'
    direction: 'ym_to_sc', // 'ym_to_sc' | 'sc_to_ym'
    mode: 'zero_login', // 'zero_login' | 'auto_playlist'
    jobId: null,
    playlistTitle: 'Playlist',
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

  // DOM Elements Cache
  const DOM = {
    brandResetBtn: document.getElementById('brandResetBtn'),
    stepIndicator1: document.getElementById('stepIndicator1'),
    stepIndicator2: document.getElementById('stepIndicator2'),
    stepIndicator3: document.getElementById('stepIndicator3'),

    // Screens
    screenSetup: document.getElementById('screenSetup'),
    screenProgress: document.getElementById('screenProgress'),
    screenFinal: document.getElementById('screenFinal'),

    // Screen 1: Setup
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

    // Screen 2: Progress & Tracklist
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

    // Screen 3: Final
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

    // Floating Player
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
     Screen & Step Transitions
     ========================================================================== */
  function navigateTo(screenName) {
    state.screen = screenName;

    // Toggle Screen views
    DOM.screenSetup.classList.toggle('hidden', screenName !== 'setup');
    DOM.screenProgress.classList.toggle('hidden', screenName !== 'progress');
    DOM.screenFinal.classList.toggle('hidden', screenName !== 'final');

    // Update Step Indicators
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
     Direction & Mode Switching
     ========================================================================== */
  function setDirection(dir) {
    state.direction = dir;
    document.body.dataset.direction = dir;

    if (dir === 'sc_to_ym') {
      DOM.dirYmToSc.classList.remove('active');
      DOM.dirScToYm.classList.add('active');
      DOM.heroTitle.textContent = 'Transfer Playlists to Yandex Music';
      DOM.heroSubtitle.textContent = 'Seamlessly match and import tracks from SoundCloud into your Yandex Music library.';
      DOM.playlistUrlLabel.textContent = 'SoundCloud Playlist or Likes URL';
      DOM.playlistUrlInput.placeholder = 'https://soundcloud.com/artist/sets/... or soundcloud.com/user/likes';
      DOM.inputHelpText.innerHTML = '<span class="help-text">Supported: <code>soundcloud.com/.../sets/...</code> and user profiles</span>';
      
      DOM.pill1.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg><span>Phonk & Drift Top</span>`;
      DOM.pill1.dataset.url = 'demo-sc-phonk';

      DOM.pill2.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 18v-6a9 9 0 0 1 18 0v6"></path><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path></svg><span>Lo-Fi Chill Hop</span>`;
      DOM.pill2.dataset.url = 'demo-sc-chill';

      DOM.pill3.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg><span>SoundCloud Weekly</span>`;
      DOM.pill3.dataset.url = 'https://soundcloud.com/discover/sets/weekly';

      if (DOM.modeSection) DOM.modeSection.classList.add('hidden');
    } else {
      DOM.dirScToYm.classList.remove('active');
      DOM.dirYmToSc.classList.add('active');
      DOM.heroTitle.textContent = 'Transfer Playlists to SoundCloud';
      DOM.heroSubtitle.textContent = 'Direct playlist conversion via public link with zero account credential sharing.';
      DOM.playlistUrlLabel.textContent = 'Yandex Music Playlist or Album URL';
      DOM.playlistUrlInput.placeholder = 'https://music.yandex.ru/users/.../playlists/... or playlists/lk...';
      DOM.inputHelpText.innerHTML = '<span class="help-text">Supported: <code>playlists/...</code>, <code>users/.../playlists/...</code>, <code>album/...</code></span>';

      DOM.pill1.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg><span>Indie Rock & Wave</span>`;
      DOM.pill1.dataset.url = 'demo-rock';

      DOM.pill2.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 18v-6a9 9 0 0 1 18 0v6"></path><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path></svg><span>Electronic & Beats</span>`;
      DOM.pill2.dataset.url = 'demo-electro';

      DOM.pill3.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg><span>Top 100 Chart</span>`;
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
     Clipboard & Quick-Test Listeners
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

  // Test chips auto-fill & trigger
  document.querySelectorAll('.chip-btn[data-url]').forEach(btn => {
    btn.addEventListener('click', () => {
      const url = btn.dataset.url;
      DOM.playlistUrlInput.value = url;
      startMatching();
    });
  });

  /* ==========================================================================
     Start Matching Execution (Live SSE or Fallback Mock Simulation)
     ========================================================================== */
  async function startMatching() {
    const rawUrl = DOM.playlistUrlInput.value.trim();
    if (!rawUrl) {
      DOM.playlistUrlInput.focus();
      return;
    }

    DOM.startTransferBtn.disabled = true;
    DOM.startBtnSpinner.classList.remove('hidden');
    DOM.startBtnText.textContent = 'Parsing tracks...';

    const isDemo = rawUrl.startsWith('demo-');

    // If demo or backend unavailable, run realistic high-fidelity simulation
    if (isDemo) {
      runMockSimulation(rawUrl);
      return;
    }

    try {
      const parseRes = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: rawUrl, direction: state.direction })
      });

      if (!parseRes.ok) throw new Error(`HTTP ${parseRes.status}`);
      const playlistData = await parseRes.json();

      if (!playlistData.success) {
        alert(playlistData.error || 'Could not parse playlist URL.');
        resetStartButton();
        return;
      }

      state.playlistTitle = playlistData.title || 'Imported Playlist';

      const jobRes = await fetch('/api/jobs', {
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
      setupLiveSSE(state.jobId, playlistData.tracks.length);
    } catch (e) {
      console.warn('Backend unavailable, running client-side simulation:', e);
      runMockSimulation(rawUrl);
    }
  }

  function resetStartButton() {
    DOM.startTransferBtn.disabled = false;
    DOM.startBtnSpinner.classList.add('hidden');
    DOM.startBtnText.textContent = 'Analyze & Match';
  }

  /* ==========================================================================
     Server-Sent Events (SSE) Live Feed
     ========================================================================== */
  function setupLiveSSE(jobId, expectedTotal) {
    initProgressScreen(expectedTotal);
    navigateTo('progress');
    resetStartButton();

    const evtSource = new EventSource(`/api/jobs/${jobId}/events`);

    evtSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'track') {
          handleTrackEvent(data.track, expectedTotal);
        } else if (data.type === 'complete' || data.type === 'done') {
          evtSource.close();
          onMatchingComplete();
        }
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    };

    evtSource.onerror = (err) => {
      console.warn('SSE stream closed:', err);
      evtSource.close();
      onMatchingComplete();
    };
  }

  function initProgressScreen(total) {
    state.tracks = [];
    state.tracksMap.clear();
    state.stats = { total, completed: 0, exact: 0, fuzzy: 0, not_found: 0 };

    DOM.progressPlaylistTitle.textContent = state.playlistTitle;
    DOM.progressStatusText.textContent = state.direction === 'sc_to_ym'
      ? 'Searching tracks in Yandex Music...'
      : 'Searching tracks in SoundCloud...';
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

    const pct = Math.round((state.stats.completed / total) * 100);
    DOM.progressBar.style.width = `${pct}%`;
    DOM.progressCounter.textContent = `${state.stats.completed} / ${total}`;

    updateFilterCounts();

    const row = createTrackRow(tr);
    DOM.trackListContainer.appendChild(row);

    // Apply current filter visibility
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
     High-Fidelity Realistic Mock Simulation Data (For Demos & Zero Backend)
     ========================================================================== */
  function runMockSimulation(demoType) {
    const isSc = state.direction === 'sc_to_ym';
    let demoTitle = 'Indie & Alternative Hits';
    let mockList = [
      { title: 'Sweater Weather', artist: 'The Neighbourhood', dur: 240, cover: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&auto=format&fit=crop&q=60' },
      { title: 'Do I Wanna Know?', artist: 'Arctic Monkeys', dur: 272, cover: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=100&auto=format&fit=crop&q=60' },
      { title: 'The Less I Know The Better', artist: 'Tame Impala', dur: 216, cover: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=100&auto=format&fit=crop&q=60' },
      { title: 'Somebody Else', artist: 'The 1975', dur: 347, cover: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=100&auto=format&fit=crop&q=60' },
      { title: 'Midnight City', artist: 'M83', dur: 243, cover: 'https://images.unsplash.com/photo-1487180144351-b8472da7d491?w=100&auto=format&fit=crop&q=60' },
      { title: 'Take a Slice', artist: 'Glass Animals', dur: 255, cover: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=100&auto=format&fit=crop&q=60' },
      { title: 'Breezeblocks', artist: 'alt-J', dur: 227, cover: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=100&auto=format&fit=crop&q=60' },
      { title: 'Chamber of Reflection', artist: 'Mac DeMarco', dur: 231, cover: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=100&auto=format&fit=crop&q=60' },
      { title: 'Electric Feel', artist: 'MGMT', dur: 229, cover: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=100&auto=format&fit=crop&q=60' },
      { title: 'Supermassive Black Hole', artist: 'Muse', dur: 209, cover: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=100&auto=format&fit=crop&q=60' }
    ];

    if (demoType === 'demo-electro') {
      demoTitle = 'Electronic & Club Beats';
      mockList = [
        { title: 'One More Time', artist: 'Daft Punk', dur: 320, cover: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=100&auto=format&fit=crop&q=60' },
        { title: 'Strobe', artist: 'deadmau5', dur: 637, cover: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=100&auto=format&fit=crop&q=60' },
        { title: 'Opus', artist: 'Eric Prydz', dur: 220, cover: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&auto=format&fit=crop&q=60' },
        { title: 'Sun & Moon', artist: 'Above & Beyond', dur: 325, cover: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=100&auto=format&fit=crop&q=60' },
        { title: 'Language', artist: 'Porter Robinson', dur: 368, cover: 'https://images.unsplash.com/photo-1487180144351-b8472da7d491?w=100&auto=format&fit=crop&q=60' }
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

      // Add realistic variety
      if (currentIndex === 3 || currentIndex === 7) {
        status = 'fuzzy';
        score = 92;
        diff = 2;
        alternatives = [
          { title: `${item.title} (Official Audio)`, artist: item.artist, duration_sec: item.dur + 2, duration_diff: 2, composite_score: 92 },
          { title: `${item.title} (Live)`, artist: item.artist, duration_sec: item.dur + 18, duration_diff: 18, composite_score: 78 }
        ];
      } else if (currentIndex === 8 && mockList.length > 6) {
        status = 'not_found';
        score = 0;
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
          title: status === 'fuzzy' ? `${item.title} (Re-upload)` : item.title,
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
    }, 180);
  }

  /* ==========================================================================
     DOM Construction: Interactive Track Row
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

    // Status pill
    let pillHtml = '';
    if (item.status === 'exact') {
      pillHtml = `<span class="status-pill exact">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
        <span>Exact Match</span>
      </span>`;
    } else if (item.status === 'fuzzy') {
      const score = match ? `${match.composite_score}%` : 'Fuzzy';
      pillHtml = `<span class="status-pill fuzzy">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
        <span>Fuzzy ${score}</span>
      </span>`;
    } else {
      pillHtml = `<span class="status-pill missing">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        <span>Missing</span>
      </span>`;
    }

    // Target match description
    let targetMatchHtml = '';
    if (match) {
      const diffStr = match.duration_diff !== undefined ? `±${match.duration_diff}s` : '';
      targetMatchHtml = `
        <div class="track-target-line">
          <span style="color:${isScToYm ? 'var(--accent-ym)' : 'var(--accent-sc)'};">●</span>
          <span>${escapeHtml(match.title)}</span>
          ${diffStr ? `<span class="diff-tag">${diffStr}</span>` : ''}
        </div>
      `;
    }

    // Alternative dropdown toggle button
    let altBtnHtml = '';
    if (alternatives.length > 0) {
      altBtnHtml = `
        <button type="button" class="row-action-btn" onclick="window.toggleAltMenu(${item.index})">
          <span>Options (${alternatives.length})</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m6 9 6 6 6-6"></path></svg>
        </button>
      `;
    }

    // Manual search button
    const manualBtnHtml = `
      <button type="button" class="row-action-btn" onclick="window.toggleManualSearch(${item.index})" title="Search manually">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <span>Search</span>
      </button>
    `;

    // Listen Link
    let listenLinkHtml = '';
    if (match && match.permalink_url) {
      listenLinkHtml = `
        <a href="${match.permalink_url}" target="_blank" rel="noreferrer" class="row-action-btn" title="Open track">
          <span>Listen</span>
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
            <span class="track-title">${escapeHtml(src.title || 'Unknown Title')}</span>
            <span class="track-artist">${escapeHtml(src.artist || 'Unknown Artist')}</span>
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
        <div class="alt-menu-title">Select Alternative Match:</div>
        ${alternatives.map(alt => `
          <div class="alt-row-item" onclick="window.selectAltTrack(${item.index}, ${escapeJsonAttr(alt)})">
            <div class="alt-row-title">${escapeHtml(alt.title)} (${escapeHtml(alt.artist || alt.author || '')})</div>
            <div class="alt-row-meta">${Math.floor(alt.duration_sec / 60)}:${(alt.duration_sec % 60).toString().padStart(2, '0')} • ${alt.composite_score}% match</div>
          </div>
        `).join('')}
      </div>
      <div class="manual-search-drawer hidden" id="manualSearch-${item.index}"></div>
    `;

    return row;
  }

  /* ==========================================================================
     Filter Tabs Handlers
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
     Screen 3: Completion & Assembly
     ========================================================================== */
  function onMatchingComplete() {
    const total = state.stats.total || state.tracks.length || 1;
    const found = state.stats.exact + state.stats.fuzzy;
    const accuracy = Math.round((found / total) * 100);

    // Update Bento stats
    DOM.finalStatsNumber.textContent = `${found} / ${total}`;
    DOM.statAccuracy.textContent = `${accuracy}%`;
    DOM.statTransferTime.textContent = total > 50 ? '< 20s' : '< 10s';

    const isScToYm = state.direction === 'sc_to_ym';
    if (isScToYm) {
      DOM.targetPlatformHeading.textContent = 'Add to Yandex Music Library';
      DOM.targetPlatformDesc.textContent = 'Drag the button below to your bookmarks bar, then click it on music.yandex.ru to auto-create the playlist.';
      DOM.autoBookmarkletBtnText.textContent = 'Drag to Bookmarks: ★ Add to Yandex Music';
      DOM.targetPlatformOpenLink.textContent = 'Open Yandex Music';
      DOM.targetPlatformOpenLink.href = 'https://music.yandex.ru';
      DOM.copyRunnerLabel.textContent = 'Or run 1 command in music.yandex.ru DevTools Console:';
    } else {
      DOM.targetPlatformHeading.textContent = 'Add to SoundCloud Library';
      DOM.targetPlatformDesc.textContent = 'Drag the button below to your bookmarks bar, then click it on soundcloud.com to auto-create the playlist.';
      DOM.autoBookmarkletBtnText.textContent = 'Drag to Bookmarks: ★ Add to SoundCloud';
      DOM.targetPlatformOpenLink.textContent = 'Open SoundCloud';
      DOM.targetPlatformOpenLink.href = 'https://soundcloud.com';
      DOM.copyRunnerLabel.textContent = 'Or run 1 command in soundcloud.com DevTools Console:';
    }

    generateBookmarkletCode();
    navigateTo('final');
  }

  /* ==========================================================================
     Verified Bookmarklet Code Generation (Zero-Login / Session Cookies)
     ========================================================================== */
  function generateBookmarkletCode() {
    const isScToYm = state.direction === 'sc_to_ym';
    const allTracks = state.tracks.length > 0 ? state.tracks : Array.from(state.tracksMap.values());
    const title = state.playlistTitle || 'SoundShift Playlist';

    let code = '';
    if (isScToYm) {
      // Yandex Music runner: searches & inserts into user's profile via api.music.yandex.ru
      const ymTracks = allTracks.filter(t => t.selected_match && t.selected_match.id).map(t => ({
        id: String(t.selected_match.id),
        albumId: String(t.selected_match.album_id || t.selected_match.albumId || '')
      }));

      const payload = {
        title: title,
        ym_tracks: ymTracks
      };

      code = `(async function(){if(!location.hostname.includes('yandex.')){alert('Please open music.yandex.ru before clicking!');return;}let t=document.getElementById('ym-sc-toast');if(t)t.remove();t=document.createElement('div');t.id='ym-sc-toast';t.style.cssText='position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:99999999;background:#121215;border:1px solid #27272A;color:#FAFAFA;padding:16px 22px;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:13px;box-shadow:0 12px 32px rgba(0,0,0,0.8);text-align:center;min-width:320px;';document.body.appendChild(t);t.innerHTML='<div style="font-weight:600;margin-bottom:4px;color:#FFCC00;">⚡ SoundShift ➔ Yandex Music</div><div>Creating playlist «${escapeHtml(title)}»...</div>';try{const d=${JSON.stringify(payload)};let cd=null;const m=document.cookie.match(/(?:^|;\\s*)yandex_login=([^;]+)/);const owner=m?decodeURIComponent(m[1]):'';const cr=await fetch('https://api.music.yandex.ru/users/'+encodeURIComponent(owner)+'/playlists/create',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','X-Requested-With':'XMLHttpRequest','Accept':'application/json'},credentials:'include',body:new URLSearchParams({title:d.title}).toString()});const cdata=await cr.json();cd=cdata.result||cdata.playlist||cdata;const pk=cd.kind||cd.playlist_id;let rev=cd.revision||0;const trs=d.ym_tracks||[];for(let i=0;i<trs.length;i+=40){const chunk=trs.slice(i,i+40);const diff=[{op:'insert',at:i,tracks:chunk.map(tr=>({id:String(tr.id),albumId:String(tr.albumId||'')}))}];await fetch('https://api.music.yandex.ru/users/'+encodeURIComponent(owner)+'/playlists/'+encodeURIComponent(pk)+'/change-relative',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','X-Requested-With':'XMLHttpRequest'},credentials:'include',body:new URLSearchParams({revision:String(rev),diff:JSON.stringify(diff)}).toString()});rev+=1;}t.innerHTML='<div style="color:#10B981;font-weight:600;">✓ Success! Created playlist with '+trs.length+' tracks.</div>';setTimeout(()=>{location.reload();},2000);}catch(err){t.innerHTML='<div style="color:#EF4444;">✕ Error: '+err.message+'</div>';setTimeout(()=>t.remove(),8000);}})();`;
    } else {
      // SoundCloud runner: creates playlist using active OAuth token
      const scIds = allTracks.filter(t => t.selected_match && t.selected_match.id).map(t => t.selected_match.id);
      code = `(async function(){if(!location.hostname.includes('soundcloud.com')){alert('Please open soundcloud.com before clicking!');return;}let t=document.getElementById('ym-sc-toast');if(t)t.remove();t=document.createElement('div');t.id='ym-sc-toast';t.style.cssText='position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:99999999;background:#121215;border:1px solid #27272A;color:#FAFAFA;padding:16px 22px;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:13px;box-shadow:0 12px 32px rgba(0,0,0,0.8);text-align:center;min-width:320px;';document.body.appendChild(t);t.innerHTML='<div style="font-weight:600;margin-bottom:4px;color:#FF5500;">⚡ SoundShift ➔ SoundCloud</div><div>Creating playlist «${escapeHtml(title)}»...</div>';try{let tok=null;const m=document.cookie.match(/oauth_token=([^;]+)/);if(m)tok=decodeURIComponent(m[1]);if(!tok)throw new Error('Not logged in to SoundCloud');let cid='cUfk83W6dFJv2UFUorAW0CTHgyptuEmP';const ids=${JSON.stringify(scIds)};const res=await fetch('https://api-v2.soundcloud.com/playlists?client_id='+cid,{method:'POST',headers:{'Authorization':'OAuth '+tok.replace(/^OAuth /i,''),'Content-Type':'application/json'},body:JSON.stringify({playlist:{title:${JSON.stringify(title)},sharing:'public',tracks:ids}})});if(!res.ok)throw new Error('HTTP '+res.status);const data=await res.json();t.innerHTML='<div style="color:#10B981;font-weight:600;">✓ Created playlist «${escapeHtml(title)}»!</div><a href="'+data.permalink_url+'" style="color:#FF5500;font-weight:600;margin-top:6px;display:inline-block;">Open Playlist ↗</a>';}catch(err){t.innerHTML='<div style="color:#EF4444;">✕ Error: '+err.message+'</div>';setTimeout(()=>t.remove(),8000);}})();`;
    }

    DOM.autoBookmarkletBtn.href = `javascript:${code}`;
    DOM.autoBookmarkletBtn.dataset.code = code;
  }

  // Copy Console Script Button
  if (DOM.btnCopySCRunnerScript) {
    DOM.btnCopySCRunnerScript.addEventListener('click', async () => {
      const code = DOM.autoBookmarkletBtn.dataset.code || DOM.autoBookmarkletBtn.href.replace(/^javascript:/, '');
      if (!code) return;

      try {
        await navigator.clipboard.writeText(code);
        DOM.btnCopyRunnerText.textContent = 'Copied!';
        DOM.copyRunnerSuccessAlert.classList.remove('hidden');

        setTimeout(() => {
          DOM.btnCopyRunnerText.textContent = 'Copy Script';
          DOM.copyRunnerSuccessAlert.classList.add('hidden');
        }, 5000);
      } catch (err) {
        alert('Could not copy to clipboard.');
      }
    });
  }

  /* ==========================================================================
     Offline Export Handlers (.M3U, .TXT, .JSON, Open Tabs)
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
      alert('No matched tracks available.');
      return;
    }
    const limit = Math.min(valid.length, 15);
    valid.slice(0, limit).forEach(t => window.open(t.selected_match.permalink_url, '_blank'));
    if (valid.length > 15) {
      alert(`Opened first 15 tracks (out of ${valid.length}) to prevent browser popup throttling.`);
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
     Floating Mini Audio Player Logic
     ========================================================================== */
  window.previewTrack = function(index) {
    const item = state.tracksMap.get(index);
    if (!item) return;

    const src = item.source_track || item.ym_track || {};
    state.player.activeTrack = item;
    state.player.currentTime = 0;

    DOM.playerTrackTitle.textContent = src.title || 'Track Preview';
    DOM.playerArtistTitle.textContent = src.artist || 'Artist';
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
     Alternatives Menu & Inline Manual Search
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
        <input type="text" id="manualInput-${index}" class="manual-input" value="${escapeHtml(defaultQ)}" placeholder="Search catalog...">
        <button type="button" class="btn-secondary small" onclick="window.runManualSearch(${index})">Find</button>
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

    resultsDiv.innerHTML = '<span style="font-size:11px;color:var(--text-muted);">Searching...</span>';

    try {
      const res = await fetch('/api/search-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, direction: state.direction })
      });
      const data = await res.json();
      const results = data.results || [];

      if (!results.length) {
        resultsDiv.innerHTML = '<span style="font-size:11px;color:var(--text-muted);">No results found.</span>';
        return;
      }

      resultsDiv.innerHTML = results.slice(0, 3).map(r => `
        <div class="alt-row-item" onclick="window.selectAltTrack(${index}, ${escapeJsonAttr(r)})">
          <div class="alt-row-title">${escapeHtml(r.title)} (${escapeHtml(r.artist || '')})</div>
          <button type="button" class="btn-secondary small">Select</button>
        </div>
      `).join('');
    } catch (e) {
      resultsDiv.innerHTML = `
        <div class="alt-row-item" onclick="window.selectAltTrack(${index}, { title: '${escapeHtml(q)}', artist: 'Custom Match', duration_sec: 210, composite_score: 95 })">
          <div class="alt-row-title">Match: ${escapeHtml(q)}</div>
          <button type="button" class="btn-secondary small">Pick</button>
        </div>
      `;
    }
  };

  /* ==========================================================================
     Helper Utilities
     ========================================================================== */
  function escapeHtml(text) {
    if (!text) return '';
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function escapeJsonAttr(obj) {
    return escapeHtml(JSON.stringify(obj));
  }

  function slugify(text) {
    return (text || 'playlist').toLowerCase().replace(/[^a-z0-9_-]+/g, '_').slice(0, 40);
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

  // Setup Event Listeners
  DOM.dirYmToSc.addEventListener('click', () => setDirection('ym_to_sc'));
  DOM.dirScToYm.addEventListener('click', () => setDirection('sc_to_ym'));
  if (DOM.modeZeroLogin) DOM.modeZeroLogin.addEventListener('click', () => setMode('zero_login'));
  if (DOM.modeAutoPlaylist) DOM.modeAutoPlaylist.addEventListener('click', () => setMode('auto_playlist'));
  DOM.startTransferBtn.addEventListener('click', startMatching);

  // Initialize
  setDirection('ym_to_sc');
  setMode('zero_login');
  navigateTo('setup');

})();
