/* 花鄉田尾：背景音樂（自製）
   <script src="music.js" data-src="music/xxx.mp3" data-mode="song|loop" defer></script>
   - song：整首歌，用 <audio>，播完再從頭播
   - loop：副歌，用 Web Audio 無縫循環（失敗時退回 <audio loop>）
   - 瀏覽器不允許「完全沒互動」就自動播放：data-default="on" 的頁面會先嘗試自動播，被擋就等訪客第一次點擊／按鍵／手指放開時開始；
     訪客按 🎵 關掉後記在 localStorage（tw-music=0），之後各頁都不再自動播。data-volume 是音量（0～1）
   - 頁面有 #bMusic 就用它（3D 地圖的按鈕列），沒有就在右下角放一顆浮動按鈕 */
(function () {
  var sc = document.currentScript, SRC = sc.getAttribute('data-src'), MODE = sc.getAttribute('data-mode') || 'song', KEY = 'tw-music';
  var DEFAULT_ON = sc.getAttribute('data-default') === 'on', VOL = parseFloat(sc.getAttribute('data-volume')) || .6;
  var LABEL = {
    zh: ['播放音樂', '暫停音樂', '點一下開始播放音樂'], en: ['Play music', 'Pause music', 'Tap to start the music'],
    ja: ['音楽を再生', '音楽を一時停止', 'タップして音楽を再生'], th: ['เล่นเพลง', 'หยุดเพลง', 'แตะเพื่อเริ่มเล่นเพลง'],
    id: ['Putar musik', 'Jeda musik', 'Ketuk untuk memulai musik'], vi: ['Phát nhạc', 'Tạm dừng nhạc', 'Chạm để phát nhạc'],
    ko: ['음악 재생', '음악 일시정지', '탭하면 음악이 시작됩니다'], de: ['Musik abspielen', 'Musik pausieren', 'Tippen, um die Musik zu starten']
  };
  function get() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function put(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }
  function lang() { var l = 'zh'; try { l = localStorage.getItem('tw-lang') || 'zh'; } catch (e) {} return LABEL[l] ? l : 'en'; }

  var btn = document.getElementById('bMusic');
  if (!btn) {
    var st = document.createElement('style');
    st.textContent = '.musicfab{position:fixed;right:14px;bottom:14px;z-index:40;width:48px;height:48px;border-radius:50%;border:0;background:#fff;color:#1f4a36;font-size:22px;line-height:1;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.25);display:grid;place-items:center}' +
      '.musicfab[aria-pressed="true"]{background:#e3a33a}.musicfab:focus-visible{outline:3px solid #d9668a}.musicfab:hover{outline:2px solid #e3a33a}' +
      '@media print{.musicfab{display:none}}';
    document.head.appendChild(st);
    btn = document.createElement('button'); btn.id = 'bMusic'; btn.type = 'button'; btn.className = 'musicfab'; btn.textContent = '🎵';
    document.body.appendChild(btn);
  }

  /* ---- 播放引擎 ---- */
  var audio = null, ctx = null, buf = null, srcNode = null, gain = null;
  function audioEl() { if (!audio) { audio = new Audio(SRC); audio.loop = true; audio.preload = 'auto'; audio.volume = VOL; } return audio; }
  var useWA = MODE === 'loop' && (window.AudioContext || window.webkitAudioContext);
  var engine = {
    play: function () {
      if (!useWA) return audioEl().play();
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!ctx) { ctx = new AC(); gain = ctx.createGain(); gain.gain.value = VOL; gain.connect(ctx.destination); }
      var ready = ctx.state === 'running' ? Promise.resolve() : Promise.race([ctx.resume(), new Promise(function (r) { setTimeout(r, 500); })]);
      return ready.then(function () {
        if (ctx.state !== 'running') throw new Error('blocked');
        return buf ? buf : fetch(SRC).then(function (r) { return r.arrayBuffer(); }).then(function (ab) {
          return new Promise(function (ok, no) { var p = ctx.decodeAudioData(ab, ok, no); if (p && p.then) p.then(ok, no); });
        }).then(function (b) { buf = b; return b; });
      }).then(function (b) {
        if (srcNode) return;
        srcNode = ctx.createBufferSource(); srcNode.buffer = b; srcNode.loop = true; srcNode.connect(gain); srcNode.start(0);
      }).catch(function (e) {
        if (e && e.message === 'blocked') throw e;
        useWA = false; return audioEl().play();   // 解碼失敗：退回 <audio loop>
      });
    },
    pause: function () {
      if (srcNode) { try { srcNode.stop(); } catch (e) {} srcNode.disconnect(); srcNode = null; }
      if (audio) audio.pause();
    }
  };

  var g0 = get(), want = g0 === '1' || (g0 === null && DEFAULT_ON), playing = false, pending = false, starting = false;
  function ui() {
    var L = LABEL[lang()], on = playing || pending;
    btn.setAttribute('aria-pressed', String(on));
    btn.textContent = playing ? '🔊' : '🎵';
    var t = pending ? L[2] : (playing ? L[1] : L[0]); btn.title = t; btn.setAttribute('aria-label', t);
  }
  function start() {
    if (starting || playing) return; starting = true;
    var p; try { p = Promise.resolve(engine.play()); } catch (e) { p = Promise.reject(e); }
    p.then(function () { playing = true; pending = false; }, function () { playing = false; pending = want; if (pending) armGesture(); })
      .then(function () { starting = false; ui(); });
  }
  function stop() { engine.pause(); playing = false; pending = false; ui(); }
  var armed = false, EVS = ['pointerup', 'touchend', 'click', 'keydown'];   // iPhone 只承認「點擊／放開」這類手勢，按下去不算
  function armGesture() {
    if (armed) return; armed = true;
    var go = function (e) {
      if (e.target && btn.contains(e.target)) return;   // 按的是音樂鈕本身：交給它的 click 處理
      EVS.forEach(function (n) { document.removeEventListener(n, go, true); }); armed = false;
      if (want) start();
    };
    EVS.forEach(function (n) { document.addEventListener(n, go, true); });
  }
  btn.addEventListener('click', function () {
    if (playing) { want = false; put('0'); stop(); } else { want = true; put('1'); start(); }
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { if (playing) { engine.pause(); playing = false; pending = false; resumeOnShow = true; ui(); } }
    else if (resumeOnShow && want) { resumeOnShow = false; start(); }
  });
  var resumeOnShow = false;
  addEventListener('storage', function (e) { if (e.key === 'tw-lang') ui(); });
  ui();
  if (want) start();
})();
