/* 花鄉田尾：子頁面共用的語言切換（20 村總覽、各村頁、學習單、照片授權頁）
   - 與主頁、3D 地圖共用 localStorage 的 tw-lang 設定
   - 翻譯字典 tw-i18n.json：{ "中文原文": { en, ja, th, id, vi, ko, de } }
   - 顯示方式和主頁一致：中文在上，所選語言在下；選「中文」時只顯示中文
   - 頁面上原本寫死的英文（.en、[lang=en]）由所選語言取代，不再另外顯示 */
(function () {
  const LANGS = { zh: '中文', en: 'English', ja: '日本語', th: 'ไทย', id: 'Indonesia', vi: 'Tiếng Việt', ko: '한국어', de: 'Deutsch' };
  const BLOCK = /^(H1|H2|H3|H4|H5|P|LI|FIGCAPTION|DD|DT|TD|TH|CAPTION|SUMMARY|BLOCKQUOTE|DIV)$/;
  const CJK = /[㐀-鿿]/;
  const ROOT = (document.currentScript && document.currentScript.src.replace(/tw-lang\.js.*$/, '')) || './';
  let lang = 'en', dict = {};
  try { lang = localStorage.getItem('tw-lang') || 'en'; } catch (e) {}
  if (!LANGS[lang]) lang = 'en';

  const skip = el => el.closest('script,style,svg,.twtr,.twbar,.en,[lang="en"],[data-notr],.logo');
  const norm = s => s.replace(/\s+/g, ' ').trim();
  // 元素的中文原文（不含已插入的譯文與寫死的英文）
  function keyOf(el) {
    let t = '';
    (function walk(n) {
      for (const c of n.childNodes) {
        if (c.nodeType === 3) t += c.textContent;
        else if (c.nodeType === 1 && !c.matches('.twtr,.en,[lang="en"],br,svg')) walk(c);
        else if (c.nodeType === 1 && c.tagName === 'BR') t += ' ';
      }
    })(el);
    return norm(t);
  }
  const ownCJK = el => [...el.childNodes].some(c => c.nodeType === 3 && CJK.test(c.textContent));
  // 由上往下找「自己有中文字」的元素；翻譯了就不再處理它的子元素
  function targets(root) {
    const out = [];
    (function walk(el) {
      for (const c of el.children) {
        if (skip(c)) continue;
        if (ownCJK(c)) out.push(c); else walk(c);
      }
    })(root);
    return out;
  }
  window.twCollect = doc => targets((doc || document).body).map(keyOf).filter(k => CJK.test(k));

  function apply() {
    document.querySelectorAll('.twtr').forEach(n => n.remove());
    // 選單只顯示所選語言（和主頁一樣）：先還原中文，再換成譯文
    document.querySelectorAll('header.site nav a').forEach(a => {
      if (a.dataset.zh === undefined) a.dataset.zh = a.textContent;
      const t = dict[norm(a.dataset.zh)];
      a.textContent = lang !== 'zh' && t && t[lang] ? t[lang] : a.dataset.zh;
    });
    document.documentElement.classList.toggle('tw-hide-en', true);
    document.querySelectorAll('.twbar button').forEach(b => b.setAttribute('aria-pressed', b.dataset.lang === lang));
    if (lang === 'zh') return;
    for (const el of targets(document.body)) {
      if (el.closest('header.site nav')) continue;
      const k = keyOf(el), tr = dict[k];
      const s = tr && tr[lang];
      if (!s || norm(s) === k) continue;      // 譯文和原文一樣（例如日文的村名）就不重複顯示
      const span = document.createElement('span');
      span.className = 'twtr ' + (BLOCK.test(el.tagName) ? 'blk' : 'inl');
      span.lang = lang;
      span.textContent = BLOCK.test(el.tagName) ? s : ' · ' + s;
      el.appendChild(span);
    }
  }

  function bar() {
    const b = document.createElement('div');
    b.className = 'twbar'; b.setAttribute('role', 'group'); b.setAttribute('aria-label', 'Language');
    b.innerHTML = Object.entries(LANGS).map(([k, n]) => `<button type="button" data-lang="${k}" aria-pressed="${k === lang}">${n}</button>`).join('');
    b.addEventListener('click', e => {
      const t = e.target.closest('[data-lang]'); if (!t) return;
      lang = t.dataset.lang; try { localStorage.setItem('tw-lang', lang); } catch (err) {}
      apply();
    });
    const host = document.querySelector('header.site .wrap') || document.querySelector('.bar') || document.querySelector('main') || document.body;
    host.appendChild(b);
  }

  const css = document.createElement('style');
  css.textContent = `
  .tw-hide-en .en, .tw-hide-en [lang="en"]:not(.twtr){display:none !important}
  .twtr.blk{display:block;color:var(--muted,#5f6d65);font-weight:400;font-size:max(18px,.85em);margin-top:2px}
  h1 .twtr.blk,h2 .twtr.blk{font-size:max(18px,.6em)}
  .twtr.inl{color:var(--muted,#5f6d65);font-weight:400}
  .twbar{display:flex;flex-wrap:wrap;gap:4px;justify-content:flex-end;width:100%;margin:6px 0 2px}
  .twbar button{font:inherit;font-size:18px;border:1px solid var(--line,#e3e8e2);background:var(--card,#fff);color:var(--text,#24302a);border-radius:999px;padding:2px 12px;cursor:pointer}
  .twbar button[aria-pressed="true"]{background:var(--green,#2f6b4f);border-color:var(--green,#2f6b4f);color:#fff}
  header.site .wrap{flex-wrap:wrap}
  @media print{.twbar{display:none}}`;
  document.head.appendChild(css);

  function start() {
    bar();
    fetch(ROOT + 'tw-i18n.json').then(r => r.ok ? r.json() : {}).catch(() => ({})).then(j => { dict = j || {}; apply(); });
    apply();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
