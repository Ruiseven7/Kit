/* Kit de sobrevivência: avisos de validade.
   Este ficheiro é usado pela aplicação (index.html) e pelo sw.js, para a regra existir num só sítio. */
(function (g) {
  'use strict';
  var DIAS_6M = 183; // «últimos 6 meses»: faltam 183 dias ou menos para a data de validade
  var NOME_BD = 'kit-sobrevivencia';

  function hojeUTC() { var d = new Date(); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); }
  function dataOk(v) { return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v); }
  function dias(v) { if (!dataOk(v)) return null; var p = v.split('-').map(Number); return Math.round((Date.UTC(p[0], p[1] - 1, p[2]) - hojeUTC()) / 864e5); }
  function dataPt(v) { var p = v.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function dentro(v) { var n = dias(v); return n !== null && n >= 0 && n <= DIAS_6M; }
  function porAvisar(produtos) { return produtos.filter(function (p) { return p && dentro(p.validade) && !p.aviso6m; }); }

  function abrir() {
    return new Promise(function (res, rej) {
      var r;
      try { r = indexedDB.open(NOME_BD); } catch (e) { rej(e); return; }
      // Se a base ainda não existe, não a cria aqui: isso é trabalho da aplicação.
      r.onupgradeneeded = function () { try { r.transaction.abort(); } catch (e) {} };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function todos(bd) {
    return new Promise(function (res, rej) {
      var r = bd.transaction('produtos').objectStore('produtos').getAll();
      r.onsuccess = function () { res(r.result || []); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function marcar(bd, ids, quando) {
    return new Promise(function (res, rej) {
      var t = bd.transaction('produtos', 'readwrite'), l = t.objectStore('produtos');
      t.oncomplete = function () { res(); };
      t.onerror = function () { rej(t.error); };
      t.onabort = function () { rej(t.error); };
      ids.forEach(function (id) {
        var r = l.get(id);
        r.onsuccess = function () { var p = r.result; if (p && !p.aviso6m) { p.aviso6m = quando; l.put(p); } };
      });
    });
  }
  function texto(lista) {
    if (lista.length === 1) return { titulo: 'Validade a menos de 6 meses', corpo: (lista[0].nome || 'Produto') + ': caduca a ' + dataPt(lista[0].validade) };
    var linhas = lista.slice(0, 4).map(function (p) { return (p.nome || 'Produto') + ' · ' + dataPt(p.validade); });
    if (lista.length > 4) linhas.push('e mais ' + (lista.length - 4));
    return { titulo: lista.length + ' produtos a menos de 6 meses da validade', corpo: linhas.join('\n') };
  }

  /* Mostra uma notificação com os produtos que entraram nos últimos 6 meses e ainda não foram avisados.
     Devolve quantos produtos avisou. Cada produto é avisado uma só vez. */
  async function verificar(registo) {
    if (!registo || !registo.showNotification || typeof Notification === 'undefined' || Notification.permission !== 'granted') return 0;
    var bd;
    try { bd = await abrir(); } catch (e) { return 0; }
    try {
      var lista = porAvisar(await todos(bd)).sort(function (a, b) { return a.validade < b.validade ? -1 : a.validade > b.validade ? 1 : 0; });
      if (!lista.length) return 0;
      var t = texto(lista), d = new Date();
      await registo.showNotification(t.titulo, {
        body: t.corpo,
        tag: 'validade-6m-' + d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(),
        icon: 'icones/icone-192.png',
        data: { ir: 'produtos' }
      });
      await marcar(bd, lista.map(function (p) { return p.id; }), d.toISOString());
      return lista.length;
    } catch (e) { return 0; } finally { try { bd.close(); } catch (e) {} }
  }

  g.KitAvisos = { DIAS_6M: DIAS_6M, dias: dias, dentro: dentro, porAvisar: porAvisar, verificar: verificar };
})(self);
