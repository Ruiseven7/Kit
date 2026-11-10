/* Kit de sobrevivência: guarda a aplicação no telemóvel para abrir sem internet. */
var CACHE = 'kit-sobrevivencia-v1';
importScripts('avisos.js'); // a regra dos avisos de validade, a mesma que a aplicação usa
var BASE = ['./', 'index.html', 'avisos.js', 'manifest.webmanifest', 'kit-inicial.json',
  'icones/icone-192.png', 'icones/icone-512.png', 'icones/icone-mascara-512.png', 'icones/apple-touch-icon.png'];
var LETRAS = 'https://fonts.googleapis.com/css2?family=Saira+Semi+Condensed:wght@400;500;600;700&family=Saira+Stencil+One&display=swap';

async function guardarLetras(cache) {
  // Opcional: se falhar, a aplicação usa os tipos de letra do telemóvel.
  try {
    var r = await fetch(LETRAS);
    if (!r.ok) return;
    var css = await r.clone().text();
    await cache.put(LETRAS, r);
    var urls = Array.from(css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)).map(function (m) { return m[1]; });
    await Promise.all(urls.map(function (u) {
      return fetch(u).then(function (x) { if (x.ok) return cache.put(u, x); }).catch(function () {});
    }));
  } catch (e) {}
}

self.addEventListener('install', function (e) {
  e.waitUntil((async function () {
    var cache = await caches.open(CACHE);
    await cache.addAll(BASE);
    await guardarLetras(cache);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', function (e) {
  e.waitUntil((async function () {
    var nomes = await caches.keys();
    await Promise.all(nomes.filter(function (n) { return n !== CACHE; }).map(function (n) { return caches.delete(n); }));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', function (e) {
  var pedido = e.request;
  if (pedido.method !== 'GET') return;
  var u = new URL(pedido.url);
  var mesmo = u.origin === self.location.origin;
  var letra = u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com';
  if (!mesmo && !letra) return;
  e.respondWith((async function () {
    var cache = await caches.open(CACHE);
    var guardado = await cache.match(pedido, { ignoreSearch: mesmo, ignoreVary: true });
    // Responde logo com o que está guardado e actualiza por trás quando há rede.
    var rede = fetch(pedido).then(function (r) {
      if (r && r.ok) cache.put(pedido, r.clone()).catch(function () {});
      return r;
    }).catch(function () { return null; });
    if (guardado) { e.waitUntil(rede); return guardado; }
    var r = await rede;
    if (r) return r;
    if (pedido.mode === 'navigate') {
      var inicio = await cache.match('index.html');
      if (inicio) return inicio;
    }
    return new Response('', { status: 504, statusText: 'Sem rede' });
  })());
});

/* Verificação de validades com a aplicação fechada. É o telemóvel que decide quando isto corre. */
self.addEventListener('periodicsync', function (e) {
  if (e.tag === 'validades') e.waitUntil(self.KitAvisos.verificar(self.registration));
});

/* Tocar na notificação abre a aplicação na lista de produtos. */
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil((async function () {
    var janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (var i = 0; i < janelas.length; i++) {
      var c = janelas[i];
      if (c.url.indexOf(self.registration.scope) === 0 && 'focus' in c) { c.postMessage({ ir: 'produtos' }); return c.focus(); }
    }
    return self.clients.openWindow('./#produtos');
  })());
});
