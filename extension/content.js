// SoundCloud In-Tab Bridge
// Adds a floating 1-click button on soundcloud.com when a transfer is ready

(function() {
  function injectTransferWidget() {
    if (document.getElementById('ym-sc-inpage-bridge')) return;

    const widget = document.createElement('div');
    widget.id = 'ym-sc-inpage-bridge';
    widget.innerHTML = `
      <div id="ym-sc-pill" style="position: fixed; bottom: 30px; right: 30px; z-index: 999999; background: rgba(18,18,22,0.92); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); color: #FFF; padding: 12px 18px; border-radius: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13.5px; font-weight: 600; cursor: pointer; box-shadow: 0 12px 36px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1); display: flex; align-items: center; gap: 10px; transition: all 0.25s ease;">
        <span style="color: #FF5500; font-size: 15px;">⚡</span>
        <span id="ym-sc-pill-text">Собрать плейлист из Яндекс Музыки</span>
        <button type="button" id="ym-sc-pill-close" style="background: rgba(255,255,255,0.08); border: none; color: #888; width: 22px; height: 22px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 12px; margin-left: 4px;">✕</button>
      </div>
    `;

    document.getElementById('ym-sc-pill-close').onclick = (e) => {
      e.stopPropagation();
      widget.remove();
    };

    widget.addEventListener('click', async () => {
      const pill = document.getElementById('ym-sc-pill');
      pill.style.pointerEvents = 'none';
      pill.innerHTML = '<span>⏳ Загрузка треков...</span>';

      try {
        let res = null;
        try {
          res = await fetch('http://localhost:8000/api/latest-export');
        } catch(e) {
          res = await fetch('http://127.0.0.1:8000/api/latest-export');
        }
        if (!res.ok) throw new Error('Локальный сервер не найден');
        const data = await res.json();
        const trackIds = data.track_ids || [];
        const title = data.playlist_title || 'Мне нравится (YM)';

        if (!trackIds.length) {
          pill.innerHTML = '<span>✕ Нет готовых треков</span>';
          setTimeout(() => pill.remove(), 3000);
          return;
        }

        // Get oauth_token
        let token = null;
        const m = document.cookie.match(/oauth_token=([^;]+)/);
        if (m) token = decodeURIComponent(m[1]);
        if (!token) {
          alert('Вы не вошли в аккаунт SoundCloud на этой вкладке!');
          return;
        }

        // Split & create
        const chunkSize = 480;
        const chunks = [];
        for (let i = 0; i < trackIds.length; i += chunkSize) {
          chunks.push(trackIds.slice(i, i + chunkSize));
        }

        pill.innerHTML = `<span>⚡ Создаем ${chunks.length} плейлиста (${trackIds.length} треков)...</span>`;
        let firstPlaylistUrl = null;

        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const partTitle = chunks.length === 1 ? title : `${title} (Часть ${i + 1} из ${chunks.length})`;
          const r = await fetch('https://api-v2.soundcloud.com/playlists?client_id=cUfk83W6dFJv2UFUorAW0CTHgyptuEmP', {
            method: 'POST',
            headers: {
              'Authorization': `OAuth ${token.replace(/^OAuth /i, '')}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              playlist: { title: partTitle, sharing: 'public', tracks: chunk }
            })
          });
          const d = await r.json();
          if (d && d.permalink_url && !firstPlaylistUrl) {
            firstPlaylistUrl = d.permalink_url;
          }
        }

        pill.style.background = '#34C759';
        pill.innerHTML = `<span>✓ Готово! Открыть плейлист ↗</span>`;
        pill.style.pointerEvents = 'auto';
        pill.onclick = () => {
          if (firstPlaylistUrl) window.location.href = firstPlaylistUrl;
        };
      } catch (e) {
        pill.style.background = '#FF3B30';
        pill.innerHTML = `<span>✕ Ошибка: ${e.message}</span>`;
        setTimeout(() => pill.remove(), 4000);
      }
    });

    document.body.appendChild(widget);
  }

  // Check if localhost:8000 is running and has jobs
  fetch('http://localhost:8000/api/latest-export')
    .then(r => r.json())
    .then(data => {
      if (data && data.total_tracks > 0) {
        setTimeout(injectTransferWidget, 1000);
      }
    })
    .catch(() => {});
})();
