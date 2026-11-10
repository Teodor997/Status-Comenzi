/* Status Comenzi - interfata */
(function () {
  'use strict';
  var SC = window.SC, L = SC.L, ST = SC.ST, esc = SC.esc;
  function $(id) { return document.getElementById(id); }

  var RH = 30, CAP = 34;
  var stare = {
    tab: 'comenzi',
    f: { q: '', cl: '', st: {}, neinc: false, colData: 'dl', dela: '', panala: '' },
    sort: { k: 'n', dir: 1 },
    lista: [], numarStatus: {}, primaData: true, murdar: false, opriri: [], utilizatori: [], pornit: false
  };

  /* ================= utilitare UI ================= */
  function toast(msg, tip) {
    var d = document.createElement('div');
    d.className = 'toast' + (tip ? ' ' + tip : '');
    d.textContent = msg;
    $('toasturi').appendChild(d);
    setTimeout(function () { d.remove(); }, tip === 'rau' ? 9000 : 4500);
  }
  function arataEroare(e) {
    if (!(e && e.prietenos)) console.error(e);
    toast(e && e.prietenos ? e.message : 'Eroare: ' + (e && e.message ? e.message : e), 'rau');
  }
  /* Fereastra modala. Se inchide doar din butoane sau din X (nu la click in afara).
     butoane: [{t, cls, v, fn(radacina) -> valoare | false (ramane deschisa) | Promise}] */
  function modal(opt) {
    return new Promise(function (rezolva) {
      var fundal = document.createElement('div');
      fundal.className = 'fundal';
      fundal.innerHTML = '<div class="fereastra' + (opt.lat ? ' lata' : '') + '" role="dialog" aria-modal="true">' +
        '<div class="sus"><h3>' + esc(opt.titlu || '') + '</h3><button class="x" aria-label="Închide">×</button></div>' +
        '<div class="mijloc">' + (opt.html || '') + '</div><div class="jos"></div></div>';
      var jos = fundal.querySelector('.jos'), rad = fundal.querySelector('.mijloc'), ocupat = false;
      function inchide(v) { fundal.remove(); rezolva(v); }
      fundal.querySelector('.x').onclick = function () { if (!ocupat) inchide(null); };
      (opt.butoane || [{ t: 'Închide', v: null }]).forEach(function (b) {
        var el = document.createElement('button');
        el.className = 'btn ' + (b.cls || ''); el.textContent = b.t; el.type = 'button';
        el.onclick = function () {
          if (ocupat) return;
          if (!b.fn) return inchide(b.v);
          ocupat = true;
          Promise.resolve().then(function () { return b.fn(rad); }).then(function (r) {
            ocupat = false;
            if (r !== false) inchide(r === undefined ? b.v : r);
          }, function (e) { ocupat = false; arataEroare(e); });
        };
        jos.appendChild(el);
      });
      document.body.appendChild(fundal);
      if (opt.laDeschidere) opt.laDeschidere(rad);
      var primul = rad.querySelector('input:not([readonly]):not([type=checkbox]), select:not(:disabled), textarea:not([readonly])');
      if (primul) primul.focus(); else jos.lastChild.focus();
    });
  }
  function confirma(mesaj, optiuni) {
    optiuni = optiuni || {};
    return modal({
      titlu: optiuni.titlu || 'Confirmare', html: '<pre class="msg">' + esc(mesaj) + '</pre>',
      butoane: [{ t: optiuni.nu || 'Nu', v: false }, { t: optiuni.da || 'Da', v: true, cls: 'pri' }]
    }).then(function (v) { return v === true; });
  }
  function alerta(mesaj, titlu) {
    return modal({ titlu: titlu || 'Status Comenzi', html: '<pre class="msg">' + esc(mesaj) + '</pre>', butoane: [{ t: 'OK', v: true, cls: 'pri' }] });
  }
  function alegeFisier() {
    return new Promise(function (ok) {
      var inp = $('fisier'); inp.value = '';
      inp.onchange = function () { if (inp.files && inp.files[0]) ok(inp.files[0]); };
      inp.click();
    });
  }
  function citesteFisier(f) { return f.arrayBuffer().then(function (b) { return L.citesteExcel(new Uint8Array(b)); }); }
  function poate() { var u = SC.store.user; return !!u && (u.rol === 'admin' || u.rol === 'operator'); }
  function eAdmin() { var u = SC.store.user; return !!u && u.rol === 'admin'; }
  function rol() { return SC.store.user ? SC.store.user.rol : ''; }
  /* Administrator + Operator date: tot ce tine de comenzi, adrese, importuri (poate()).
     Incarcari: doar confirmarea incarcarii.  Transport: doar Nr AUTO. */
  function poateIncarca() { return rol() === 'admin' || rol() === 'incarcari'; }
  function nCom(n) { return n === 1 ? '1 comandă' : n + ' comenzi'; }
  function stampila() { var d = new Date(); return SC.p2(d.getDate()) + '.' + SC.p2(d.getMonth() + 1) + '.' + d.getFullYear() + ' ' + SC.oraAcum(); }

  /* ================= autentificare ================= */
  var modBootstrap = false, listaNume = [];
  function arataLogin(mesaj) {
    opresteTot();
    $('aplicatie').classList.add('ascuns'); $('ecranLogin').classList.remove('ascuns');
    $('loginEroare').textContent = mesaj || ''; $('loginPin').value = '';
    $('loginText').textContent = 'Se încarcă…';
    SC.store.citesteNume().then(function (r) {
      modBootstrap = !r.setup; listaNume = r.lista || [];
      $('campNumeSel').classList.toggle('ascuns', modBootstrap);
      $('campNumeNou').classList.toggle('ascuns', !modBootstrap);
      if (modBootstrap) {
        $('loginText').textContent = 'Prima pornire: creează contul de administrator (numele tău și un PIN de 6 cifre).';
        $('loginBtn').textContent = 'Creează administratorul';
      } else {
        $('loginText').textContent = SC.store.mod === 'demo' ? 'Mod demonstrație — datele rămân doar în acest browser.' : 'Alege numele și introdu PIN-ul.';
        $('loginBtn').textContent = 'Intră';
        var sel = $('loginNume'), vechi = null;
        try { vechi = localStorage.getItem('sc-ultimul-nume'); } catch (e) { /* ignor */ }
        sel.innerHTML = listaNume.slice().sort(function (a, b) { return a.n.localeCompare(b.n, 'ro'); }).map(function (x) {
          return '<option value="' + esc(x.e) + '"' + (x.n === vechi ? ' selected' : '') + '>' + esc(x.n) + '</option>';
        }).join('');
      }
    }, function (e) {
      $('loginText').textContent = '';
      $('loginEroare').textContent = 'Nu pot citi lista de utilizatori (' + (e.message || e) + '). Verifică regulile Firestore și conexiunea.';
    });
  }
  $('formLogin').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var pin = $('loginPin').value.trim(), p;
    $('loginEroare').textContent = '';
    if (!/^\d{6}$/.test(pin)) { $('loginEroare').textContent = 'PIN-ul are exact 6 cifre.'; return; }
    $('loginBtn').disabled = true;
    if (modBootstrap) {
      var nume = $('loginNumeNou').value.trim();
      if (nume.length < 2) { $('loginEroare').textContent = 'Scrie numele.'; $('loginBtn').disabled = false; return; }
      p = SC.store.bootstrap(nume, pin);
    } else {
      var sel = $('loginNume');
      try { localStorage.setItem('sc-ultimul-nume', sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text : ''); } catch (e) { /* ignor */ }
      p = SC.store.login(sel.value, pin);
    }
    p.then(function () { $('loginBtn').disabled = false; }, function (e) {
      $('loginBtn').disabled = false;
      $('loginEroare').textContent = e && e.prietenos ? e.message : 'Autentificare eșuată: ' + (e && e.message ? e.message : e);
    });
  });
  SC.onAuth = function (user, mesaj) { if (user) porneste(); else arataLogin(mesaj); };
  SC.onEroareSync = function (e) {
    $('sync').classList.add('rau'); $('syncText').textContent = 'eroare de sincronizare';
    var b = $('banda'); b.className = 'rau'; b.textContent = e && e.message ? e.message : String(e);
  };

  /* ================= pornire / urmarire ================= */
  function opresteTot() {
    stare.opriri.forEach(function (f) { try { f(); } catch (e) { /* ignor */ } });
    stare.opriri = []; stare.pornit = false;
    L.golesteCache();
  }
  function urmaresteComenzile() {
    var prag = Date.now() - SC.ZILE_RECENTE * 86400000;
    stare.opriri.push(SC.store.urmaresteComenzi(prag, function (lista) {
      L.aplicaGrupe(lista);
      marcheazaSync();
      redeseneaza();
      if (stare.primaData && SC.comenzi.length) { stare.primaData = false; stare.laFinal = true; }
      mergiLaFinal();
    }));
  }
  function mergiLaFinal() {
    if (!stare.laFinal || stare.tab !== 'comenzi') return;
    stare.laFinal = false;
    var t = $('tabel'); t.scrollTop = t.scrollHeight; deseneazaRanduri();
  }
  function porneste() {
    if (stare.pornit) return;
    stare.pornit = true; stare.primaData = true;
    var u = SC.store.user;
    $('ecranLogin').classList.add('ascuns'); $('aplicatie').classList.remove('ascuns');
    $('cine').textContent = u.nume + ' · ' + (SC.ROLURI[u.rol] || u.rol);
    $('tabAdmin').classList.toggle('ascuns', !eAdmin());
    var doarInc = u.rol === 'incarcari';
    document.querySelector('.tab[data-tab=comenzi]').classList.toggle('ascuns', doarInc);
    document.querySelector('.tab[data-tab=adrese]').classList.toggle('ascuns', doarInc);
    Array.prototype.forEach.call(document.querySelectorAll('.doarEdit'), function (el) { el.classList.toggle('ascuns', !poate()); });
    var b = $('banda');
    if (SC.store.mod === 'demo') { b.className = ''; b.textContent = 'Mod demonstrație: datele se păstrează doar în acest browser. Pentru lucrul în echipă completează config.js cu proiectul Firebase.'; }
    else b.className = 'ascuns';
    deseneazaCap();
    stare.opriri.push(SC.store.urmaresteDoc('meta', 'config', function (d) {
      SC.config = Object.assign({}, SC.CONFIG_IMPLICIT, d || {});
      umpleClienti();
      if (stare.tab === 'admin') deseneazaAdmin();
    }));
    stare.opriri.push(SC.store.urmaresteColectie('adrese', function (docs) {
      L.seteazaAdrese(docs);
      if (stare.tab === 'adrese') deseneazaAdrese();
    }));
    if (eAdmin()) {
      stare.opriri.push(SC.store.urmaresteColectie('utilizatori', function (docs) {
        stare.utilizatori = docs;
        if (stare.tab === 'admin') deseneazaAdmin();
      }));
    }
    urmaresteComenzile();
    arataTab(doarInc ? 'incarcari' : 'comenzi');
  }
  function marcheazaSync() {
    $('sync').classList.remove('rau');
    $('syncText').textContent = 'actualizat ' + SC.oraAcum();
    if (SC.store.mod !== 'demo') $('banda').className = 'ascuns';
  }
  function umpleClienti() {
    var opt = SC.config.clienti.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('');
    var v1 = $('fClient').value, v2 = $('adrClient').value;
    $('fClient').innerHTML = '<option value="">Toți clienții</option>' + opt; $('fClient').value = v1;
    $('adrClient').innerHTML = '<option value="">Toți clienții</option>' + opt; $('adrClient').value = v2;
  }
  function arataTab(t) {
    stare.tab = t;
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (b) { b.classList.toggle('activ', b.dataset.tab === t); });
    ['comenzi', 'incarcari', 'adrese', 'admin'].forEach(function (x) { $('pag-' + x).classList.toggle('ascuns', x !== t); });
    if (t === 'comenzi') { redeseneaza(); mergiLaFinal(); }
    else if (t === 'incarcari') deseneazaIncarcari();
    else if (t === 'adrese') deseneazaAdrese();
    else if (t === 'admin') deseneazaAdmin();
  }
  $('taburi').addEventListener('click', function (e) { var b = e.target.closest('.tab'); if (b) arataTab(b.dataset.tab); });
  $('btnIesire').onclick = function () { SC.store.logout(); };
  $('btnPin').onclick = function () {
    modal({
      titlu: 'Schimbă PIN', html: '<label class="camp"><span>PIN nou (6 cifre)</span><input type="password" id="pinNou" inputmode="numeric" maxlength="6"></label>',
      butoane: [{ t: 'Renunță', v: null }, {
        t: 'Salvează', cls: 'pri', fn: function (r) {
          var p = r.querySelector('#pinNou').value.trim();
          if (!/^\d{6}$/.test(p)) { toast('PIN-ul are exact 6 cifre.', 'rau'); return false; }
          return SC.store.schimbaPin(p).then(function () { toast('PIN schimbat.', 'bun'); });
        }
      }]
    });
  };

  /* ================= COMENZI: lista ================= */
  function fan(o) {
    if (!o._h) {
      o._h = SC.normText([o.n, o.cl, o.nc, o.cc, o.de, o.ad, o.or, o.ju, o.na, o.nt, o.ob, o.co, o.im].join(' '));
    }
    return o._h;
  }
  function calculeazaLista() {
    var f = stare.f, cuv = SC.normText(f.q).split(' ').filter(Boolean), num = {}, areSt = Object.keys(f.st).length > 0;
    var baza = SC.comenzi.filter(function (o) {
      if (f.cl && o.cl !== f.cl) return false;
      if (f.neinc && !(o.st === ST.TER && o.inc !== 'DA')) return false;
      if (f.dela || f.panala) {
        var v = o[f.colData] || '';
        if (!v || (f.dela && v < f.dela) || (f.panala && v > f.panala)) return false;
      }
      if (cuv.length) { var h = fan(o); for (var i = 0; i < cuv.length; i++) if (h.indexOf(cuv[i]) < 0) return false; }
      num[o.st] = (num[o.st] || 0) + 1;
      return true;
    });
    stare.numarStatus = num;
    var l = areSt ? baza.filter(function (o) { return f.st[o.st]; }) : baza;
    var k = stare.sort.k, dir = stare.sort.dir;
    if (!(k === 'n' && dir === 1)) {
      l = l.slice().sort(function (a, b) {
        var x = a[k], y = b[k];
        if (x == null || x === '') return (y == null || y === '') ? a.n - b.n : 1;
        if (y == null || y === '') return -1;
        var r = (typeof x === 'number' && typeof y === 'number') ? x - y : String(x).localeCompare(String(y), 'ro', { numeric: true });
        return (r || (a.n - b.n)) * dir;
      });
    }
    stare.lista = l;
  }
  function deseneazaCap() {
    var cols = SC.COLS, latime = 0;
    $('cap').innerHTML = cols.map(function (c) {
      latime += c.w;
      var s = stare.sort.k === c.k ? (stare.sort.dir === 1 ? ' ▲' : ' ▼') : '';
      return '<div data-k="' + c.k + '" title="Sortează după ' + esc(c.t) + '">' + esc(c.t) + s + '</div>';
    }).join('');
    $('tabel').style.setProperty('--cols', cols.map(function (c) { return c.w + 'px'; }).join(' '));
    $('tabel').style.setProperty('--latime', latime + 'px');
  }
  function deseneazaCipuri() {
    var f = stare.f;
    $('fStatus').innerHTML = SC.STATUSURI.map(function (s) {
      return '<button class="cip' + (f.st[s] ? ' activ' : '') + '" data-st="' + esc(s) + '">' + esc(s) + '<b>' + (stare.numarStatus[s] || 0) + '</b></button>';
    }).join('');
  }
  function optiuniStatus(st) {
    var l = SC.STATUSURI.slice();
    if (st && l.indexOf(st) < 0) l.unshift(st);
    return l.map(function (s) { return '<option' + (s === st ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('');
  }
  function randHtml(o, i) {
    var cls = 'rand', edit = poate();
    if (o.st === ST.ANU) cls += ' anulata'; else if (o.st === ST.SELF) cls += ' selfpick';
    else if (SC.esteEDI(o) && SC.esteDeschisa(o)) cls += ' edi';
    var h = '<div class="' + cls + '" data-n="' + o.n + '" style="top:' + (i * RH) + 'px">';
    for (var j = 0; j < SC.COLS.length; j++) {
      var c = SC.COLS[j], v = SC.fmtCelula(o, c), cc = '';
      if (c.typ === 'num' || c.typ === 'int') cc = 'nr';
      if (c.k === 'st') {
        cc = o.st === ST.LUC ? 'st-lucru' : (o.st === ST.TER ? 'st-term' : '');
        h += '<div class="' + cc + '">' + (edit ? '<select class="stSel" aria-label="Status comanda ' + esc(o.nc) + '">' + optiuniStatus(o.st) + '</select>' : esc(v)) + '</div>';
        continue;
      }
      if (c.k === 'im' && SC.esteEDI(o)) cc = 'imp-edi';
      if (c.k === 'ju' && o.jd) cc = 'jd';
      if (c.k === 'inc' && o.inc === 'DA') cc = 'da';
      if (c.k === 'na' && rol() === 'transport' && o.inc !== 'DA') cc = 'ed';
      var titlu = (c.typ === 'txt' && v.length > 14) ? ' title="' + esc(v) + '"' : '';
      h += '<div' + (cc ? ' class="' + cc + '"' : '') + (c.k === 'na' ? ' data-k="na"' : '') + titlu + '>' + esc(v) + '</div>';
    }
    return h + '</div>';
  }
  function deseneazaRanduri() {
    var cont = $('tabel'), corp = $('corp'), N = stare.lista.length;
    corp.style.height = (N * RH) + 'px';
    var sus = cont.scrollTop - CAP;
    var prim = Math.max(0, Math.floor(sus / RH) - 12), ultim = Math.min(N, prim + Math.ceil(cont.clientHeight / RH) + 26);
    var h = '';
    for (var i = prim; i < ultim; i++) h += randHtml(stare.lista[i], i);
    corp.innerHTML = h;
    var gol = $('gol');
    gol.classList.toggle('ascuns', N > 0);
    if (!N) {
      gol.textContent = SC.comenzi.length ? 'Nicio comandă nu corespunde filtrelor.' :
        'Nu există comenzi încărcate. Adaugă o comandă, importă un borderou sau (administrator) fă migrarea din Excel.';
    }
  }
  function redeseneaza() {
    if (stare.tab === 'incarcari') { deseneazaIncarcari(); }
    if (stare.tab !== 'comenzi') return;
    var a = document.activeElement;
    if (a && a.classList && a.classList.contains('stSel')) { stare.murdar = true; return; }
    stare.murdar = false;
    calculeazaLista(); deseneazaCipuri(); deseneazaRanduri();
    var tot = SC.comenzi.length;
    $('numarare').textContent = stare.lista.length === tot ? tot + ' comenzi' : stare.lista.length + ' din ' + tot + ' comenzi încărcate';
  }
  var rafCerut = false;
  $('tabel').addEventListener('scroll', function () {
    if (rafCerut) return;
    rafCerut = true;
    requestAnimationFrame(function () {
      rafCerut = false;
      var a = document.activeElement;
      if (a && a.classList && a.classList.contains('stSel')) return;
      deseneazaRanduri();
    });
  });
  window.addEventListener('resize', function () { if (stare.pornit && stare.tab === 'comenzi') deseneazaRanduri(); });
  $('cap').addEventListener('click', function (e) {
    var d = e.target.closest('[data-k]'); if (!d) return;
    if (stare.sort.k === d.dataset.k) stare.sort.dir = -stare.sort.dir; else stare.sort = { k: d.dataset.k, dir: 1 };
    deseneazaCap(); redeseneaza();
  });
  $('corp').addEventListener('change', function (e) {
    var s = e.target.closest('.stSel'); if (!s) return;
    var o = SC.dupaNr[+s.closest('.rand').dataset.n];
    s.blur();
    if (o) schimbaStatus(o, s.value).catch(arataEroare).then(function () { stare.murdar = false; redeseneaza(); });
  });
  $('corp').addEventListener('focusout', function () { setTimeout(function () { if (stare.murdar) redeseneaza(); }, 0); });
  $('corp').addEventListener('click', function (e) {
    if (e.target.closest('.stSel')) return;
    var r = e.target.closest('.rand'); if (!r) return;
    var o = SC.dupaNr[+r.dataset.n]; if (!o) return;
    if (rol() === 'transport' && e.target.closest('[data-k=na]')) editeazaNrAuto(o); else deschideComanda(o);
  });

  /* filtre */
  var tCauta = null;
  $('fCauta').addEventListener('input', function () {
    clearTimeout(tCauta);
    var v = this.value;
    tCauta = setTimeout(function () { stare.f.q = v; $('tabel').scrollTop = 0; redeseneaza(); }, 180);
  });
  $('fClient').onchange = function () { stare.f.cl = this.value; redeseneaza(); };
  $('fNeinc').onchange = function () { stare.f.neinc = this.checked; redeseneaza(); };
  $('fColData').onchange = function () { stare.f.colData = this.value; redeseneaza(); };
  $('fDela').onchange = function () { stare.f.dela = this.value; redeseneaza(); };
  $('fPanala').onchange = function () { stare.f.panala = this.value; redeseneaza(); };
  $('fStatus').addEventListener('click', function (e) {
    var b = e.target.closest('.cip'); if (!b) return;
    var s = b.dataset.st;
    if (stare.f.st[s]) delete stare.f.st[s]; else stare.f.st[s] = 1;
    redeseneaza();
  });
  $('btnReset').onclick = function () {
    stare.f = { q: '', cl: '', st: {}, neinc: false, colData: stare.f.colData, dela: '', panala: '' };
    $('fCauta').value = ''; $('fClient').value = ''; $('fNeinc').checked = false; $('fDela').value = ''; $('fPanala').value = '';
    redeseneaza();
  };
  $('fScop').onchange = function () {
    $('zonaIstoric').classList.toggle('ascuns', this.value !== 'istoric');
    if (this.value === 'istoric' && !$('iDela').value) { $('iPanala').value = SC.azi(); $('iDela').value = SC.ziPlus(SC.azi(), -30); }
  };
  $('btnIstoric').onclick = function () {
    var a = $('iDela').value, b = $('iPanala').value;
    if (!a || !b || a > b) { toast('Alege perioada (de la – până la).', 'rau'); return; }
    var btn = this; btn.disabled = true;
    /* grupele se cauta dupa momentul introducerii comenzilor; marja de 3 zile acopera grupele care trec peste capatul perioadei */
    SC.store.cautaGrupe(SC.msDin(a, '00:00'), SC.msDin(SC.ziPlus(b, 4), '00:00')).then(function (grupe) {
      btn.disabled = false;
      var noi = grupe.filter(function (d) { return !SC.grupe[d.id] || (SC.grupe[d.id].upd || 0) <= (d.data.upd || 0); });
      L.aplicaGrupe(noi);
      toast('Istoric încărcat: ' + grupe.length + ' grupe de comenzi din perioada aleasă.', 'bun');
      redeseneaza();
    }, function (e) { btn.disabled = false; arataEroare(e); });
  };
  $('btnExport').onclick = function () {
    if (!stare.lista.length) { toast('Nu există comenzi de exportat.', 'rau'); return; }
    L.exportExcel(stare.lista, 'Status Comenzi ' + SC.azi() + '.xlsx');
  };

  /* ================= COMENZI: statusuri ================= */
  function cereDateTerminare(o, st) {
    var cfg = SC.config, auto = L.greutateAuto(o), eKandia = SC.normText(o.cl) === SC.normText(cfg.clientGreutateAuto);
    var est = SC.esteNum(o.pe) ? o.pe : null;
    var html = '<div class="nota">' + esc(o.cl) + ' · comanda <b>' + esc(o.nc) + '</b><br>' + esc(o.de || '') +
      (est != null ? '<br>Paleți estimați: <b>' + SC.fmtNum(est, 'num') + '</b>' : '') +
      (SC.esteNum(o.g) ? ' · Greutate: <b>' + SC.fmtNum(o.g, 'num') + ' kg</b>' : '') + '</div>' +
      '<div class="grila">' +
      '<label class="camp"><span>Paleți reali</span><input type="text" id="tPr" inputmode="numeric" value="' + (SC.esteNum(o.pr) ? o.pr : '') + '"></label>' +
      '<label class="camp"><span>Amprente paleți</span><input type="text" id="tAm" inputmode="numeric" value="' + (SC.esteNum(o.am) ? o.am : '') + '"></label>' +
      (auto ? '' : '<label class="camp"><span>Greutate finală (kg)</span><input type="text" id="tGf" inputmode="decimal" value="' + (SC.esteNum(o.gf) ? String(o.gf).replace('.', ',') : '') + '"></label>') +
      '</div>' +
      (auto ? '<div class="mic">Greutatea finală se calculează automat: greutate + paleți reali × ' + cfg.kgPalet + ' kg.</div>' :
        (eKandia ? '<div class="nota atentie">Comanda este ' + esc(cfg.clientGreutateAuto) + ', dar Greutatea lipsește, deci greutatea finală se introduce manual.</div>' :
          '<div class="mic">Zecimalele se scriu cu virgulă (ex. 2135,45).</div>'));
    function intreg(v, nume) {
      var n = SC.parseNum(v);
      if (n == null) { toast(nume + ': „' + v + '” nu este un număr.', 'rau'); return null; }
      if (n < 0) { toast(nume + ' nu poate fi negativ.', 'rau'); return null; }
      if (n !== Math.floor(n)) { toast(nume + ': introdu un număr întreg.', 'rau'); return null; }
      return n;
    }
    return modal({
      titlu: st === ST.SELF ? 'Ridicare client — date pregătire' : 'Terminare comandă', html: html,
      butoane: [{ t: 'Renunță', v: null }, {
        t: 'Confirmă', cls: 'pri', fn: function (r) {
          var pr = intreg(r.querySelector('#tPr').value.trim(), 'Paleți reali'); if (pr == null) return false;
          var am = intreg(r.querySelector('#tAm').value.trim(), 'Amprente'); if (am == null) return false;
          var gf = null, pasi = Promise.resolve(true);
          if (!auto) {
            gf = SC.parseNum(r.querySelector('#tGf').value.trim());
            if (gf == null || gf < 0) { toast('Greutatea finală nu este un număr valid.', 'rau'); return false; }
          }
          if (est != null) {
            var rot = Math.ceil(est);
            if (Math.abs(pr - rot) > cfg.tolerantaPaleti) {
              pasi = pasi.then(function (ok) {
                return ok && confirma('Pentru comanda ' + o.nc + ' estimarea este ' + SC.fmtNum(est, 'num') + ' paleți (aprox. ' + rot + ').\nNumărul introdus este ' + pr + '. Este corect?');
              });
            }
          }
          if (am > pr) {
            pasi = pasi.then(function (ok) {
              return ok && confirma('Ai introdus ' + am + ' amprente la ' + pr + ' paleți reali.\nAmprentele sunt de obicei cel mult egale cu paleții. Este corect?');
            });
          }
          if (!auto && SC.esteNum(o.g) && o.g > 0 && gf > o.g * cfg.factorGreutate) {
            pasi = pasi.then(function (ok) {
              return ok && confirma('Greutatea finală introdusă (' + SC.fmtNum(gf, 'num') + ' kg) este de peste ' + cfg.factorGreutate +
                ' ori mai mare decât greutatea din comandă (' + SC.fmtNum(o.g, 'num') + ' kg).\nZecimalele se introduc cu virgulă (ex. 2135,454). Este corectă valoarea?');
            });
          }
          return pasi.then(function (ok) { return ok ? { pr: pr, am: am, gf: gf } : false; });
        }
      }]
    });
  }
  function schimbaStatus(o, stNou) {
    var vechi = o.st, nc = o.nc, n = o.n;
    if (stNou === vechi) return Promise.resolve();
    var p;
    if (stNou === ST.TER) p = cereDateTerminare(o, stNou);
    else if (stNou === ST.SELF) {
      p = confirma('Comanda ' + nc + ' se ridică de către client?').then(function (ok) { return ok ? cereDateTerminare(o, stNou) : null; });
    } else if (stNou === ST.ANU) {
      p = confirma('Ești sigur că vrei să anulezi comanda ' + nc + '?\n\nToate datele comenzii se șterg; rămân Nr Crt, clientul, numărul de comandă și eticheta de import.').then(function (ok) { return ok ? {} : null; });
    } else p = Promise.resolve({});
    return p.then(function (date) {
      if (!date) return;
      return L.modifica([{
        n: n, fn: function (x) {
          if (x.st !== vechi) throw L.eroare('Statusul comenzii ' + nc + ' a fost schimbat între timp de un coleg (acum: ' + x.st + '). Verifică și repetă.');
          L.aplicaStatus(x, stNou, date);
        }
      }], nc + ': ' + vechi + ' → ' + stNou).then(function () { toast('Comanda ' + nc + ': ' + stNou, 'bun'); });
    });
  }

  /* ================= COMENZI: formular ================= */
  var CAMPURI_FORM = ['cl', 'nc', 'cc', 'dc', 'dl', 'de', 'ad', 'or', 'ju', 'g', 'ca', 'pe', 'gf', 'pr', 'am', 'dp', 'op', 'na', 'nt', 'inc', 'di', 'ob', 'co', 'sc', 'te', 'se', 'so', 're'];
  var CAMPURI_NOI = ['cl', 'nc', 'cc', 'dc', 'dl', 'de', 'ad', 'or', 'ju', 'g', 'ca', 'pe', 'na', 'ob', 'co'];
  var LATE = { de: 1, ad: 1, ob: 1, co: 1 };
  function campHtml(k, val, editabil) {
    var c = SC.COL[k], v = val == null ? '' : val, ro = editabil ? '' : ' readonly', inp;
    if (k === 'cl') {
      var l = SC.config.clienti.slice(); if (v && l.indexOf(v) < 0) l.unshift(v);
      inp = '<select data-k="cl"' + (editabil ? '' : ' disabled') + '><option value=""></option>' +
        l.map(function (x) { return '<option' + (x === v ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select>';
    } else if (k === 'inc') {
      inp = '<select data-k="inc"' + (editabil ? '' : ' disabled') + '>' + ['', 'DA', 'NU'].map(function (x) {
        return '<option' + (x === v ? ' selected' : '') + '>' + x + '</option>';
      }).join('') + '</select>';
    } else if (c.typ === 'date' && (v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v))) {
      inp = '<input type="date" data-k="' + k + '" value="' + esc(v) + '"' + ro + '>';
    } else if (c.typ === 'num' || c.typ === 'int') {
      inp = '<input type="text" inputmode="decimal" data-k="' + k + '" value="' + esc(SC.esteNum(v) ? String(v).replace('.', ',') : v) + '"' + ro + '>';
    } else {
      inp = '<input type="text" data-k="' + k + '" value="' + esc(v) + '"' + ro + '>';
    }
    return '<label class="camp' + (LATE[k] ? ' lat2' : '') + '"><span>' + esc(c.t) + '</span>' + inp + '</label>';
  }
  function citesteCampuri(rad) {
    var val = {}, greseala = null;
    Array.prototype.forEach.call(rad.querySelectorAll('[data-k]'), function (el) {
      var k = el.dataset.k, c = SC.COL[k], v = String(el.value || '').trim();
      if ((c.typ === 'num' || c.typ === 'int') && v !== '') {
        var n = SC.parseNum(v);
        if (n == null) { if (!el.readOnly && el.value !== el.defaultValue) greseala = c.t + ': „' + v + '” nu este un număr.'; }
        else v = n;
      }
      if (k === 'na' || k === 'cl') v = String(v).toUpperCase();
      val[k] = v;
    });
    if (greseala) { toast(greseala, 'rau'); return null; }
    return val;
  }
  /* la schimbarea codului de client: Destinatar / Adresa / Oras / Judet din Adrese (dupa Client + Cod) */
  function leagaCodClient(rad) {
    var cod = rad.querySelector('[data-k=cc]'); if (!cod || cod.readOnly) return;
    cod.addEventListener('change', function () {
      var cl = rad.querySelector('[data-k=cl]').value, v = cod.value.trim();
      if (!v) return;
      if (!cl) { toast('Alege întâi clientul, apoi codul — același cod există la mai mulți clienți.', 'rau'); return; }
      var a = L.adresaDupaCod(cl, v);
      if (!a) { toast('Codul „' + v + '” nu există în Adrese pentru clientul ' + cl + '.', 'rau'); return; }
      [['de', a.nume], ['ad', a.str], ['or', a.loc], ['ju', a.jud]].forEach(function (p) {
        var el = rad.querySelector('[data-k=' + p[0] + ']');
        if (el && !el.readOnly) el.value = p[1] || '';
      });
    });
  }
  function verificaDublura(nc, cl, exceptN) {
    return L.cautaComenzi([nc]).then(function (rez) {
      var l = (rez[SC.cheieComanda(nc)] || []).filter(function (x) { return x.n !== exceptN && (!cl || !x.cl || x.cl === cl); });
      if (!l.length) return true;
      var x = l[0];
      return confirma('Comanda ' + nc + (cl ? ' (' + cl + ')' : '') + ' există deja: Nr Crt ' + x.n + ', status ' + x.st + '.\n\nPăstrezi totuși comanda și aici?');
    });
  }
  /* rolul Transport: singura modificare permisa este Nr AUTO, direct din lista */
  function editeazaNrAuto(o) {
    if (o.inc === 'DA') { toast('Comanda ' + o.nc + ' este deja încărcată; numărul auto nu mai poate fi schimbat.', 'rau'); return; }
    var n = o.n;
    modal({
      titlu: 'Nr AUTO — comanda ' + o.nc,
      html: '<div class="nota">' + esc(o.cl) + ' · ' + esc(o.de || '') + '</div><label class="camp"><span>Nr AUTO</span><input type="text" id="naNou" value="' + esc(o.na || '') + '" maxlength="20"></label>',
      butoane: [{ t: 'Renunță', v: null }, {
        t: 'Salvează', cls: 'pri', fn: function (rad) {
          var v = rad.querySelector('#naNou').value.trim().toUpperCase();
          if (v === String(o.na || '')) return null;
          return L.modifica([{
            n: n, fn: function (x) {
              if (x.inc === 'DA') throw L.eroare('Comanda ' + x.nc + ' a fost încărcată între timp; numărul auto nu mai poate fi schimbat.');
              if (v) x.na = v; else delete x.na;
            }
          }]).then(function () { toast('Nr AUTO salvat pentru comanda ' + o.nc + '.', 'bun'); redeseneaza(); });
        }
      }]
    });
  }
  function deschideComanda(o) {
    var r = rol(), n = o.n;
    function editabil(k) {
      if (r === 'admin') return true;
      if (r === 'operator') return !SC.CAMPURI_INCARCARE[k];
      if (r === 'transport') return k === 'na' && o.inc !== 'DA';
      return false;
    }
    var edit = CAMPURI_FORM.some(editabil);
    var html = '<div class="nota">Nr Crt <b>' + o.n + '</b> · Status <b>' + esc(o.st) + '</b> · Import: ' + esc(o.im || '—') +
      (o.cu ? '<br><span class="mic">Introdusă de ' + esc(o.cu) + (o.uu ? ' · ultima modificare: ' + esc(o.uu) + ', ' + esc(SC.fmtDT(SC.ymd(new Date(o.ut)) + ' ' + SC.p2(new Date(o.ut).getHours()) + ':' + SC.p2(new Date(o.ut).getMinutes()))) : '') + '</span>' : '') +
      (o.ar ? '<br><span class="mic">Comandă arhivată (terminată, fără confirmare de încărcare).</span>' : '') + '</div><div class="grila">';
    CAMPURI_FORM.forEach(function (k) {
      html += campHtml(k, o[k], editabil(k));
    });
    html += '</div>' + (r === 'operator' ? '<div class="mic">Statusul se schimbă din lista de comenzi, iar câmpurile de încărcare din tabul Încărcări. Fiecare modificare rămâne în jurnal, cu valoarea veche și cea nouă.</div>' :
      (r === 'transport' ? '<div class="mic">Poți modifica doar Nr AUTO, cât timp comanda nu este încărcată.</div>' : ''));
    var butoane = [{ t: 'Închide', v: null }];
    if (edit) {
      butoane.push({
        t: 'Salvează', cls: 'pri', fn: function (rad) {
          var val = citesteCampuri(rad); if (!val) return false;
          var schimbari = {};
          Object.keys(val).forEach(function (k) {
            var vechi = o[k] == null ? '' : o[k];
            if (String(val[k]) !== String(vechi)) schimbari[k] = val[k];
          });
          var chei = Object.keys(schimbari);
          if (!chei.length) return null;
          if ('nc' in schimbari && !schimbari.nc) { toast('Numărul de comandă nu poate fi șters. Pentru renunțare folosește statusul Anulata.', 'rau'); return false; }
          if (schimbari.inc && o.st !== ST.TER) { toast('O comandă poate fi marcată ca încărcată doar dacă are statusul Terminata.', 'rau'); return false; }
          var pas = ('nc' in schimbari || 'cl' in schimbari) ? verificaDublura(val.nc, val.cl, n) : Promise.resolve(true);
          return pas.then(function (ok) {
            if (!ok) return false;
            return L.modifica([{
              n: n, fn: function (x) {
                chei.forEach(function (k) {
                  if (!editabil(k)) throw L.eroare('Nu ai drept de modificare pe câmpul „' + SC.COL[k].t + '”.');
                  if (r === 'transport' && x.inc === 'DA') throw L.eroare('Comanda a fost încărcată între timp; numărul auto nu mai poate fi schimbat.');
                  if (schimbari[k] === '') delete x[k]; else x[k] = schimbari[k];
                  if (k === 'ju') delete x.jd;
                  if (k === 'inc' && schimbari[k] === 'DA' && !x.di) x.di = SC.dtAcum();
                });
              }
            }], o.nc + ': modificat ' + chei.map(function (k) { return SC.COL[k].t; }).join(', ')).then(function () { toast('Comanda ' + o.nc + ' a fost salvată.', 'bun'); redeseneaza(); });
          });
        }
      });
    }
    return modal({ titlu: 'Comanda ' + o.nc + (o.cl ? ' — ' + o.cl : ''), html: html, lat: true, butoane: butoane, laDeschidere: leagaCodClient });
  }
  $('btnNoua').onclick = function () {
    var html = '<div class="grila">' + CAMPURI_NOI.map(function (k) { return campHtml(k, '', true); }).join('') + '</div>' +
      '<div class="mic">Comanda primește statusul Initiata, următorul Nr Crt și eticheta „MANUAL: data ora”. Cu Cod Client completat, destinatarul și adresa vin din Adrese.</div>';
    modal({
      titlu: 'Comandă nouă', html: html, lat: true, laDeschidere: leagaCodClient,
      butoane: [{ t: 'Renunță', v: null }, {
        t: 'Adaugă comanda', cls: 'pri', fn: function (rad) {
          var val = citesteCampuri(rad); if (!val) return false;
          if (!val.cl) { toast('Alege clientul.', 'rau'); return false; }
          if (!val.nc) { toast('Scrie numărul de comandă.', 'rau'); return false; }
          return verificaDublura(val.nc, val.cl, -1).then(function (ok) {
            if (!ok) return false;
            val.st = ST.INI; val.im = 'MANUAL: ' + stampila();
            return L.creeaza([val], 'Comandă nouă ' + val.cl + ' ' + val.nc).then(function (nr) {
              toast('Comanda ' + val.nc + ' a fost adăugată cu Nr Crt ' + nr[0] + '.', 'bun');
              redeseneaza(); $('tabel').scrollTop = $('tabel').scrollHeight;
            });
          });
        }
      }]
    });
  };

  /* ================= import borderou Kandia ================= */
  function listaHtml(linii, max) {
    var l = linii.slice(0, max || 15).map(function (x) { return '<div style="padding:3px 8px">' + esc(x) + '</div>'; }).join('');
    return '<div class="lista-mica">' + l + (linii.length > (max || 15) ? '<div style="padding:3px 8px">… încă ' + (linii.length - (max || 15)) + '</div>' : '') + '</div>';
  }
  $('btnBorderou').onclick = function () {
    var fisier, b, client = SC.config.clientGreutateAuto || 'KANDIA';
    alegeFisier().then(function (f) {
      fisier = f;
      if (!/\.xlsx$/i.test(f.name)) throw L.eroare('Borderoul trebuie să fie un fișier .xlsx: ' + f.name);
      return citesteFisier(f);
    }).then(function (wb) {
      b = L.parseBorderou(wb, fisier.name, fisier.lastModified);
      return SC.store.citesteDoc('meta', 'importuri');
    }).then(function (imp) {
      var deja = imp && (imp.l || []).filter(function (x) { return x.f === fisier.name; })[0];
      if (!deja) return true;
      return confirma('Fișierul „' + fisier.name + '” a mai fost importat (' + deja.t + ', ' + deja.u + ').\nComenzile existente vor fi oricum sărite. Continui?');
    }).then(function (ok) {
      if (!ok) return null;
      return L.cautaComenzi(b.randuri.map(function (r) { return r.nc; }));
    }).then(function (exist) {
      if (!exist) return;
      var noi = [], dubluri = [], vazute = {}, dupaOras = 0, faraJudet = [];
      b.randuri.forEach(function (r) {
        var k = SC.cheieComanda(r.nc);
        if ((exist[k] && exist[k].length) || vazute[k]) {
          dubluri.push(r.nc + (exist[k] && exist[k].length ? ' (Nr Crt ' + exist[k][0].n + ')' : ' (de două ori în borderou)'));
          return;
        }
        vazute[k] = 1;
        var o = { cl: client, st: ST.INI, im: b.eticheta, nc: r.nc, dc: r.dc, dl: r.dl, de: r.de, ad: r.ad, or: r.or, g: r.g, ca: r.ca, pe: r.pe, ob: r.ob };
        var a = L.adresaDupaNume(client, r.de, r.ad, r.or);
        if (a && a.jud) o.ju = a.jud;
        else {
          var j = L.judetDupaLocalitate(r.or);
          if (j) { o.ju = j; o.jd = 1; dupaOras++; } else faraJudet.push(o);
        }
        noi.push(o);
      });
      var html = '<div class="nota">Borderou (' + b.tip + '): <b>' + esc(fisier.name) + '</b><br>Eticheta de import: <b>' + esc(b.eticheta) + '</b></div>' +
        '<div><b>Comenzi noi: ' + noi.length + '</b></div>';
      if (dubluri.length) html += '<div>Comenzi sărite (existau deja): ' + dubluri.length + '</div>' + listaHtml(dubluri);
      if (b.ramase) html += '<div class="nota atentie">Atenție: după ultima comandă citită mai sunt ' + b.ramase + ' rânduri completate în borderou care nu au fost preluate (coloana A nu este un număr de comandă). Verifică fișierul.</div>';
      if (b.adreseCorectate) html += '<div class="mic">' + b.adreseCorectate + ' adrese transformate de Excel în dată au fost refăcute ca text (ex. „22 Decembrie 1989”).</div>';
      if (dupaOras) html += '<div class="mic">Județ completat după oraș (destinatar negăsit în Adrese): ' + dupaOras + ' — apare cu roșu în listă.</div>';
      if (faraJudet.length) {
        html += '<div class="nota atentie">Nu am găsit județul pentru ' + nCom(faraJudet.length) + '. Completează-l aici sau lasă gol:</div><div class="lista-mica"><table class="simplu">' +
          faraJudet.map(function (o, i) {
            return '<tr><td>' + esc(o.nc) + '</td><td>' + esc(o.de) + '<br><span class="mic">' + esc(o.ad) + ' · ' + esc(o.or) + '</span></td><td><input type="text" data-j="' + i + '" placeholder="Județ" style="width:120px"></td></tr>';
          }).join('') + '</table></div>';
      }
      if (!noi.length) return alerta('Borderou (' + b.tip + '): ' + fisier.name + '\n\nNicio comandă nouă — toate cele ' + dubluri.length + ' există deja.');
      return modal({
        titlu: 'Import borderou', html: html, lat: true,
        butoane: [{ t: 'Renunță', v: null }, {
          t: 'Importă ' + nCom(noi.length), cls: 'pri', fn: function (rad) {
            Array.prototype.forEach.call(rad.querySelectorAll('[data-j]'), function (el) {
              var v = el.value.trim(); if (v) faraJudet[+el.dataset.j].ju = v;
            });
            return L.creeaza(noi, 'Import borderou ' + fisier.name + ': ' + noi.length + ' comenzi').then(function (nr) {
              return SC.store.tx(function (t) {
                return t.get('meta', 'importuri').then(function (d) {
                  d = d || { l: [] };
                  d.l.push({ f: fisier.name, t: stampila(), u: SC.store.user.nume, k: noi.length });
                  if (d.l.length > 300) d.l = d.l.slice(-300);
                  t.set('meta', 'importuri', d);
                });
              }).then(function () {
                toast('Importate ' + noi.length + ' comenzi (Nr Crt ' + nr[0] + '–' + nr[nr.length - 1] + ').', 'bun');
                redeseneaza(); $('tabel').scrollTop = $('tabel').scrollHeight;
              });
            });
          }
        }]
      });
    }).catch(arataEroare);
  };

  /* ================= import din Excel cu antetele registrului ================= */
  $('btnImportExcel').onclick = function () {
    var fisier, p;
    alegeFisier().then(function (f) { fisier = f; return citesteFisier(f); }).then(function (wb) {
      p = L.parseRegistru(wb);
      if (!p.comenzi.length) throw L.eroare('Fișierul nu conține comenzi (coloana „Nr. Comanda” este goală).');
      return L.cautaComenzi(p.comenzi.map(function (o) { return o.nc; }));
    }).then(function (exist) {
      var noi = [], sarite = 0, vazute = {};
      p.comenzi.forEach(function (o) {
        var k = SC.cheieComanda(o.nc) + '|' + (o.cl || '');
        var are = (exist[SC.cheieComanda(o.nc)] || []).some(function (x) { return !o.cl || !x.cl || x.cl === o.cl; });
        if (are || vazute[k]) { sarite++; return; }
        vazute[k] = 1;
        var c = JSON.parse(JSON.stringify(o));
        delete c.n;
        if (!c.im) c.im = 'MANUAL: ' + stampila();
        if (c.cc && c.cl) {
          var a = L.adresaDupaCod(c.cl, c.cc);
          if (a) { if (!c.de) c.de = a.nume; if (!c.ad) c.ad = a.str; if (!c.or) c.or = a.loc; if (!c.ju) c.ju = a.jud; }
        }
        noi.push(c);
      });
      var html = '<div class="nota">Fișier: <b>' + esc(fisier.name) + '</b> (foaia „' + esc(p.foaie) + '”)</div>' +
        '<div><b>Comenzi noi: ' + noi.length + '</b> · sărite (există deja la același client): ' + sarite + '</div>' +
        (p.lipsa.length ? '<div class="mic">Coloane care lipsesc din fișier (rămân goale): ' + esc(p.lipsa.join(', ')) + '</div>' : '') +
        '<div class="mic">Coloanele se potrivesc după numele din antet (rândul 1), ca în registrul Excel. Comenzile primesc Nr Crt noi; statusul gol devine Initiata.</div>';
      if (!noi.length) return alerta('Nicio comandă nouă în „' + fisier.name + '” — toate cele ' + sarite + ' există deja.');
      return modal({
        titlu: 'Import din Excel', html: html,
        butoane: [{ t: 'Renunță', v: null }, {
          t: 'Importă ' + nCom(noi.length), cls: 'pri', fn: function () {
            return L.creeaza(noi, 'Import Excel ' + fisier.name + ': ' + noi.length + ' comenzi').then(function () {
              toast('Importate ' + noi.length + ' comenzi.', 'bun'); redeseneaza(); $('tabel').scrollTop = $('tabel').scrollHeight;
            });
          }
        }]
      });
    }).catch(arataEroare);
  };

  /* ================= ÎNCĂRCĂRI ================= */
  function grupeCamioane() {
    var g = {}, azi = SC.azi(), siAzi = $('incAzi').checked, q = SC.normNrAuto($('incCauta').value);
    SC.comenzi.forEach(function (o) {
      if (!o.na || o.ar || o.st === ST.ANU) return;
      var k = (o.nt || '') + '|' + SC.normNrAuto(o.na);
      (g[k] = g[k] || { cheie: k, na: o.na, nt: o.nt || '', toate: [] }).toate.push(o);
    });
    return Object.keys(g).map(function (k) { return g[k]; }).filter(function (x) {
      x.deIncarcat = x.toate.filter(function (o) { return o.st === ST.TER && o.inc !== 'DA'; });
      x.inLucru = x.toate.filter(function (o) { return SC.esteDeschisa(o); });
      x.incarcateAzi = x.toate.filter(function (o) { return o.inc === 'DA' && String(o.di || '').slice(0, 10) === azi; });
      if (q && SC.normNrAuto(x.na).indexOf(q) < 0 && SC.normNrAuto(x.nt).indexOf(q) < 0) return false;
      if (q) return true;
      return x.deIncarcat.length > 0 || x.inLucru.length > 0 || (siAzi && x.incarcateAzi.length > 0);
    }).sort(function (a, b) { return (b.deIncarcat.length > 0) - (a.deIncarcat.length > 0) || a.na.localeCompare(b.na); });
  }
  function suma(l, k) { return l.reduce(function (s, o) { return s + (SC.esteNum(o[k]) ? o[k] : 0); }, 0); }
  var camioaneAfisate = {};
  function deseneazaIncarcari() {
    var l = grupeCamioane(), edit = poateIncarca();
    camioaneAfisate = {};
    if (!l.length) { $('incLista').innerHTML = '<div class="mic" style="padding:10px">Niciun camion cu comenzi de încărcat. Nr AUTO se completează pe comandă sau prin importul fișierului de transport.</div>'; return; }
    var h = '<table class="simplu"><tr><th>Nr AUTO</th><th>Nr transport</th><th>De încărcat</th><th>În lucru</th><th class="nr">Paleți reali</th><th class="nr">Amprente</th><th class="nr">Greutate finală</th><th></th></tr>';
    l.slice(0, 300).forEach(function (x, i) {
      camioaneAfisate[i] = x;
      var baza = x.deIncarcat.length ? x.deIncarcat : x.incarcateAzi;
      h += '<tr><td><b>' + esc(x.na) + '</b></td><td>' + esc(x.nt) + '</td><td>' +
        (x.deIncarcat.length ? '<span class="eticheta asteapta">' + nCom(x.deIncarcat.length) + '</span>' : (x.incarcateAzi.length ? '<span class="eticheta ok">încărcat azi (' + x.incarcateAzi.length + ')</span>' : '—')) +
        '</td><td>' + (x.inLucru.length || '') + '</td><td class="nr">' + SC.fmtNum(suma(baza, 'pr'), 'int') + '</td><td class="nr">' + SC.fmtNum(suma(baza, 'am'), 'int') +
        '</td><td class="nr">' + SC.fmtNum(suma(baza, 'gf'), 'num') + '</td><td style="white-space:nowrap">' +
        (edit && x.deIncarcat.length ? '<button class="btn mic pri" data-inc="' + i + '">Încarcă</button> ' : '') +
        '<button class="btn mic" data-print="' + i + '">Borderou</button></td></tr>';
    });
    $('incLista').innerHTML = h + '</table>';
  }
  $('incCauta').addEventListener('input', deseneazaIncarcari);
  $('incAzi').onchange = deseneazaIncarcari;
  $('incLista').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.inc != null) incarcaCamion(camioaneAfisate[+b.dataset.inc]);
    else if (b.dataset.print != null) tiparesteCamion(camioaneAfisate[+b.dataset.print]);
  });
  function incarcaCamion(x) {
    var l = x.deIncarcat;
    var html = '<div class="nota">Camion <b>' + esc(x.na) + '</b>' + (x.nt ? ' · transport <b>' + esc(x.nt) + '</b>' : '') + '</div>' +
      '<div class="lista-mica"><table class="simplu"><tr><th></th><th>Comandă</th><th>Destinatar</th><th class="nr">Paleți</th><th class="nr">Amprente</th></tr>' +
      l.map(function (o) {
        return '<tr><td><input type="checkbox" data-n="' + o.n + '" checked aria-label="Încarcă ' + esc(o.nc) + '"></td><td>' + esc(o.cl) + ' ' + esc(o.nc) + '</td><td>' + esc(o.de || '') + '</td><td class="nr">' +
          SC.fmtNum(o.pr, 'int') + '</td><td class="nr">' + SC.fmtNum(o.am, 'int') + '</td></tr>';
      }).join('') + '</table></div>' +
      (x.inLucru.length ? '<div class="nota atentie">' + x.inLucru.length + ' comenzi cu acest număr auto nu sunt încă Terminata și nu pot fi încărcate: ' + esc(x.inLucru.map(function (o) { return o.nc; }).join(', ')) + '</div>' : '') +
      '<div class="grila"><label class="camp"><span>Stare camion</span><select id="iStare"><option>OK</option><option>NOK</option></select></label>' +
      '<label class="camp"><span>Temperatură</span><input type="text" id="iTemp" inputmode="decimal"></label>' +
      '<label class="camp"><span>Semnătură (nume)</span><input type="text" id="iSemn" value="' + esc(SC.store.user.nume) + '"></label></div>' +
      '<div class="mic">Comenzile debifate rămân neîncărcate și pot pleca cu alt camion.</div>';
    modal({
      titlu: 'Confirmare încărcare', html: html, lat: true,
      butoane: [{ t: 'Renunță', v: null }, {
        t: 'Confirmă încărcarea', cls: 'pri', fn: function (rad) {
          var nr = Array.prototype.filter.call(rad.querySelectorAll('[data-n]'), function (c) { return c.checked; }).map(function (c) { return +c.dataset.n; });
          if (!nr.length) { toast('Bifează cel puțin o comandă.', 'rau'); return false; }
          var stareC = rad.querySelector('#iStare').value, temp = rad.querySelector('#iTemp').value.trim(), semn = rad.querySelector('#iSemn').value.trim();
          if (!semn) { toast('Completează semnătura (numele celui care confirmă).', 'rau'); return false; }
          var acum = SC.dtAcum();
          return L.modifica(nr.map(function (n) {
            return {
              n: n, fn: function (o) {
                if (o.st !== ST.TER) throw L.eroare('Comanda ' + o.nc + ' nu mai are statusul Terminata (acum: ' + o.st + ').');
                o.inc = 'DA'; o.di = acum; o.sc = stareC; o.te = temp; o.se = semn;
              }
            };
          }), 'Încărcare ' + x.na + (x.nt ? ' / transport ' + x.nt : '') + ': ' + nr.length + ' comenzi, camion ' + stareC).then(function () {
            toast('Camion ' + x.na + ': ' + nCom(nr.length) + ' încărcate.', 'bun');
            $('incAzi').checked = true; deseneazaIncarcari();
          });
        }
      }]
    });
  }
  function tiparesteCamion(x) {
    var l = (x.deIncarcat.length ? x.deIncarcat : (x.incarcateAzi.length ? x.incarcateAzi : x.toate)).slice().sort(function (a, b) { return a.n - b.n; });
    var cols = [['n', 'Nr Crt'], ['cl', 'Client'], ['nc', 'Nr. Comandă'], ['dl', 'Livrare'], ['de', 'Destinatar'], ['or', 'Oraș'], ['ju', 'Județ'], ['ca', 'Cartoane'], ['pr', 'Paleți reali'], ['am', 'Amprente'], ['gf', 'Greutate finală']];
    var h = '<h1>Borderou de încărcare</h1><div>Nr AUTO: <b>' + esc(x.na) + '</b>' + (x.nt ? ' · Nr transport: <b>' + esc(x.nt) + '</b>' : '') +
      (l[0] && l[0].so ? ' · Șofer: ' + esc(l[0].so) : '') + ' · Tipărit: ' + esc(stampila()) + '</div><table><tr>' +
      cols.map(function (c) { var num = ['ca', 'pr', 'am', 'gf', 'n'].indexOf(c[0]) >= 0; return '<th' + (num ? ' class="nr"' : '') + '>' + c[1] + '</th>'; }).join('') + '</tr>';
    l.forEach(function (o) {
      h += '<tr>' + cols.map(function (c) {
        var col = SC.COL[c[0]], num = col.typ === 'num' || col.typ === 'int';
        return '<td' + (num ? ' class="nr"' : '') + '>' + esc(SC.fmtCelula(o, col)) + '</td>';
      }).join('') + '</tr>';
    });
    h += '<tr><th colspan="7">TOTAL (' + l.length + ' comenzi)</th><th class="nr">' + SC.fmtNum(suma(l, 'ca'), 'int') + '</th><th class="nr">' + SC.fmtNum(suma(l, 'pr'), 'int') +
      '</th><th class="nr">' + SC.fmtNum(suma(l, 'am'), 'int') + '</th><th class="nr">' + SC.fmtNum(suma(l, 'gf'), 'num') + '</th></tr></table>' +
      '<div class="semnaturi"><div>Stare camion: ' + esc((l[0] && l[0].sc) || '________') + ' · Temperatură: ' + esc((l[0] && l[0].te) || '________') + '</div><div>Semnătură depozit: ' + esc((l[0] && l[0].se) || '________________') + '</div><div>Semnătură șofer: ________________</div></div>';
    $('tiparire').innerHTML = h;
    window.print();
  }
  $('btnTransport').onclick = function () {
    var fisier, p;
    alegeFisier().then(function (f) { fisier = f; return citesteFisier(f); }).then(function (wb) {
      p = L.parseTransport(wb);
      if (!p.randuri.length) throw L.eroare('Fișierul nu conține rânduri cu ReferintaClient și Masina.');
      return L.cautaComenzi(p.randuri.map(function (r) { return r.ref; }));
    }).then(function (exist) {
      var noi = [], schimbate = [], neschimbate = 0, dejaInc = 0, necunoscute = [], vazute = {};
      p.randuri.forEach(function (r) {
        var k = SC.cheieComanda(r.ref);
        if (vazute[k]) return; vazute[k] = 1;
        var l = (exist[k] || []).filter(function (o) { return o.st !== ST.ANU; });
        if (r.cl && l.length > 1) { var pc = l.filter(function (o) { return SC.normText(o.cl) === SC.normText(r.cl); }); if (pc.length) l = pc; }
        if (!l.length) { necunoscute.push(r); return; }
        var libere = l.filter(function (o) { return o.inc !== 'DA'; });
        if (!libere.length) { dejaInc++; return; }
        var o = libere[libere.length - 1];
        if (SC.normNrAuto(o.na) === SC.normNrAuto(r.na) && (o.nt || '') === (r.nt || '')) { neschimbate++; return; }
        if (o.na && SC.normNrAuto(o.na) !== SC.normNrAuto(r.na)) schimbate.push({ o: o, r: r }); else noi.push({ o: o, r: r });
      });
      var html = '<div class="nota">Fișier: <b>' + esc(fisier.name) + '</b> (foaia „' + esc(p.foaie) + '”, ' + p.randuri.length + ' rânduri)</div>' +
        '<div>Nr AUTO de completat: <b>' + noi.length + '</b> · de schimbat: <b>' + schimbate.length + '</b> · neschimbate: ' + neschimbate + ' · deja încărcate (sărite): ' + dejaInc + '</div>';
      if (schimbate.length) html += '<div class="mic">Numere auto care se schimbă (fișierul de transport are prioritate):</div>' + listaHtml(schimbate.map(function (x) { return x.o.nc + ': ' + x.o.na + ' → ' + x.r.na; }));
      if (necunoscute.length) {
        html += '<div class="nota atentie">' + necunoscute.length + ' referințe din fișier nu există în registru.</div>' + listaHtml(necunoscute.map(function (r) { return r.ref + (r.cl ? ' · ' + r.cl : '') + ' · ' + r.na; }), 12) +
          '<label class="bifa"><input type="checkbox" id="trAdauga"> Adaugă-le ca rânduri noi (status Terminata, restul se completează manual)</label>';
      }
      if (!noi.length && !schimbate.length && !necunoscute.length) return alerta('Nimic de actualizat din „' + fisier.name + '”.');
      return modal({
        titlu: 'Import fișier transport', html: html, lat: true,
        butoane: [{ t: 'Renunță', v: null }, {
          t: 'Aplică', cls: 'pri', fn: function (rad) {
            var bifa = rad.querySelector('#trAdauga'), adauga = bifa && bifa.checked, toate = noi.concat(schimbate), i = 0;
            function parte() {
              if (i >= toate.length) return Promise.resolve();
              var bucata = toate.slice(i, i + 100); i += 100;
              return L.modifica(bucata.map(function (x) {
                return {
                  n: x.o.n, fn: function (o) {
                    if (o.inc === 'DA') return;
                    o.na = x.r.na; if (x.r.nt) o.nt = x.r.nt; if (x.r.so) o.so = x.r.so; if (x.r.re) o.re = x.r.re;
                  }
                };
              }), 'Import transport ' + fisier.name + ': Nr AUTO pe ' + bucata.length + ' comenzi').then(parte);
            }
            return parte().then(function () {
              if (!adauga) return;
              var azi = SC.azi(), ora = SC.oraAcum(), et = 'TRANSPORT: ' + stampila();
              return L.creeaza(necunoscute.map(function (r) {
                return { cl: (r.cl || '').toUpperCase(), nc: r.ref, de: r.de || '', na: r.na, nt: r.nt || '', so: r.so || '', re: r.re || '', st: ST.TER, dp: azi, op: ora, im: et, tr: 1 };
              }), 'Import transport ' + fisier.name + ': ' + necunoscute.length + ' comenzi doar din transport');
            }).then(function () {
              toast('Transport: ' + toate.length + ' comenzi actualizate' + (adauga ? ', ' + necunoscute.length + ' adăugate' : '') + '.', 'bun');
              redeseneaza();
            });
          }
        }]
      });
    }).catch(arataEroare);
  };

  /* ================= ADRESE ================= */
  var adreseAfisate = [];
  function deseneazaAdrese() {
    var cuv = SC.normText($('adrCauta').value).split(' ').filter(Boolean), cl = $('adrClient').value;
    var l = SC.adrese.filter(function (a) {
      if (cl && a.cl !== cl) return false;
      if (!cuv.length) return true;
      var h = SC.normText([a.cl, a.cod, a.nume, a.str, a.loc, a.jud].join(' '));
      return cuv.every(function (c) { return h.indexOf(c) >= 0; });
    });
    adreseAfisate = l.slice(0, 400);
    $('adrNumar').textContent = l.length + ' adrese' + (l.length > 400 ? ' (afișate primele 400 — restrânge căutarea)' : '');
    $('adrLista').innerHTML = '<table class="simplu"><tr><th>Client</th><th>Cod</th><th>Nume</th><th>Stradă</th><th>Localitate</th><th>Județ</th></tr>' +
      adreseAfisate.map(function (a, i) {
        return '<tr class="clic" data-i="' + i + '"><td>' + esc(a.cl) + '</td><td>' + esc(a.cod) + '</td><td>' + esc(a.nume) + '</td><td>' + esc(a.str) + '</td><td>' + esc(a.loc) + '</td><td>' + esc(a.jud) + '</td></tr>';
      }).join('') + '</table>';
  }
  var tAdr = null;
  $('adrCauta').addEventListener('input', function () { clearTimeout(tAdr); tAdr = setTimeout(deseneazaAdrese, 180); });
  $('adrClient').onchange = deseneazaAdrese;
  function formAdresa(a) {
    var nou = !a; a = a || {};
    var edit = poate();
    function c(k, t, lat) { return '<label class="camp' + (lat ? ' lat2' : '') + '"><span>' + t + '</span><input type="text" data-a="' + k + '" value="' + esc(a[k] || '') + '"' + (edit ? '' : ' readonly') + '></label>'; }
    var html = '<div class="grila"><label class="camp"><span>Client</span><select data-a="cl"' + (edit ? '' : ' disabled') + '>' +
      SC.config.clienti.concat(a.cl && SC.config.clienti.indexOf(a.cl) < 0 ? [a.cl] : []).map(function (x) { return '<option' + (x === a.cl ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') +
      '</select></label>' + c('cod', 'Cod') + c('nume', 'Nume', 1) + c('str', 'Stradă', 1) + c('loc', 'Localitate') + c('jud', 'Județ') + '</div>';
    var butoane = [{ t: 'Închide', v: null }];
    function citeste(rad) {
      var r = { id: a.id, _c: a._c };
      Array.prototype.forEach.call(rad.querySelectorAll('[data-a]'), function (el) { r[el.dataset.a] = el.value.trim(); });
      return r;
    }
    if (edit && !nou) butoane.push({
      t: 'Șterge', cls: 'rosu', fn: function (rad) {
        return confirma('Ștergi adresa „' + a.nume + '”?').then(function (ok) { return ok ? L.salveazaAdresa(citeste(rad), true).then(function () { toast('Adresă ștearsă.'); }) : false; });
      }
    });
    if (edit) butoane.push({
      t: 'Salvează', cls: 'pri', fn: function (rad) {
        var r = citeste(rad);
        if (!r.nume) { toast('Completează numele.', 'rau'); return false; }
        if (r.cod) {
          var ex = L.adresaDupaCod(r.cl, r.cod);
          if (ex && ex.id !== r.id) { toast('Codul ' + r.cod + ' există deja la ' + r.cl + ': ' + ex.nume, 'rau'); return false; }
        }
        return L.salveazaAdresa(r).then(function () { toast('Adresă salvată.', 'bun'); });
      }
    });
    modal({ titlu: nou ? 'Adresă nouă' : 'Adresă', html: html, lat: true, butoane: butoane });
  }
  $('btnAdresaNoua').onclick = function () { formAdresa(null); };
  $('adrLista').addEventListener('click', function (e) { var r = e.target.closest('tr.clic'); if (r) formAdresa(adreseAfisate[+r.dataset.i]); });

  /* ================= ADMINISTRARE ================= */
  function candidatiArhivare(zile) {
    var prag = SC.ziPlus(SC.azi(), -zile);
    return SC.comenzi.filter(function (o) { return !o.ar && o.st === ST.TER && o.inc !== 'DA' && (!o.dp || String(o.dp) < prag); });
  }
  function deseneazaAdmin() {
    if (!eAdmin()) { $('pag-admin').innerHTML = ''; return; }
    var a = document.activeElement;
    if (a && $('pag-admin').contains(a) && /INPUT|SELECT|TEXTAREA/.test(a.tagName)) return;   // nu stricam ce se tasteaza
    var h = '<div class="card"><h2>Utilizatori</h2><p>Fiecare coleg intră cu numele lui și un PIN de 6 cifre. PIN-ul uitat se rezolvă dezactivând contul și creând unul nou cu același nume.<br>' +
      '<b>Administrator</b>: toate drepturile. <b>Operator date</b>: comenzi (adaugă, modifică, statusuri), importuri borderou / Excel / fișier TMS, adrese. ' +
      '<b>Încărcări</b>: doar tabul Încărcări (confirmă camioane, tipărește borderoul). <b>Transport</b>: vede comenzile și poate modifica doar Nr AUTO.</p>' +
      '<div class="derulare-x"><table class="simplu"><tr><th>Nume</th><th>Rol</th><th>Stare</th><th></th></tr>' +
      stare.utilizatori.map(function (d) {
        var u = d.data, eu = d.id === SC.store.user.uid;
        return '<tr><td>' + esc(u.nume) + (eu ? ' (tu)' : '') + '</td><td><select data-rol="' + d.id + '"' + (eu ? ' disabled' : '') + '>' +
          Object.keys(SC.ROLURI).map(function (r) { return '<option value="' + r + '"' + (r === u.rol ? ' selected' : '') + '>' + SC.ROLURI[r] + '</option>'; }).join('') +
          '</select></td><td>' + (u.activ ? '<span class="eticheta ok">activ</span>' : '<span class="eticheta asteapta">dezactivat</span>') + '</td><td>' +
          (eu ? '' : '<button class="btn mic" data-activ="' + d.id + '">' + (u.activ ? 'Dezactivează' : 'Activează') + '</button>') + '</td></tr>';
      }).join('') + '</table></div>' +
      '<div class="rand-form" style="margin-top:10px"><label class="camp"><span>Nume</span><input type="text" id="uNume" maxlength="40"></label>' +
      '<label class="camp"><span>PIN (6 cifre)</span><input type="text" id="uPin" inputmode="numeric" maxlength="6" style="width:110px"></label>' +
      '<label class="camp"><span>Rol</span><select id="uRol">' + ['operator', 'incarcari', 'transport', 'admin'].map(function (x) { return '<option value="' + x + '">' + SC.ROLURI[x] + '</option>'; }).join('') + '</select></label>' +
      '<button class="btn pri" id="uAdauga">Adaugă utilizator</button></div></div>';

    h += '<div class="card"><h2>Clienți și reguli</h2><p>Lista de clienți din formulare și regula de greutate finală automată (greutate + paleți reali × kg/palet).</p>' +
      '<div class="rand-form"><label class="camp" style="flex:1;min-width:260px"><span>Clienți (separați prin virgulă)</span><input type="text" id="cClienti" value="' + esc(SC.config.clienti.join(', ')) + '"></label>' +
      '<label class="camp"><span>Client cu greutate automată</span><input type="text" id="cAuto" value="' + esc(SC.config.clientGreutateAuto) + '" style="width:150px"></label>' +
      '<label class="camp"><span>Kg / palet</span><input type="text" id="cKg" value="' + esc(SC.config.kgPalet) + '" style="width:80px"></label>' +
      '<label class="camp"><span>Toleranță paleți (±)</span><input type="text" id="cTol" value="' + esc(SC.config.tolerantaPaleti) + '" style="width:80px"></label>' +
      '<button class="btn pri" id="cSalveaza">Salvează</button></div></div>';

    var cand = candidatiArhivare(14).length;
    h += '<div class="card"><h2>Arhivare comenzi neîncărcate</h2><p>Comenzile Terminata fără confirmare de încărcare rămân „active” și se încarcă la fiecare deschidere a aplicației. Arhivarea le scoate din lista activă (rămân în istoric, neschimbate).</p>' +
      '<div class="rand-form"><label class="camp"><span>Mai vechi de (zile)</span><input type="text" id="aZile" value="14" style="width:80px"></label>' +
      '<button class="btn" id="aArhiveaza">Arhivează</button><span class="mic">Acum: ' + cand + ' comenzi mai vechi de 14 zile.</span></div></div>';

    h += '<div class="card"><h2>Migrare din Excel</h2><p>Încarcă registrul „Status Comenzi” (.xlsm): toate comenzile, cu Nr Crt păstrat, și foaia Adrese. <b>Înlocuiește tot ce există</b> în aplicație — se folosește la pornire și, dacă e nevoie, încă o dată în ziua trecerii de pe Excel.</p>' +
      '<div class="rand-form"><button class="btn" id="mMigrare">Alege fișierul și migrează…</button></div></div>';

    h += '<div class="card"><h2>Jurnal de modificări</h2><p>Fiecare modificare, cu cine a făcut-o, valoarea veche și cea nouă. Alege ziua; opțional caută un număr de comandă sau un nume.</p><div class="rand-form"><input type="date" id="jZi" value="' + SC.azi() + '" aria-label="Ziua">' +
      '<input type="search" id="jFiltru" placeholder="Comandă, utilizator, câmp…" aria-label="Caută în jurnal">' +
      '<button class="btn" id="jArata">Arată</button><span class="mic" id="jNumar"></span></div><div id="jLista" style="margin-top:10px"></div></div>';

    h += '<div class="card"><h2>Despre consum (plan gratuit Firebase)</h2><p>Comenzile sunt păstrate în grupe de ' + SC.MARIME_GRUPA + ', iar aplicația urmărește în timp real doar grupele cu comenzi active și pe cele recente. ' +
      'Acum sunt încărcate ' + Object.keys(SC.grupe).length + ' grupe (' + SC.comenzi.length + ' comenzi). Consumul real se vede în consola Firebase → Firestore → Usage.</p></div>';
    $('pag-admin').innerHTML = h;
  }
  function schimbaUtilizator(uid, fn) {
    return SC.store.tx(function (t) {
      return Promise.all([t.get('utilizatori', uid), t.get('public', 'nume')]).then(function (r) {
        var u = r[0], p = r[1] || { lista: [] };
        if (!u) throw L.eroare('Utilizatorul nu mai există.');
        fn(u);
        p.lista = (p.lista || []).filter(function (x) { return x.e !== u.email; });
        if (u.activ) p.lista.push({ n: u.nume, e: u.email });
        t.set('utilizatori', uid, u); t.set('public', 'nume', p);
        t.log('Utilizator ' + u.nume + ': ' + SC.ROLURI[u.rol] + ', ' + (u.activ ? 'activ' : 'dezactivat'));
      });
    });
  }
  $('pag-admin').addEventListener('change', function (e) {
    var s = e.target.closest('[data-rol]');
    if (s) { var v = s.value; schimbaUtilizator(s.dataset.rol, function (u) { u.rol = v; }).then(function () { toast('Rol schimbat.', 'bun'); }, arataEroare); }
  });
  $('pag-admin').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.activ) {
      schimbaUtilizator(b.dataset.activ, function (u) { u.activ = !u.activ; }).then(function () { toast('Utilizator actualizat.', 'bun'); }, arataEroare);
    } else if (b.id === 'uAdauga') {
      var nume = $('uNume').value.trim(), pin = $('uPin').value.trim(), rol = $('uRol').value;
      if (nume.length < 2) return toast('Scrie numele.', 'rau');
      if (!/^\d{6}$/.test(pin)) return toast('PIN-ul are exact 6 cifre.', 'rau');
      if (stare.utilizatori.some(function (d) { return d.data.activ && SC.normText(d.data.nume) === SC.normText(nume); })) return toast('Există deja un utilizator activ cu acest nume.', 'rau');
      b.disabled = true;
      SC.store.creeazaUtilizator(nume, pin, rol).then(function () {
        b.disabled = false; $('uNume').value = ''; $('uPin').value = ''; toast('Utilizator adăugat: ' + nume, 'bun'); deseneazaAdmin();
      }, function (er) { b.disabled = false; arataEroare(er); });
    } else if (b.id === 'cSalveaza') {
      var clienti = $('cClienti').value.split(',').map(function (x) { return x.trim().toUpperCase(); }).filter(Boolean);
      var kg = SC.parseNum($('cKg').value), tol = SC.parseNum($('cTol').value);
      if (!clienti.length || kg == null || tol == null) return toast('Verifică valorile.', 'rau');
      var cfg = Object.assign({}, SC.config, { clienti: clienti, clientGreutateAuto: $('cAuto').value.trim().toUpperCase(), kgPalet: kg, tolerantaPaleti: tol });
      SC.store.tx(function (t) { t.set('meta', 'config', cfg); t.log('Configurare: clienți / reguli modificate'); }).then(function () { toast('Salvat.', 'bun'); }, arataEroare);
    } else if (b.id === 'aArhiveaza') {
      var zile = SC.parseNum($('aZile').value);
      if (zile == null || zile < 1) return toast('Numărul de zile nu este valid.', 'rau');
      var l = candidatiArhivare(zile);
      if (!l.length) return toast('Nu există comenzi Terminata neîncărcate mai vechi de ' + zile + ' zile.');
      confirma(l.length + ' comenzi Terminata fără confirmare de încărcare, pregătite acum mai mult de ' + zile + ' zile, vor fi arhivate.\nDatele lor nu se schimbă. Continui?').then(function (ok) {
        if (!ok) return;
        var i = 0;
        function parte() {
          if (i >= l.length) return Promise.resolve();
          var buc = l.slice(i, i + 150); i += 150;
          return L.modifica(buc.map(function (o) { return { n: o.n, fn: function (x) { if (x.st === ST.TER && x.inc !== 'DA') x.ar = 1; } }; }), 'Arhivare: ' + buc.length + ' comenzi neîncărcate', { faraDetalii: true }).then(parte);
        }
        return parte().then(function () { toast('Arhivate ' + l.length + ' comenzi.', 'bun'); deseneazaAdmin(); });
      }).catch(arataEroare);
    } else if (b.id === 'mMigrare') {
      migrare();
    } else if (b.id === 'jArata') {
      var zi = $('jZi').value, cuv = SC.normText($('jFiltru').value).split(' ').filter(Boolean), ore = [];
      for (var hh = 0; hh < 24; hh++) ore.push(SC.store.citesteDoc('jurnal', zi + '_' + SC.p2(hh)));
      Promise.all(ore).then(function (docs) {
        var e2 = [];
        docs.forEach(function (d) { if (d && d.e) e2 = e2.concat(d.e); });
        var randuri = e2.map(function (x) { var p = x.split('|'); return { t: +p[0], u: p[1], x: p.slice(2).join('|') }; }).sort(function (a2, b2) { return b2.t - a2.t; });
        var total = randuri.length;
        if (cuv.length) randuri = randuri.filter(function (r2) { var h2 = SC.normText(r2.u + ' ' + r2.x); return cuv.every(function (c) { return h2.indexOf(c) >= 0; }); });
        $('jNumar').textContent = total ? randuri.length + ' din ' + total + ' înregistrări' : '';
        if (!randuri.length) { $('jLista').innerHTML = '<div class="mic">' + (total ? 'Nicio înregistrare nu corespunde căutării.' : 'Nicio modificare înregistrată în ' + esc(SC.fmtDataLunga(zi)) + '.') + '</div>'; return; }
        $('jLista').innerHTML = '<div class="lista-mica" style="max-height:420px"><table class="simplu"><tr><th>Ora</th><th>Cine</th><th>Ce</th></tr>' +
          randuri.map(function (r) { var dt = new Date(r.t); return '<tr><td>' + SC.p2(dt.getHours()) + ':' + SC.p2(dt.getMinutes()) + ':' + SC.p2(dt.getSeconds()) + '</td><td>' + esc(r.u) + '</td><td>' + esc(r.x) + '</td></tr>'; }).join('') + '</table></div>';
      }, arataEroare);
    }
  });
  function migrare() {
    var fisier, p, m;
    alegeFisier().then(function (f) {
      fisier = f; toast('Se citește fișierul… (câteva secunde)');
      return new Promise(function (ok) { setTimeout(ok, 50); }).then(function () { return citesteFisier(f); });
    }).then(function (wb) {
      p = L.parseRegistru(wb);
      if (!p.comenzi.length) throw L.eroare('Fișierul nu conține comenzi.');
      m = L.construiesteMigrare(p.comenzi, 7);
      var s = m.stat;
      var html = '<div class="nota">Fișier: <b>' + esc(fisier.name) + '</b></div>' +
        '<table class="simplu"><tr><td>Comenzi</td><td class="nr"><b>' + s.total + '</b></td></tr>' +
        SC.STATUSURI.map(function (st) { return '<tr><td>&nbsp;&nbsp;' + st + '</td><td class="nr">' + (s.peStatus[st] || 0) + '</td></tr>'; }).join('') +
        '<tr><td>Ultimul Nr Crt</td><td class="nr">' + s.ultimNr + '</td></tr>' +
        '<tr><td>Comenzi active (deschise sau în așteptarea încărcării)</td><td class="nr">' + s.active + '</td></tr>' +
        '<tr><td>Terminata fără încărcare, mai vechi de 7 zile → arhivate</td><td class="nr">' + s.arhivate + '</td></tr>' +
        '<tr><td>Adrese</td><td class="nr">' + p.adrese.length + '</td></tr>' +
        '<tr><td>Documente de scris în baza de date</td><td class="nr">' + (s.grupe + Math.ceil(p.adrese.length / 400) + 1) + '</td></tr></table>' +
        (s.renumerotate.length ? '<div class="nota atentie">' + s.renumerotate.length + ' comenzi aveau Nr Crt dublat sau lipsă și primesc numere noi la sfârșit:</div>' +
          listaHtml(s.renumerotate.map(function (x) { return x.nc + ': Nr Crt ' + (x.vechi == null ? '—' : x.vechi) + ' → ' + x.nou; })) : '') +
        (p.adreseCorectate ? '<div class="mic">' + p.adreseCorectate + ' adrese transformate de Excel în dată au fost refăcute ca text.</div>' : '') +
        (p.lipsa.length ? '<div class="mic">Coloane care lipsesc din fișier: ' + esc(p.lipsa.join(', ')) + '</div>' : '') +
        '<div class="nota atentie">Migrarea <b>șterge și înlocuiește</b> toate comenzile' + (p.adrese.length ? ' și adresele' : '') + ' din aplicație.</div>';
      return modal({ titlu: 'Migrare din Excel', html: html, lat: true, butoane: [{ t: 'Renunță', v: null }, { t: 'Migrează', cls: 'pri', v: true }] });
    }).then(function (ok) {
      if (!ok) return;
      opresteUrmarireaComenzilor();
      toast('Migrare în curs… nu închide pagina.');
      return SC.store.stergeColectie('comenzi').then(function () {
        return SC.store.setMulte('comenzi', m.docs, function (a, b) { $('syncText').textContent = 'migrare ' + a + '/' + b; });
      }).then(function () {
        if (!p.adrese.length) return;
        return SC.store.stergeColectie('adrese').then(function () { return SC.store.setMulte('adrese', L.adreseInDocumente(p.adrese)); });
      }).then(function () {
        return SC.store.tx(function (t) {
          t.set('meta', 'contor', { ultim: m.contor });
          t.log('Migrare din ' + fisier.name + ': ' + m.stat.total + ' comenzi, ' + p.adrese.length + ' adrese');
        });
      }).then(function () {
        L.golesteCache(); stare.primaData = true;
        repornesteUrmarireaComenzilor();
        return alerta('Migrare terminată.\n\nComenzi: ' + m.stat.total + '\nUltimul Nr Crt: ' + m.stat.ultimNr + '\nAdrese: ' + p.adrese.length);
      }, function (e) { repornesteUrmarireaComenzilor(); throw e; });
    }).catch(arataEroare);
  }
  /* la migrare oprim doar urmarirea comenzilor (restul raman) si o repornim dupa */
  function opresteUrmarireaComenzilor() {
    stare.opriri.forEach(function (f) { try { f(); } catch (e) { /* ignor */ } });
    stare.opriri = []; stare.pornit = false;
  }
  function repornesteUrmarireaComenzilor() {
    var tab = stare.tab;
    porneste();
    arataTab(tab);
  }

  /* ================= start ================= */
  window.addEventListener('afterprint', function () { $('tiparire').innerHTML = ''; });
  SC.creeazaStore();
  SC.store.init().catch(function (e) {
    console.error(e);
    $('ecranLogin').classList.remove('ascuns');
    $('loginText').textContent = '';
    $('loginEroare').textContent = 'Aplicația nu a putut porni: ' + (e && e.message ? e.message : e) + '. Verifică internetul și config.js.';
  });
  SC._test = { stare: stare, schimbaStatus: schimbaStatus, redeseneaza: redeseneaza };
})();
