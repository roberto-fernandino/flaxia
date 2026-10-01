/**
 * Página HTML do visualizador de documento (roda dentro de uma WebView).
 *
 * Porta mobile do `DocumentViewer` web: renderiza o PDF com pdf.js (todas as
 * páginas em rolagem contínua) ou a imagem, desenha os retângulos de destaque
 * que o React Native calcula a partir do OCR, e devolve:
 *  - `loaded`: tamanho de cada página + palavras do text layer do PDF (usadas
 *    como "OCR" quando o job não tem OCR do Vision, igual ao destaque legado);
 *  - `fieldTap`: toque num destaque seleciona o campo;
 *  - `area`: retângulo arrastado no modo seleção (coordenadas 0..1 da página).
 */
export const VIEWER_HTML = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<style>
  html, body { margin: 0; padding: 0; background: var(--bg, #f3f4f6); -webkit-user-select: none; user-select: none; }
  #root { padding: 10px 0 40px; overflow-x: auto; }
  #pages { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 0 10px; box-sizing: border-box; }
  .page { position: relative; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,.18); line-height: 0; }
  .page canvas, .page img { display: block; width: 100%; height: 100%; }
  .layer { position: absolute; inset: 0; }
  .hl { position: absolute; border-radius: 3px; box-sizing: border-box; }
  .hl.sel { border: 2px solid rgba(6,182,212,.9) !important; outline: 2px solid rgba(6,182,212,.28); outline-offset: 1px; }
  .select { position: absolute; inset: 0; touch-action: none; z-index: 5; }
  .box { position: absolute; border: 2px solid rgba(6,182,212,.9); background: rgba(6,182,212,.12); pointer-events: none; }
  .msg { font: 14px -apple-system, system-ui; color: #6b7280; text-align: center; padding: 60px 16px; }
  .err { color: #b91c1c; }
</style>
</head>
<body>
<div id="root"><div id="pages"><div class="msg">Carregando documento…</div></div></div>
<script>
(function () {
  var post = function (m) { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(m)); };
  var pagesEl = document.getElementById('pages');
  var pages = []; // { n, el, layer, sel, w, h }
  var zoom = 1;
  var selectMode = false;
  var lastHighlights = null;
  var doc = null, kind = null;

  function baseWidth() { return Math.max(200, document.documentElement.clientWidth - 20); }

  function b64ToBytes(b64) {
    var bin = atob(b64), len = bin.length, bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function makePage(n, w, h, child) {
    var el = document.createElement('div');
    el.className = 'page';
    el.dataset.page = n;
    el.appendChild(child);
    var layer = document.createElement('div'); layer.className = 'layer'; el.appendChild(layer);
    var sel = document.createElement('div'); sel.className = 'select'; sel.style.display = selectMode ? 'block' : 'none'; el.appendChild(sel);
    wireSelection(sel, n);
    pagesEl.appendChild(el);
    var p = { n: n, el: el, layer: layer, sel: sel, w: w, h: h, child: child };
    pages.push(p);
    return p;
  }

  function sizePage(p) {
    var dw = baseWidth() * zoom;
    p.el.style.width = dw + 'px';
    p.el.style.height = (dw * p.h / p.w) + 'px';
  }

  function renderPdfPage(p) {
    return doc.getPage(p.n).then(function (page) {
      var dw = baseWidth() * zoom;
      var scale = dw / p.w * Math.min(window.devicePixelRatio || 2, 3);
      var vp = page.getViewport({ scale: scale });
      var canvas = p.child;
      canvas.width = Math.floor(vp.width); canvas.height = Math.floor(vp.height);
      return page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
    });
  }

  function textWords(page, vp) {
    return page.getTextContent().then(function (tc) {
      var words = [];
      tc.items.forEach(function (it) {
        var str = (it.str || '');
        if (!str.trim()) return;
        var pt = vp.convertToViewportPoint(it.transform[4], it.transform[5]);
        var fh = Math.hypot(it.transform[2], it.transform[3]) || it.height || 10;
        var total = it.width || fh * str.length * 0.5;
        var x = pt[0], y = pt[1] - fh;
        var parts = str.split(/(\\s+)/);
        var cursor = 0;
        parts.forEach(function (part) {
          var pw = total * (part.length / str.length);
          if (part.trim()) words.push({ text: part, x: x + cursor, y: y, w: pw, h: fh });
          cursor += pw;
        });
      });
      return words;
    });
  }

  function loadPdf(b64) {
    kind = 'pdf';
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    pdfjsLib.getDocument({ data: b64ToBytes(b64) }).promise.then(function (d) {
      doc = d;
      pagesEl.innerHTML = '';
      var info = [], textByPage = {};
      var chain = Promise.resolve();
      for (var i = 1; i <= d.numPages; i++) (function (n) {
        chain = chain.then(function () { return d.getPage(n); }).then(function (page) {
          var vp = page.getViewport({ scale: 1 });
          var p = makePage(n, vp.width, vp.height, document.createElement('canvas'));
          sizePage(p);
          info.push({ pageNumber: n, w: vp.width, h: vp.height });
          return textWords(page, vp).then(function (w) { textByPage[n] = w; }).then(function () { return renderPdfPage(p); });
        });
      })(i);
      chain.then(function () {
        post({ type: 'loaded', kind: 'pdf', pages: info, textWords: textByPage });
        if (lastHighlights) drawHighlights(lastHighlights);
      }).catch(function (e) { fail(e); });
    }).catch(function (e) { fail(e); });
  }

  function loadImage(b64, mime) {
    kind = 'image';
    var img = new Image();
    img.onload = function () {
      pagesEl.innerHTML = '';
      var p = makePage(1, img.naturalWidth, img.naturalHeight, img);
      sizePage(p);
      post({ type: 'loaded', kind: 'image', pages: [{ pageNumber: 1, w: img.naturalWidth, h: img.naturalHeight }], textWords: {} });
      if (lastHighlights) drawHighlights(lastHighlights);
    };
    img.onerror = function () { fail(new Error('Falha ao carregar imagem')); };
    img.src = 'data:' + mime + ';base64,' + b64;
  }

  function fail(e) {
    pagesEl.innerHTML = '<div class="msg err">Falha ao carregar documento.</div>';
    post({ type: 'error', message: String(e && e.message || e) });
  }

  function drawHighlights(h) {
    lastHighlights = h;
    var target = null;
    pages.forEach(function (p) {
      p.layer.innerHTML = '';
      var data = h.pages[p.n];
      if (!data) return;
      var dw = baseWidth() * zoom;
      var dh = dw * p.h / p.w;
      var sx = dw / data.space.w, sy = dh / data.space.h, pad = 3;
      data.rects.forEach(function (r) {
        var d = document.createElement('div');
        d.className = 'hl' + (r.selected ? ' sel' : '');
        d.style.left = (r.x1 * sx - pad) + 'px';
        d.style.top = (r.y1 * sy - pad) + 'px';
        d.style.width = ((r.x2 - r.x1) * sx + pad * 2) + 'px';
        d.style.height = ((r.y2 - r.y1) * sy + pad * 2) + 'px';
        d.style.background = r.fill;
        d.style.border = '1px solid ' + r.stroke;
        d.addEventListener('click', function (ev) { ev.stopPropagation(); post({ type: 'fieldTap', fieldKey: r.fieldKey }); });
        p.layer.appendChild(d);
        if (r.selected && !target) target = d;
      });
    });
    if (target && h.scroll) setTimeout(function () { target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' }); }, 60);
  }

  function wireSelection(sel, n) {
    var start = null, box = null;
    function pos(t) { var r = sel.getBoundingClientRect(); return { x: t.clientX - r.left, y: t.clientY - r.top, w: r.width, h: r.height }; }
    sel.addEventListener('touchstart', function (e) {
      if (!selectMode) return; e.preventDefault();
      start = pos(e.touches[0]);
      box = document.createElement('div'); box.className = 'box'; sel.appendChild(box);
    }, { passive: false });
    sel.addEventListener('touchmove', function (e) {
      if (!start) return; e.preventDefault();
      var c = pos(e.touches[0]);
      box.style.left = Math.min(start.x, c.x) + 'px'; box.style.top = Math.min(start.y, c.y) + 'px';
      box.style.width = Math.abs(c.x - start.x) + 'px'; box.style.height = Math.abs(c.y - start.y) + 'px';
      box.dataset.x2 = c.x; box.dataset.y2 = c.y;
    }, { passive: false });
    sel.addEventListener('touchend', function () {
      if (!start) return;
      var x2 = Number(box.dataset.x2 || start.x), y2 = Number(box.dataset.y2 || start.y);
      if (box) box.remove();
      var s = start; start = null; box = null;
      if (Math.abs(x2 - s.x) < 6 && Math.abs(y2 - s.y) < 6) return;
      post({ type: 'area', pageNumber: n,
        x1: Math.min(s.x, x2) / s.w, y1: Math.min(s.y, y2) / s.h,
        x2: Math.max(s.x, x2) / s.w, y2: Math.max(s.y, y2) / s.h });
    });
  }

  function setZoom(z) {
    zoom = z;
    pages.forEach(sizePage);
    if (kind === 'pdf') pages.reduce(function (c, p) { return c.then(function () { return renderPdfPage(p); }); }, Promise.resolve());
    if (lastHighlights) drawHighlights(Object.assign({}, lastHighlights, { scroll: false }));
  }

  window.__rn = function (m) {
    if (m.type === 'theme') document.documentElement.style.setProperty('--bg', m.bg);
    if (m.type === 'load') { pages = []; if (m.kind === 'pdf') loadPdf(m.base64); else loadImage(m.base64, m.mime); }
    if (m.type === 'highlights') drawHighlights(m);
    if (m.type === 'selectMode') { selectMode = !!m.enabled; pages.forEach(function (p) { p.sel.style.display = selectMode ? 'block' : 'none'; }); }
    if (m.type === 'zoom') setZoom(m.zoom);
  };
  // Toque fora de um destaque (sem arrastar) deseleciona o campo, como o clique fora no web.
  document.addEventListener('click', function (ev) {
    if (selectMode) return;
    if (ev.target && ev.target.closest && ev.target.closest('.hl')) return;
    post({ type: 'blankTap' });
  });
  window.addEventListener('resize', function () { if (pages.length) setZoom(zoom); });
  post({ type: 'ready' });
})();
</script>
</body>
</html>`;
