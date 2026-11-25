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
    fc: {},                 // filtre pe coloane, ca in Excel: cheie coloana -> Set de valori afisate permise
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
      /* ferestrele doar de citit (opt.usor) se inchid si cu Esc sau cu un click in afara lor */
      if (opt.usor) {
        fundal.addEventListener('pointerdown', function (e) { if (e.target === fundal) inchide(null); });
        fundal.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); inchide(null); } });
      }
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
  /* Administratorul poate vedea aplicatia ca alt rol: user.rol devine rolul ales, iar rolReal ramane 'admin'.
     Drepturile din baza de date raman cele de administrator; se schimba doar ce arata si ce permite ecranul. */
  function rolReal() { var u = SC.store.user; return u ? (u.rolReal || u.rol) : ''; }
  /* Administrator + Operator date: tot ce tine de comenzi, adrese, importuri (poate()).
     Incarcari: doar confirmarea incarcarii.  Transport: doar Nr AUTO. */
  function poateIncarca() { return rol() === 'admin' || rol() === 'incarcari'; }
  function poateTms() { return poate() || rol() === 'transport'; }
  /* fisierul de import in TMS il face Transportul (si Administratorul) */
  function poateTmsExport() { return rol() === 'transport' || rol() === 'admin'; }
  /* raportul „Paleți”: Administratorul si utilizatorii carora el le-a bifat dreptul in Administrare → Utilizatori */
  function poatePaleti() { var u = SC.store.user; return !!u && (u.rol === 'admin' || u.rolReal === 'admin' || !!u.rapPal); }
  /* ordinea in care se incarca masinile o pune Transportul (si Administratorul); o vad toti */
  function poateOrdona() { return rol() === 'transport' || rol() === 'admin'; }
  /* bifarea mai multor comenzi, cu totaluri (Transport; si Administratorul, ca sa poata verifica) */
  function cuSelectie() { return rol() === 'transport' || rol() === 'admin' || rol() === 'operator'; }
  /* comenzile legate in acelasi cumul cu o (inclusiv ea); [] daca nu e in niciun cumul */
  function membriCumul(o) { return o && o.cum ? SC.comenzi.filter(function (x) { return x.cum === o.cum; }) : []; }
  function editareInLinie() { var a = document.activeElement; return !!(a && a.classList && (a.classList.contains('stSel') || a.classList.contains('naInline'))); }
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
  SC.onAuth = function (user, mesaj) {
    if (!user) { stare.veziCa = ''; arataLogin(mesaj); return; }
    /* daca profilul este recitit cat timp administratorul vede aplicatia ca alt rol, vederea aleasa se pastreaza */
    if (stare.veziCa && user.rol === 'admin' && !user.rolReal) { user.rolReal = 'admin'; user.rol = stare.veziCa; }
    porneste();
  };
  SC.onEroareSync = function (e) {
    $('sync').classList.add('rau'); $('syncText').textContent = 'eroare de sincronizare';
    var b = $('banda'); b.className = 'rau'; b.textContent = e && e.message ? e.message : String(e);
  };

  /* ================= pornire / urmarire ================= */
  function opresteTot() {
    stare.opriri.forEach(function (f) { try { f(); } catch (e) { /* ignor */ } });
    stare.opriri = []; stare.pornit = false;
    L.golesteCache(); kpUitaArhiva();
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
    $('cine').textContent = u.nume + ' · ' + (SC.ROLURI[rolReal()] || rolReal());
    var caAltul = rolReal() === 'admin' && u.rol !== 'admin';
    $('veziCaCutie').classList.toggle('ascuns', rolReal() !== 'admin');
    $('veziCa').innerHTML = Object.keys(SC.ROLURI).map(function (r) { return '<option value="' + r + '"' + (r === u.rol ? ' selected' : '') + '>' + esc(SC.ROLURI[r]) + '</option>'; }).join('');
    $('bandaRol').classList.toggle('ascuns', !caAltul);
    $('bandaRol').innerHTML = caAltul ? '<span>Vezi aplicația ca <b>' + esc(SC.ROLURI[u.rol]) + '</b>. Ecranul arată și permite exact ce are acest rol. Modificările pe care le faci sunt reale și se salvează pe numele tău.</span>' +
      '<button type="button" class="btn mic" id="veziCaInapoi">Înapoi la Administrator</button>' : '';
    $('tabAdmin').classList.toggle('ascuns', !eAdmin());
    var doarInc = u.rol === 'incarcari';
    /* Incarcari: vede si lista de comenzi, dar doar ca s-o citeasca (fara deschidere la click, fara modificari) */
    document.querySelector('.tab[data-tab=comenzi]').classList.remove('ascuns');
    $('tabel').classList.toggle('doarCitire', doarInc);
    document.querySelector('.tab[data-tab=adrese]').classList.toggle('ascuns', doarInc);
    Array.prototype.forEach.call(document.querySelectorAll('.doarEdit'), function (el) { el.classList.toggle('ascuns', !poate()); });
    $('btnTransport').classList.toggle('ascuns', !poateTms());
    $('btnTransport2').classList.toggle('ascuns', u.rol !== 'transport');
    $('btnTmsExport').classList.toggle('ascuns', !poateTmsExport());
    $('btnPaleti').classList.toggle('ascuns', !poatePaleti());
    $('btnGolesteInc').classList.toggle('ascuns', !eAdmin());
    stare.sel = {};
    var b = $('banda');
    if (SC.store.mod === 'demo') { b.className = ''; b.textContent = 'Mod demonstrație: datele se păstrează doar în acest browser. Pentru lucrul în echipă completează config.js cu proiectul Firebase.'; }
    else b.className = 'ascuns';
    deseneazaCap();
    stare.opriri.push(SC.store.urmaresteDoc('meta', 'config', function (d) {
      SC.config = Object.assign({}, SC.CONFIG_IMPLICIT, d || {});
      umpleClienti();
      if (stare.tab === 'admin') deseneazaAdmin();
      bk.cfgSosit = true; bkAvertizeaza();
    }));
    stare.opriri.push(SC.store.urmaresteColectie('adrese', function (docs) {
      L.seteazaAdrese(docs);
      if (stare.tab === 'adrese') deseneazaAdrese();
    }));
    notifInitial = true; notifVazute = {}; SC.notif = []; actualizeazaNotificari(); notifInitial = true;
    if (veziNotif()) {
      var lunaTrecuta = new Date(); lunaTrecuta.setDate(1); lunaTrecuta.setMonth(lunaTrecuta.getMonth() - 1);
      stare.opriri.push(SC.store.urmaresteDela('notificari', L.lunaNotif(lunaTrecuta.getTime()), function (docs) {
        L.seteazaNotificari(docs); actualizeazaNotificari();
      }, function () {
        /* regulile Firestore pentru „notificari” nu sunt inca publicate: aplicatia merge mai departe, doar fara notificari */
        $('btnNotif').title = 'Notificările nu sunt disponibile: publică regulile Firestore din firestore.rules.';
      }));
    }
    stare.opriri.push(SC.store.urmaresteDela('extra', SC.ziPlus(SC.azi(), -(SC.ZILE_EXTRA + 7)), function (docs) {
      L.seteazaExtra(docs);
      if (stare.tab === 'incarcari') deseneazaIncarcari();
      if (stare.tab === 'kpi') deseneazaKpi();
    }));
    if (eAdmin()) {
      stare.opriri.push(SC.store.urmaresteColectie('utilizatori', function (docs) {
        stare.utilizatori = docs;
        if (stare.tab === 'admin') deseneazaAdmin();
      }));
    }
    bkPorneste();
    urmaresteComenzile();
    arataTab(doarInc ? 'incarcari' : 'comenzi');
  }
  /* ---- versiunea aplicatiei: aratata in antet; daca pe server exista alta (versiune.json), apare o banda cu „Reîncarcă”.
     Fisierul este cerut direct de la GitHub Pages (nu din Firebase), la pornire, din 10 in 10 minute si la revenirea in pagina. */
  var versVazuta = '';
  function verificaVersiunea() {
    if (!/^https?:/.test(location.protocol) || !window.fetch) return;
    fetch('versiune.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      var v = d && d.v ? String(d.v) : '';
      if (!v || v === SC.VERSIUNE || v === versVazuta) return;
      versVazuta = v;
      var b = $('bandaVersiune');
      b.innerHTML = '<span>A apărut versiunea <b>' + esc(v) + '</b> a aplicației (pe acest calculator rulează ' + esc(SC.VERSIUNE) + '). Termină ce ai de salvat, apoi reîncarcă pagina.</span>' +
        '<button type="button" class="btn mic pri" id="versReincarca">Reîncarcă acum</button>';
      b.classList.remove('ascuns');
      $('versReincarca').onclick = function () {
        /* adresa primeste versiunea noua, ca browserul sa nu foloseasca pagina tinuta in memorie */
        var q = location.search.replace(/([?&])v=[^&]*&?/, '$1').replace(/[?&]$/, '');
        location.replace(location.pathname + q + (q ? '&' : '?') + 'v=' + encodeURIComponent(v));
      };
    }).catch(function () { /* fara retea: se incearca data viitoare */ });
  }
  $('versiune').textContent = 'v' + SC.VERSIUNE;
  verificaVersiunea(); setInterval(verificaVersiunea, 10 * 60000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) verificaVersiunea(); });
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
    ['comenzi', 'incarcari', 'kpi', 'adrese', 'admin'].forEach(function (x) { $('pag-' + x).classList.toggle('ascuns', x !== t); });
    if (t === 'comenzi') { redeseneaza(); mergiLaFinal(); }
    else if (t === 'incarcari') deseneazaIncarcari();
    else if (t === 'kpi') deseneazaKpi();
    else if (t === 'adrese') deseneazaAdrese();
    else if (t === 'admin') deseneazaAdmin();
  }
  $('taburi').addEventListener('click', function (e) { var b = e.target.closest('.tab'); if (b) arataTab(b.dataset.tab); });
  $('btnIesire').onclick = function () { SC.store.logout(); };
  function veziCa(r) {
    var u = SC.store.user;
    if (!u || rolReal() !== 'admin' || !SC.ROLURI[r] || r === u.rol) return;
    u.rolReal = 'admin'; u.rol = r; stare.veziCa = r === 'admin' ? '' : r;
    /* se inchid ferestrele deschise si aplicatia reporneste cu rolul ales (taburi, butoane, liste) */
    Array.prototype.forEach.call(document.querySelectorAll('.fundal'), function (f) { f.remove(); });
    inchideFiltru(); inchideCal();
    opresteTot(); porneste();
    toast(r === 'admin' ? 'Ai revenit la vederea de Administrator.' : 'Acum vezi aplicația ca ' + SC.ROLURI[r] + '.', 'bun');
  }
  $('veziCa').onchange = function () { veziCa(this.value); };
  $('bandaRol').addEventListener('click', function (e) { if (e.target.id === 'veziCaInapoi') veziCa('admin'); });
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
  var GOALE = '(Goale)';
  function valAfisata(o, c) { var v = SC.fmtCelula(o, c); return v === '' ? GOALE : v; }
  /* filtrele de sus (cautare, client, date, neincarcate) */
  function treceSus(o, cuv) {
    var f = stare.f;
    if (f.cl && o.cl !== f.cl) return false;
    if (f.neinc && !(o.st === ST.TER && o.inc !== 'DA')) return false;
    if (f.deInchis && !SC.incDeInchis(o)) return false;
    if (f.dela || f.panala) {
      var v = o[f.colData] || '';
      if (!v || (f.dela && v < f.dela) || (f.panala && v > f.panala)) return false;
    }
    if (cuv.length) { var h = fan(o); for (var i = 0; i < cuv.length; i++) if (h.indexOf(cuv[i]) < 0) return false; }
    return true;
  }
  /* filtrele de pe coloane; exceptCol = coloana al carei filtru se ignora (pentru lista de valori a acelei coloane) */
  function treceColoane(o, exceptCol) {
    for (var k in stare.fc) {
      if (k === exceptCol) continue;
      if (!stare.fc[k].has(valAfisata(o, SC.COL[k]))) return false;
    }
    return true;
  }
  function calculeazaLista() {
    var f = stare.f, cuv = SC.normText(f.q).split(' ').filter(Boolean), num = {}, areSt = Object.keys(f.st).length > 0;
    var baza = SC.comenzi.filter(function (o) {
      if (!treceSus(o, cuv) || !treceColoane(o, null)) return false;
      num[o.st] = (num[o.st] || 0) + 1;
      return true;
    });
    stare.numarStatus = num;
    stare.nrDeInchis = SC.comenzi.filter(SC.incDeInchis).length;      /* din toate comenzile, nu doar din cele filtrate */
    var l = areSt ? baza.filter(function (o) { return f.st[o.st]; }) : baza;
    var k = stare.sort.k, dir = stare.sort.dir, adaugate = false;
    /* cumul: daca o comanda trece de filtre / cautare, apar si cele cu care este legata */
    if (l.length < SC.comenzi.length) {
      var inL = {}, cumL = {}, areCum = false;
      l.forEach(function (o) { inL[o.n] = 1; if (o.cum) { cumL[o.cum] = 1; areCum = true; } });
      if (areCum) {
        var legate = SC.comenzi.filter(function (o) { return o.cum && cumL[o.cum] && !inL[o.n]; });
        if (legate.length) { l = l.concat(legate); adaugate = true; }
      }
    }
    if (adaugate && k === 'n' && dir === 1) l.sort(function (a, b) { return a.n - b.n; });
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
    var cols = SC.COLS, latime = 0, sel = cuSelectie();
    if (sel) latime += 30;
    $('cap').innerHTML = (sel ? '<div class="selc" title="Bifează / debifează toate comenzile din listă"><input type="checkbox" id="selTot" aria-label="Bifează toate comenzile din listă"></div>' : '') + cols.map(function (c) {
      latime += c.w;
      var s = stare.sort.k === c.k ? (stare.sort.dir === 1 ? ' ▲' : ' ▼') : '';
      return '<div data-k="' + c.k + '"><span class="et" title="Sortează după ' + esc(c.t) + '">' + esc(c.t) + s + '</span>' +
        '<button type="button" class="fb' + (stare.fc[c.k] ? ' activ' : '') + '" data-f="' + c.k + '" aria-label="Filtru pe coloana ' + esc(c.t) + '" title="Filtrează ' + esc(c.t) + '">▾</button></div>';
    }).join('');
    $('tabel').style.setProperty('--cols', (sel ? '30px ' : '') + cols.map(function (c) { return c.w + 'px'; }).join(' '));
    $('tabel').style.setProperty('--latime', latime + 'px');
  }
  function deseneazaCipuri() {
    var f = stare.f;
    $('fStatus').innerHTML = SC.STATUSURI.map(function (s) {
      return '<button class="cip' + (f.st[s] ? ' activ' : '') + '" data-st="' + esc(s) + '">' + esc(s) + '<b>' + (stare.numarStatus[s] || 0) + '</b></button>';
    }).join('');
    /* comenzile plecate cu camionul inainte sa fie inchise: apar doar cand exista (sau cand filtrul este pus) */
    var di = $('fDeInchis'), nrDi = stare.nrDeInchis || 0;
    di.classList.toggle('ascuns', !nrDi && !f.deInchis);
    di.classList.toggle('activ', !!f.deInchis);
    $('fDeInchisNr').textContent = nrDi;
  }
  function optiuniStatus(st) {
    var l = SC.STATUSURI.slice();
    if (st && l.indexOf(st) < 0) l.unshift(st);
    return l.map(function (s) { return '<option' + (s === st ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('');
  }
  function randHtml(o, i) {
    var cls = 'rand', edit = poate();
    if (stare.evid && stare.evid[o.n]) cls += ' nou';
    if (o.st === ST.ANU) cls += ' anulata'; else if (o.st === ST.SELF) cls += ' selfpick';
    else if (SC.esteEDI(o) && SC.esteDeschisa(o)) cls += ' edi';
    var bifat = stare.sel && stare.sel[o.n];
    if (bifat) cls += ' bifat';
    if (o.cum) cls += ' legata';       /* comanda dintr-un cumul: dunga in stanga, pe celula Nr Crt */
    var h = '<div class="' + cls + '" data-n="' + o.n + '" style="top:' + (i * RH) + 'px">';
    if (cuSelectie()) h += '<div class="selc"><input type="checkbox" class="selR" aria-label="Bifează comanda ' + esc(o.nc) + '"' + (bifat ? ' checked' : '') + '></div>';
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
      if ((c.k === 'na' || c.k === 'nt') && rol() === 'transport' && o.inc !== 'DA' && o.st !== ST.ANU) cc = 'ed';
      if (c.k === 'dl' && rol() === 'transport' && o.inc !== 'DA' && o.st !== ST.ANU) cc = 'ed';
      var titlu = (c.typ === 'txt' && v.length > 14) ? ' title="' + esc(v) + '"' : '';
      if (c.k === 'n' && o.cum) { cc += ' nrc'; titlu = ' title="Comandă legată în cumulul ' + esc(o.cum) + ' (' + membriCumul(o).map(function (x) { return x.nc; }).join(', ') + ')"'; }
      /* comenzi mai vechi la care paletii reali nu sunt FPP + Pick: semnalate, se corecteaza din FPP / Pick */
      if (c.k === 'pr' && SC.esteNum(o.fpp) && SC.esteNum(o.pk) && SC.esteNum(o.pr) && o.fpp + o.pk !== o.pr) {
        cc += ' nepotrivit'; titlu = ' title="FPP ' + o.fpp + ' + Pick ' + o.pk + ' = ' + (o.fpp + o.pk) + ', dar paleți reali = ' + o.pr + '. Apasă pe FPP sau Pick și salvează."';
      }
      var inainte = '';      /* locul camionului la incarcare, in fata numarului auto (ca sa nu fie taiat de latimea coloanei) */
      if (c.k === 'na' && SC.areOrdine && o.na) {
        var oc = ordineComanda(o);
        if (oc) { inainte = '<span class="ordM">' + oc.o + '</span>'; titlu = ' title="' + esc(v) + ' — locul ' + oc.o + ' la încărcare' + (oc.data ? ', ' + esc(SC.fmtDataLunga(oc.data)) : '') + '"'; }
      }
      if (c.k === 'na' && SC.incDeInchis(o)) {
        inainte = DI_ETICHETA + inainte;
        titlu = ' title="Încărcată' + (o.di ? ' la ' + esc(SC.fmtDT(o.di)) : '') + (SC.esteNum(o.ipr) ? ' cu ' + o.ipr + ' paleți și ' + (SC.esteNum(o.iam) ? o.iam : '—') + ' amprente numărate' : '') + ', dar comanda nu este închisă: trebuie trecută pe Terminata' + (v ? ' — ' + esc(v) : '') + '"';
      }
      if (c.k === 'na' && o.sp === 'DA') { inainte = SP_ETICHETA + inainte; titlu = ' title="Self-Pick: o ridică clientul, nu intră în exportul pentru TMS' + (v ? ' — ' + esc(v) : '') + '"'; }
      h += '<div' + (cc ? ' class="' + cc + '"' : '') + (c.k === 'na' || c.k === 'nt' || c.k === 'fpp' || c.k === 'pk' || c.k === 'am' || c.k === 'dl' || c.k === 'ob' || c.k === 'co' ? ' data-k="' + c.k + '"' : '') + titlu + '>' + inainte + esc(v) + '</div>';
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
      var qGol = String(stare.f.q || '').trim(), stIst = qGol ? istoricCautat[SC.cheieComanda(qGol)] : '';
      gol.textContent = SC.comenzi.length ? 'Nicio comandă nu corespunde filtrelor. ' +
        (stIst === 'caut' ? 'Caut numărul „' + qGol + '” și în istoric…' :
          stIst === 'lipsa' ? 'Am căutat numărul „' + qGol + '” și în istoric: nu există nicio comandă cu exact acest număr.' :
            'Lista ține doar comenzile active și recente: pentru una mai veche scrie numărul ei exact în căutare sau alege „Istoric pe perioadă…”.') :
        'Nu există comenzi încărcate. Adaugă o comandă, importă un borderou sau (administrator) fă migrarea din Excel.';
    }
  }
  /* ---- pozitia listei ----
     Cand lista se reface din cauza unei modificari (a ta sau a unui coleg), ramane pe loc comanda la care lucrezi
     (ultima pe care ai apasat) sau, daca nu e cazul, primul rand vizibil. Lista sare doar cand schimbi tu filtrele sau sortarea. */
  var tEvid = null;
  function indexComanda(n) { var l = stare.lista; for (var i = 0; i < l.length; i++) if (l[i].n === n) return i; return -1; }
  function semnaturaFiltre() {
    return JSON.stringify([stare.f, stare.sort, Object.keys(stare.fc).sort().map(function (k) { return k + '=' + Array.from(stare.fc[k]).join('\u0001'); })]);
  }
  function iaAncora() {
    var t = $('tabel'), l = stare.lista, sus = t.scrollTop, i = -1, a = stare.atins;
    if (!l.length) return null;
    if (sus > 0 && sus + t.clientHeight >= t.scrollHeight - RH) return { coada: true };   /* erai la capatul listei: ramai la capat, ca sa vezi ce se adauga */
    if (a && Date.now() - a.t < 180000) {
      i = indexComanda(a.n);
      if (i >= 0 && (i * RH < sus - RH || i * RH > sus + t.clientHeight)) i = -1;      /* nu mai e pe ecran: nu tragem lista inapoi la ea */
    }
    if (i < 0) i = Math.min(l.length - 1, Math.floor(sus / RH));
    return { n: l[i].n, off: i * RH - sus };
  }
  function refaAncora(anc) {
    var t = $('tabel');
    $('corp').style.height = (stare.lista.length * RH) + 'px';
    if (anc.coada) { t.scrollTop = t.scrollHeight; return; }
    var j = indexComanda(anc.n); if (j < 0) return;
    var y = Math.max(0, j * RH - anc.off);
    if (Math.abs(y - t.scrollTop) > 1) t.scrollTop = y;
  }
  /* dupa adaugare / import: lista merge la comanda noua si o evidentiaza cateva secunde */
  function arataComenzi(numere) {
    if (!numere || !numere.length) return redeseneaza();
    stare.tinta = { n: numere[0], toate: numere, t: Date.now() };
    redeseneaza();
  }
  function aplicaTinta() {
    var x = stare.tinta; if (!x) return;
    var i = indexComanda(x.n);
    if (i < 0) {
      if (SC.dupaNr[x.n]) {
        stare.tinta = null;
        toast((x.toate.length > 1 ? 'Comenzile noi nu se văd' : 'Comanda nouă (Nr Crt ' + x.n + ') nu se vede') + ' în listă din cauza filtrelor active. Lista a rămas pe loc.');
      } else if (Date.now() - x.t > 20000) stare.tinta = null;
      return;
    }
    stare.tinta = null;
    stare.evid = {}; x.toate.forEach(function (n) { stare.evid[n] = 1; });
    stare.atins = { n: x.n, t: Date.now() };
    clearTimeout(tEvid);
    tEvid = setTimeout(function () { stare.evid = null; if (stare.tab === 'comenzi') deseneazaRanduri(); }, 12000);
    var t = $('tabel'), y = i * RH, sus = t.scrollTop, h = t.clientHeight - CAP;
    $('corp').style.height = (stare.lista.length * RH) + 'px';
    if (y < sus || y + RH > sus + h) t.scrollTop = Math.max(0, x.toate.length > 1 ? y - 2 * RH : y - Math.floor(h / 2));
  }
  function redeseneaza() {
    if (stare.tab === 'incarcari') { deseneazaIncarcari(); }
    if (stare.tab === 'kpi') { deseneazaKpi(); }
    if (stare.tab !== 'comenzi') return;
    var a = document.activeElement;
    if (editareInLinie()) { stare.murdar = true; return; }
    stare.murdar = false;
    var semn = semnaturaFiltre(), anc = stare.semn === semn ? iaAncora() : null;
    stare.semn = semn;
    calculeazaLista(); deseneazaCipuri();
    if (anc) refaAncora(anc);
    aplicaTinta();
    deseneazaRanduri();
    deseneazaBaraSel();
    var tot = SC.comenzi.length;
    var nf = Object.keys(stare.fc).length;
    $('numarare').textContent = (stare.lista.length === tot ? tot + ' comenzi' : stare.lista.length + ' din ' + tot + ' comenzi încărcate') +
      (nf ? ' · ' + nf + (nf === 1 ? ' filtru pe coloană' : ' filtre pe coloane') : '');
    actualizeazaTmsNr();
  }
  var rafCerut = false;
  $('tabel').addEventListener('scroll', function () {
    if (rafCerut) return;
    rafCerut = true;
    requestAnimationFrame(function () {
      rafCerut = false;
      if (editareInLinie()) return;
      deseneazaRanduri();
    });
  });
  /* derulare cu rotita / bara in timp ce se scrie un Nr AUTO in celula: se salveaza ce s-a scris, apoi lista se deruleaza normal */
  $('tabel').addEventListener('wheel', function () { inchideCal(); }, { passive: true });
  function inchideNaInLinie(e) {
    var act = document.activeElement;
    if (act && act.classList && act.classList.contains('naInline') && (e.type !== 'pointerdown' || e.target === $('tabel'))) act.blur();
  }
  $('tabel').addEventListener('wheel', inchideNaInLinie, { passive: true });
  $('tabel').addEventListener('touchmove', inchideNaInLinie, { passive: true });
  $('tabel').addEventListener('pointerdown', inchideNaInLinie);
  window.addEventListener('resize', function () { if (stare.pornit && stare.tab === 'comenzi') deseneazaRanduri(); });
  $('cap').addEventListener('click', function (e) {
    var fb = e.target.closest('.fb');
    if (fb) { deschideFiltru(fb.dataset.f, fb); return; }
    if (e.target.closest('.selc')) {
      var tot = $('selTot'), pune = e.target === tot ? tot.checked : !tot.checked;
      stare.lista.forEach(function (o) { if (pune) stare.sel[o.n] = 1; else delete stare.sel[o.n]; });
      deseneazaRanduri(); deseneazaBaraSel();
      return;
    }
    var d = e.target.closest('[data-k]'); if (!d) return;
    if (stare.sort.k === d.dataset.k) stare.sort.dir = -stare.sort.dir; else stare.sort = { k: d.dataset.k, dir: 1 };
    deseneazaCap(); redeseneaza();
  });
  $('corp').addEventListener('change', function (e) {
    var s = e.target.closest('.stSel'); if (!s) return;
    var o = SC.dupaNr[+s.closest('.rand').dataset.n];
    if (o) stare.atins = { n: o.n, t: Date.now() };
    s.blur();
    if (o) schimbaStatus(o, s.value).catch(arataEroare).then(function () { stare.murdar = false; redeseneaza(); });
  });
  $('corp').addEventListener('focusout', function () { setTimeout(function () { if (stare.murdar) redeseneaza(); }, 0); });
  $('corp').addEventListener('click', function (e) {
    if (e.target.closest('.stSel') || e.target.closest('.naInline')) return;
    var r = e.target.closest('.rand'); if (!r) return;
    var o = SC.dupaNr[+r.dataset.n]; if (!o) return;
    stare.atins = { n: o.n, t: Date.now() };
    if (e.target.closest('.selc')) {
      var cb = r.querySelector('.selR'), pus = e.target === cb ? cb.checked : !cb.checked;
      if (pus) stare.sel[o.n] = 1; else delete stare.sel[o.n];
      cb.checked = pus; r.classList.toggle('bifat', pus);
      deseneazaBaraSel();
      return;
    }
    /* Incarcari: lista de comenzi este doar de citit - click-ul nu deschide si nu modifica nimic */
    if (rol() === 'incarcari') return;
    /* Transport: comanda nu se deschide; click pe Nr AUTO sau pe Nr transport deschide fereastra camionului */
    if (rol() === 'transport') {
      var cel = e.target.closest('[data-k=na],[data-k=nt]'), celDl = e.target.closest('[data-k=dl]');
      if (cel) transportPentru([o]); else if (celDl) editeazaDlInLinie(o, celDl);
      /* click pe Observatii sau Comentarii: tot textul, intr-o fereastra (in lista este taiat de latimea coloanei) */
      else if (e.target.closest('[data-k=ob],[data-k=co]') && (!SC.gol(o.ob) || !SC.gol(o.co))) arataTextComanda(o);
      return;
    }
    if (poate() && o.st !== ST.ANU && e.target.closest('[data-k=fpp],[data-k=pk]')) editeazaFppPick(o);
    else if (poate() && (o.st === ST.TER || o.st === ST.SELF) && e.target.closest('[data-k=am]')) editeazaAmprente(o);
    else deschideComanda(o);
  });

  /* Observatiile si comentariile unei comenzi, intregi (doar de citit) */
  function arataTextComanda(o) {
    var h = '<div class="mic" style="margin-bottom:10px">' + esc([o.de, o.or, o.dl ? 'livrare ' + SC.fmtDataLunga(o.dl) : ''].filter(Boolean).join(' · ')) + '</div>';
    [['ob', 'Observații'], ['co', 'Comentarii']].forEach(function (c) {
      if (!SC.gol(o[c[0]])) h += '<div class="text-titlu">' + c[1] + '</div><div class="text-lung">' + esc(String(o[c[0]]).trim()) + '</div>';
    });
    return modal({ titlu: ((o.cl || '') + ' ' + (o.nc || '')).trim() + ' — observații și comentarii', html: h, usor: true, butoane: [{ t: 'Închide', cls: 'pri', v: null }] });
  }

  /* ---- filtru pe coloana, ca in Excel: sortare, cautare in valori, bife ---- */
  var popFiltru = null;
  function inchideFiltru() {
    if (!popFiltru) return;
    popFiltru.remove(); popFiltru = null;
    document.removeEventListener('pointerdown', afaraFiltru, true);
    document.removeEventListener('keydown', tastaFiltru, true);
  }
  function afaraFiltru(e) { if (popFiltru && !popFiltru.contains(e.target) && !e.target.closest('.fb')) inchideFiltru(); }
  function tastaFiltru(e) { if (e.key === 'Escape') inchideFiltru(); }
  function deschideFiltru(k, buton) {
    var eraAcelasi = popFiltru && popFiltru.dataset.k === k;
    inchideFiltru();
    if (eraAcelasi) return;
    var c = SC.COL[k], cuvSus = SC.normText(stare.f.q).split(' ').filter(Boolean), areSt = Object.keys(stare.f.st).length > 0;
    var numeric = c.typ === 'num' || c.typ === 'int', eData = c.typ === 'date' || c.typ === 'dt', cuOrdine = numeric || eData;
    /* valorile distincte, tinand cont de toate celelalte filtre (ca in Excel) */
    var harta = new Map();
    SC.comenzi.forEach(function (o) {
      if (!treceSus(o, cuvSus) || !treceColoane(o, k) || (areSt && k !== 'st' && !stare.f.st[o.st])) return;
      var d = valAfisata(o, c), x = harta.get(d);
      if (x) x.n++; else harta.set(d, { d: d, r: o[k], n: 1, h: SC.normText(d), zi: eData && /^\d{4}-\d{2}-\d{2}/.test(String(o[k])) ? String(o[k]).slice(0, 10) : '' });
    });
    var vals = Array.from(harta.values()).sort(function (a, b) {
      if (a.d === GOALE) return 1; if (b.d === GOALE) return -1;
      if (typeof a.r === 'number' && typeof b.r === 'number') return a.r - b.r;
      return String(a.r).localeCompare(String(b.r), 'ro', { numeric: true });
    });
    var activ = stare.fc[k], sel = new Set();
    vals.forEach(function (v) { if (!activ || activ.has(v.d)) sel.add(v.d); });
    var MAX = 400, cautare = '';
    /* coloanele cu date: valorile se grupeaza pe ani > luni > zile, ca in Excel */
    var LUNI = ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'];
    var deschise = {};
    function subNod(cheie) { return vals.filter(function (v) { return v.zi && v.zi.indexOf(cheie) === 0; }); }
    function stareNod(cheie) { var l = subNod(cheie), b = l.filter(function (v) { return sel.has(v.d); }).length; return b === 0 ? 0 : (b === l.length ? 2 : 1); }
    if (eData) {
      var aniExistenti = {};
      vals.forEach(function (v) { if (v.zi) aniExistenti[v.zi.slice(0, 4)] = 1; });
      if (Object.keys(aniExistenti).length === 1) deschise[Object.keys(aniExistenti)[0]] = true;
      /* daca filtrul e deja pus, se deschid ramurile bifate partial, ca sa se vada ce e ales */
      if (activ) vals.forEach(function (v) {
        if (!v.zi) return;
        if (stareNod(v.zi.slice(0, 4)) === 1) deschise[v.zi.slice(0, 4)] = true;
        if (stareNod(v.zi.slice(0, 7)) === 1) deschise[v.zi.slice(0, 7)] = true;
      });
    }
    function htmlArbore(m) {
      var ani = {}, rest = [], h = '';
      m.forEach(function (v) {
        if (!v.zi) { rest.push(v); return; }
        var a = v.zi.slice(0, 4), l = v.zi.slice(0, 7);
        var A = ani[a] || (ani[a] = { n: 0, luni: {} }), U = A.luni[l] || (A.luni[l] = { n: 0, zile: {} });
        A.n += v.n; U.n += v.n; U.zile[v.zi] = (U.zile[v.zi] || 0) + v.n;
      });
      function nod(cheie, text, n, nivel, cls) {
        var exp = cheie.length < 10;
        return '<div class="pf-nod ' + cls + '" style="padding-left:' + (nivel * 18) + 'px">' +
          (exp ? '<button type="button" class="pf-exp" data-e="' + cheie + '" aria-expanded="' + (deschise[cheie] ? 'true' : 'false') + '" aria-label="' + (deschise[cheie] ? 'Restrânge ' : 'Desfășoară ') + esc(text) + '">' + (deschise[cheie] ? '▾' : '▸') + '</button>' : '<span class="pf-exp"></span>') +
          '<label class="bifa"><input type="checkbox" data-g="' + cheie + '"> <span class="pf-v">' + esc(text) + '</span><span class="mic">' + n + '</span></label></div>';
      }
      Object.keys(ani).sort().reverse().forEach(function (a) {
        h += nod(a, a, ani[a].n, 0, 'pf-an');
        if (!deschise[a]) return;
        Object.keys(ani[a].luni).sort().reverse().forEach(function (l) {
          h += nod(l, LUNI[+l.slice(5, 7) - 1], ani[a].luni[l].n, 1, 'pf-luna');
          if (!deschise[l]) return;
          Object.keys(ani[a].luni[l].zile).sort().reverse().forEach(function (z) { h += nod(z, SC.fmtDataLunga(z), ani[a].luni[l].zile[z], 2, 'pf-zi'); });
        });
      });
      rest.forEach(function (v) {
        h += '<div class="pf-nod"><span class="pf-exp"></span><label class="bifa"><input type="checkbox" data-v="' + esc(v.d) + '"' + (sel.has(v.d) ? ' checked' : '') + '> <span class="pf-v">' + esc(v.d) + '</span><span class="mic">' + v.n + '</span></label></div>';
      });
      return h;
    }
    function bifeArbore() {
      Array.prototype.forEach.call(lista.querySelectorAll('[data-g]'), function (cb) { var s = stareNod(cb.dataset.g); cb.checked = s === 2; cb.indeterminate = s === 1; });
    }

    var p = document.createElement('div');
    p.className = 'popfiltru'; p.dataset.k = k;
    p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', 'Filtru pe coloana ' + c.t);
    p.innerHTML = '<div class="pf-titlu">' + esc(c.t) + '</div>' +
      '<div class="pf-sort"><button type="button" class="btn mic" data-s="1">' + (cuOrdine ? 'Sortează crescător' : 'Sortează A → Z') + '</button>' +
      '<button type="button" class="btn mic" data-s="-1">' + (cuOrdine ? 'Sortează descrescător' : 'Sortează Z → A') + '</button></div>' +
      '<input type="search" class="pf-cauta" placeholder="Caută în ' + esc(c.t) + '…" aria-label="Caută în valorile coloanei">' +
      '<label class="bifa pf-tot"><input type="checkbox"> <span>(Selectează tot)</span></label>' +
      '<div class="pf-lista"></div><div class="mic pf-nota"></div>' +
      '<div class="pf-jos"><button type="button" class="btn mic" data-a="sterge"' + (activ ? '' : ' disabled') + '>Șterge filtrul</button><span style="flex:1"></span>' +
      '<button type="button" class="btn mic" data-a="renunta">Renunță</button><button type="button" class="btn mic pri" data-a="ok">OK</button></div>';
    var lista = p.querySelector('.pf-lista'), tot = p.querySelector('.pf-tot input'), nota = p.querySelector('.pf-nota'), inp = p.querySelector('.pf-cauta');
    function potrivite() {
      var cuv = SC.normText(cautare).split(' ').filter(Boolean);
      return cuv.length ? vals.filter(function (v) { return cuv.every(function (w) { return v.h.indexOf(w) >= 0; }); }) : vals;
    }
    function deseneaza() {
      var m = potrivite(), h = '', arbore = eData && !cautare, poz = lista.scrollTop;
      if (arbore) h = htmlArbore(m);
      else m.slice(0, MAX).forEach(function (v) {
        h += '<label class="bifa"><input type="checkbox" data-v="' + esc(v.d) + '"' + (sel.has(v.d) ? ' checked' : '') + '> <span class="pf-v">' + esc(v.d) + '</span><span class="mic">' + v.n + '</span></label>';
      });
      lista.innerHTML = h || '<div class="mic" style="padding:8px">Nicio valoare nu corespunde căutării.</div>';
      if (arbore) { bifeArbore(); lista.scrollTop = poz; }
      var bifate = m.filter(function (v) { return sel.has(v.d); }).length;
      tot.checked = m.length > 0 && bifate === m.length; tot.indeterminate = bifate > 0 && bifate < m.length;
      p.querySelector('.pf-tot span').textContent = cautare ? '(Selectează toate rezultatele căutării)' : '(Selectează tot)';
      nota.textContent = arbore ? m.length + (m.length === 1 ? ' valoare' : ' valori') + ' · apasă ▸ pentru luni și zile' :
        m.length + (m.length === 1 ? ' valoare' : ' valori') + (m.length > MAX ? ' — afișate primele ' + MAX + '; folosește căutarea' : '');
    }
    lista.addEventListener('click', function (e) {
      var b = e.target.closest('button.pf-exp'); if (!b) return;
      deschise[b.dataset.e] = !deschise[b.dataset.e]; deseneaza();
      var nou = lista.querySelector('button.pf-exp[data-e="' + b.dataset.e + '"]'); if (nou) nou.focus();
    });
    inp.addEventListener('input', function () {
      var inainte = cautare; cautare = inp.value;
      /* ca in Excel: la prima tastare raman bifate doar rezultatele cautarii */
      if (!inainte && cautare) { sel = new Set(); potrivite().forEach(function (v) { sel.add(v.d); }); }
      else if (cautare) { sel = new Set(); potrivite().forEach(function (v) { sel.add(v.d); }); }
      else { sel = new Set(); vals.forEach(function (v) { if (!activ || activ.has(v.d)) sel.add(v.d); }); }
      deseneaza();
    });
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); aplica(); } });
    tot.addEventListener('change', function () {
      potrivite().forEach(function (v) { if (tot.checked) sel.add(v.d); else sel.delete(v.d); });
      deseneaza();
    });
    lista.addEventListener('change', function (e) {
      var g = e.target.closest('[data-g]');
      if (g) {   /* an / luna / zi: bifeaza sau debifeaza tot ce are dedesubt */
        subNod(g.dataset.g).forEach(function (v) { if (g.checked) sel.add(v.d); else sel.delete(v.d); });
        deseneaza();
        var la = lista.querySelector('[data-g="' + g.dataset.g + '"]'); if (la) la.focus();
        return;
      }
      var cb = e.target.closest('[data-v]'); if (!cb) return;
      if (cb.checked) sel.add(cb.dataset.v); else sel.delete(cb.dataset.v);
      var m = potrivite(), bifate = m.filter(function (v) { return sel.has(v.d); }).length;
      tot.checked = bifate === m.length; tot.indeterminate = bifate > 0 && bifate < m.length;
    });
    function aplica() {
      var alese = potrivite().filter(function (v) { return sel.has(v.d); }).map(function (v) { return v.d; });
      if (!alese.length) { toast('Bifează cel puțin o valoare.', 'rau'); return; }
      if (!cautare && alese.length === vals.length) delete stare.fc[k]; else stare.fc[k] = new Set(alese);
      inchideFiltru(); deseneazaCap(); $('tabel').scrollTop = 0; redeseneaza();
    }
    p.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.s) { stare.sort = { k: k, dir: +b.dataset.s }; inchideFiltru(); deseneazaCap(); redeseneaza(); }
      else if (b.dataset.a === 'ok') aplica();
      else if (b.dataset.a === 'renunta') inchideFiltru();
      else if (b.dataset.a === 'sterge') { delete stare.fc[k]; inchideFiltru(); deseneazaCap(); redeseneaza(); }
    });
    document.body.appendChild(p);
    var r = buton.getBoundingClientRect(), lat = p.offsetWidth;
    p.style.left = Math.max(6, Math.min(r.right - 24, window.innerWidth - lat - 6)) + 'px';
    p.style.top = (r.bottom + 4) + 'px';
    p.style.maxHeight = Math.max(260, window.innerHeight - r.bottom - 14) + 'px';
    popFiltru = p; deseneaza(); inp.focus();
    document.addEventListener('pointerdown', afaraFiltru, true);
    document.addEventListener('keydown', tastaFiltru, true);
  }
  $('tabel').addEventListener('scroll', function () { if (popFiltru) inchideFiltru(); }, { passive: true });

  /* filtre */
  var tCauta = null;
  $('fCauta').addEventListener('input', function () {
    clearTimeout(tCauta);
    var v = this.value;
    tCauta = setTimeout(function () { stare.f.q = v; $('tabel').scrollTop = 0; redeseneaza(); }, 180);
    clearTimeout(tIstoric);
    tIstoric = setTimeout(function () { cautaInIstoric(v); }, 700);
  });
  /* Lista tine in memorie doar comenzile active si recente. Daca scrii un numar de comanda care nu e printre ele,
     il cautam o singura data in toata baza de date (o interogare mica) si aducem comanda in lista. */
  var tIstoric = null, istoricCautat = {};
  function cautaInIstoric(text) {
    var q = String(text || '').trim(), cheie = SC.cheieComanda(q);
    if (q.length < 3 || /\s/.test(q) || !cheie || istoricCautat[cheie]) return;
    if (SC.comenzi.some(function (o) { return SC.cheieComanda(o.nc) === cheie; })) return;      /* e deja in lista */
    istoricCautat[cheie] = 'caut';
    L.cautaComenzi([q]).then(function (rez) {
      var gasite = (rez[cheie] || []).length;
      istoricCautat[cheie] = gasite ? 'gasit' : 'lipsa';
      if ($('fCauta').value.trim() !== q) return;
      if (gasite) toast('Comanda ' + q + ' a fost găsită în istoric și adusă în listă.', 'bun');
      redeseneaza();
    }, function () { delete istoricCautat[cheie]; });
  }
  $('fClient').onchange = function () { stare.f.cl = this.value; redeseneaza(); };
  $('fNeinc').onchange = function () { stare.f.neinc = this.checked; redeseneaza(); };
  $('fDeInchis').onclick = function () { stare.f.deInchis = !stare.f.deInchis; redeseneaza(); };
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
    stare.fc = {}; deseneazaCap();
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
    SC.store.cautaGrupe(SC.msDin(SC.ziPlus(a, -3), '00:00'), SC.msDin(SC.ziPlus(b, 4), '00:00')).then(function (grupe) {
      btn.disabled = false;
      var noi = grupe.filter(function (d) { return !SC.grupe[d.id] || (SC.grupe[d.id].upd || 0) <= (d.data.upd || 0); });
      L.aplicaGrupe(noi);
      toast('Istoric încărcat: ' + grupe.length + ' grupe de comenzi din perioada aleasă.', 'bun');
      redeseneaza();
    }, function (e) { btn.disabled = false; arataEroare(e); });
  };
  /* export: ce se vede in lista, sau toate comenzile dintr-o anumita zi (cautate in toata baza de date) */
  var TIP_ZI = {
    dl: { t: 'Livrare solicitată', f: [-40, 4] }, dc: { t: 'Data comandă', f: [-5, 14] }, dp: { t: 'Data pregătire', f: [-40, 4] },
    di: { t: 'Data încărcare', f: [-55, 4] }, ct: { t: 'Data introducerii în registru', f: [-4, 4] }
  };
  function ziuaComenzii(o, tip) {
    if (tip === 'ct') return o.ct ? SC.ymd(new Date(o.ct)) : '';
    return String(o[tip] || '').slice(0, 10);
  }
  /* ================= export pentru TMS ================= */
  function tmsDeExportat() { return SC.comenzi.filter(function (o) { return L.tmsStare(o) === 'deExportat'; }); }
  /* zilele numarate pe buton: de maine pana la urmatoarea zi lucratoare inclusiv (vineri: sambata, duminica si luni) */
  function tmsPerioadaContor(azi) {
    var a = SC.ziPlus(azi || SC.azi(), 1), b = a, z;
    for (var i = 0; i < 3; i++) { z = new Date(b + 'T12:00:00').getDay(); if (z !== 0 && z !== 6) break; b = SC.ziPlus(b, 1); }
    return { a: a, b: b };
  }
  SC._tmsPerioadaContor = tmsPerioadaContor;
  function actualizeazaTmsNr() {
    var b = $('tmsNr'); if (!b || !poateTmsExport()) return;
    /* contorul: comenzile neexportate cu livrare solicitata in ziua urmatoare (cele urgente pentru Transport) */
    var per = tmsPerioadaContor(), toate = tmsDeExportat(), n = toate.filter(function (o) { var d = String(o.dl || '').slice(0, 10); return d >= per.a && d <= per.b; }).length;
    var cand = per.a === per.b ? 'mâine (' + SC.fmtDataLunga(per.a) + ')' : 'între ' + SC.fmtDataLunga(per.a) + ' și ' + SC.fmtDataLunga(per.b);
    b.textContent = n || ''; b.classList.toggle('are', n > 0);
    $('btnTmsExport').title = (n ? nCom(n) + ' cu livrare ' + cand + ' nu ' + (n === 1 ? 'a fost exportată' : 'au fost exportate') + ' încă pentru TMS' : 'Nicio comandă cu livrare ' + cand + ' nu așteaptă exportul pentru TMS') +
      '. În total, neexportate: ' + toate.length + '.';
  }
  function tmsNumeFisier(ts) { var d = new Date(ts); return 'Import TMS ' + SC.ymd(d) + ' ' + SC.p2(d.getHours()) + SC.p2(d.getMinutes()) + SC.p2(d.getSeconds()) + '.xlsx'; }      /* cu secunde: doua exporturi in acelasi minut au nume diferite */
  function tmsMoment(ts) { var d = new Date(ts); return SC.p2(d.getDate()) + '.' + SC.p2(d.getMonth() + 1) + '.' + d.getFullYear() + ' ' + SC.p2(d.getHours()) + ':' + SC.p2(d.getMinutes()); }
  function tmsEticheta(o) { return ((o.cl || '') + ' ' + (o.nc || '')).trim() + ' (Nr Crt ' + o.n + ')'; }
  /* exporturile facute pana acum, din marcajele de pe comenzile incarcate: [{ts, u, n, manual}] cele mai noi primele */
  function tmsExporturi() {
    var m = {};
    SC.comenzi.forEach(function (o) { if (!o.tx) return; var e = m[o.tx] = m[o.tx] || { ts: o.tx, u: o.txu || '?', n: 0, manual: !!o.txm }; e.n++; });
    return Object.keys(m).map(function (k) { return m[k]; }).sort(function (a, b) { return b.ts - a.ts; }).slice(0, 15);
  }
  $('btnPaleti').onclick = function () {
    if (!poatePaleti()) return;
    var azi = SC.azi(), date = null, cheieCitita = '', sel = null;
    var html = '<div class="rand-form">' +
      '<label class="camp"><span>Client</span><select id="rpCl"><option value="">Toți clienții</option>' + SC.config.clienti.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('') + '</select></label>' +
      '<label class="camp"><span>Perioada după</span><select id="rpDupa"><option value="dp">Data pregătire (închidere)</option><option value="dl">Livrare solicitată</option><option value="di">Data încărcare</option></select></label>' +
      '<label class="camp"><span>De la</span><input type="date" id="rpDe" value="' + SC.ziPlus(azi, -1) + '"></label>' +
      '<label class="camp"><span>Până la</span><input type="date" id="rpPana" value="' + SC.ziPlus(azi, -1) + '"></label>' +
      '<button type="button" class="btn" id="rpCauta">Caută comenzile</button></div>' +
      '<div class="mic" style="margin-top:6px">În raport intră comenzile închise (Terminata și Self-Pick) din perioada aleasă, cu FPP, Pick, paleți reali și amprente. Perioada este obligatorie (cel mult ' + L.PALETI_ZILE_MAX + ' de zile).</div>' +
      '<fieldset class="tms-ce"><legend>Ce comenzi intră în raport</legend>' +
      '<label class="bifa"><input type="radio" name="rpCe" value="toate" checked> <span><b>Toate comenzile închise</b> din filtru, și cele care au mai fost în raport <span class="tms-nr" id="rpNrToate"></span></span></label>' +
      '<label class="bifa"><input type="radio" name="rpCe" value="noi"> <span><b>Doar comenzile care nu au mai fost în raport</b> <span class="tms-nr" id="rpNrNoi"></span></span></label></fieldset>' +
      '<div class="tms-rez" id="rpRez" role="status"></div>';
    function citeste(rad) {
      var f = { cl: rad.querySelector('#rpCl').value, dupa: rad.querySelector('#rpDupa').value, a: rad.querySelector('#rpDe').value, b: rad.querySelector('#rpPana').value, noi: rad.querySelector('input[name=rpCe]:checked').value === 'noi' };
      f.eroare = !f.a || !f.b ? 'Alege ambele zile ale perioadei.' : f.b < f.a ? '„Până la” este înaintea zilei de început.' : Math.round((SC.msDin(f.b, '00:00') - SC.msDin(f.a, '00:00')) / 86400000) + 1 > L.PALETI_ZILE_MAX ? 'Perioada este mai lungă de ' + L.PALETI_ZILE_MAX + ' de zile. Fă raportul pe bucăți.' : '';
      return f;
    }
    function arata(rad) {
      var f = citeste(rad), rez = rad.querySelector('#rpRez'), cheie = f.a + '|' + f.b;
      sel = null; rad.querySelector('#rpNrToate').textContent = ''; rad.querySelector('#rpNrNoi').textContent = '';
      if (f.eroare) { rez.innerHTML = '<div class="nota rau">' + esc(f.eroare) + '</div>'; return; }
      if (!date || cheieCitita !== cheie) { rez.innerHTML = '<div class="nota">Apasă „Caută comenzile” ca să citesc comenzile din perioada ' + esc(SC.fmtDataLunga(f.a)) + ' – ' + esc(SC.fmtDataLunga(f.b)) + '.</div>'; return; }
      var potrivite = date.comenzi.filter(function (o) {
        if (!L.paletiInchisa(o)) return false;
        if (f.cl && String(o.cl || '').toUpperCase() !== f.cl) return false;
        var d = String(o[f.dupa] || '').slice(0, 10);
        return !!d && d >= f.a && d <= f.b;
      });
      var noi = potrivite.filter(function (o) { return !o.rp; }), l = f.noi ? noi : potrivite;
      rad.querySelector('#rpNrToate').textContent = '— ' + nCom(potrivite.length); rad.querySelector('#rpNrNoi').textContent = '— ' + nCom(noi.length);
      var faraPal = l.filter(function (o) { return !SC.esteNum(o.pr); }).length;
      sel = { f: f, l: l };
      rez.innerHTML = '<div class="nota"><span class="mare"><b>' + nCom(l.length) + '</b> în raport</span>' + (l.length ? ' · FPP ' + SC.fmtNum(suma(l, 'fpp'), 'int') + ' · Pick ' + SC.fmtNum(suma(l, 'pk'), 'int') + ' · paleți reali <b>' + SC.fmtNum(suma(l, 'pr'), 'int') + '</b> · amprente ' + SC.fmtNum(suma(l, 'am'), 'int') : '') +
        (potrivite.length - noi.length ? '<div>Din cele ' + potrivite.length + ' din filtru, <b>' + (potrivite.length - noi.length) + '</b> au mai fost într-un raport.</div>' : '') +
        '<div class="mic">Citite din baza de date: ' + date.documente + ' documente (comenzi primite cu până la ' + L.PALETI_MARJA_ZILE + ' de zile înaintea perioadei).</div></div>' +
        (faraPal ? '<div class="nota atentie">' + nCom(faraPal) + ' fără paleți reali trecuți; în Excel celula rămâne goală.</div>' : '');
    }
    modal({
      titlu: 'Raport paleți — comenzi închise', html: html, lat: true,
      laDeschidere: function (rad) {
        function cauta() {
          var f = citeste(rad); if (f.eroare) { arata(rad); return; }
          rad.querySelector('#rpRez').innerHTML = '<div class="mic" role="status">Se citesc comenzile din perioada aleasă…</div>';
          L.paletiCiteste(f.a, f.b).then(function (d) { date = d; cheieCitita = f.a + '|' + f.b; arata(rad); }, function (e) { rad.querySelector('#rpRez').innerHTML = '<div class="nota rau">Comenzile nu au putut fi citite: ' + esc(e && e.message ? e.message : e) + '</div>'; });
        }
        rad.querySelector('#rpCauta').onclick = cauta;
        ['#rpCl', '#rpDupa', '#rpDe', '#rpPana'].forEach(function (s) { rad.querySelector(s).addEventListener('change', function () { arata(rad); }); });
        Array.prototype.forEach.call(rad.querySelectorAll('[name=rpCe]'), function (x) { x.onchange = function () { arata(rad); }; });
        cauta();
      },
      butoane: [{ t: 'Închide', v: null }, {
        t: 'Descarcă raportul (Excel)', cls: 'pri', fn: function (rad) {
          if (!sel) { toast('Caută întâi comenzile din perioada aleasă.', 'rau'); return false; }
          if (!sel.l.length) { toast('Nicio comandă închisă în filtrul ales.', 'rau'); return false; }
          var f = sel.f, l = sel.l, text = (f.cl || 'toți clienții') + ' · ' + { dp: 'data pregătirii', dl: 'livrare solicitată', di: 'data încărcării' }[f.dupa] + ' ' + SC.fmtDataLunga(f.a) + ' – ' + SC.fmtDataLunga(f.b) + (f.noi ? ' · doar comenzile care nu au mai fost în raport' : '');
          var x = L.paletiExcel(l, text);
          XLSX.writeFile(x.wb, 'Raport paleti ' + f.a + (f.b !== f.a ? ' - ' + f.b : '') + (f.cl ? ' ' + f.cl : '') + '.xlsx');
          var deMarcat = l.filter(function (o) { return !o.rp; }).map(function (o) { return o.n; });
          if (!deMarcat.length) { toast('Raport descărcat: ' + nCom(l.length) + '.', 'bun'); return null; }
          toast('Raport descărcat. Marchez comenzile ca trecute prin raport…');
          return L.paletiMarcheaza(deMarcat, 'Raport Paleți: ' + nCom(l.length) + ' (' + text + ')').then(function () {
            toast('Raport descărcat: ' + nCom(l.length) + '; ' + deMarcat.length + ' marcate ca trecute prin raport.', 'bun');
          }, function (e) { toast('Raportul a fost descărcat, dar marcarea comenzilor nu a reușit: ' + (e && e.message ? e.message : e) + '. La următorul raport vor apărea din nou ca „noi”.', 'rau'); });
        }
      }]
    });
  };
  $('btnTmsExport').onclick = function () {
    if (!poateTmsExport()) return;
    var html = '<div class="rand-form">' +
      '<label class="camp"><span>Client</span><select id="txCl"><option value="">Toți clienții</option>' + SC.config.clienti.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('') + '</select></label>' +
      '<label class="camp"><span>Perioada după</span><select id="txDupa"><option value="dl">Livrare solicitată</option><option value="dc">Data comandă</option></select></label>' +
      '<label class="camp"><span>De la</span><input type="date" id="txDe"></label>' +
      '<label class="camp"><span>Până la</span><input type="date" id="txPana"></label></div>' +
      '<div class="mic" style="margin-top:6px">În fișier intră toate comenzile din perioada aleasă care au nevoie de transport, chiar dacă au mai fost exportate. Fără perioadă intră comenzile din orice zi.</div>' +
      '<fieldset class="tms-ce"><legend>Ce comenzi intră în fișier</legend>' +
      '<label class="bifa"><input type="radio" name="txCe" value="toate" checked> <span><b>Toate comenzile</b> din filtru, și cele care au mai fost exportate <span class="tms-nr" id="txNrToate"></span></span></label>' +
      '<label class="bifa"><input type="radio" name="txCe" value="noi"> <span><b>Doar comenzile care nu au mai fost exportate</b> <span class="tms-nr" id="txNrNoi"></span></span></label></fieldset>' +
      '<div class="tms-rez" id="txRez" role="status"></div>' +
      '<label class="bifa"><input type="checkbox" id="txCuLipsa"> Exportă și comenzile fără destinatar, oraș, județ sau dată de livrare (celulele rămân goale)</label>' +
      '<div class="tms-vechi" id="txVechi"></div>';
    var sel = { deExportat: [], lipsa: [] };
    function citeste(rad) {
      var f = { cl: rad.querySelector('#txCl').value, dupa: rad.querySelector('#txDupa').value, a: rad.querySelector('#txDe').value, b: rad.querySelector('#txPana').value, cuLipsa: rad.querySelector('#txCuLipsa').checked, cuExp: rad.querySelector('input[name=txCe]:checked').value === 'toate' };
      f.gresit = !!(f.a && f.b && f.b < f.a);
      return f;
    }
    function inFiltru(o, f) {
      if (f.cl && String(o.cl || '').toUpperCase() !== f.cl) return false;
      if (!f.a && !f.b) return true;
      var d = String(o[f.dupa] || '').slice(0, 10);
      if (!d) return false;
      return (!f.a || d >= f.a) && (!f.b || d <= f.b);
    }
    function calculeaza(rad) {
      var f = citeste(rad), numar = { exportata: 0, inTms: 0, faraTransport: 0 }, noi = [], vechi = [], afara = [];
      SC.comenzi.forEach(function (o) {
        var s = L.tmsStare(o), a = !f.gresit && inFiltru(o, f);
        if (s === 'deExportat') (a ? noi : afara).push(o);      /* nu a ajuns inca in niciun fisier */
        else if (!a) return;
        else if (s === 'exportata') {
          /* a mai fost exportata: poate intra din nou in fisier daca inca are nevoie de transport si nu are numar de transport */
          var s2 = L.tmsStare(o, true);
          if (s2 === 'deExportat') vechi.push(o); else if (numar[s2] != null) numar[s2]++;
        } else if (numar[s] != null) numar[s]++;
      });
      function bune(lista) { return f.cuLipsa ? lista : lista.filter(function (o) { return !L.tmsLipsa(o).length; }); }
      var inF = f.cuExp ? noi.concat(vechi) : noi, complete = [], lipsa = [];
      if (!f.cuExp) numar.exportata = vechi.length;
      inF.forEach(function (o) { var l = L.tmsLipsa(o); if (l.length) lipsa.push({ o: o, l: l }); else complete.push(o); });
      sel = { f: f, complete: complete, lipsa: lipsa, afara: afara, numar: numar, deExportat: f.cuLipsa ? inF : complete };
      sel.dinNou = sel.deExportat.filter(function (o) { return o.tx; }).length;
      /* cate comenzi ar intra cu fiecare dintre cele doua variante (aratat langa ele) */
      sel.nrToate = bune(noi.concat(vechi)).length; sel.nrNoi = bune(noi).length;
      return sel;
    }
    function deseneaza(rad) {
      var s = calculeaza(rad), f = s.f, h = '', l = s.deExportat;
      if (!L.tmsSetariComplete()) h += '<div class="nota rau"><b>Setările pentru TMS nu sunt completate</b> (furnizorul și celelalte valori fixe din fișier). ' +
        (eAdmin() ? 'Completează-le o singură dată în Administrare → Export pentru TMS; le poți prelua direct din fișierul de import folosit acum.' : 'Roagă administratorul să le completeze în Administrare → Export pentru TMS.') + ' Până atunci exportul nu este posibil.</div>';
      if (f.gresit) h += '<div class="nota rau">„Până la” este înaintea zilei de început. Corectează perioada.</div>';
      var pal = 0, kg = 0; l.forEach(function (o) { pal += L.tmsPaleti(o) || 0; kg += L.tmsMasa(o) || 0; });
      h += '<div class="nota"><span class="mare"><b>' + nCom(l.length) + '</b> de exportat acum</span>' + (l.length ? ' · ' + SC.fmtNum(pal, 'int') + ' paleți · ' + SC.fmtNum(kg, 'num') + ' kg' : '') +
        (s.dinNou ? '<div>Din ele, <b>' + s.dinNou + '</b> ' + (s.dinNou === 1 ? 'a mai fost exportată' : 'au mai fost exportate') + ' și <b>' + (l.length - s.dinNou) + '</b> ' + (l.length - s.dinNou === 1 ? 'este' : 'sunt') + ' la primul export.</div>' : '') +
        '<div class="mic">Nu intră în fișier, din ce se potrivește filtrului: ' + (f.cuExp ? '' : s.numar.exportata + ' deja exportate · ') + s.numar.inTms + ' deja în TMS (au număr de transport) · ' + s.numar.faraTransport + ' fără transport (Self-Pick / Ridicare client).</div></div>';
      if (s.lipsa.length) {
        h += '<div class="nota atentie"><b>' + nCom(s.lipsa.length) + ' cu date de livrare lipsă</b> — ' + (f.cuLipsa ? 'se exportă cu celulele goale; verifică-le în fișier.' : 'nu intră în fișier până completezi datele în comandă:') +
          '<ul>' + s.lipsa.slice(0, 8).map(function (x) { return '<li>' + esc(tmsEticheta(x.o)) + ' — lipsește: ' + esc(x.l.join(', ')) + '</li>'; }).join('') + (s.lipsa.length > 8 ? '<li>… și încă ' + (s.lipsa.length - 8) + '</li>' : '') + '</ul></div>';
      }
      var faraPal = 0, faraKg = 0, multi = [];
      l.forEach(function (o) { var pp = L.tmsPaleti(o); if (pp == null) faraPal++; else if (pp > L.TMS_PALETI_MULTI) multi.push(o); if (L.tmsMasa(o) == null) faraKg++; });
      if (faraPal || faraKg) h += '<div class="nota atentie"><b>De completat în fișier înainte de import:</b> ' + [faraKg ? nCom(faraKg) + ' fără greutate' : '', faraPal ? nCom(faraPal) + ' fără paleți' : ''].filter(Boolean).join(' · ') +
        '. Statusul nu are încă aceste valori, așa că în coloanele MASA PALETI / NUMAR PALETI celula rămâne goală.</div>';
      if (multi.length) h += '<div class="nota atentie"><b>De verificat:</b> ' + nCom(multi.length) + ' cu peste ' + L.TMS_PALETI_MULTI + ' de paleți (' + esc(multi.slice(0, 4).map(function (o) { return tmsEticheta(o) + ': ' + L.tmsPaleti(o); }).join('; ')) + (multi.length > 4 ? '…' : '') + '). Pare o greșeală de scriere în status.</div>';
      var externe = l.filter(function (o) { return L.tmsTara(o); }), faraNume = {};
      l.forEach(function (o) { var c = String(o.cl || '').toUpperCase(); if (c && !(SC.config.tmsClienti || {})[c]) faraNume[c] = 1; });
      if (externe.length) h += '<div class="nota atentie">' + nCom(externe.length) + ' pentru altă țară (' + esc(externe.slice(0, 4).map(function (o) { return o.nc; }).join(', ')) + (externe.length > 4 ? '…' : '') + '): țara este luată din câmpul Județ. Verifică-le în fișier înainte de import.</div>';
      if (Object.keys(faraNume).length) h += '<div class="nota atentie">Client fără nume de TMS: ' + esc(Object.keys(faraNume).join(', ')) + '. În fișier se scrie codul din aplicație; numele din TMS se trec în Administrare → Export pentru TMS.</div>';
      /* cheia de verificare: ce ramane neexportat dupa acest export */
      var ramaseLipsa = f.cuLipsa ? 0 : s.lipsa.length;
      if (s.afara.length) {
        var vechi = s.afara.map(function (o) { return String(o.dc || '').slice(0, 10); }).filter(function (d) { return /^\d{4}-\d{2}-\d{2}$/.test(d); }).sort()[0];
        h += '<div class="nota atentie"><b>Verificare:</b> în afara filtrului ales mai ' + (s.afara.length === 1 ? 'rămâne 1 comandă care nu a fost exportată niciodată' : 'rămân ' + s.afara.length + ' comenzi care nu au fost exportate niciodată') +
          (vechi ? ' (cea mai veche are data comenzii ' + esc(SC.fmtDataLunga(vechi)) + ')' : '') + '. <button type="button" class="legatura" id="txToate">Arată-le pe toate</button></div>';
      } else if (!f.gresit) {
        h += '<div class="nota bun"><b>Verificare:</b> ' + (l.length || ramaseLipsa ? 'după acest export nu mai rămâne nicio comandă neexportată' + (ramaseLipsa ? ', în afară de ' + (ramaseLipsa === 1 ? 'cea' : 'cele ' + ramaseLipsa) + ' cu date de livrare lipsă.' : '.') : 'toate comenzile care au nevoie de transport au fost exportate.') + '</div>';
      }
      rad.querySelector('#txRez').innerHTML = h;
      rad.querySelector('#txNrToate').textContent = '— ' + nCom(s.nrToate);
      rad.querySelector('#txNrNoi').textContent = '— ' + nCom(s.nrNoi);
      var ex = tmsExporturi();
      rad.querySelector('#txVechi').innerHTML = ex.length ? '<div class="rand-form"><label class="camp" style="flex:1;min-width:260px"><span>Marcaje de export (pe loturi)</span><select id="txLot">' +
        ex.map(function (e) { return '<option value="' + e.ts + '">' + esc(tmsMoment(e.ts) + ' · ' + e.u + ' · ' + nCom(e.n) + (e.manual ? ' · marcate fără fișier' : ' la primul export')) + '</option>'; }).join('') + '</select></label>' +
        '<button type="button" class="btn" id="txDinNou">Descarcă din nou</button><button type="button" class="btn" id="txAnuleaza">Anulează marcajul</button></div>' : '<div class="mic">Încă nu s-a făcut niciun export.</div>';
    }
    /* Fisierul contine toate comenzile din filtru (si pe cele exportate inainte). Marcajul se pune doar pe cele aflate la
       primul export si serveste numai la verificare: numarul de pe buton = comenzi care n-au ajuns inca in niciun fisier. */
    function marcheaza(rad, faraFisier) {
      var s = calculeaza(rad), l = s.deExportat;
      if (s.f.gresit) { toast('Corectează perioada.', 'rau'); return Promise.resolve(false); }
      if (!faraFisier && !L.tmsSetariComplete()) { toast('Setările pentru TMS nu sunt completate.', 'rau'); return Promise.resolve(false); }
      if (!l.length) { toast('Nu este nicio comandă de exportat cu filtrul ales.', 'rau'); return Promise.resolve(false); }
      var noi = l.filter(function (o) { return !o.tx; }), numere = noi.map(function (o) { return o.n; });
      if (faraFisier && !noi.length) { toast('Toate comenzile din filtru sunt deja marcate ca exportate.', 'rau'); return Promise.resolve(false); }
      var intreb = faraFisier ? confirma('Marchezi ' + nCom(noi.length) + ' ca exportate, fără să se facă fișier?\n\nFolosește asta pentru comenzile care sunt deja în TMS (introduse de mână sau cu fișierul vechi), ca să nu mai apară la numărătoarea de pe buton. Marcajul se poate anula din „Marcaje de export”.', { da: 'Marchează', nu: 'Renunță' }) : Promise.resolve(true);
      return intreb.then(function (da) {
        if (!da) return false;
        var ts = Date.now(), nume = tmsNumeFisier(ts);
        if (!faraFisier) L.tmsFisier(l, nume);
        var text = faraFisier ? 'Export TMS — marcate fără fișier: ' + nCom(noi.length) :
          'Export TMS: ' + nCom(l.length) + (noi.length === l.length ? '' : (noi.length ? ', din care ' + noi.length + ' la primul export' : ', toate exportate și înainte'));
        var scrie = numere.length ? L.tmsMarcheaza(numere, faraFisier, text) : SC.store.tx(function (t) { t.log(text); }).then(function () { return {}; }, function (e) { return { eroare: e }; });
        return scrie.then(function (r) {
          redeseneaza(); deseneaza(rad);
          if (r.eroare) {
            return alerta((faraFisier ? 'Marcajul nu s-a salvat' : 'Fișierul „' + nume + '” a fost descărcat, dar marcajul de export nu s-a salvat') + ' (' + (r.eroare.message || r.eroare) + ').\n\n' +
              (faraFisier ? 'Încearcă din nou.' : 'Fișierul este complet. Doar numărătoarea de pe buton poate arăta în continuare aceste comenzi ca neexportate.'), 'Export pentru TMS').then(function () { return false; });
          }
          toast(faraFisier ? nCom(noi.length) + ' marcate ca exportate.' : 'Exportat: ' + nCom(l.length) + ' în „' + nume + '”.', 'bun');
          return false;
        });
      });
    }
    modal({
      titlu: 'Export pentru TMS', html: html, lat: true,
      laDeschidere: function (rad) {
        deseneaza(rad);
        rad.addEventListener('change', function (e) { if (e.target.id !== 'txLot') deseneaza(rad); });
        rad.addEventListener('click', function (e) {
          var id = e.target.id;
          if (id === 'txToate') { rad.querySelector('#txCl').value = ''; rad.querySelector('#txDe').value = ''; rad.querySelector('#txPana').value = ''; deseneaza(rad); }
          else if (id === 'txDinNou' || id === 'txAnuleaza') {
            var ts = +rad.querySelector('#txLot').value, lot = L.tmsExportate(ts);
            if (!lot.length) return toast('Exportul ales nu mai are comenzi marcate.', 'rau');
            if (id === 'txDinNou') {
              if (!L.tmsSetariComplete()) return toast('Setările pentru TMS nu sunt completate.', 'rau');
              L.tmsFisier(lot, tmsNumeFisier(ts)); toast('Descărcat din nou: ' + nCom(lot.length) + '.', 'bun');
            } else {
              confirma('Anulezi marcajul exportului din ' + tmsMoment(ts) + '?\n\n' + nCom(lot.length) + ' ' + (lot.length === 1 ? 'redevine neexportată' : 'redevin neexportate') + ' la numărătoarea de pe buton. În fișier intră oricum, după perioada aleasă.', { da: 'Anulează marcajul', nu: 'Renunță' }).then(function (da) {
                if (!da) return;
                return L.tmsAnuleaza(ts, 'Export TMS din ' + tmsMoment(ts) + ' anulat: ' + nCom(lot.length) + (lot.length === 1 ? ' redevine neexportată' : ' redevin neexportate')).then(function () { redeseneaza(); deseneaza(rad); toast('Marcaj anulat pentru ' + nCom(lot.length) + '.', 'bun'); });
              }).catch(arataEroare);
            }
          }
        });
      },
      butoane: [{ t: 'Închide', v: null },
        { t: 'Marchează ca exportate, fără fișier', fn: function (rad) { return marcheaza(rad, true); } },
        { t: 'Exportă fișierul', cls: 'pri', fn: function (rad) { return marcheaza(rad, false); } }]
    }).then(function () { redeseneaza(); });
  };

  $('btnExport').onclick = function () {
    var html = '<label class="bifa"><input type="radio" name="exTip" value="lista" checked> Ce se vede acum în listă, cu filtrele aplicate (' + nCom(stare.lista.length) + ')</label>' +
      '<label class="bifa"><input type="radio" name="exTip" value="zi"> Toate comenzile dintr-o zi</label>' +
      '<div class="grila" style="margin-left:24px"><label class="camp"><span>Ziua</span><input type="date" id="exZi" value="' + SC.azi() + '"></label>' +
      '<label class="camp"><span>După</span><select id="exDupa">' + Object.keys(TIP_ZI).map(function (k) { return '<option value="' + k + '"' + (k === stare.f.colData ? ' selected' : '') + '>' + TIP_ZI[k].t + '</option>'; }).join('') + '</select></label></div>' +
      '<div class="mic" style="margin-left:24px">Exportul pe zi caută în toată baza de date, nu doar în comenzile încărcate, și ignoră filtrele din listă.</div>';
    modal({
      titlu: 'Export Excel', html: html,
      laDeschidere: function (rad) {
        function peZi() { rad.querySelector('[value=zi]').checked = true; }
        rad.querySelector('#exZi').addEventListener('focus', peZi); rad.querySelector('#exDupa').addEventListener('focus', peZi);
      },
      butoane: [{ t: 'Renunță', v: null }, {
        t: 'Exportă', cls: 'pri', fn: function (rad) {
          if (rad.querySelector('[value=lista]').checked) {
            if (!stare.lista.length) { toast('Nu există comenzi de exportat.', 'rau'); return false; }
            L.exportExcel(stare.lista, 'Status Comenzi ' + SC.azi() + '.xlsx');
            return;
          }
          var zi = rad.querySelector('#exZi').value, tip = rad.querySelector('#exDupa').value, fer = TIP_ZI[tip].f;
          if (!zi) { toast('Alege ziua.', 'rau'); return false; }
          return SC.store.cautaGrupe(SC.msDin(SC.ziPlus(zi, fer[0]), '00:00'), SC.msDin(SC.ziPlus(zi, fer[1]), '00:00')).then(function (grupe) {
            L.aplicaGrupe(grupe.filter(function (d) { return !SC.grupe[d.id] || (SC.grupe[d.id].upd || 0) <= (d.data.upd || 0); }));
            var l = SC.comenzi.filter(function (o) { return ziuaComenzii(o, tip) === zi; });
            redeseneaza();
            if (!l.length) { toast('Nicio comandă cu ' + TIP_ZI[tip].t.toLowerCase() + ' = ' + SC.fmtDataLunga(zi) + '.', 'rau'); return false; }
            L.exportExcel(l, 'Comenzi ' + SC.fmtDataLunga(zi) + ' (' + TIP_ZI[tip].t + ').xlsx');
            toast('Exportate ' + nCom(l.length) + ' din ' + SC.fmtDataLunga(zi) + '.', 'bun');
          });
        }
      }]
    });
  };

  /* ================= COMENZI: statusuri ================= */
  function cereDateTerminare(o, st, grup) {
    var cfg = SC.config, cumul = !!(grup && grup.length > 1);
    /* la cumul nu se cere si nu se calculeaza greutatea: ramane cea din tabel */
    var auto = cumul || L.greutateAuto(o), eKandia = SC.normText(o.cl) === SC.normText(cfg.clientGreutateAuto);
    var est = cumul ? (grup.some(function (x) { return SC.esteNum(x.pe); }) ? SC.rotunjeste(suma(grup, 'pe')) : null) : (SC.esteNum(o.pe) ? o.pe : null);
    /* comanda (sau cumulul) a plecat deja cu camionul: paletii si amprentele numarate la incarcare vin ca sugestie */
    var cuInc = (cumul ? grup : [o]).filter(function (x) { return x.inc === 'DA' && SC.esteNum(x.ipr); });
    var incPal = cuInc.length ? suma(cuInc, 'ipr') : null, incAm = cuInc.length ? suma(cuInc, 'iam') : null;
    var html = (cumul ? '<div class="nota">Cumul <b>' + esc(o.cum) + '</b> · ' + esc(o.cl) + ' · ' + esc(o.de || '') + '</div>' + tabelCumul(grup) +
        '<div class="nota atentie" style="margin-top:8px">Paleții se trec o singură dată, pe comanda <b>' + esc(o.nc) + '</b>. ' + (grup.length === 2 ? 'Cealaltă comandă se închide' : 'Celelalte ' + (grup.length - 1) + ' comenzi se închid') +
        ' automat cu 0 paleți. Greutatea finală rămâne greutatea din tabel.</div>' :
      '<div class="nota">' + esc(o.cl) + ' · comanda <b>' + esc(o.nc) + '</b><br>' + esc(o.de || '') +
      (est != null ? '<br>Paleți estimați: <b>' + SC.fmtNum(est, 'num') + '</b>' : '') +
      (SC.esteNum(o.g) ? ' · Greutate: <b>' + SC.fmtNum(o.g, 'num') + ' kg</b>' : '') + '</div>') +
      (incPal != null ? '<div class="nota bun" style="margin-top:6px">' + (!cumul ? 'Comanda a' : cuInc.length === grup.length ? 'Comenzile au' : cuInc.length === 1 ? 'O comandă din cele ' + grup.length + ' a' : cuInc.length + ' din cele ' + grup.length + ' comenzi au') + ' plecat deja cu camionul' + (o.di ? ' (' + esc(SC.fmtDT(o.di)) + (o.se ? ', ' + esc(o.se) : '') + ')' : '') +
        '. La încărcare s-au numărat <b>' + incPal + '</b> paleți și <b>' + incAm + '</b> amprente — sunt puse mai jos ca sugestie.</div>' : '') +
      '<div class="grila">' +
      '<label class="camp"><span>FPP (paleți full)</span><input type="text" id="tFpp" inputmode="numeric" value="' + (SC.esteNum(o.fpp) ? o.fpp : SC.fppImplicit(o)) + '"></label>' +
      '<label class="camp"><span>Pick (paleți din picking)</span><input type="text" id="tPk" inputmode="numeric" value="' + (SC.esteNum(o.pk) ? o.pk : '') + '"></label>' +
      '<label class="camp"><span>Paleți reali (FPP + Pick)</span><input type="text" id="tPr" readonly tabindex="-1" value=""></label>' +
      '<label class="camp"><span>Amprente paleți</span><input type="text" id="tAm" inputmode="numeric" value="' + (incAm != null ? incAm : SC.esteNum(o.am) ? o.am : '') + '"></label>' +
      (auto ? '' : '<label class="camp"><span>Greutate finală (kg)</span><input type="text" id="tGf" inputmode="decimal" value="' + (SC.esteNum(o.gf) ? String(o.gf).replace('.', ',') : '') + '"></label>') +
      '</div>' +
      (cumul ? '' : auto ? '<div class="mic">Greutatea finală se calculează automat: greutate + paleți reali × ' + cfg.kgPalet + ' kg.</div>' :
        (eKandia ? '<div class="nota atentie">Comanda este ' + esc(cfg.clientGreutateAuto) + ', dar Greutatea lipsește, deci greutatea finală se introduce manual.</div>' :
          '<div class="mic">Zecimalele se scriu cu virgulă (ex. 2135,45).</div>')) +
      '<div class="nota atentie ascuns" id="tIncNota" style="margin-top:6px" role="status"></div>' +
      '<div class="mic">FPP și Pick se confirmă la închiderea comenzii. Paleții reali sunt mereu FPP + Pick. Amprentele pornesc de la aceeași sumă și pot fi corectate.</div>';
    function intreg(v, nume) {
      var n = SC.parseNum(v);
      if (n == null) { toast(nume + ': „' + v + '” nu este un număr.', 'rau'); return null; }
      if (n < 0) { toast(nume + ' nu poate fi negativ.', 'rau'); return null; }
      if (n !== Math.floor(n)) { toast(nume + ': introdu un număr întreg.', 'rau'); return null; }
      return n;
    }
    return modal({
      titlu: (st === ST.SELF ? 'Ridicare client — date pregătire' : (cumul ? 'Terminare cumul' : 'Terminare comandă')), html: html, lat: cumul,
      laDeschidere: function (rad) {
        var iPr = rad.querySelector('#tPr'), iF = rad.querySelector('#tFpp'), iP = rad.querySelector('#tPk'), iA = rad.querySelector('#tAm');
        var atins = SC.esteNum(o.pk);
        /* amprentele urmeaza suma pana cand sunt scrise de mana (sau daca erau deja diferite de paletii reali) */
        var amAtins = (SC.esteNum(o.am) && o.am !== o.pr) || incAm != null;      /* amprentele numarate la incarcare raman, daca nu sunt schimbate de mana */
        var notaInc = rad.querySelector('#tIncNota');
        function total() {
          var f = SC.parseNum(iF.value.trim()), p = SC.parseNum(iP.value.trim());
          var s = f != null && p != null ? f + p : null;
          iPr.value = s == null ? '' : s;
          if (!amAtins) iA.value = s == null ? '' : s;
          var difera = incPal != null && s != null && s !== incPal;
          notaInc.classList.toggle('ascuns', !difera);
          if (difera) notaInc.textContent = 'FPP + Pick = ' + s + ', dar la încărcare s-au numărat ' + incPal + ' paleți. Verifică înainte de a confirma.';
        }
        iF.addEventListener('input', function () {
          if (!atins) { var p = SC.pickPropus(SC.parseNum(iF.value.trim()), est, null); if (p != null) iP.value = p; }
          total();
        });
        iP.addEventListener('input', function () { atins = true; total(); });
        iA.addEventListener('input', function () { amAtins = true; });
        total();
      },
      butoane: [{ t: 'Renunță', v: null }, {
        t: 'Confirmă', cls: 'pri', fn: function (r) {
          var fpp = citesteIntreg(r.querySelector('#tFpp').value, 'FPP', true); if (fpp == null) return false;
          var pk = citesteIntreg(r.querySelector('#tPk').value, 'Pick', true); if (pk == null) return false;
          var pr = fpp + pk;
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
                return ok && confirma('Pentru ' + (cumul ? 'cumulul ' + o.cum : 'comanda ' + o.nc) + ' estimarea este ' + SC.fmtNum(est, 'num') + ' paleți (aprox. ' + rot + ').\nFPP ' + fpp + ' + Pick ' + pk + ' = ' + pr + ' paleți reali. Este corect?');
              });
            }
          }
          if (incPal != null && pr !== incPal) {
            pasi = pasi.then(function (ok) {
              return ok && confirma('La încărcare s-au numărat ' + incPal + ' paleți, iar FPP ' + fpp + ' + Pick ' + pk + ' = ' + pr + ' paleți reali.\nRămâne ' + pr + '?');
            });
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
          return pasi.then(function (ok) { return ok ? { pr: pr, am: am, gf: gf, fpp: fpp, pk: pk, cumul: cumul } : false; });
        }
      }]
    });
  }
  /* cumul: statusul se schimba la toate comenzile legate; paletii se trec doar pe comanda la care s-a lucrat */
  function schimbaStatusCumul(o, stNou, grup) {
    /* O comanda incarcata si deja inchisa nu se mai atinge. Una incarcata inainte de a fi inchisa (plecata cu camionul cu paletii
       numarati la incarcare) trebuie insa sa poata fi inchisa odata cu cumulul ei; doar anularea o ocoleste. */
    var cod = o.cum, n = o.n, tinta = grup.filter(function (x) {
      if (x.inc === 'DA' && (!SC.esteDeschisa(x) || stNou === ST.ANU)) return false;
      return x.n === n || x.st !== stNou;
    }).sort(function (a, b) { return a.n - b.n; });
    if (!tinta.length) { toast('Nicio comandă din cumulul ' + cod + ' nu mai poate fi trecută pe ' + stNou + ': sunt deja încărcate.', 'rau'); return Promise.resolve(); }
    var asteptat = {}; tinta.forEach(function (x) { asteptat[x.n] = x.st; });
    /* cumul plecat cu camionul: paletii se trec pe comanda pe care au fost numarati la incarcare, indiferent pe care apasa Operatorul */
    if (stNou === ST.TER || stNou === ST.SELF) {
      var purt = tinta.filter(function (x) { return x.inc === 'DA' && SC.esteNum(x.ipr) && x.ipr > 0; }).sort(function (a, b) { return b.ipr - a.ipr || a.n - b.n; })[0];
      if (purt) { o = purt; n = purt.n; }
    }
    var lista = tinta.map(function (x) { return x.nc; }).join(', '), p;
    if (stNou === ST.TER) p = cereDateTerminare(o, stNou, tinta);
    else if (stNou === ST.SELF) p = confirma('Cumulul ' + cod + ' (' + lista + ') se ridică de către client?').then(function (ok) { return ok ? cereDateTerminare(o, stNou, tinta) : null; });
    else if (stNou === ST.ANU) p = confirma('Comanda ' + o.nc + ' face parte din cumulul ' + cod + '.\nSe anulează toate cele ' + tinta.length + ' comenzi: ' + lista + '?\n\nToate datele lor se șterg; rămân Nr Crt, clientul, numărul de comandă și eticheta de import.\nCa să anulezi doar una, anulează întâi cumulul.').then(function (ok) { return ok ? {} : null; });
    else {
      var avertC = avertRedeschidere(tinta, stNou, 'cumulul ' + cod + ' (' + lista + ')');
      p = avertC ? confirma(avertC, { da: 'Da, redeschide', nu: 'Renunță' }).then(function (ok) { return ok ? {} : null; }) : Promise.resolve({});
    }
    return p.then(function (date) {
      if (!date) return;
      return L.modifica(tinta.map(function (m) {
        return {
          n: m.n, fn: function (x) {
            if (x.st !== asteptat[m.n]) throw L.eroare('Statusul comenzii ' + x.nc + ' a fost schimbat între timp de un coleg (acum: ' + x.st + '). Verifică și repetă.');
            L.aplicaStatus(x, stNou, (stNou === ST.TER || stNou === ST.SELF) ? (m.n === n ? date : { pr: 0, am: 0, fpp: 0, pk: 0, cumul: true }) : date);
            dezanuleaza(x, asteptat[m.n] === ST.ANU);
          }
        };
      }), 'Cumul ' + cod + ' (' + lista + ') → ' + stNou).then(function () { toast('Cumul ' + cod + ': ' + nCom(tinta.length) + ' → ' + stNou, 'bun'); });
    });
  }
  /* textul de avertizare la redeschiderea unor comenzi (Terminata / Self-Pick / Anulata → Initiata / In lucru); '' = nu e cazul */
  function avertRedeschidere(l, stNou, ceEste) {
    if (stNou !== ST.INI && stNou !== ST.LUC) return '';
    var anulate = l.filter(function (x) { return x.st === ST.ANU; }), gata = l.filter(function (x) { return x.st === ST.TER || x.st === ST.SELF; });
    if (!anulate.length && !gata.length) return '';
    var inc = gata.filter(function (x) { return x.inc === 'DA'; }), t = 'Redeschizi ' + ceEste + ' (→ ' + stNou + ')?';
    if (gata.length) t += '\n\n' + (l.length === 1 ? 'Comanda este ' + gata[0].st : nCom(gata.length) + ' sunt deja pregătite') + ': data și ora pregătirii se șterg și se trec din nou la următoarea închidere. Paleții rămân cum sunt.';
    if (inc.length) t += '\n\nATENȚIE: ' + (l.length === 1 ? 'comanda este deja ÎNCĂRCATĂ' + (inc[0].na ? ' pe camionul ' + inc[0].na : '') + (inc[0].di ? ' (' + SC.fmtDT(inc[0].di) + ')' : '') : nCom(inc.length) + ' sunt deja ÎNCĂRCATE') + '. Rămâne încărcată, dar cu status deschis, și va trebui închisă din nou.';
    if (anulate.length) t += '\n\n' + (l.length === 1 ? 'Comanda este Anulata' : nCom(anulate.length) + ' sunt Anulate') + ': la anulare i s-au șters toate datele (destinatar, adresă, greutăți, date). Revine goală și trebuie completată din nou; comentariul „COMANDA ANULATA” se șterge.';
    return t;
  }
  function dezanuleaza(x, eraAnulata) { if (eraAnulata && String(x.co || '').trim().toUpperCase() === 'COMANDA ANULATA') delete x.co; }
  function schimbaStatus(o, stNou) {
    var vechi = o.st, nc = o.nc, n = o.n;
    if (stNou === vechi) return Promise.resolve();
    var grup = membriCumul(o);
    if (grup.length > 1) return schimbaStatusCumul(o, stNou, grup);
    var p, avert = avertRedeschidere([o], stNou, 'comanda ' + nc);
    if (stNou === ST.TER) p = cereDateTerminare(o, stNou);
    else if (stNou === ST.SELF) {
      p = confirma('Comanda ' + nc + ' se ridică de către client?').then(function (ok) { return ok ? cereDateTerminare(o, stNou) : null; });
    } else if (stNou === ST.ANU) {
      p = confirma((o.inc === 'DA' ? 'ATENȚIE: comanda ' + nc + ' este deja ÎNCĂRCATĂ' + (o.na ? ' pe camionul ' + o.na + (o.nt ? ' / ' + o.nt : '') : '') + (o.di ? ' (' + SC.fmtDT(o.di) + (o.se ? ', ' + o.se : '') + ')' : '') +
        '.\nDacă o anulezi, se șterg și datele de încărcare, iar camionul rămâne fără ea (în borderou și în totaluri).\n\n' : '') +
        'Ești sigur că vrei să anulezi comanda ' + nc + '?\n\nToate datele comenzii se șterg; rămân Nr Crt, clientul, numărul de comandă și eticheta de import.',
        o.inc === 'DA' ? { da: 'Da, anulează comanda încărcată', nu: 'Renunță' } : undefined).then(function (ok) { return ok ? {} : null; });
    } else if (avert) p = confirma(avert, { da: 'Da, redeschide', nu: 'Renunță' }).then(function (ok) { return ok ? {} : null; });
    else p = Promise.resolve({});
    return p.then(function (date) {
      if (!date) return;
      return L.modifica([{
        n: n, fn: function (x) {
          if (x.st !== vechi) throw L.eroare('Statusul comenzii ' + nc + ' a fost schimbat între timp de un coleg (acum: ' + x.st + '). Verifică și repetă.');
          L.aplicaStatus(x, stNou, date); dezanuleaza(x, vechi === ST.ANU);
        }
      }], nc + ': ' + vechi + ' → ' + stNou).then(function () { toast('Comanda ' + nc + ': ' + stNou, 'bun'); });
    });
  }

  /* ================= COMENZI: formular ================= */
  var CAMPURI_FORM = ['cl', 'nc', 'cc', 'dc', 'dl', 'de', 'ad', 'or', 'ju', 'g', 'ca', 'pe', 'fpp', 'pk', 'gf', 'pr', 'am', 'dp', 'op', 'na', 'nt', 'dtr', 'inc', 'di', 'ob', 'co', 'sc', 'te', 'se', 'so', 're'];
  var CAMPURI_FARA_OPERATOR = { sc: 1, te: 1, se: 1, so: 1, re: 1 };      /* Stare camion, Temperatura, Semnatura, Sofer, Remorca */
  var CAMPURI_NOI = ['cl', 'nc', 'cc', 'dc', 'dl', 'de', 'ad', 'or', 'ju', 'g', 'ca', 'pe', 'fpp', 'pk', 'na', 'ob', 'co'];
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
    } else if (k === 'ob' && editabil) {
      /* text liber + lista cu textele uzuale: alegerea din lista adauga textul (sau il scoate, daca exista deja) */
      inp = '<span class="ob-rand"><input type="text" data-k="ob" value="' + esc(v) + '"><select class="ob-sel" aria-label="Texte uzuale pentru Observații">' + obOptiuni(v) + '</select></span>';
    } else if (c.typ === 'date' && (v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v))) {
      inp = '<input type="date" data-k="' + k + '" value="' + esc(v) + '"' + ro + '>';
    } else if (c.typ === 'num' || c.typ === 'int') {
      inp = '<input type="text" inputmode="decimal" data-k="' + k + '" value="' + esc(SC.esteNum(v) ? String(v).replace('.', ',') : v) + '"' + ro + '>';
    } else {
      inp = '<input type="text" data-k="' + k + '" value="' + esc(v) + '"' + ro + '>';
    }
    if (k === 'ju' && editabil) {
      /* eticheta si campul sunt legate prin id (nu prin imbricare), ca butonul de sugestie sa poata sta langa eticheta */
      var id = 'fJu' + (++nrCampJu);
      return '<div class="camp camp-ju"><span class="camp-sus"><label for="' + id + '">' + esc(c.t) + '</label><button type="button" class="sug-ju ascuns" data-sug-ju></button></span>' +
        inp.replace('<input ', '<input id="' + id + '" ') + '</div>';
    }
    return '<label class="camp' + (LATE[k] ? ' lat2' : '') + '"><span>' + esc(c.t) + '</span>' + inp + '</label>';
  }
  var nrCampJu = 0;
  /* Sugestia de judet din formularul comenzii: apare langa eticheta „Județ” cand orasul are un judet cunoscut si
     in camp este altceva (gol, numele orasului, o greseala). Un click pe ea completeaza campul. */
  function leagaSugestieJudet(rad) {
    var ju = rad.querySelector('[data-k=ju]'), or = rad.querySelector('[data-k=or]'), b = rad.querySelector('[data-sug-ju]');
    if (!ju || !or || !b || ju.readOnly) return;
    function arata() {
      var sug = L.sugestieJudet(or.value), acum = ju.value.trim();
      if (!sug || SC.normLoc(acum) === SC.normLoc(sug)) { b.classList.add('ascuns'); b.textContent = ''; return; }
      /* in camp este scris altceva decat un judet (de exemplu numele orasului): sugestia iese in evidenta */
      var gresit = !!acum && !L.numeJudet(acum);
      b.textContent = (gresit ? 'corect: ' : 'sugestie: ') + sug;
      b.dataset.v = sug;
      b.classList.toggle('tare', gresit);
      b.setAttribute('aria-label', 'Completează județul cu ' + sug + (acum ? ' în loc de ' + acum : ''));
      b.title = 'Pentru orașul ' + or.value.trim() + ' județul este ' + sug + '. Click pentru a-l completa.';
      b.classList.remove('ascuns');
    }
    b.addEventListener('click', function () { ju.value = b.dataset.v || ''; arata(); ju.focus(); });
    or.addEventListener('input', arata); ju.addEventListener('input', arata);
    rad.addEventListener('sugestie-judet', arata);      /* dupa completarea din Adrese (cod client) */
    arata();
  }
  function obParti(text) { return String(text || '').split('/').map(function (x) { return x.trim(); }).filter(Boolean); }
  function obOptiuni(text) {
    var are = obParti(text).map(SC.normText);
    return '<option value="">Alege din listă…</option>' + (SC.config.observatii || []).map(function (x) {
      return '<option value="' + esc(x) + '">' + (are.indexOf(SC.normText(x)) >= 0 ? '✓ ' : '') + esc(x) + '</option>';
    }).join('');
  }
  document.addEventListener('change', function (e) {
    var s = e.target.closest ? e.target.closest('.ob-sel') : null; if (!s || !s.value) return;
    var inp = s.parentNode.querySelector('[data-k=ob]'), parti = obParti(inp.value), cheie = SC.normText(s.value), i = parti.map(SC.normText).indexOf(cheie);
    if (i >= 0) parti.splice(i, 1); else parti.push(s.value);
    inp.value = parti.join(' / ');
    s.innerHTML = obOptiuni(inp.value); s.value = '';
    inp.focus();
  });
  document.addEventListener('input', function (e) {
    if (!e.target.matches || !e.target.matches('.ob-rand [data-k=ob]')) return;
    var s = e.target.parentNode.querySelector('.ob-sel'); if (s) s.innerHTML = obOptiuni(e.target.value);
  });
  /* bifa Self-Pick din formularul comenzii */
  function bifaSelfPick(bifat, activ) {
    return '<label class="bifa sp-bifa"><input type="checkbox" id="spBifa"' + (bifat ? ' checked' : '') + (activ ? '' : ' disabled') + '> <span><b>Comandă Self-Pick</b> — o ridică clientul; nu intră în exportul pentru TMS</span></label>';
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
      if (k === 'ju') v = SC.fmtJudet(v);      /* „BUCURESTI” scris de mana se salveaza „Bucuresti” */
      val[k] = v;
    });
    if (greseala) { toast(greseala, 'rau'); return null; }
    var sp = rad.querySelector('#spBifa');
    if (sp && !sp.disabled) val.sp = sp.checked ? 'DA' : '';
    return val;
  }
  /* la schimbarea codului de client: Destinatar / Adresa / Oras / Judet din Adrese (dupa Client + Cod) */
  function leagaCodClient(rad) {
    leagaSugestieJudet(rad);
    var inF = rad.querySelector('[data-k=fpp]'), inP = rad.querySelector('[data-k=pk]');
    if (inF && inP && !inF.readOnly && !inP.readOnly) {
      inF.addEventListener('input', function () {
        function nr(k) { var el = rad.querySelector('[data-k=' + k + ']'); return el ? SC.parseNum(el.value.trim()) : null; }
        var p = SC.pickPropus(SC.parseNum(inF.value.trim()), nr('pe'), nr('pr'));
        if (p != null) inP.value = p;
      });
    }
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
      rad.dispatchEvent(new Event('sugestie-judet'));
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
  /* FPP (paleti full) si Pick (paleti din picking), direct din lista. La completarea FPP, Pick se propune singur. */
  function leagaFppPick(inFpp, inPk, estimare, paletiReali) {
    inFpp.addEventListener('input', function () {
      var f = SC.parseNum(inFpp.value.trim()), p = SC.pickPropus(f, estimare, typeof paletiReali === 'function' ? paletiReali() : paletiReali);
      if (p != null) inPk.value = p;
    });
  }
  function citesteIntreg(v, nume, obligatoriu) {
    v = String(v).trim();
    if (v === '') { if (obligatoriu) { toast(nume + ': completează valoarea (0 dacă nu sunt).', 'rau'); return null; } return ''; }
    var n = SC.parseNum(v);
    if (n == null || n < 0 || n !== Math.floor(n)) { toast(nume + ': „' + v + '” nu este un număr întreg valid.', 'rau'); return null; }
    return n;
  }
  function editeazaFppPick(o) {
    var n = o.n, gata = o.st === ST.TER || o.st === ST.SELF;
    modal({
      titlu: 'FPP și Pick — comanda ' + o.nc,
      html: '<div class="nota">' + esc(o.cl) + ' · ' + esc(o.de || '') + '<br>Paleți estimați: <b>' + (SC.esteNum(o.pe) ? SC.fmtNum(o.pe, 'num') : '—') + '</b>' +
        (SC.esteNum(o.pr) ? ' · Paleți reali: <b>' + SC.fmtNum(o.pr, 'int') + '</b>' : '') + '</div>' +
        '<div class="grila"><label class="camp"><span>FPP (paleți full)</span><input type="text" inputmode="numeric" id="fppNou" value="' + (SC.esteNum(o.fpp) ? o.fpp : SC.fppImplicit(o)) + '"></label>' +
        '<label class="camp"><span>Pick (paleți din picking)</span><input type="text" inputmode="numeric" id="pkNou" value="' + (SC.esteNum(o.pk) ? o.pk : '') + '"></label></div>' +
        (gata ? '<div class="nota" id="fpTot"></div><div class="mic">Comanda este pregătită: paleții reali se refac din FPP + Pick. Amprentele urmează suma doar dacă nu au fost modificate separat.</div>' :
          '<div class="mic">Când scrii FPP, Pick se calculează singur: estimarea rotunjită în sus − FPP. Îl poți corecta înainte de salvare.</div>'),
      laDeschidere: function (rad) {
        var iF = rad.querySelector('#fppNou'), iP = rad.querySelector('#pkNou');
        if (!gata) { leagaFppPick(iF, iP, o.pe, null); if (!SC.esteNum(o.fpp) && iF.value !== '' && iP.value === '') iF.dispatchEvent(new Event('input')); return; }
        function total() {
          var f = SC.parseNum(iF.value.trim()), p = SC.parseNum(iP.value.trim());
          rad.querySelector('#fpTot').innerHTML = 'Paleți reali după salvare: <b>' + (f != null && p != null ? f + p : '—') + '</b>' + (SC.esteNum(o.pr) ? ' (acum: ' + SC.fmtNum(o.pr, 'int') + ')' : '');
        }
        iF.addEventListener('input', total); iP.addEventListener('input', total); total();
      },
      butoane: [{ t: 'Renunță', v: null }, {
        t: 'Salvează', cls: 'pri', fn: function (rad) {
          var f = citesteIntreg(rad.querySelector('#fppNou').value, 'FPP', gata); if (f == null) return false;
          var p = citesteIntreg(rad.querySelector('#pkNou').value, 'Pick', gata); if (p == null) return false;
          return L.modifica([{ n: n, fn: function (x) { if (f === '') delete x.fpp; else x.fpp = f; if (p === '') delete x.pk; else x.pk = p; L.sincPaleti(x); } }])
            .then(function () { toast('FPP / Pick salvate pentru comanda ' + o.nc + '.', 'bun'); redeseneaza(); });
        }
      }]
    });
  }
  /* amprentele se pot corecta separat de paletii reali (Operator date din lista, Incarcari la confirmarea incarcarii) */
  function editeazaAmprente(o) {
    var n = o.n;
    modal({
      titlu: 'Amprente — comanda ' + o.nc,
      html: '<div class="nota">' + esc(o.cl) + ' · ' + esc(o.de || '') + '<br>FPP <b>' + (SC.esteNum(o.fpp) ? o.fpp : '—') + '</b> + Pick <b>' + (SC.esteNum(o.pk) ? o.pk : '—') +
        '</b> = paleți reali <b>' + (SC.esteNum(o.pr) ? SC.fmtNum(o.pr, 'int') : '—') + '</b></div>' +
        '<label class="camp"><span>Amprente paleți</span><input type="text" inputmode="numeric" id="amNou" value="' + (SC.esteNum(o.am) ? o.am : '') + '"></label>',
      butoane: [{ t: 'Renunță', v: null }, {
        t: 'Salvează', cls: 'pri', fn: function (rad) {
          var a = citesteIntreg(rad.querySelector('#amNou').value, 'Amprente', true); if (a == null) return false;
          if (a === o.am) return null;
          return L.modifica([{ n: n, fn: function (x) { x.am = a; } }]).then(function () { toast('Amprente salvate pentru comanda ' + o.nc + '.', 'bun'); redeseneaza(); });
        }
      }]
    });
  }
  /* rolul Transport: singura modificare permisa este Nr AUTO, direct din lista */
  /* ---- comenzi bifate: totaluri + Nr AUTO pentru toate ---- */
  function comenziBifate() { return Object.keys(stare.sel || {}).map(function (n) { return SC.dupaNr[+n]; }).filter(Boolean); }
  function deseneazaBaraSel() {
    var b = $('baraSel');
    if (!cuSelectie()) { b.classList.add('ascuns'); return; }
    var l = comenziBifate(), tot = $('selTot');
    if (tot) {
      var inLista = stare.lista.filter(function (o) { return stare.sel[o.n]; }).length;
      tot.checked = stare.lista.length > 0 && inLista === stare.lista.length; tot.indeterminate = inLista > 0 && inLista < stare.lista.length;
    }
    b.classList.toggle('ascuns', !l.length);
    if (!l.length) return;
    var ascunse = l.length - stare.lista.filter(function (o) { return stare.sel[o.n]; }).length;
    b.innerHTML = '<span>Bifate: <b>' + nCom(l.length) + '</b></span><span>Greutate: <b>' + SC.fmtNum(SC.rotunjeste(suma(l, 'g')), 'num') + ' kg</b></span>' +
      (poate() ? '<span>Cartoane: <b>' + SC.fmtNum(suma(l, 'ca'), 'int') + '</b></span>' : '') +          // doar Operator date / Administrator
      '<span>Paleți estimați: <b>' + SC.fmtNum(SC.rotunjeste(suma(l, 'pe')), 'num') + '</b></span>' +
      (ascunse ? '<span class="mic">' + ascunse + (ascunse === 1 ? ' bifată nu se vede' : ' bifate nu se văd') + ' cu filtrele de acum</span>' : '') +
      '<span style="flex:1"></span>' +
      (poate() ? '<button type="button" class="btn mic pri" id="selCum">Cumulat</button>' : '') +
      (poate() ? '<button type="button" class="btn mic" id="selCmr">CMR</button>' : '') +
      (l.some(function (o) { return o.cum; }) ? '<button type="button" class="btn mic" id="selVezi">Vezi cumulul</button>' : '') +
      (poate() && l.some(function (o) { return o.cum; }) ? '<button type="button" class="btn mic" id="selDecum">Anulează cumulul</button>' : '') +
      /* Transport (si Administrator): camionul se alege sau se creeaza cu Nr AUTO + Nr transport; Operatorul trece doar Nr AUTO */
      (rol() === 'operator' ? '' : '<button type="button" class="btn mic" id="selTra" title="Pune comenzile bifate pe un camion: unul nou (Nr AUTO + Nr transport) sau unul care există deja">Creează TRA…</button>') +
      '<button type="button" class="btn mic" id="selGol">Debifează tot</button>';
  }
  $('baraSel').addEventListener('click', function (e) {
    if (e.target.id === 'selGol') { stare.sel = {}; deseneazaRanduri(); deseneazaBaraSel(); }
    else if (e.target.id === 'selTra') transportPentru(comenziBifate(), true);
    else if (e.target.id === 'selCum') cumuleazaBifate();
    else if (e.target.id === 'selCmr') cmrDinBifate();
    else if (e.target.id === 'selVezi') { var prima = comenziBifate().filter(function (o) { return o.cum; })[0]; if (prima) arataCumul(prima); }
    else if (e.target.id === 'selDecum') {
      var cu = {}; comenziBifate().forEach(function (o) { if (o.cum) cu[o.cum] = 1; });
      anuleazaCumul(Object.keys(cu));
    }
  });
  /* ---- cumul: comenzi legate intre ele (acelasi client, acelasi destinatar) ---- */
  function tabelCumul(l) {
    return '<div class="derulare-x"><table class="simplu"><tr><th>Nr Crt</th><th>Nr. Comandă</th><th>Status</th><th class="nr">Paleți estimați</th><th class="nr">Greutate</th><th class="nr">Paleți reali</th></tr>' +
      l.map(function (o) {
        return '<tr><td>' + o.n + '</td><td><b>' + esc(o.nc) + '</b></td><td>' + esc(o.st) + '</td><td class="nr">' + SC.fmtNum(o.pe, 'num') + '</td><td class="nr">' + SC.fmtNum(o.g, 'num') + '</td><td class="nr">' + SC.fmtNum(o.pr, 'int') + '</td></tr>';
      }).join('') +
      '<tr><th colspan="3">Total ' + nCom(l.length) + '</th><th class="nr">' + SC.fmtNum(SC.rotunjeste(suma(l, 'pe')), 'num') + '</th><th class="nr">' + SC.fmtNum(SC.rotunjeste(suma(l, 'g')), 'num') + '</th><th class="nr">' + SC.fmtNum(suma(l, 'pr'), 'int') + '</th></tr></table></div>';
  }
  function cumuleazaBifate() {
    if (!poate()) return;
    var bif = comenziBifate();
    if (bif.length < 2) { toast('Bifează cel puțin două comenzi pentru cumul.', 'rau'); return; }
    var coduri = {}; bif.forEach(function (o) { if (o.cum) coduri[o.cum] = 1; });
    coduri = Object.keys(coduri);
    if (coduri.length > 1) { toast('Comenzile bifate fac parte din cumuluri diferite (' + coduri.join(', ') + '). Anulează întâi unul dintre ele.', 'rau'); return; }
    /* daca una e deja intr-un cumul, celelalte se adauga la el, impreuna cu toate comenzile lui */
    var l = bif.slice();
    if (coduri.length) SC.comenzi.forEach(function (o) { if (o.cum === coduri[0] && l.indexOf(o) < 0) l.push(o); });
    if (l.every(function (o) { return o.cum; })) { toast('Comenzile bifate sunt deja legate în cumulul ' + coduri[0] + '.', 'rau'); return; }
    var cl = SC.normText(l[0].cl), de = SC.normText(l[0].de);
    var altele = l.filter(function (o) { return SC.normText(o.cl) !== cl || SC.normText(o.de) !== de; });
    if (altele.length) {
      modal({
        titlu: 'Nu se pot cumula', lat: true,
        html: '<div class="nota atentie">Se pot cumula doar comenzi cu același client și același destinatar.</div><div class="derulare-x"><table class="simplu"><tr><th>Nr. Comandă</th><th>Client</th><th>Destinatar</th></tr>' +
          l.map(function (o) { return '<tr><td><b>' + esc(o.nc) + '</b></td><td>' + esc(o.cl) + '</td><td>' + esc(o.de || '—') + '</td></tr>'; }).join('') + '</table></div>',
        butoane: [{ t: 'Am înțeles', cls: 'pri', v: null }]
      });
      return;
    }
    var inchise = l.filter(function (o) { return !SC.esteDeschisa(o) || o.inc === 'DA'; });
    if (inchise.length) { toast('Se pot cumula doar comenzi încă deschise (Initiata / In lucru). Nu se potrivesc: ' + inchise.map(function (o) { return o.nc; }).join(', ') + '.', 'rau'); return; }
    l.sort(function (a, b) { return a.n - b.n; });
    var cod = coduri[0] || 'C' + l[0].n, numere = l.map(function (o) { return o.n; });
    modal({
      titlu: coduri.length ? 'Adaugă la cumulul ' + cod : 'Cumulează ' + nCom(l.length), lat: true,
      html: '<div class="nota">' + esc(l[0].cl) + ' · ' + esc(l[0].de || '(fără destinatar)') + '</div>' + tabelCumul(l) +
        '<div class="mic" style="margin-top:8px">Comenzile legate se închid împreună: la Terminata / Self-Pick paleții se trec o singură dată, pe comanda la care schimbi statusul, iar celelalte se închid cu 0 paleți. ' +
        'Greutatea finală rămâne greutatea din tabel. Când cauți sau filtrezi una dintre ele, apar toate.</div>',
      butoane: [{ t: 'Renunță', v: null }, {
        t: 'Cumulează', cls: 'pri', fn: function () {
          return L.modifica(numere.map(function (n) {
            return {
              n: n, fn: function (x) {
                if (!SC.esteDeschisa(x) || x.inc === 'DA') throw L.eroare('Comanda ' + x.nc + ' a fost închisă între timp și nu mai poate fi cumulată.');
                if (SC.normText(x.cl) !== cl || SC.normText(x.de) !== de) throw L.eroare('Comanda ' + x.nc + ' nu mai are același client și destinatar.');
                if (x.cum && x.cum !== cod) throw L.eroare('Comanda ' + x.nc + ' a fost pusă între timp în cumulul ' + x.cum + '.');
                x.cum = cod;
              }
            };
          }), 'Cumul ' + cod + ': ' + l.map(function (o) { return o.nc; }).join(' + ')).then(function () {
            stare.sel = {}; toast('Cumul ' + cod + ': ' + nCom(l.length) + ' legate.', 'bun'); redeseneaza();
          });
        }
      }]
    });
  }
  function anuleazaCumul(coduri) {
    if (!poate() || !coduri.length) return;
    var l = SC.comenzi.filter(function (o) { return o.cum && coduri.indexOf(o.cum) >= 0; });
    if (!l.length) return;
    var gata = l.filter(function (o) { return !SC.esteDeschisa(o); }).length;
    return confirma('Anulezi ' + (coduri.length === 1 ? 'cumulul ' + coduri[0] : 'cumulurile ' + coduri.join(', ')) + '?\n\nComenzile ' + l.map(function (o) { return o.nc; }).join(', ') +
      ' nu vor mai fi legate între ele.' + (gata ? '\n\n' + gata + (gata === 1 ? ' comandă este deja închisă' : ' comenzi sunt deja închise') + ': paleții rămân cum sunt acum (și cele cu 0).' : '')).then(function (ok) {
      if (!ok) return;
      return L.modifica(l.map(function (o) { return { n: o.n, fn: function (x) { delete x.cum; } }; }), 'Cumul anulat ' + coduri.join(', ') + ': ' + l.map(function (o) { return o.nc; }).join(', ')).then(function () {
        toast('Cumul anulat: ' + nCom(l.length) + ' dezlegate.', 'bun'); redeseneaza();
      });
    }).catch(arataEroare);
  }
  function arataCumul(o) {
    var l = membriCumul(o).sort(function (a, b) { return a.n - b.n; });
    modal({
      titlu: 'Cumul ' + o.cum, lat: true,
      html: '<div class="nota">' + esc(o.cl) + ' · ' + esc(o.de || '') + '</div>' + tabelCumul(l),
      butoane: (poate() ? [{ t: 'Anulează cumulul', fn: function () { anuleazaCumul([o.cum]); return null; } }] : []).concat([{ t: 'Închide', cls: 'pri', v: null }])
    });
  }
  /* ================= Transport: Nr AUTO + Nr transport scrise de mana (fara fisierul TMS) =================
     Aceeasi fereastra pentru o comanda (click pe Nr AUTO / Nr transport) si pentru cele bifate („Creeaza TRA”):
     pe masura ce se scrie, dedesubt apar camioanele care exista deja; un click pe unul il alege. Ce nu exista se creeaza. */
  function celMaiDesDin(l, camp) {
    var m = {}, ales = '', n = 0;
    l.forEach(function (o) { var v = o[camp]; if (v == null || v === '') return; m[v] = (m[v] || 0) + 1; if (m[v] > n) { n = m[v]; ales = v; } });
    return ales;
  }
  function transporturiExistente() {
    return toateCamioanele().map(function (x) {
      return { cheie: x.cheie, na: x.na, nt: x.nt, zi: x.data || '', so: celMaiDesDin(x.toate, 'so'), re: celMaiDesDin(x.toate, 're'),
        nr: x.toate.length - x.doarTransport.length, nrExtra: x.doarTransport.length, nrInc: x.incarcate.length, deInc: x.toate.length - x.incarcate.length, x: x };
    });
  }
  function transportPentru(l, dinBara) {
    var libere = l.filter(function (o) { return o.inc !== 'DA' && o.st !== ST.ANU; }), sarite = l.length - libere.length;
    if (!libere.length) {
      toast(l.length === 1 ? 'Comanda ' + l[0].nc + (l[0].st === ST.ANU ? ' este anulată' : ' este deja încărcată') + '; camionul ei nu mai poate fi schimbat.' : 'Comenzile bifate sunt deja încărcate sau anulate; camionul lor nu mai poate fi schimbat.', 'rau');
      return Promise.resolve();
    }
    var una = libere.length === 1 ? libere[0] : null, azi = SC.azi(), ales = '';
    var cam = transporturiExistente(), inSel = {}, camDupaNr = {};
    libere.forEach(function (o) { inSel[o.n] = 1; });
    cam.forEach(function (c) { c.x.toate.forEach(function (o) { if (!o.extra && o.n != null) camDupaNr[o.n] = c; }); });
    /* in lista: camioanele care mai au ceva de incarcat sau sunt de azi incolo; cele mai noi sus, „fara data” la sfarsit */
    var deAles = cam.filter(function (c) { return c.deInc > 0 || c.zi >= azi; }).sort(function (a, b) {
      return (a.zi === b.zi ? 0 : !a.zi ? 1 : !b.zi ? -1 : a.zi < b.zi ? 1 : -1) || String(a.nt).localeCompare(String(b.nt)) || String(a.na).localeCompare(String(b.na));
    });
    var acelasi = libere.every(function (o) { return SC.normNrAuto(o.na) === SC.normNrAuto(libere[0].na) && (o.nt || '') === (libere[0].nt || ''); });
    var naInit = acelasi ? String(libere[0].na || '') : '', ntInit = acelasi ? String(libere[0].nt || '') : '';
    var cuCamion = libere.filter(function (o) { return o.na; }).length;
    function gaseste(na, nt) {
      var nn = SC.normNrAuto(na), c;
      if (nt) {
        c = cam.filter(function (x) { return String(x.nt).toUpperCase() === nt; }).sort(function (a, b) { return b.nr - a.nr; });
        if (!c.length) return { nou: true };
        var p = c.filter(function (x) { return SC.normNrAuto(x.na) === nn; })[0];
        if (p || !na) return { ex: p || c[0] };
        /* acelasi numar de transport, alt numar auto: se poate doar daca tot transportul este intre comenzile alese (corectarea numarului auto) */
        var afara = c.some(function (x) { return x.x.toate.some(function (o) { return o.extra || !inSel[o.n]; }); });
        return { nou: true, vechi: c[0], blocat: afara };
      }
      if (!na) return { gol: true };
      c = deAles.filter(function (x) { return !x.nt && SC.normNrAuto(x.na) === nn; });
      if (!c.length) return { nou: true };
      return { ex: c.filter(function (x) { return x.cheie === ales; })[0] || c.filter(function (x) { return x.zi >= azi; }).sort(function (a, b) { return a.zi < b.zi ? -1 : 1; })[0] || c[0] };
    }
    function descrie(c) {
      return '<b>' + esc(c.na || '—') + '</b>' + (c.nt ? ' · <b>' + esc(c.nt) + '</b>' : ' · fără nr. transport') + ' · ' + (c.zi ? esc(SC.fmtDataLunga(c.zi)) : 'fără dată') + (c.so ? ' · șofer ' + esc(c.so) : '') + (c.re ? ' · remorcă ' + esc(c.re) : '') +
        ' · ' + nCom(c.nr) + (c.nrExtra ? ' + ' + c.nrExtra + ' doar din transport' : '') + (c.nrInc ? ' (' + c.nrInc + ' deja încărcate)' : '');
    }
    var html = '<div class="nota">' + (una ? esc(una.cl) + ' · comanda <b>' + esc(una.nc) + '</b>' + (una.de ? '<br>' + esc(una.de) : '') + '<br>' : '') +
        'Greutate <b>' + SC.fmtNum(SC.rotunjeste(suma(libere, 'g')), 'num') + ' kg</b> · paleți estimați <b>' + SC.fmtNum(SC.rotunjeste(suma(libere, 'pe')), 'num') + '</b>' +
        (!una && cuCamion ? '<br>' + cuCamion + (cuCamion === 1 ? ' comandă are' : ' comenzi au') + ' deja un camion; ' + (cuCamion === 1 ? 'va fi mutată' : 'vor fi mutate') + ' pe cel ales aici.' : '') +
        (sarite ? '<br>' + sarite + (sarite === 1 ? ' comandă bifată este deja încărcată sau anulată și rămâne neschimbată.' : ' comenzi bifate sunt deja încărcate sau anulate și rămân neschimbate.') : '') + '</div>' +
      '<div class="grila"><label class="camp"><span>Nr AUTO</span><input type="text" id="trNa" maxlength="20" autocomplete="off" style="text-transform:uppercase" value="' + esc(naInit) + '"></label>' +
      '<label class="camp"><span>Nr transport (TRA)</span><input type="text" id="trNt" maxlength="30" autocomplete="off" style="text-transform:uppercase" value="' + esc(ntInit) + '"></label></div>' +
      '<div class="mic" id="trListaTitlu" style="margin-top:8px"></div><div class="lista-mica tra-lista" id="trLista" role="listbox" aria-label="Camioane care există deja"></div>' +
      '<div class="nota" id="trStare" style="margin-top:8px" role="status"></div>' +
      '<div class="grila ascuns" id="trNou" style="margin-top:8px"><label class="camp"><span>Data încărcării</span><input type="date" id="trData" value="' + esc(celMaiDesDin(libere, 'dtr') ? String(celMaiDesDin(libere, 'dtr')).slice(0, 10) : azi) + '"></label>' +
      '<label class="camp"><span>Șofer (opțional)</span><input type="text" id="trSo" maxlength="60"></label><label class="camp"><span>Remorcă (opțional)</span><input type="text" id="trRe" maxlength="20" style="text-transform:uppercase"></label></div>' +
      '<div class="mic" style="margin-top:8px">Ambele câmpuri goale = ' + (una ? 'comanda rămâne' : 'comenzile rămân') + ' fără camion. Camioanele scrise aici apar la Încărcări la fel ca cele din fișierul de transport.</div>';
    function citeste(rad) {
      var na = rad.querySelector('#trNa').value.trim().toUpperCase(), nt = rad.querySelector('#trNt').value.trim().toUpperCase();
      return { na: na, nt: nt, g: gaseste(na, nt) };
    }
    function arata(rad) {
      var s = citeste(rad), nn = SC.normNrAuto(s.na), lista = rad.querySelector('#trLista'), st = rad.querySelector('#trStare'), g = s.g;
      var filtrate = deAles.filter(function (c) { return (!nn || SC.normNrAuto(c.na).indexOf(nn) >= 0) && (!s.nt || String(c.nt).toUpperCase().indexOf(s.nt) >= 0); });
      rad.querySelector('#trListaTitlu').textContent = deAles.length ? 'Camioane care există deja' + (nn || s.nt ? ' și se potrivesc cu ce ai scris' : '') + ' (' + filtrate.length + ')' + (filtrate.length ? ' — click pe unul ca să îl alegi:' : ':') : 'Încă nu există niciun camion de încărcat în aplicație.';
      lista.classList.toggle('ascuns', !deAles.length);
      lista.innerHTML = filtrate.slice(0, 80).map(function (c) {
        return '<button type="button" class="tra-rand' + (g.ex && g.ex.cheie === c.cheie ? ' ales' : '') + '" role="option" data-cheie="' + esc(c.cheie) + '"><span class="tra-na">' + esc(c.na || '—') + '</span><span class="tra-nt">' + esc(c.nt || '—') + '</span><span>' +
          (c.zi ? esc(SC.fmtDataLunga(c.zi)) : 'fără dată') + '</span><span>' + esc(c.so || '') + '</span><span class="tra-nr">' + nCom(c.nr) + (c.nrInc ? ' · ' + c.nrInc + ' înc.' : '') + '</span></button>';
      }).join('') + (filtrate.length > 80 ? '<div class="mic" style="padding:6px 8px">… încă ' + (filtrate.length - 80) + '. Scrie câteva caractere ca să scurtezi lista.</div>' : '') +
        (!filtrate.length ? '<div class="mic" style="padding:8px">Niciun camion existent nu se potrivește.</div>' : '');
      var cls = 'nota', txt, nou = false;
      if (g.gol) { cls = cuCamion ? 'nota atentie' : 'nota'; txt = cuCamion ? (una ? 'Comanda rămâne' : 'Comenzile rămân') + ' fără camion: se șterg Nr AUTO, Nr transport, data încărcării, șoferul și remorca.' : 'Scrie un Nr AUTO sau un Nr transport, ori alege un camion din listă.'; }
      else if (g.ex) { cls = 'nota bun'; txt = 'Camion existent: ' + descrie(g.ex) + '.<br>' + (una ? 'Comanda se adaugă' : 'Comenzile se adaugă') + ' pe el, cu data, șoferul și remorca lui.' + (g.ex.deInc ? '' : ' Camionul a fost deja confirmat ca încărcat; va apărea din nou la Încărcări.'); }
      else if (g.blocat) { cls = 'nota rau'; txt = 'Transportul <b>' + esc(s.nt) + '</b> există deja pe camionul <b>' + esc(g.vechi.na) + '</b> (' + nCom(g.vechi.nr) + '). Alege-l din listă sau scrie alt număr de transport.'; }
      else if (s.nt && !s.na) { cls = 'nota atentie'; txt = 'Transport nou <b>' + esc(s.nt) + '</b>: scrie și Nr AUTO.'; }
      else { nou = true; txt = (g.vechi ? 'Transportul <b>' + esc(s.nt) + '</b> trece de pe camionul <b>' + esc(g.vechi.na) + '</b> pe <b>' + esc(s.na) + '</b>.' : (s.nt ? 'Transport nou: <b>' + esc(s.na) + '</b> · <b>' + esc(s.nt) + '</b>.' : 'Camion nou, fără număr de transport: <b>' + esc(s.na) + '</b>.')) + ' Completează mai jos data încărcării.'; }
      if (!g.ex && !g.gol && !g.blocat && filtrate.length) txt += '<br><b>Atenție:</b> în listă ' + (filtrate.length === 1 ? 'este un camion care se potrivește' : 'sunt ' + filtrate.length + ' camioane care se potrivesc') + ' cu ce ai scris. Dacă e vorba de ' + (filtrate.length === 1 ? 'el' : 'unul dintre ele') + ', apasă pe el în listă.';
      st.className = cls; st.innerHTML = txt;
      rad.querySelector('#trNou').classList.toggle('ascuns', !nou);
    }
    return modal({
      titlu: una ? 'Camion — comanda ' + una.nc : 'Camion (TRA) pentru ' + nCom(libere.length), html: html, lat: true,
      laDeschidere: function (rad) {
        var vechiPus = false;
        function laScris() { ales = ''; arata(rad); var s = citeste(rad); if (s.g.vechi && !s.g.blocat && !vechiPus) { vechiPus = true; rad.querySelector('#trData').value = s.g.vechi.zi || ''; rad.querySelector('#trSo').value = s.g.vechi.so || ''; rad.querySelector('#trRe').value = s.g.vechi.re || ''; } }
        rad.querySelector('#trNa').addEventListener('input', laScris); rad.querySelector('#trNt').addEventListener('input', laScris);
        rad.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); rad.parentNode.querySelector('.jos .btn.pri').click(); } });
        rad.querySelector('#trLista').addEventListener('click', function (e) {
          var b = e.target.closest('.tra-rand'); if (!b) return;
          var c = deAles.filter(function (x) { return x.cheie === b.dataset.cheie; })[0]; if (!c) return;
          ales = c.cheie; rad.querySelector('#trNa').value = c.na || ''; rad.querySelector('#trNt').value = c.nt || ''; arata(rad);
        });
        arata(rad);
      },
      butoane: [{ t: 'Renunță', v: null }, {
        t: 'Salvează', cls: 'pri', fn: function (rad) {
          var s = citeste(rad), g = s.g, T = null;
          if (g.blocat) { toast('Transportul ' + s.nt + ' există deja pe camionul ' + g.vechi.na + '. Alege-l din listă sau scrie alt număr de transport.', 'rau'); return false; }
          if (g.ex) T = { na: g.ex.na, nt: g.ex.nt || '', dtr: g.ex.zi || '', so: g.ex.so || '', re: g.ex.re || '' };
          else if (!g.gol) {
            if (!s.na) { toast('Scrie și Nr AUTO pentru transportul ' + s.nt + '.', 'rau'); rad.querySelector('#trNa').focus(); return false; }
            T = { na: s.na, nt: s.nt, dtr: rad.querySelector('#trData').value || '', so: rad.querySelector('#trSo').value.trim(), re: rad.querySelector('#trRe').value.trim().toUpperCase() };
          }
          function laFel(o) {
            if (!T) return !o.na && !o.nt && !o.dtr && !o.so && !o.re;
            return SC.normNrAuto(o.na) === SC.normNrAuto(T.na) && (o.nt || '') === T.nt && String(o.dtr || '').slice(0, 10) === T.dtr && (o.so || '') === T.so && (o.re || '') === T.re;
          }
          var deSchimbat = libere.filter(function (o) { return !laFel(o); });
          if (!deSchimbat.length) { toast('Nimic de schimbat: ' + (una ? 'comanda este' : 'comenzile sunt') + ' deja ' + (T ? 'pe acest camion.' : 'fără camion.')); return null; }
          /* ce afla Incarcarile: camionul existent care primeste comenzi, camioanele de pe care pleaca, numarul auto corectat */
          var anunt = [], peVechi = {};
          function tiparit(c) { var info = L.infoCamion(c.x); return info && info.bt ? info.bt : ''; }
          if (g.vechi) anunt.push({ nt: T.nt, na: T.na, zi: T.dtr, tiparit: tiparit(g.vechi), linii: ['Nr AUTO: ' + (g.vechi.na || '—') + ' → ' + T.na] });
          else {
            var adaugate = deSchimbat.filter(function (o) { return g.ex && camDupaNr[o.n] !== g.ex; });
            if (adaugate.length) anunt.push({ nt: T.nt, na: T.na, zi: T.dtr, tiparit: tiparit(g.ex), linii: ['Comenzi adăugate de mână: ' + adaugate.map(function (o) { return o.nc; }).join(', ')] });
            deSchimbat.forEach(function (o) {
              var c = camDupaNr[o.n]; if (!c || (g.ex && c === g.ex)) return;
              (peVechi[c.cheie] = peVechi[c.cheie] || { c: c, l: [] }).l.push(o.nc);
            });
            Object.keys(peVechi).forEach(function (k) {
              var v = peVechi[k];
              anunt.push({ nt: v.c.nt, na: v.c.na, zi: v.c.zi, tiparit: tiparit(v.c), linii: ['Comenzi scoase de mână: ' + v.l.join(', ') + (T ? ' (mutate pe ' + T.na + (T.nt ? ' / ' + T.nt : '') + ')' : ' (rămân fără camion)')] });
            });
          }
          var nume = T ? T.na + (T.nt ? ' / ' + T.nt : '') : '';
          return L.modifica(deSchimbat.map(function (o) {
            return {
              n: o.n, fn: function (x) {
                if (x.inc === 'DA') { if (una) throw L.eroare('Comanda ' + x.nc + ' a fost încărcată între timp; camionul ei nu mai poate fi schimbat.'); return; }
                if (!T) { delete x.na; delete x.nt; delete x.dtr; delete x.so; delete x.re; delete x.mnt; }
                else {
                  x.na = T.na;
                  if (T.nt) { x.nt = T.nt; x.mnt = T.nt; } else { delete x.nt; delete x.mnt; }      /* mnt: fisierul de transport nu o scoate de pe acest transport */
                  if (T.dtr) x.dtr = T.dtr; else delete x.dtr;
                  if (T.so) x.so = T.so; else delete x.so;
                  if (T.re) x.re = T.re; else delete x.re;
                }
                delete x.xnt;
              }
            };
          }), T ? 'Camion scris de mână: ' + nume + ' — ' + nCom(deSchimbat.length) : 'Scoase de mână de pe camion — ' + nCom(deSchimbat.length), { cuText: true }).then(function () {
            return L.notificaTransport(anunt, 'modificare de mână').then(function () { return true; }, function (e) {
              toast('Modificarea a fost salvată, dar notificarea pentru Încărcări nu a putut fi salvată: ' + (e && e.message ? e.message : e), 'rau'); return false;
            });
          }).then(function (anuntat) {
            toast((T ? (g.ex ? 'Adăugat pe camionul ' : g.vechi ? 'Nr AUTO corectat: ' : 'Camion nou ') + nume + ': ' + nCom(deSchimbat.length) + '.' : nCom(deSchimbat.length) + (deSchimbat.length === 1 ? ' a rămas' : ' au rămas') + ' fără camion.') +
              (anuntat && anunt.length ? ' Încărcările au fost anunțate.' : ''), 'bun');
            if (dinBara) stare.sel = {};
            redeseneaza();
          });
        }
      }]
    });
  }
  /* Transport: data de livrare se schimba direct in celula, cu confirmare; Operatorul de date primeste o notificare care ramane salvata */
  var popCal = null;
  function inchideCal() {
    if (!popCal) return;
    popCal.remove(); popCal = null;
    document.removeEventListener('pointerdown', afaraCal, true);
    document.removeEventListener('keydown', tastaCal, true);
  }
  function afaraCal(e) { if (popCal && !popCal.contains(e.target)) inchideCal(); }
  function tastaCal(e) { if (e.key === 'Escape') { e.preventDefault(); inchideCal(); } }
  function editeazaDlInLinie(o, cel) {
    if (o.st === ST.ANU) { toast('Comanda ' + o.nc + ' este anulată; data de livrare nu mai poate fi schimbată.', 'rau'); return; }
    if (o.inc === 'DA') { toast('Comanda ' + o.nc + ' este deja încărcată; data de livrare nu mai poate fi schimbată.', 'rau'); return; }
    inchideCal(); inchideFiltru();
    var vechi = /^\d{4}-\d{2}-\d{2}/.test(String(o.dl || '')) ? String(o.dl).slice(0, 10) : '', azi = SC.azi(), n = o.n;
    var ales = '', lunaCal = (vechi || azi).slice(0, 7);
    var pc = document.createElement('div');
    pc.className = 'popfiltru popcal';
    pc.setAttribute('role', 'dialog'); pc.setAttribute('aria-label', 'Alege data de livrare pentru comanda ' + o.nc);
    function deseneaza(focusPe) {
      var an = +lunaCal.slice(0, 4), luna = +lunaCal.slice(5, 7);
      var prima = new Date(an, luna - 1, 1), nrZile = new Date(an, luna, 0).getDate(), decalaj = (prima.getDay() + 6) % 7;
      var h = '<div class="pf-titlu">Livrare — comanda ' + esc(o.nc) + '</div><div class="mic">' + esc(o.cl) + (o.de ? ' · ' + esc(o.de) : '') + '<br>Data de acum: <b>' + (vechi ? esc(SC.fmtDataLunga(vechi)) : 'necompletată') + '</b></div>' +
        '<div class="cal"><div class="cal-sus"><button type="button" class="btn mic" data-luna="-1" aria-label="Luna anterioară">‹</button><b>' + LUNI_CAL[luna - 1] + ' ' + an + '</b>' +
        '<button type="button" class="btn mic" data-luna="1" aria-label="Luna următoare">›</button></div><div class="cal-grila">' +
        ['L', 'Ma', 'Mi', 'J', 'V', 'S', 'D'].map(function (z) { return '<div class="cal-cap">' + z + '</div>'; }).join('');
      for (var g = 0; g < decalaj; g++) h += '<div></div>';
      for (var zi = 1; zi <= nrZile; zi++) {
        var d = lunaCal + '-' + SC.p2(zi);
        h += '<button type="button" class="zi are' + (d === ales ? ' activ' : '') + (d === azi ? ' azi' : '') + (d === vechi ? ' veche' : '') + '" data-d="' + d + '" aria-label="' + zi + ' ' + LUNI_CAL[luna - 1] + ' ' + an +
          (d === vechi ? ', data de acum' : '') + '"' + (d === ales ? ' aria-pressed="true"' : '') + '><span>' + zi + '</span></button>';
      }
      h += '</div></div><div class="pf-jos"><span class="mic" style="flex:1">' + (ales ? 'Data nouă: <b>' + esc(SC.fmtDataLunga(ales)) + '</b>' : 'Alege data nouă de livrare.') + '</span>' +
        '<button type="button" class="btn mic" data-a="renunta">Renunță</button><button type="button" class="btn mic pri" data-a="ok"' + (ales && ales !== vechi ? '' : ' disabled') + '>Ok</button></div>';
      pc.innerHTML = h;
      var f = focusPe === 'ok' ? pc.querySelector('[data-a=ok]:not(:disabled)') : (focusPe ? pc.querySelector('[data-luna="' + focusPe + '"]') : null);
      if (f) f.focus();
    }
    pc.addEventListener('click', function (e) {
      var bt = e.target.closest('button'); if (!bt) return;
      if (bt.dataset.luna) {
        var an = +lunaCal.slice(0, 4), luna = +lunaCal.slice(5, 7) + (+bt.dataset.luna);
        if (luna < 1) { luna = 12; an--; } else if (luna > 12) { luna = 1; an++; }
        lunaCal = an + '-' + SC.p2(luna); deseneaza(bt.dataset.luna);
      } else if (bt.dataset.d) {
        ales = bt.dataset.d; deseneaza('ok');
        if (ales === vechi) toast('Aceasta este data de livrare de acum. Alege altă zi.');
      } else if (bt.dataset.a === 'renunta') inchideCal();
      else if (bt.dataset.a === 'ok' && ales && ales !== vechi) {
        var v = ales; inchideCal();
        confirma('Schimbi data de livrare pentru comanda ' + o.nc + '?\n' + o.cl + (o.de ? ' · ' + o.de : '') + '\n\n' + (vechi ? SC.fmtDataLunga(vechi) : '(fără dată)') + '  →  ' + SC.fmtDataLunga(v) +
          '\n\nOperatorul de date va primi o notificare cu această schimbare.').then(function (ok) {
          if (!ok) return;
          return L.schimbaLivrare(n, v).then(function () { toast('Livrare ' + SC.fmtDataLunga(v) + ' salvată pentru comanda ' + o.nc + '. Operatorul de date a fost notificat.', 'bun'); redeseneaza(); });
        }).catch(arataEroare);
      }
    });
    document.body.appendChild(pc); popCal = pc; deseneaza();
    /* sub celula; daca nu incape, deasupra ei, fara sa iasa din ecran */
    var r = cel.getBoundingClientRect(), lat = pc.offsetWidth, inalt = pc.offsetHeight;
    var x = Math.max(8, Math.min(r.left, window.innerWidth - lat - 8)), y = r.bottom + 4;
    if (y + inalt > window.innerHeight - 8) y = Math.max(8, r.top - inalt - 4);
    pc.style.left = x + 'px'; pc.style.top = y + 'px';
    var prim = pc.querySelector('.zi.veche') || pc.querySelector('.zi.azi') || pc.querySelector('.zi'); if (prim) prim.focus();
    document.addEventListener('pointerdown', afaraCal, true);
    document.addEventListener('keydown', tastaCal, true);
  }
  /* ---- notificari ----
     tip 'dl'  = Transportul a schimbat data de livrare a unei comenzi -> pentru Operatorul de date;
     tip 'tra' = un transport care era deja in aplicatie a fost incarcat din nou cu modificari -> pentru Incarcari.
     Administratorul le vede pe toate. Raman salvate (un document pe luna); „Am vazut” noteaza cine si cand. */
  var notifInitial = true, notifVazute = {};
  function veziNotif() { return poate() || rol() === 'incarcari'; }
  function notifMea(x) { var r = rol(); return x.tip === 'tra' ? (r === 'incarcari' || r === 'admin') : (r === 'operator' || r === 'admin'); }
  function notifMele() { return SC.notif.filter(notifMea); }
  function notifCand(t) { var z = new Date(t); return SC.fmtDT(SC.ymd(z) + ' ' + SC.p2(z.getHours()) + ':' + SC.p2(z.getMinutes())); }
  function actualizeazaNotificari() {
    var b = $('btnNotif'), noi = notifMele().filter(function (x) { return !x.vz; });
    b.classList.toggle('ascuns', !veziNotif());
    b.classList.toggle('are', noi.length > 0);
    $('notifNr').textContent = noi.length || '';
    b.title = noi.length ? noi.length + (noi.length === 1 ? ' notificare nouă' : ' notificări noi') : 'Nicio notificare nouă';
    /* cele sosite cat aplicatia e deschisa se anunta si printr-un mesaj */
    if (!notifInitial && veziNotif()) noi.forEach(function (x) {
      if (notifVazute[x._k]) return;
      if (x.tip === 'tra') toast('Transport modificat (' + x.u + '): ' + [x.nt, x.na].filter(Boolean).join(' / ') + '. Vezi Notificări.');
      else toast('Transport (' + x.u + '): comanda ' + x.nc + ' — livrare ' + (x.v ? SC.fmtData(x.v) : '(fără dată)') + ' → ' + SC.fmtData(x.nou));
    });
    SC.notif.forEach(function (x) { notifVazute[x._k] = 1; });
    notifInitial = false;
    var lista = document.getElementById('notifLista'); if (lista) lista.innerHTML = htmlNotificari(lista.dataset.toate === '1');
  }
  function htmlNotificari(toate) {
    var l = notifMele().filter(function (x) { return toate || !x.vz; });
    if (!l.length) return '<div class="mic" style="padding:10px 0">' + (toate ? 'Nicio notificare în perioada păstrată.' : 'Nicio notificare nouă.') + '</div>';
    return '<div class="derulare-x"><table class="simplu notif-tabel"><tr><th>Când</th><th>Cine</th><th>Despre</th><th>Ce s-a schimbat</th><th>Stare</th><th></th></tr>' +
      l.map(function (x) {
        var despre, ce;
        if (x.tip === 'tra') {
          despre = 'Transport <button type="button" class="btn mic" data-tra="' + esc(x.nt || x.na || '') + '" title="Arată camionul în tabul Încărcări">' + esc(x.nt || '') + '</button><div class="mic">' + esc(x.na || '') + (x.zi ? ' · ' + esc(SC.fmtDataLunga(x.zi)) : '') + '</div>';
          ce = String(x.txt || '').split(' · ').map(function (s) { return '<div>' + esc(s) + '</div>'; }).join('') +
            (x.bt ? '<div class="tr-tip">⚠ Borderoul fusese deja tipărit (' + esc(SC.fmtDT(x.bt)) + '): trebuie tipărit din nou.</div>' : '');
        } else {
          despre = 'Comanda <button type="button" class="btn mic" data-nc="' + esc(x.nc || '') + '" title="Arată comanda în listă">' + esc(x.nc || '') + '</button><div class="mic">' + esc(x.cl || '') + (x.de ? ' · ' + esc(x.de) : '') + '</div>';
          ce = 'Livrare solicitată: ' + esc(x.v ? SC.fmtDataLunga(x.v) : '—') + ' → <b>' + esc(SC.fmtDataLunga(x.nou)) + '</b>';
        }
        return '<tr' + (x.vz ? '' : ' class="noua"') + '><td>' + esc(notifCand(x.t)) + '</td><td>' + esc(x.u) + '</td><td>' + despre + '</td><td>' + ce + '</td><td>' +
          (x.vz ? '<span class="mic">văzută de ' + esc(x.vz.u) + ', ' + esc(notifCand(x.vz.t)) + '</span>' : '<span class="eticheta asteapta">nouă</span>') +
          '</td><td>' + (x.vz ? '' : '<button type="button" class="btn mic" data-vz="' + esc(x._k) + '">Am văzut</button>') + '</td></tr>';
      }).join('') + '</table></div>';
  }
  $('btnNotif').onclick = function () {
    if (!veziNotif()) return;
    var noi = notifMele().filter(function (x) { return !x.vz; }).length, r = rol();
    modal({
      titlu: r === 'incarcari' ? 'Notificări — transporturi modificate' : r === 'operator' ? 'Notificări — date de livrare schimbate de Transport' : 'Notificări', lat: true,
      html: '<label class="bifa" style="margin-bottom:8px"><input type="checkbox" id="notifToate"> Arată și cele deja văzute</label><div id="notifLista" data-toate="0">' + htmlNotificari(false) + '</div>' +
        '<div class="mic" style="margin-top:8px">Notificările rămân salvate (datele de livrare: două luni; transporturile modificate: ' + L.NOTIF_TRA_ZILE + ' zile). „Am văzut” notează cine și când a luat la cunoștință, pentru toți colegii cu același rol.</div>',
      laDeschidere: function (rad) {
        var lista = rad.querySelector('#notifLista');
        rad.querySelector('#notifToate').onchange = function () { lista.dataset.toate = this.checked ? '1' : '0'; lista.innerHTML = htmlNotificari(this.checked); };
        lista.addEventListener('click', function (e) {
          var v = e.target.closest('[data-vz]'), c = e.target.closest('[data-nc]'), tr = e.target.closest('[data-tra]');
          if (v) { var x = SC.notif.filter(function (y) { return y._k === v.dataset.vz; })[0]; if (x) { v.disabled = true; L.vazutNotificari([x]).catch(arataEroare); } }
          else if (c) { rad.closest('.fundal').querySelector('.x').click(); $('fCauta').value = c.dataset.nc; stare.f.q = c.dataset.nc; arataTab('comenzi'); $('tabel').scrollTop = 0; redeseneaza(); }
          else if (tr) { rad.closest('.fundal').querySelector('.x').click(); $('incCauta').value = tr.dataset.tra; Object.keys(incDate).forEach(function (d) { delete incDate[d]; }); arataTab('incarcari'); }
        });
      },
      butoane: (noi ? [{ t: 'Am văzut toate (' + noi + ')', fn: function () { return L.vazutNotificari(notifMele().filter(function (x) { return !x.vz; })).then(function () { return false; }); } }] : []).concat([{ t: 'Închide', cls: 'pri', v: null }])
    });
  };
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
    /* Operatorul de date nu are in fereastra comenzii campurile camionului (se completeaza la incarcare / vin din TMS) */
    var ascunse = r === 'operator' ? CAMPURI_FARA_OPERATOR : {};
    CAMPURI_FORM.forEach(function (k) {
      if (!ascunse[k]) html += campHtml(k, o[k], editabil(k));
    });
    html += '</div>' + bifaSelfPick(o.sp === 'DA', poate()) + (r === 'operator' ? '<div class="mic">Statusul se schimbă din lista de comenzi, iar câmpurile de încărcare din tabul Încărcări. Fiecare modificare rămâne în jurnal, cu valoarea veche și cea nouă.</div>' :
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
          if (o.cum && ('cl' in schimbari || 'de' in schimbari) && membriCumul(o).length > 1) { toast('Comanda este în cumulul ' + o.cum + ': clientul și destinatarul trebuie să rămână aceleași. Anulează întâi cumulul.', 'rau'); return false; }
          if ((o.st === ST.TER || o.st === ST.SELF) && SC.esteNum(val.fpp) && SC.esteNum(val.pk) && !('fpp' in schimbari) && !('pk' in schimbari) && 'pr' in schimbari && val.pr !== val.fpp + val.pk) {
            toast('Paleții reali sunt FPP + Pick (' + val.fpp + ' + ' + val.pk + ' = ' + (val.fpp + val.pk) + '). Modifică FPP sau Pick.', 'rau'); return false;
          }
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
                if ('fpp' in schimbari || 'pk' in schimbari) L.sincPaleti(x);
              }
            }], o.nc + ': modificat ' + chei.map(function (k) { return SC.COL[k].t; }).join(', ')).then(function () {
              toast('Comanda ' + o.nc + ' a fost salvată.', 'bun'); redeseneaza();
              /* bifata Self-Pick dupa ce a plecat deja spre TMS: Transportul trebuie sa stie */
              if (schimbari.sp === 'DA' && (o.tx || o.nt)) alerta('Comanda ' + o.nc + ' este acum Self-Pick, dar ' + (o.nt ? 'are deja număr de transport (' + o.nt + ')' : 'a fost deja exportată pentru TMS') + '.\n\nAnunță Transportul, ca să o scoată din TMS.', 'Self-Pick');
            });
          });
        }
      });
    }
    return modal({ titlu: 'Comanda ' + o.nc + (o.cl ? ' — ' + o.cl : ''), html: html, lat: true, butoane: butoane, laDeschidere: leagaCodClient });
  }
  $('btnNoua').onclick = function () {
    var html = '<div class="grila">' + CAMPURI_NOI.map(function (k) { return campHtml(k, k === 'dc' ? SC.azi() : '', true); }).join('') + '</div>' + bifaSelfPick(false, true) +
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
              arataComenzi(nr);
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
      return confirma('Fișierul „' + fisier.name + '” a mai fost importat (' + deja.t + ', ' + deja.u + ').\n' +
        (eAdmin() ? 'Comenzile existente nu se importă a doua oară; în fereastra următoare poți alege care să fie rescrise cu datele din borderou. Continui?' : 'Comenzile existente vor fi oricum sărite. Continui?'));
    }).then(function (ok) {
      if (!ok) return null;
      return L.cautaComenzi(b.randuri.map(function (r) { return r.nc; }));
    }).then(function (exist) {
      if (!exist) return;
      var noi = [], dubluri = [], vazute = {}, dupaOras = 0, faraJudet = [], existente = [];
      b.randuri.forEach(function (r) {
        var k = SC.cheieComanda(r.nc);
        if ((exist[k] && exist[k].length) || vazute[k]) {
          dubluri.push(r.nc + (exist[k] && exist[k].length ? ' (Nr Crt ' + exist[k][0].n + ')' : ' (de două ori în borderou)'));
          /* Administratorul poate rescrie comenzile existente ale aceluiasi client cu datele din borderou */
          if (!vazute[k] && exist[k] && exist[k].length) {
            exist[k].filter(function (o) { return SC.normText(o.cl) === SC.normText(client); }).forEach(function (o) { existente.push({ o: o, r: r }); });
            vazute[k] = 1;
          }
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
      var rescriu = eAdmin() && existente.length > 0, bifate = {};
      if (dubluri.length && !rescriu) html += '<div>Comenzi sărite (existau deja): ' + dubluri.length + '</div>' + listaHtml(dubluri);
      if (rescriu) html += '<div id="brSec" style="margin:10px 0"></div>';
      function valB(k, v) { return v == null || v === '' ? '(gol)' : SC.fmtCelula({ x: v }, { k: 'x', typ: (SC.COL[k] || {}).typ }); }
      /* sectiunea „exista deja”: ce difera fata de borderou, cu bifa pe fiecare comanda */
      function deseneazaExistente(rad) {
        var cuObs = rad.querySelector('#brObs') ? rad.querySelector('#brObs').checked : false, difera = 0;
        existente.forEach(function (e) { var d = L.diferenteBorderou(e.o, e.r, cuObs); e.dif = d.dif; e.jd = d.jd; if (e.dif.length) difera++; else delete bifate[e.o.n]; });
        var cuDif = existente.filter(function (e) { return e.dif.length; }), nb = cuDif.filter(function (e) { return bifate[e.o.n]; }).length;
        var h2 = '<div><b>Comenzi care există deja: ' + existente.length + '</b> — ' + (difera ? difera + ' diferă de borderou' : 'niciuna nu diferă de borderou') +
          (existente.length - difera ? ', ' + (existente.length - difera) + ' identice' : '') + (dubluri.length > existente.length ? ', ' + (dubluri.length - existente.length) + ' sărite (alt client sau de două ori în borderou)' : '') + '.</div>' +
          '<div class="mic" style="margin:4px 0 8px">Doar Administratorul: bifează comenzile pe care vrei să le rescrii cu datele din borderou. Statusul, paleții reali, Nr AUTO și încărcarea rămân neschimbate; valorile vechi rămân în jurnal. O celulă goală din borderou nu șterge nimic. Dacă se schimbă greutatea unei comenzi Terminata cu greutate finală calculată automat, se recalculează și greutatea finală.</div>' +
          '<label class="bifa"><input type="checkbox" id="brObs"' + (cuObs ? ' checked' : '') + '> Compară și rescrie și Observațiile din borderou</label>';
        if (cuDif.length) {
          h2 += '<div class="lista-mica" style="max-height:300px;margin-top:8px"><table class="simplu"><tr><th style="width:34px"><input type="checkbox" id="brToate" aria-label="Bifează toate comenzile care diferă"' + (nb === cuDif.length ? ' checked' : '') + '></th><th>Comandă</th><th>Status</th><th>Ce se schimbă</th></tr>' +
            cuDif.map(function (e) {
              return '<tr><td><input type="checkbox" data-br="' + e.o.n + '" aria-label="Rescrie comanda ' + esc(e.o.nc) + '"' + (bifate[e.o.n] ? ' checked' : '') + '></td><td><b>' + esc(e.o.nc) + '</b><br><span class="mic">Nr Crt ' + e.o.n + '</span></td><td>' + esc(e.o.st || '') + (e.o.inc === 'DA' ? '<br><span class="mic">încărcată</span>' : '') + '</td><td>' +
                e.dif.map(function (d) { return '<div><span class="mic">' + esc(SC.COL[d.k].t) + ':</span> ' + esc(valB(d.k, d.vechi)) + ' → <b>' + esc(valB(d.k, d.nou)) + '</b></div>'; }).join('') + '</td></tr>';
            }).join('') + '</table></div><div class="mic" style="margin-top:6px" id="brNumar" role="status">' + (nb ? nCom(nb) + ' de rescris' : 'Nicio comandă bifată pentru rescriere.') + '</div>';
        }
        rad.querySelector('#brSec').innerHTML = h2;
      }
      if (b.ramase) html += '<div class="nota atentie">Atenție: după ultima comandă citită mai sunt ' + b.ramase + ' rânduri completate în borderou care nu au fost preluate (coloana A nu este un număr de comandă). Verifică fișierul.</div>';
      if (b.adreseCorectate) html += '<div class="mic">' + b.adreseCorectate + ' adrese transformate de Excel în dată au fost refăcute ca text (ex. „22 Decembrie 1989”).</div>';
      if (dupaOras) html += '<div class="mic">Județ completat după oraș (destinatar negăsit în Adrese): ' + dupaOras + ' — apare cu roșu în listă.</div>';
      if (faraJudet.length) {
        html += '<div class="nota atentie">Nu am găsit județul pentru ' + nCom(faraJudet.length) + '. Completează-l aici sau lasă gol:</div><div class="lista-mica"><table class="simplu">' +
          faraJudet.map(function (o, i) {
            return '<tr><td>' + esc(o.nc) + '</td><td>' + esc(o.de) + '<br><span class="mic">' + esc(o.ad) + ' · ' + esc(o.or) + '</span></td><td><input type="text" data-j="' + i + '" placeholder="Județ" style="width:120px"></td></tr>';
          }).join('') + '</table></div>';
      }
      if (!noi.length && !rescriu) return alerta('Borderou (' + b.tip + '): ' + fisier.name + '\n\nNicio comandă nouă — toate cele ' + dubluri.length + ' există deja.');
      return modal({
        titlu: 'Import borderou', html: html, lat: true,
        laDeschidere: function (rad) {
          if (!rescriu) return;
          deseneazaExistente(rad);
          rad.querySelector('#brSec').addEventListener('change', function (e) {
            var el = e.target;
            if (el.id === 'brToate') existente.forEach(function (x) { if (x.dif.length) { if (el.checked) bifate[x.o.n] = 1; else delete bifate[x.o.n]; } });
            else if (el.dataset.br) { if (el.checked) bifate[el.dataset.br] = 1; else delete bifate[el.dataset.br]; }
            deseneazaExistente(rad);
            var inapoi = el.id ? rad.querySelector('#' + el.id) : rad.querySelector('[data-br="' + el.dataset.br + '"]');
            if (inapoi) inapoi.focus();
          });
        },
        butoane: [{ t: 'Renunță', v: null }, {
          t: rescriu ? (noi.length ? 'Importă ' + nCom(noi.length) + ' și rescrie cele bifate' : 'Rescrie comenzile bifate') : 'Importă ' + nCom(noi.length), cls: 'pri', fn: function (rad) {
            Array.prototype.forEach.call(rad.querySelectorAll('[data-j]'), function (el) {
              var v = el.value.trim(); if (v) faraJudet[+el.dataset.j].ju = v;
            });
            var deRescris = rescriu ? existente.filter(function (e) { return e.dif.length && bifate[e.o.n]; }) : [];
            if (!noi.length && !deRescris.length) { toast('Nu ai bifat nicio comandă de rescris.', 'rau'); return false; }
            var intreb = deRescris.length ? confirma('Rescrii ' + nCom(deRescris.length) + ' cu datele din borderou?\n\nDestinatarul, adresa și celelalte valori afișate se înlocuiesc. Valorile vechi rămân doar în jurnalul de modificări.', { da: 'Rescrie', nu: 'Renunță' }) : Promise.resolve(true);
            return intreb.then(function (da) {
              if (!da) return false;
              var nrNoi = [];
              return (noi.length ? L.creeaza(noi, 'Import borderou ' + fisier.name + ': ' + noi.length + ' comenzi') : Promise.resolve([])).then(function (nr) {
                nrNoi = nr;
                if (!deRescris.length) return 0;
                return L.modificaPeLoturi(deRescris.map(function (e) {
                  return { n: e.o.n, fn: function (x) { L.aplicaBorderou(x, e.dif, e.jd); } };
                }), 'Rescriere din borderou ' + fisier.name + ': ' + nCom(deRescris.length));
              }).then(function () {
                return SC.store.tx(function (t) {
                  return t.get('meta', 'importuri').then(function (d) {
                    d = d || { l: [] };
                    var linie = { f: fisier.name, t: stampila(), u: SC.store.user.nume, k: noi.length };
                    if (deRescris.length) linie.r = deRescris.length;
                    d.l.push(linie);
                    if (d.l.length > 300) d.l = d.l.slice(-300);
                    t.set('meta', 'importuri', d);
                  });
                });
              }).then(function () {
                toast([nrNoi.length ? 'Importate ' + nCom(nrNoi.length) + ' (Nr Crt ' + nrNoi[0] + '–' + nrNoi[nrNoi.length - 1] + ')' : '', deRescris.length ? 'Rescrise ' + nCom(deRescris.length) : ''].filter(Boolean).join('. ') + '.', 'bun');
                arataComenzi(nrNoi.length ? nrNoi : deRescris.map(function (e) { return e.o.n; }));
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
            return L.creeaza(noi, 'Import Excel ' + fisier.name + ': ' + noi.length + ' comenzi').then(function (nr) {
              toast('Importate ' + noi.length + ' comenzi.', 'bun'); arataComenzi(nr);
            });
          }
        }]
      });
    }).catch(arataEroare);
  };

  /* ================= ÎNCĂRCĂRI ================= */
  var FARA_DATA = '(fără dată)';
  var incDate = {};          // datele bifate in filtrul de date (gol = toate)
  function poateExtra() { return poate() || poateIncarca(); }
  /* o linie doar din transport, in forma unei comenzi (pentru liste, incarcare si borderou) */
  /* linie doar din transport: amprentele sunt paletii din TMS, pana cand cineva le scrie de mana; retururile nu au */
  function amExtra(x) { return SC.esteNum(x.am) ? x.am : (x.retur ? undefined : x.pr); }
  function caComanda(x) {
    return { extra: true, retur: !!x.retur, _zi: x._zi, _k: x._k, n: '', cl: x.cl || '', nc: x.ref, de: x.de || '', or: x.or || '', ju: x.ju || '', na: x.na || '', nt: x.nt || '', dtr: x.dtr || '',
      so: x.so, re: x.re, pr: x.pr, am: amExtra(x), gf: x.gf, ca: x.ca, ob: x.ob, inc: x.inc, di: x.di, sc: x.sc, te: x.te, se: x.se, st: ST.TER };
  }
  function dataDin(o) { return o.dtr ? String(o.dtr).slice(0, 10) : ''; }
  /* toate camioanele: comenzile din registru cu Nr AUTO + liniile doar din transport */
  function toateCamioanele() {
    var g = {};
    /* cu numar de transport: un camion = un transport. Fara: acelasi numar auto se desparte pe zile,
       ca incarcarile vechi ale camionului sa nu se amestece cu ce e de incarcat acum. */
    function pune(o) {
      var na = SC.normNrAuto(o.na);
      var k = o.nt ? o.nt + '|' + na : '|' + na + '|' + (dataDin(o) || (o.inc === 'DA' ? String(o.di || '').slice(0, 10) : ''));
      (g[k] = g[k] || { cheie: k, na: o.na || '', nt: o.nt || '', toate: [] }).toate.push(o);
    }
    /* "0" in Nr AUTO vine din istoricul Excel si nu este un camion */
    SC.comenzi.forEach(function (o) { if (!o.na || o.ar || o.st === ST.ANU || !SC.normNrAuto(o.na).replace(/0/g, '')) return; pune(o); });
    SC.extra.forEach(function (x) { if (x.na || x.nt) pune(caComanda(x)); });
    return Object.keys(g).map(function (k) {
      var x = g[k], d = '';
      /* retururile (ridicari / preluari) raman la camion doar ca informatie: nu se incarca si nu se aduna nicaieri */
      x.retururi = x.toate.filter(function (o) { return o.retur; });
      x.toate = x.toate.filter(function (o) { return !o.retur; });
      x.deIncarcat = x.toate.filter(function (o) { return o.st === ST.TER && o.inc !== 'DA'; });
      /* o comanda deja confirmata ca incarcata nu mai este „in lucru” pentru incarcari, chiar daca statusul ei a ramas deschis */
      x.inLucru = x.toate.filter(function (o) { return !o.extra && SC.esteDeschisa(o) && o.inc !== 'DA'; });
      x.incarcate = x.toate.filter(function (o) { return o.inc === 'DA'; });
      x.doarTransport = x.toate.filter(function (o) { return o.extra; });
      var nrPeZi = {};
      x.toate.forEach(function (o) { var z = dataDin(o); if (z) nrPeZi[z] = (nrPeZi[z] || 0) + 1; });
      d = Object.keys(nrPeZi).sort(function (a, b) { return nrPeZi[b] - nrPeZi[a] || (a < b ? 1 : -1); })[0] || '';
      if (!d && !x.deIncarcat.length && !x.inLucru.length) x.incarcate.forEach(function (o) { var z = String(o.di || '').slice(0, 10); if (z > d) d = z; });
      x.data = d;
      return x;
    }).filter(function (x) { return x.toate.length; });   /* un camion doar cu retururi nu are nimic de incarcat */
  }
  var SP_ETICHETA = '<span class="spM">Self-Pick</span>';
  var DI_ETICHETA = '<span class="diM">de închis</span>';
  /* locul camionului la incarcare, pentru o comanda (aratat langa Nr AUTO); se recalculeaza doar cand se schimba datele */
  var ordCache = { rev: -1, peNr: {} };
  function ordineComanda(o) {
    if (ordCache.rev !== SC.rev) {
      var m = {};
      toateCamioanele().forEach(function (x) {
        var info = L.infoCamion(x);
        if (info && info.o > 0) x.toate.forEach(function (c) { if (!c.extra && c.n != null) m[c.n] = { o: info.o, data: x.data }; });
      });
      ordCache = { rev: SC.rev, peNr: m };
    }
    return ordCache.peNr[o.n] || null;
  }
  function ordineCamion(x) { var i = L.infoCamion(x); return i && i.o > 0 ? i.o : null; }
  function incFiltre() {
    return { q: SC.normNrAuto($('incCauta').value), siInc: $('incAzi').checked, areDate: Object.keys(incDate).length > 0 };
  }
  var camioaneAfisate = {}, extraAfisate = [];
  /* Transportul scrie locul direct in celula: Enter sau iesirea din celula salveaza */
  $('incLista').addEventListener('keydown', function (e) {
    if (!e.target.classList || !e.target.classList.contains('ordIn')) return;
    /* Enter salveaza si ramane pe acelasi camion (care se muta la locul lui); Esc renunta */
    if (e.key === 'Enter') { e.preventDefault(); e.target.dispatchEvent(new Event('change', { bubbles: true })); }
    else if (e.key === 'Escape') { e.target.value = e.target.defaultValue; e.target.blur(); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      /* sagetile trec la camionul de dedesubt / de deasupra (nu schimba numarul) */
      e.preventDefault();
      var toateIn = Array.prototype.slice.call($('incLista').querySelectorAll('.ordIn')), urm = toateIn[toateIn.indexOf(e.target) + (e.key === 'ArrowDown' ? 1 : -1)];
      if (urm) { urm.focus(); urm.select(); }
    }
  });
  $('incLista').addEventListener('focusout', function (e) {
    if (e.target.classList && e.target.classList.contains('ordIn') && incAmanat && e.target.value === e.target.defaultValue) setTimeout(deseneazaIncarcari, 0);
  });
  $('incLista').addEventListener('change', function (e) {
    var el = e.target;
    if (!el.classList || !el.classList.contains('ordIn') || !poateOrdona()) return;
    if (el.value === el.defaultValue) return;      /* deja salvat (Enter urmat de iesirea din celula) */
    var x = camioaneAfisate[el.dataset.ord], text = el.value.trim(), nr = text === '' ? null : Number(text);
    if (!x) return;
    if (nr != null && (!isFinite(nr) || nr < 1 || Math.round(nr) !== nr)) { toast('Locul la încărcare trebuie să fie un număr întreg, de la 1 în sus.', 'rau'); el.value = el.defaultValue; return; }
    var cheiZi = toateCamioanele().filter(function (c) { return (c.data || '') === (x.data || ''); }).map(L.cheieCamion);
    el.defaultValue = el.value;      /* nu mai este „nesalvat”: lista se poate reface cand vine raspunsul */
    /* salvarea porneste dupa ce tastatura a mutat deja focusul (Tab, sageti), ca refacerea listei sa nu-l piarda */
    setTimeout(function () {
      L.seteazaOrdine(x, nr, cheiZi).then(function (loc) {
        if (nr != null && loc !== nr) toast(x.na + ' a fost pus pe locul ' + loc + ': în ziua respectivă sunt doar ' + loc + (loc === 1 ? ' camion ordonat.' : ' camioane ordonate.'), 'bun');
        if (stare.tab === 'incarcari') deseneazaIncarcari();
      }, function (er) { arataEroare(er); if (stare.tab === 'incarcari') deseneazaIncarcari(); });
    }, 0);
  });
  var incAmanat = false;
  /* camioanele bifate pentru tiparirea mai multor borderouri deodata (cheia: data + camion) */
  var incSel = {};
  function incAfisate() { return Object.keys(camioaneAfisate).map(function (k) { return camioaneAfisate[k]; }).filter(Boolean); }
  function incBifate() { return incAfisate().filter(function (x) { return incSel[(x.data || '') + '|' + x.cheie]; }); }
  function incSelArata() {
    var n = incBifate().length, alte = Object.keys(incSel).length - n;
    $('incSelBara').classList.toggle('ascuns', !Object.keys(incSel).length);
    $('incSelText').innerHTML = 'Bifate: <b>' + n + (n === 1 ? ' camion' : ' camioane') + '</b>' + (alte > 0 ? ' <span class="mic">(+ ' + alte + ' care nu sunt în lista afișată acum și nu se tipăresc)</span>' : '');
    $('incSelPrint').disabled = !n;
    var tot = $('incSelTot'); if (tot) { var afis = incAfisate().length; tot.checked = afis > 0 && n === afis; tot.indeterminate = n > 0 && n < afis; }
  }
  $('incSelGol').onclick = function () { incSel = {}; deseneazaIncarcari(); };
  $('incSelPrint').onclick = function () { var l = incBifate(); if (l.length) tiparesteCamioane(l).then(function () { incSel = {}; deseneazaIncarcari(); }); };
  $('incLista').addEventListener('change', function (e) {
    var t = e.target;
    if (t.id === 'incSelTot') { incAfisate().forEach(function (x) { var k = (x.data || '') + '|' + x.cheie; if (t.checked) incSel[k] = 1; else delete incSel[k]; }); deseneazaIncarcari(); return; }
    if (t.dataset && t.dataset.bsel != null) { var x = camioaneAfisate[+t.dataset.bsel]; if (!x) return; var k = (x.data || '') + '|' + x.cheie; if (t.checked) incSel[k] = 1; else delete incSel[k]; incSelArata(); }
  });
  function deseneazaIncarcari() {
    /* cat timp Transportul scrie un loc nesalvat, lista nu se reface sub el; se reface imediat dupa */
    var activ = document.activeElement, focusPe = null;
    if (activ && activ.classList && activ.classList.contains('ordIn') && activ.value !== activ.defaultValue) { incAmanat = true; return; }
    /* refacerea listei nu trebuie sa piarda locul de la tastatura: acelasi camion, acelasi fel de element */
    if (activ && activ.closest && activ.closest('#incLista') && activ.closest('tr[data-cheie]')) {
      focusPe = { cheie: activ.closest('tr[data-cheie]').dataset.cheie, ce: activ.classList.contains('ordIn') ? '.ordIn' : (activ.hasAttribute('data-inc') ? '[data-inc]' : '[data-print]') };
    }
    incAmanat = false;
    var f = incFiltre(), edit = poateIncarca(), ordonez = poateOrdona(), toate = toateCamioanele();
    /* camioanele de interes: cu ceva de incarcat / in lucru, plus cele incarcate daca s-a cerut */
    var deInteres = toate.filter(function (x) { return x.deIncarcat.length || x.inLucru.length || (f.siInc && x.incarcate.length); });
    /* filtrul de date: un buton pe fiecare data, se pot bifa mai multe */
    var peData = {};
    deInteres.forEach(function (x) { var d = x.data || FARA_DATA; peData[d] = (peData[d] || 0) + 1; });
    Object.keys(incDate).forEach(function (d) { if (!peData[d]) peData[d] = 0; });
    var date = Object.keys(peData).sort(function (a, b) { return a === FARA_DATA ? 1 : (b === FARA_DATA ? -1 : (a < b ? 1 : -1)); });
    deseneazaCalendar(peData, deInteres.length, f.areDate);

    /* cautarea dupa Nr AUTO / Nr transport tine cont de zilele alese: cu una sau mai multe zile bifate apar doar camioanele din ele */
    var gasite = f.q ? toate.filter(function (x) { return SC.normNrAuto(x.na).indexOf(f.q) >= 0 || SC.normNrAuto(x.nt).indexOf(f.q) >= 0; }) : deInteres;
    var l = gasite.filter(function (x) { return !f.areDate || incDate[x.data || FARA_DATA]; })
      .sort(function (a, b) {
        if ((a.data || '9') !== (b.data || '9')) return (a.data || '9') < (b.data || '9') ? -1 : 1;
        /* in aceeasi zi: intai camioanele cu loc stabilit de Transport, in ordinea lor */
        return (ordineCamion(a) || 1e6) - (ordineCamion(b) || 1e6) || a.na.localeCompare(b.na);
      });
    camioaneAfisate = {};
    var zileAlese = Object.keys(incDate).sort().map(function (d) { return d === FARA_DATA ? 'fără dată' : SC.fmtDataLunga(d); });
    var inAlteZile = f.q && f.areDate ? gasite.length - l.length : 0;
    $('incTitlu').textContent = (f.q ? 'căutare „' + $('incCauta').value.trim() + '” · ' : '') + (zileAlese.length ? zileAlese.join(', ') : 'toate datele') + ' · ' + l.length + (l.length === 1 ? ' camion' : ' camioane') +
      (inAlteZile ? ' (încă ' + inAlteZile + ' în alte zile)' : '');
    var h;
    if (!l.length) {
      h = '<div class="mic" style="padding:10px">' + (inAlteZile ? 'Niciun camion găsit în ' + (zileAlese.length === 1 ? 'ziua aleasă' : 'zilele alese') + '; căutarea se potrivește cu ' + inAlteZile + (inAlteZile === 1 ? ' camion' : ' camioane') + ' din alte zile — apasă „Toate datele” ca să le vezi.</div>' : 'Niciun camion pentru filtrele alese. Data încărcării vine din fișierul de transport (TMS): dacă ziua căutată lipsește, importă fișierul la zi.</div>');
    } else {
      h = '<table class="simplu"><tr><th class="incB"><input type="checkbox" id="incSelTot" title="Bifează / debifează toate camioanele afișate" aria-label="Bifează toate camioanele afișate"></th><th title="Ordinea în care se încarcă mașinile, stabilită de Transport">Ordine</th><th>Data</th><th>Nr AUTO</th><th>Nr transport</th><th>De încărcat</th><th>În lucru</th><th>Doar transport</th><th>Început încărcare</th><th>Încărcat</th><th class="nr">Paleți reali</th><th class="nr">Amprente</th><th class="nr">Greutate finală</th><th></th></tr>';
      l.slice(0, 300).forEach(function (x, i) {
        camioaneAfisate[i] = x;
        var baza = x.deIncarcat.length ? x.deIncarcat : x.incarcate;
        var info = L.infoCamion(x), sfarsit = '';
        x.incarcate.forEach(function (o) { if (o.di && String(o.di) > sfarsit) sfarsit = String(o.di); });
        var durata = info && info.bt && sfarsit.length > 10 && sfarsit >= info.bt ? Math.round((SC.msDin(sfarsit.slice(0, 10), sfarsit.slice(11, 16)) - SC.msDin(info.bt.slice(0, 10), info.bt.slice(11, 16))) / 60000) : null;
        function oraScurta(dt) { return dt ? (dt.slice(0, 10) === SC.azi() ? dt.slice(11, 16) : SC.fmtDT(dt)) : ''; }
        var loc = ordineCamion(x);
        var chSel = (x.data || '') + '|' + x.cheie;
        h += '<tr data-cheie="' + esc(chSel) + '"><td class="incB"><input type="checkbox" data-bsel="' + i + '"' + (incSel[chSel] ? ' checked' : '') + ' aria-label="Bifează camionul ' + esc(x.na) + ' pentru tipărirea borderoului"></td><td class="ordC">' + (ordonez ?
            '<input type="number" class="ordIn" min="1" step="1" inputmode="numeric" data-ord="' + i + '" value="' + (loc || '') + '" aria-label="Locul la încărcare pentru ' + esc(x.na) + '">' :
            (loc ? '<span class="ordB">' + loc + '</span>' : '<span class="mic">—</span>')) + '</td>' +
          '<td>' + esc(x.data ? SC.fmtDataLunga(x.data) : '—') + '</td><td><b>' + esc(x.na) + '</b></td><td>' + esc(x.nt) + '</td><td>' +
          (x.deIncarcat.length ? '<span class="eticheta asteapta">' + nCom(x.deIncarcat.length) + '</span>' : (x.incarcate.length ? '<span class="eticheta ok">încărcat (' + x.incarcate.length + ')</span>' : '—')) +
          '</td><td>' + (x.inLucru.length || '') + '</td><td>' + (x.doarTransport.length || '') + (x.retururi.length ? ' <span class="mic" title="Ridicări / preluări: nu se încarcă și nu se adună">+' + x.retururi.length + ' retur</span>' : '') + '</td><td' + (info && info.bt ? ' title="Borderou tipărit de ' + esc(info.bu || '') + (info.bn > 1 ? '; retipărit de ' + (info.bn - 1) + ' ori, ultima dată ' + esc(SC.fmtDT(info.bl)) : '') + '"' : '') + '>' +
          (info && info.bt ? esc(oraScurta(info.bt)) + (info.bn > 1 ? ' <span class="mic">×' + info.bn + '</span>' : '') : '') + '</td><td>' +
          (sfarsit ? esc(oraScurta(sfarsit)) + (durata != null ? ' <span class="mic">(' + durata + ' min)</span>' : '') : '') + '</td><td class="nr">' + SC.fmtNum(suma(baza, 'pr'), 'int') + '</td><td class="nr">' + SC.fmtNum(suma(baza, 'am'), 'int') +
          '</td><td class="nr">' + SC.fmtNum(suma(baza, 'gf'), 'num') + '</td><td style="white-space:nowrap">' +
          (edit && (x.deIncarcat.length || x.inLucru.length) ? '<button class="btn mic' + (x.deIncarcat.length ? ' pri' : '') + '" data-inc="' + i + '"' +
            (x.deIncarcat.length ? '' : ' title="Comenzile camionului nu sunt încă Terminata: pot fi încărcate cu paleții și amprentele numărate"') + '>Încarcă</button> ' : '') +
          '<button class="btn mic" data-print="' + i + '">Borderou</button>' +
          (rol() === 'admin' && x.incarcate.length ? ' <button class="btn mic" data-dezinc="' + i + '" title="Doar Administratorul: șterge confirmarea de încărcare de pe comenzile acestui camion">Anulează încărcarea</button>' : '') + '</td></tr>';
      });
      h += '</table>' + (l.length > 300 ? '<div class="mic" style="padding:8px">Afișate primele 300 din ' + l.length + ' camioane — restrânge cu filtrul de date sau cu căutarea.</div>' : '');
    }
    $('incLista').innerHTML = h;
    incSelArata();
    if (focusPe) {
      var randF = Array.prototype.filter.call($('incLista').querySelectorAll('tr[data-cheie]'), function (tr) { return tr.dataset.cheie === focusPe.cheie; })[0];
      var inapoi = randF && (randF.querySelector(focusPe.ce) || randF.querySelector('.ordIn, button'));
      if (inapoi) { inapoi.focus(); if (inapoi.select) inapoi.select(); }
    }
    $('incNrCam').textContent = l.length;

    /* rubrica separata: liniile din TMS care nu exista in registrul de comenzi */
    var ex = SC.extra.filter(function (x) {
      if (f.q) return (SC.normNrAuto(x.na).indexOf(f.q) >= 0 || SC.normNrAuto(x.nt).indexOf(f.q) >= 0 || SC.normNrAuto(x.ref).indexOf(f.q) >= 0) && (!f.areDate || incDate[x.dtr || FARA_DATA]);
      if (!f.siInc && x.inc === 'DA') return false;
      return !f.areDate || incDate[x.dtr || FARA_DATA];
    }).sort(function (a, b) { return (a.dtr || '9') < (b.dtr || '9') ? -1 : ((a.dtr || '9') > (b.dtr || '9') ? 1 : String(a.na).localeCompare(String(b.na))); });
    extraAfisate = ex.slice(0, 400);
    $('incNrExtra').textContent = ex.length;
    $('incExtraNumar').textContent = '· ' + ex.length + (ex.length === 1 ? ' linie' : ' linii') + (ex.length > 400 ? ' (afișate primele 400)' : '');
    $('incExtra').innerHTML = !ex.length ? '<div class="mic" style="padding:10px">Nicio linie doar din transport pentru filtrele alese.</div>' :
      '<table class="simplu"><tr><th>Data</th><th>Nr AUTO</th><th>Nr transport</th><th>Client</th><th>Referință</th><th>Destinatar</th><th>Localitate</th><th class="nr">Paleți</th><th class="nr">Amprente</th><th class="nr">Greutate</th><th>Încărcată</th></tr>' +
      extraAfisate.map(function (x, i) {
        return '<tr' + (poateExtra() ? ' class="clic"' : '') + ' data-x="' + i + '"><td>' + esc(x.dtr ? SC.fmtDataLunga(x.dtr) : '—') + '</td><td><b>' + esc(x.na || '') + '</b></td><td>' + esc(x.nt || '') + '</td><td>' + esc(x.cl || '') +
          '</td><td>' + esc(x.ref) + '</td><td>' + esc(x.de || '') + '</td><td>' + esc(x.or || '') + '</td>' +
          (x.retur ? '<td class="nr mic" colspan="3" title="În TMS: ' + esc(SC.fmtNum(x.pr, 'int')) + ' paleți, ' + esc(SC.fmtNum(x.gf, 'num')) + ' kg">nu se ia în calcul</td><td><span class="eticheta gri">Retur</span></td></tr>' : '') +
          (x.retur ? '' : '<td class="nr"' + (x.prm ? ' title="Corectat manual (în TMS: ' + esc(SC.fmtNum(x.un, 'int')) + ')"' : '') + '>' + SC.fmtNum(x.pr, 'int') + (x.prm ? ' ✎' : '') + '</td><td class="nr">' + SC.fmtNum(amExtra(x), 'int') + '</td><td class="nr">' + SC.fmtNum(x.gf, 'num') +
          '</td><td>' + (x.inc === 'DA' ? '<span class="eticheta ok">DA ' + esc(SC.fmtDT(x.di)) + '</span>' : '') + '</td></tr>');
      }).join('') + '</table>';
  }
  function suma(l, k) { return l.reduce(function (s, o) { return s + (SC.esteNum(o[k]) ? o[k] : 0); }, 0); }
  /* in dreapta se vede o singura lista odata, pe toata inaltimea: camioanele sau liniile doar din transport */
  $('incVedere').addEventListener('click', function (e) {
    var b = e.target.closest('.cip'); if (!b) return;
    Array.prototype.forEach.call(this.querySelectorAll('.cip'), function (x) { x.classList.toggle('activ', x === b); });
    $('cardCam').classList.toggle('ascuns', b.dataset.v !== 'cam');
    $('cardExtra').classList.toggle('ascuns', b.dataset.v !== 'extra');
  });
  $('incCauta').addEventListener('input', deseneazaIncarcari);
  $('incAzi').onchange = deseneazaIncarcari;
  /* ---- filtrul de date ca un calendar lunar: fiecare zi arata cate camioane are; se pot bifa mai multe zile ---- */
  var LUNI_CAL = ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'];
  var incLuna = null;        // luna afisata, "YYYY-MM"
  function deseneazaCalendar(peData, total, areDate) {
    var azi = SC.azi();
    if (!incLuna) {
      /* la prima afisare: luna curenta daca are camioane, altfel luna celei mai recente zile cu camioane */
      var zile = Object.keys(peData).filter(function (d) { return d !== FARA_DATA; }).sort();
      incLuna = (peData[azi] || !zile.length) ? azi.slice(0, 7) : zile[zile.length - 1].slice(0, 7);
    }
    var an = +incLuna.slice(0, 4), luna = +incLuna.slice(5, 7);
    var prima = new Date(an, luna - 1, 1), nrZile = new Date(an, luna, 0).getDate(), decalaj = (prima.getDay() + 6) % 7;   // luni = prima coloana
    var h = '<div class="cal"><div class="cal-sus"><button type="button" class="btn mic" data-luna="-1" aria-label="Luna anterioară">‹</button>' +
      '<b>' + LUNI_CAL[luna - 1] + ' ' + an + '</b><button type="button" class="btn mic" data-luna="1" aria-label="Luna următoare">›</button></div><div class="cal-grila">' +
      ['L', 'Ma', 'Mi', 'J', 'V', 'S', 'D'].map(function (z) { return '<div class="cal-cap">' + z + '</div>'; }).join('');
    for (var g = 0; g < decalaj; g++) h += '<div></div>';
    for (var zi = 1; zi <= nrZile; zi++) {
      var d = incLuna + '-' + SC.p2(zi), n = peData[d] || 0;
      h += '<button type="button" class="zi' + (n ? ' are' : '') + (incDate[d] ? ' activ' : '') + (d === azi ? ' azi' : '') + '" data-d="' + d + '"' + (n || incDate[d] ? '' : ' disabled') +
        ' aria-label="' + zi + ' ' + LUNI_CAL[luna - 1] + (n ? ', ' + n + ' camioane' : ', fără camioane') + '"' + (incDate[d] ? ' aria-pressed="true"' : '') + '><span>' + zi + '</span>' + (n ? '<i>' + n + '</i>' : '') + '</button>';
    }
    var alese = Object.keys(incDate).filter(function (x) { return x !== FARA_DATA; }).sort();
    h += '</div></div><div class="cal-lateral"><button type="button" class="cip' + (areDate ? '' : ' activ') + '" data-d="">Toate datele<b>' + total + '</b></button>' +
      '<button type="button" class="cip" data-azi="1">Azi<b>' + (peData[azi] || 0) + '</b></button>' +
      (peData[FARA_DATA] ? '<button type="button" class="cip' + (incDate[FARA_DATA] ? ' activ' : '') + '" data-d="' + FARA_DATA + '">Fără dată<b>' + peData[FARA_DATA] + '</b></button>' : '') +
      (alese.length ? '' : '<div class="mic">Apasă pe o zi; poți alege mai multe. Cifra de sub zi = câte camioane are.</div>') + '</div>';
    $('incDate').innerHTML = h;
  }
  $('incDate').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.luna) {
      var an = +incLuna.slice(0, 4), luna = +incLuna.slice(5, 7) + (+b.dataset.luna);
      if (luna < 1) { luna = 12; an--; } else if (luna > 12) { luna = 1; an++; }
      incLuna = an + '-' + SC.p2(luna);
    } else if (b.dataset.azi) {
      incDate = {}; incDate[SC.azi()] = 1; incLuna = SC.azi().slice(0, 7);
    } else {
      var d = b.dataset.d;
      if (!d) incDate = {}; else if (incDate[d]) delete incDate[d]; else incDate[d] = 1;
    }
    deseneazaIncarcari();
  });
  $('incLista').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.inc != null) incarcaCamion(camioaneAfisate[+b.dataset.inc]);
    else if (b.dataset.print != null) tiparesteCamion(camioaneAfisate[+b.dataset.print]);
    else if (b.dataset.dezinc != null) anuleazaIncarcarea(camioaneAfisate[+b.dataset.dezinc]);
  });
  $('incExtra').addEventListener('click', function (e) {
    var r = e.target.closest('tr.clic'); if (r) editeazaExtra(extraAfisate[+r.dataset.x]);
  });
  /* paletii / amprentele / greutatea pentru o linie doar din transport (nu au comanda in registru, deci se completeaza aici) */
  function editeazaExtra(x) {
    function camp(k, t) { var v = x[k]; return '<label class="camp"><span>' + t + '</span><input type="text" inputmode="decimal" data-e="' + k + '" value="' + esc(SC.esteNum(v) ? String(v).replace('.', ',') : (v || '')) + '"></label>'; }
    modal({
      titlu: 'Linie doar din transport — ' + x.ref, lat: true,
      html: '<div class="nota">' + esc(x.cl || '') + ' · ' + esc(x.de || '') + '<br>Nr AUTO <b>' + esc(x.na || '—') + '</b>' + (x.nt ? ' · transport <b>' + esc(x.nt) + '</b>' : '') + (x.dtr ? ' · ' + esc(SC.fmtDataLunga(x.dtr)) : '') +
        ((x.un != null || x.ma != null) ? '<br>În TMS: ' + (x.un != null ? '<b>' + SC.fmtNum(x.un, 'int') + '</b> unități' : '') + (x.ma != null ? ' · <b>' + SC.fmtNum(x.ma, 'num') + '</b> kg' : '') : '') +
        '<br><span class="mic">Linia vine din fișierul TMS și nu există în registrul de comenzi. Apare în borderoul camionului. Paleții și greutatea sunt preluate din TMS; dacă le corectezi aici, importurile următoare păstrează corecția.</span></div>' +
        '<div class="grila">' + camp('pr', 'Paleți reali') + camp('am', 'Amprente') + camp('gf', 'Greutate finală (kg)') + camp('ca', 'Cartoane') +
        '<label class="camp lat2"><span>Observații</span><input type="text" data-e="ob" value="' + esc(x.ob || '') + '"></label></div>',
      butoane: [{ t: 'Închide', v: null }, {
        t: 'Salvează', cls: 'pri', fn: function (rad) {
          var val = {}, rau = null;
          Array.prototype.forEach.call(rad.querySelectorAll('[data-e]'), function (el) {
            var k = el.dataset.e, v = el.value.trim();
            if (k !== 'ob' && v !== '') { var n = SC.parseNum(v); if (n == null || n < 0) rau = '„' + v + '” nu este un număr valid.'; else v = n; }
            val[k] = v;
          });
          if (rau) { toast(rau, 'rau'); return false; }
          return L.modificaExtra([{
            zi: x._zi, k: x._k, fn: function (l) {
              Object.keys(val).forEach(function (k) {
                var inainte = l[k] == null ? '' : l[k];
                if (String(inainte) === String(val[k])) return;
                if (val[k] === '') delete l[k]; else l[k] = val[k];
                if (k === 'pr') l.prm = 1;          /* corectat de mana: urmatorul import TMS nu il mai suprascrie */
                if (k === 'gf') l.gfm = 1;
              });
            }
          }])
            .then(function () { toast('Linie salvată.', 'bun'); });
        }
      }]
    });
  }
  /* Confirmarea incarcarii unui camion.
     - comenzile Terminata: ca pana acum (paletii reali sunt cei de la inchidere, amprentele se pot corecta);
     - comenzile inca neterminate (Initiata / In lucru) pleaca si ele cu camionul: nu se pot sari. La „Confirma incarcarea”
       aplicatia duce la prima comanda neterminata fara paleti sau amprente si nu merge mai departe pana nu sunt scrise.
       Comanda devine Incarcata = DA, statusul ramane, iar cifrele se pastreaza separat (ipr / iam) si vin ca sugestie
       cand Operatorul de date inchide comanda. */
  function incarcaCamion(x) {
    var l = x.deIncarcat, d = x.inLucru;
    /* cumul: comenzile neterminate ale aceluiasi cumul de pe acest camion se numara o singura data, pe una dintre ele */
    var nrCum = {}; d.forEach(function (o) { if (o.cum) nrCum[o.cum] = (nrCum[o.cum] || 0) + 1; });
    function inCumul(o) { return !!(o.cum && nrCum[o.cum] > 1); }
    var areCumul = d.some(inCumul);
    function textNotaNet(n) {
      return (n === 1 ? 'O comandă a acestui camion nu este încă Terminata.' : n + ' comenzi ale acestui camion nu sunt încă Terminata.') +
        ' Încărcarea nu poate fi confirmată până nu sunt scrise, pentru fiecare, <b>paleții și amprentele numărate</b>. Închiderea comenzii rămâne la Operatorul de date, care primește aceste cifre ca sugestie.' +
        ' Dacă o comandă chiar nu pleacă cu acest camion, apasă „Nu pleacă” pe rândul ei.' +
        (areCumul ? '<br><b>Comenzi cumulate:</b> paleții și amprentele se scriu o singură dată, pe una dintre comenzile cumulului; celelalte rămân goale și pleacă cu 0.' : '');
    }
    function btnNuPleaca(fel, idx, o) {
      return '<button type="button" class="btn mic" data-np="' + fel + idx + '" title="Comanda nu pleacă cu acest camion: se scoate de pe el și rămâne fără Nr AUTO" aria-label="Comanda ' + esc(o.nc) + ' nu pleacă cu acest camion">Nu pleacă</button>';
    }
    var html = '<div class="nota">Camion <b>' + esc(x.na) + '</b>' + (x.nt ? ' · transport <b>' + esc(x.nt) + '</b>' : '') + (x.data ? ' · ' + esc(SC.fmtDataLunga(x.data)) : '') + '</div>' +
      '<div class="lista-mica inc-lista"><table class="simplu"><tr><th></th><th>Comandă</th><th>Destinatar</th><th class="nr">Paleți</th><th class="nr">Amprente</th><th></th></tr>' +
      l.map(function (o, i) {
        return '<tr data-ri="' + i + '"><td><input type="checkbox" data-i="' + i + '" checked aria-label="Încarcă ' + esc(o.nc) + '"></td><td>' + esc(o.cl) + ' ' + esc(o.nc) +
          (o.extra ? ' <span class="eticheta asteapta">doar transport</span>' : '') + '</td><td>' + esc(o.de || '') + '</td><td class="nr">' +
          SC.fmtNum(o.pr, 'int') + '</td><td class="nr"><input type="text" inputmode="numeric" data-am="' + i + '" value="' + (SC.esteNum(o.am) ? o.am : '') + '" style="width:64px;text-align:right" aria-label="Amprente ' + esc(o.nc) + '"></td><td>' +
          (o.extra ? '' : btnNuPleaca('i', i, o)) + '</td></tr>';
      }).join('') +
      d.map(function (o, j) {
        var est = SC.esteNum(o.pe) ? 'est. ' + SC.fmtNum(o.pe, 'num') : '';
        return '<tr class="inc-net" data-rj="' + j + '"><td><input type="checkbox" data-j="' + j + '" checked disabled title="Comanda nu este închisă: pleacă cu camionul doar cu paleții și amprentele numărate" aria-label="Comanda ' + esc(o.nc) + ', neterminată, se încarcă obligatoriu"></td><td>' + esc(o.cl) + ' ' + esc(o.nc) +
          ' <span class="eticheta lucru">neterminată · ' + esc(o.st) + '</span>' + (inCumul(o) ? ' <span class="eticheta gri" title="Comenzi cumulate: se numără o singură dată, pe una dintre ele">cumul ' + esc(o.cum) + '</span>' : '') + '</td><td>' + esc(o.de || '') + '</td>' +
          '<td class="nr"><input type="text" inputmode="numeric" data-pj="' + j + '" placeholder="' + esc(inCumul(o) ? 'cumul' : est) + '" style="width:74px;text-align:right" aria-label="Paleți numărați ' + esc(o.nc) + '"></td>' +
          '<td class="nr"><input type="text" inputmode="numeric" data-aj="' + j + '" style="width:64px;text-align:right" aria-label="Amprente ' + esc(o.nc) + '"></td><td>' + btnNuPleaca('j', j, o) + '</td></tr>';
      }).join('') + '</table></div>' +
      (l.length ? '<div class="mic">Amprentele pot fi corectate aici, pe fiecare linie, înainte de confirmare.</div>' : '') +
      (d.length ? '<div class="nota atentie" id="iNotaNet">' + textNotaNet(d.length) + '</div>' : '') +
      '<div class="grila"><label class="camp"><span>Stare camion</span><select id="iStare"><option>OK</option><option>NOK</option></select></label>' +
      '<label class="camp"><span>Temperatură</span><input type="text" id="iTemp" inputmode="decimal"></label>' +
      '<label class="camp"><span>Semnătură (nume)</span><input type="text" id="iSemn" value="' + esc(SC.store.user.nume) + '"></label></div>' +
      (l.length ? '<div class="mic">Liniile Terminata debifate rămân neîncărcate și pot pleca cu alt camion.</div>' : '');
    /* duce la campul care lipseste: randul este marcat, adus in vedere, iar cursorul pus in camp */
    function arataLipsa(rad, j, camp, mesaj) {
      var rand = rad.querySelector('[data-rj="' + j + '"]'), inp = rad.querySelector('[data-' + camp + '="' + j + '"]');
      Array.prototype.forEach.call(rad.querySelectorAll('.inc-lipsa'), function (r) { r.classList.remove('inc-lipsa'); });
      rand.classList.add('inc-lipsa');
      if (rand.scrollIntoView) rand.scrollIntoView({ block: 'center' });
      inp.focus(); inp.select();
      toast(mesaj, 'rau');
      return false;
    }
    modal({
      titlu: 'Confirmare încărcare', html: html, lat: true,
      laDeschidere: function (rad) {
        /* „Nu pleaca”: comanda este scoasa pe loc de pe camion (ramane fara Nr AUTO) si dispare din fereastra */
        rad.addEventListener('click', function (e) {
          var b = e.target.closest && e.target.closest('[data-np]'); if (!b) return;
          var fel = b.dataset.np.charAt(0), idx = +b.dataset.np.slice(1), o = (fel === 'i' ? l : d)[idx], rand = b.closest('tr');
          confirma('Comanda ' + o.nc + ' nu pleacă cu camionul ' + x.na + (x.nt ? ' (transport ' + x.nt + ')' : '') + '?\n\nSe scoate de pe acest camion și rămâne fără Nr AUTO, până când Transportul o planifică din nou.',
            { da: 'Da, scoate-o de pe camion', nu: 'Renunță' }).then(function (ok) {
            if (!ok) return;
            b.disabled = true;
            return L.scoateDePeCamion(o.n, x).then(function () {
              rand.remove();
              toast('Comanda ' + o.nc + ' a fost scoasă de pe camionul ' + x.na + '.', 'bun');
              var ramaseNet = rad.querySelectorAll('[data-j]').length, nota = rad.querySelector('#iNotaNet');
              if (nota) { if (ramaseNet) nota.innerHTML = textNotaNet(ramaseNet); else nota.remove(); }
              deseneazaIncarcari();
              if (!rad.querySelectorAll('[data-i], [data-j]').length) rad.closest('.fundal').querySelector('.x').click();      /* nu a mai ramas nimic de incarcat */
            }, function (er) { b.disabled = false; arataEroare(er); });
          });
        });
        rad.addEventListener('input', function (e) {
          var r = e.target.closest && e.target.closest('tr[data-rj]');
          if (r && d[+r.dataset.rj] && inCumul(d[+r.dataset.rj])) Array.prototype.forEach.call(rad.querySelectorAll('.inc-lipsa'), function (z) { z.classList.remove('inc-lipsa'); });
          r = e.target.closest && e.target.closest('.inc-lipsa');
          if (r && rad.querySelector('[data-pj="' + r.dataset.rj + '"]').value.trim() !== '' && rad.querySelector('[data-aj="' + r.dataset.rj + '"]').value.trim() !== '') r.classList.remove('inc-lipsa');
        });
      },
      butoane: [{ t: 'Renunță', v: null }, {
        t: 'Confirmă încărcarea', cls: 'pri', fn: function (rad) {
          var bife = Array.prototype.filter.call(rad.querySelectorAll('[data-i]'), function (c) { return c.checked; });
          var bifeD = Array.prototype.slice.call(rad.querySelectorAll('[data-j]'));      /* comenzile neterminate: toate, nu se pot sari */
          if (!bife.length && !bifeD.length) { toast('Bifează cel puțin o linie.', 'rau'); return false; }
          var alese = [], amNoi = [], gresit = false, deschise = [];
          bife.forEach(function (c) {
            var o = l[+c.dataset.i], a = citesteIntreg(rad.querySelector('[data-am="' + c.dataset.i + '"]').value, 'Amprente ' + o.nc);
            if (a == null) gresit = true;
            alese.push(o); amNoi.push(a);
          });
          if (gresit) return false;
          /* cumul: ajunge o comanda completata; cele lasate goale pleaca cu 0 paleti si 0 amprente */
          var cumCompletat = {}, cumPrimul = {};
          bifeD.forEach(function (c) {
            var o = d[+c.dataset.j]; if (!inCumul(o)) return;
            if (cumPrimul[o.cum] == null) cumPrimul[o.cum] = c.dataset.j;
            if (rad.querySelector('[data-pj="' + c.dataset.j + '"]').value.trim() !== '' || rad.querySelector('[data-aj="' + c.dataset.j + '"]').value.trim() !== '') cumCompletat[o.cum] = 1;
          });
          for (var q = 0; q < bifeD.length; q++) {
            var j = bifeD[q].dataset.j, od = d[+j], vp = rad.querySelector('[data-pj="' + j + '"]').value.trim(), va = rad.querySelector('[data-aj="' + j + '"]').value.trim();
            if (inCumul(od) && vp === '' && va === '') {
              if (cumCompletat[od.cum]) { deschise.push({ o: od, pal: 0, am: 0 }); continue; }
              return arataLipsa(rad, cumPrimul[od.cum], 'pj', 'Cumulul ' + od.cum + ' nu este închis: scrie paleții și amprentele numărate pe una dintre comenzile lui.');
            }
            /* prima comanda neterminata care nu este completata: aplicatia duce la ea si nu merge mai departe */
            if (vp === '') return arataLipsa(rad, j, 'pj', 'Comanda ' + od.nc + ' nu este închisă: scrie paleții numărați la încărcare.');
            var pal = citesteIntreg(vp, 'Paleți numărați, comanda ' + od.nc, true); if (pal == null) return arataLipsa(rad, j, 'pj', 'Comanda ' + od.nc + ': paleții numărați trebuie să fie un număr întreg.');
            if (va === '') return arataLipsa(rad, j, 'aj', 'Comanda ' + od.nc + ' nu este închisă: scrie amprentele numărate la încărcare.');
            var amp = citesteIntreg(va, 'Amprente, comanda ' + od.nc, true); if (amp == null) return arataLipsa(rad, j, 'aj', 'Comanda ' + od.nc + ': amprentele trebuie să fie un număr întreg.');
            deschise.push({ o: od, pal: pal, am: amp });
          }
          alese.forEach(function (o, i) { o._am = amNoi[i]; });
          var stareC = rad.querySelector('#iStare').value, temp = rad.querySelector('#iTemp').value.trim(), semn = rad.querySelector('#iSemn').value.trim();
          if (!semn) { toast('Completează semnătura (numele celui care confirmă).', 'rau'); return false; }
          var acum = SC.dtAcum(), reg = alese.filter(function (o) { return !o.extra; }), ext = alese.filter(function (o) { return o.extra; }), total = alese.length + deschise.length;
          var text = 'Încărcare ' + x.na + (x.nt ? ' / transport ' + x.nt : '') + ': ' + (total === 1 ? '1 linie' : total + ' linii') +
            (deschise.length ? ' (din care ' + (deschise.length === 1 ? '1 neterminată' : deschise.length + ' neterminate') + ', de închis)' : '') + ', camion ' + stareC;
          function pune(o) { o.inc = 'DA'; o.di = acum; o.sc = stareC; o.te = temp; o.se = semn; }
          var modificari = reg.map(function (c) {
            return { n: c.n, fn: function (o) { if (o.st !== ST.TER) throw L.eroare('Comanda ' + o.nc + ' nu mai are statusul Terminata (acum: ' + o.st + ').'); pune(o); if (c._am !== '') o.am = c._am; } };
          }).concat(deschise.map(function (c) {
            return {
              n: c.o.n, fn: function (o) {
                if (o.inc === 'DA') throw L.eroare('Comanda ' + o.nc + ' a fost deja confirmată ca încărcată.');
                if (o.st === ST.ANU || o.st === ST.SELF) throw L.eroare('Comanda ' + o.nc + ' are acum statusul ' + o.st + ' și nu se mai încarcă.');
                pune(o); o.ipr = c.pal; o.iam = c.am;
                /* daca intre timp a fost inchisa de operator, raman cifrele lui; altfel cele numarate la incarcare */
                if (SC.esteDeschisa(o)) { o.pr = c.pal; o.am = c.am; }
              }
            };
          }));
          var p = modificari.length ? L.modifica(modificari, text, { cuText: true }) : Promise.resolve();
          return p.then(function () {
            if (!ext.length) return;
            return L.modificaExtra(ext.map(function (c) { return { zi: c._zi, k: c._k, fn: function (o) { pune(o); if (c._am !== '') o.am = c._am; } }; }), modificari.length ? null : text);
          }).then(function () {
            toast('Camion ' + x.na + ': ' + total + (total === 1 ? ' linie încărcată' : ' linii încărcate') +
              (deschise.length ? '; ' + nCom(deschise.length) + (deschise.length === 1 ? ' rămâne' : ' rămân') + ' de închis de Operatorul de date.' : '.'), 'bun');
            $('incAzi').checked = true; deseneazaIncarcari();
          });
        }
      }]
    });
  }
  /* Doar Administratorul: o incarcare confirmata din greseala. Comenzile camionului redevin neincarcate (se sterg Incarcata, data
     incarcarii, starea camionului, temperatura, semnatura). La cele plecate inainte de inchidere se sterg si paletii / amprentele
     numarate la incarcare; daca Operatorul le-a inchis intre timp, cifrele lui raman. */
  function anuleazaIncarcarea(x) {
    if (rol() !== 'admin' || !x) return;
    var l = x.incarcate.slice(), reg = l.filter(function (o) { return !o.extra; });
    if (!l.length) return;
    var cand = ''; l.forEach(function (o) { if (o.di && String(o.di) > cand) cand = String(o.di); });
    var neinchise = reg.filter(function (o) { return SC.esteDeschisa(o); }).length;
    var html = '<div class="nota atentie">Camion <b>' + esc(x.na) + '</b>' + (x.nt ? ' · transport <b>' + esc(x.nt) + '</b>' : '') + (cand ? ' · încărcat ' + esc(SC.fmtDT(cand)) : '') +
      '<br>Confirmarea de încărcare se șterge de pe ' + (l.length === 1 ? 'linia bifată' : 'liniile bifate') + '; camionul apare din nou la Încărcări, de încărcat.</div>' +
      '<div class="lista-mica inc-lista"><table class="simplu"><tr><th></th><th>Comandă</th><th>Destinatar</th><th>Status</th><th>Încărcată</th></tr>' +
      l.map(function (o, i) {
        return '<tr><td><input type="checkbox" data-di="' + i + '" checked aria-label="Anulează încărcarea pentru ' + esc(o.nc) + '"></td><td>' + esc(o.cl || '') + ' ' + esc(o.nc) + (o.extra ? ' <span class="eticheta asteapta">doar transport</span>' : '') +
          '</td><td>' + esc(o.de || '') + '</td><td>' + esc(o.extra ? '' : o.st) + '</td><td>' + esc(SC.fmtDT(o.di)) + (o.se ? ' · ' + esc(o.se) : '') + '</td></tr>';
      }).join('') + '</table></div>' +
      (neinchise ? '<div class="mic">' + (neinchise === 1 ? 'O comandă a plecat neînchisă' : neinchise + ' comenzi au plecat neînchise') + ': li se șterg și paleții și amprentele numărate la încărcare.</div>' : '') +
      '<div class="mic">Operația rămâne în jurnal, cu valorile vechi. Ora de început a încărcării (borderoul tipărit) nu se schimbă.</div>';
    modal({
      titlu: 'Anulează încărcarea', html: html, lat: true,
      butoane: [{ t: 'Renunță', v: null }, {
        t: 'Anulează încărcarea', cls: 'pri', fn: function (rad) {
          var alese = Array.prototype.filter.call(rad.querySelectorAll('[data-di]'), function (c) { return c.checked; }).map(function (c) { return l[+c.dataset.di]; });
          if (!alese.length) { toast('Bifează cel puțin o linie.', 'rau'); return false; }
          var r2 = alese.filter(function (o) { return !o.extra; }), e2 = alese.filter(function (o) { return o.extra; });
          var text = 'Încărcare anulată de Administrator: ' + x.na + (x.nt ? ' / transport ' + x.nt : '') + ' — ' + (alese.length === 1 ? '1 linie' : alese.length + ' linii');
          function scoate(o) { delete o.inc; delete o.di; delete o.sc; delete o.te; delete o.se; }
          var p = r2.length ? L.modifica(r2.map(function (c) {
            return { n: c.n, fn: function (o) {
              if (o.inc !== 'DA') return;
              scoate(o);
              if (SC.esteNum(o.ipr) && SC.esteDeschisa(o)) { delete o.pr; delete o.am; }
              delete o.ipr; delete o.iam;
            } };
          }), text, { cuText: true }) : Promise.resolve();
          return p.then(function () {
            if (!e2.length) return;
            return L.modificaExtra(e2.map(function (c) { return { zi: c._zi, k: c._k, fn: scoate }; }), r2.length ? null : text);
          }).then(function () { toast('Încărcarea a fost anulată pentru ' + (alese.length === 1 ? '1 linie' : alese.length + ' linii') + ' de pe camionul ' + x.na + '.', 'bun'); deseneazaIncarcari(); });
        }
      }]
    });
  }
  /* Borderoul camionului: toate comenzile lui, indiferent de status. La cele neterminate
     paletii reali, amprentele si greutatea finala raman goale (se vad doar paletii estimati). */
  function tiparesteCamion(x) { return tiparesteCamioane([x]); }
  /* Unul sau mai multe borderouri intr-o singura tiparire, cate unul pe pagina (A4 pe lat). Ora la care s-a tiparit borderoul =
     inceputul incarcarii; se inregistreaza automat pentru fiecare camion (Administrator / Incarcari). */
  function tiparesteCamioane(lista) {
    var pagini = [], nereusite = 0, p = Promise.resolve();
    lista.forEach(function (x) {
      var fa = htmlBorderou(x);
      p = p.then(function () {
        if (!poateIncarca()) { pagini.push(fa(L.infoCamion(x))); return; }
        return L.marcheazaBorderou(x).then(function (info) { pagini.push(fa(info)); }, function () { nereusite++; pagini.push(fa(L.infoCamion(x))); });
      });
    });
    return p.then(function () {
      if (nereusite) toast((lista.length === 1 ? 'Borderoul se tipărește' : 'Borderourile se tipăresc') + ', dar ora de început nu a putut fi înregistrată' + (lista.length > 1 ? ' pentru ' + nereusite + ' dintre ele' : '') + '.', 'rau');
      $('tiparire').innerHTML = pagini.join('');
      window.print();
      if (stare.tab === 'incarcari') deseneazaIncarcari();
    });
  }
  function htmlBorderou(x) {
    var l = x.toate.slice().sort(function (a, b) { return (a.extra ? 1 : 0) - (b.extra ? 1 : 0) || (a.n || 0) - (b.n || 0); }).concat(x.retururi || []);
    var nrRetur = (x.retururi || []).length;
    function gata(o) { return o.extra || o.st === ST.TER || o.st === ST.SELF || o.inc === 'DA'; }
    function val(o, k) {
      if (o.retur && NUMERICE[k]) return '';                              /* retur: fara paleti, amprente, greutate */
      if (k === 'pe') return o.extra ? o.pr : o.pe;                       /* la liniile doar din transport estimarea = unitatile din TMS */
      if ((k === 'pr' || k === 'am' || k === 'gf') && !gata(o)) return '';
      return o[k];
    }
    var cols = [['cl', 'Client'], ['nc', 'Nr. Comandă'], ['dl', 'Livrare'], ['de', 'Destinatar'], ['or', 'Oraș'], ['ju', 'Județ'], ['ca', 'Cartoane'], ['pe', 'Paleți estimați'], ['pr', 'Paleți reali'], ['am', 'Amprente'], ['gf', 'Greutate finală']];
    var NUMERICE = { ca: 1, pe: 1, pr: 1, am: 1, gf: 1 };
    function tot(k) { return l.reduce(function (s, o) { var v = val(o, k); return s + (SC.esteNum(v) ? v : 0); }, 0); }
    var neterminate = l.filter(function (o) { return !gata(o); }).length;
    function fppPick(f, p) {
      if (!SC.esteNum(f) && !SC.esteNum(p)) return '';
      return '<div class="fp">' + (SC.esteNum(f) ? 'FPP ' + f : '') + (SC.esteNum(f) && SC.esteNum(p) ? ' · ' : '') + (SC.esteNum(p) ? 'Pick ' + p : '') + '</div>';
    }
    var reg = l.filter(function (o) { return !o.extra; }), areF = reg.some(function (o) { return SC.esteNum(o.fpp); }), areP = reg.some(function (o) { return SC.esteNum(o.pk); });
    var h = '<h1>Borderou de încărcare</h1><div>Nr AUTO: <b>' + esc(x.na) + '</b>' + (x.nt ? ' · Nr transport: <b>' + esc(x.nt) + '</b>' : '') + (x.data ? ' · Data: <b>' + esc(SC.fmtDataLunga(x.data)) + '</b>' : '') +
      (l[0] && l[0].so ? ' · Șofer: ' + esc(l[0].so) : '') + '<!--inceput--> · Tipărit: ' + esc(stampila()) + '</div><table><tr>' +
      cols.map(function (c) { return '<th' + (NUMERICE[c[0]] ? ' class="nr"' : '') + '>' + c[1] + '</th>'; }).join('') + '</tr>';
    l.forEach(function (o) {
      h += '<tr>' + cols.map(function (c) {
        var col = SC.COL[c[0]], v = val(o, c[0]), tmp = {}; tmp[c[0]] = v;
        var text = esc(SC.fmtCelula(tmp, col));
        /* in coloana de paleti estimati apar si FPP / Pick, pe al doilea rand */
        if (c[0] === 'pe' && !o.extra) text += fppPick(o.fpp, o.pk);
        if (c[0] === 'nc' && o.retur) text += '<div class="fp">RETUR — nu se încarcă</div>';
        return '<td' + (NUMERICE[c[0]] ? ' class="nr"' : '') + '>' + text + '</td>';
      }).join('') + '</tr>';
    });
    var incarcat = l.filter(function (o) { return o.inc === 'DA' && !o.retur; })[0] || {};
    h += '<tr><th colspan="6">TOTAL (' + (l.length - nrRetur) + (l.length - nrRetur === 1 ? ' linie' : ' linii') + (neterminate ? ', din care ' + neterminate + (neterminate === 1 ? ' nepregătită' : ' nepregătite') : '') + (nrRetur ? '; ' + nrRetur + (nrRetur === 1 ? ' retur neinclus' : ' retururi neincluse') : '') + ')</th><th class="nr">' + SC.fmtNum(tot('ca'), 'int') +
      '</th><th class="nr">' + SC.fmtNum(tot('pe'), 'num') + fppPick(areF ? suma(reg, 'fpp') : null, areP ? suma(reg, 'pk') : null) + '</th><th class="nr">' + SC.fmtNum(tot('pr'), 'int') + '</th><th class="nr">' + SC.fmtNum(tot('am'), 'int') + '</th><th class="nr">' + SC.fmtNum(tot('gf'), 'num') + '</th></tr></table>' +
      '<div class="semnaturi"><div>Stare camion: ' + esc(incarcat.sc || '________') + ' · Temperatură: ' + esc(incarcat.te || '________') + '</div><div>Semnătură depozit: ' + esc(incarcat.se || '________________') + '</div><div>Semnătură șofer: ________________</div></div>';
    return function (info) {
      return '<div class="bord-pag">' + h.replace('<!--inceput-->', (info && info.o > 0 ? ' · Locul la încărcare: <b>' + info.o + '</b>' : '') + (info && info.bt ? ' · Început încărcare: <b>' + esc(SC.fmtDT(info.bt).replace(/^(\d\d\.\d\d)\.(\d\d) /, '$1.20$2 ')) + '</b>' : '')) + '</div>';
    };
  }
  $('btnTransport2').onclick = function () { $('btnTransport').onclick(); };
  /* Administrator: sterge tot ce a venit pana acum din fisierele de transport, ca urmatorul import sa porneasca de la zero */
  $('btnGolesteInc').onclick = function () {
    if (!eAdmin()) return;
    var atinse = SC.comenzi.filter(function (o) { return o.inc !== 'DA' && (o.nt || o.dtr || o.so || o.re); });
    var nrCam = Object.keys(SC.camInfo || {}).length;
    /* camioanele „Fără dată”: comenzi neincarcate (terminate sau in lucru) care au Nr AUTO, dar nu au data de transport */
    /* exact camioanele pe care lista le arata la „Fără dată”: fara data de transport si cu ceva de incarcat / in lucru */
    var camFara = toateCamioanele().filter(function (x) { return !x.data && (x.deIncarcat.length || x.inLucru.length); });
    var faraData = [];
    camFara.forEach(function (x) { x.deIncarcat.concat(x.inLucru).forEach(function (o) { if (!o.extra && faraData.indexOf(SC.dupaNr[o.n]) < 0 && SC.dupaNr[o.n]) faraData.push(SC.dupaNr[o.n]); }); });
    var extraFara = SC.extra.filter(function (x) { return !x.dtr; });
    var nCamFara = camFara.length;
    modal({
      titlu: 'Golește încărcările', lat: true,
      html: '<div class="nota atentie">Alege ce se șterge. Operația apare în jurnal și nu poate fi anulată.</div>' +
        '<label class="bifa" style="align-items:flex-start;margin-top:10px"><input type="checkbox" id="gTms"' + (SC.extra.length || nrCam || atinse.length ? '' : ' disabled') + '> <span><b>Tot ce a venit din fișierele de transport (TMS)</b>, ca următorul import să pornească de la zero:<br>' +
        '<span class="mic">liniile „doar din transport”, cu tot cu retururi: ' + SC.extra.length + ' · orele de început de încărcare: ' + nrCam + (nrCam === 1 ? ' camion' : ' camioane') +
        ' · Nr transport, Data transport, Șofer și Remorcă de pe ' + nCom(atinse.length) + ' neîncărcate. Nr AUTO rămâne.</span></span></label>' +
        '<label class="bifa" style="align-items:flex-start;margin-top:10px"><input type="checkbox" id="gFara"' + (faraData.length || extraFara.length ? '' : ' disabled') + '> <span><b>Camioanele „Fără dată”</b>: ' + nCamFara + (nCamFara === 1 ? ' camion' : ' camioane') + '<br>' +
        '<span class="mic">se șterge Nr AUTO de pe comenzile neîncărcate din aceste camioane (' + nCom(faraData.length) + ')' + (extraFara.length ? ' și se șterg ' + extraFara.length + ' linii „doar din transport” fără dată' : '') +
        '. Comenzile rămân în registru, doar fără număr auto; valoarea veche a fiecăreia se păstrează în jurnal.</span></span></label>' +
        '<div class="mic" style="margin-top:10px">Rămân neatinse comenzile deja confirmate ca încărcate, cele arhivate și tot restul registrului. Dacă le bifezi pe amândouă, a doua se aplică doar camioanelor care sunt „Fără dată” în acest moment.</div>',
      butoane: [{ t: 'Renunță', v: null }, {
        t: 'Șterge', cls: 'pri', fn: function (rad) {
          var tms = rad.querySelector('#gTms').checked, fara = rad.querySelector('#gFara').checked;
          if (!tms && !fara) { toast('Bifează ce vrei să ștergi.', 'rau'); return false; }
          function inBucati(lista, eticheta, fn, text, opt) {
            var i = 0;
            function parte() {
              if (i >= lista.length) return Promise.resolve();
              var buc = lista.slice(i, i + 100); i += 100;
              $('syncText').textContent = eticheta + ' ' + Math.min(i, lista.length) + '/' + lista.length;
              return L.modifica(buc.map(function (o) { return { n: o.n, fn: fn }; }), text(buc.length), opt).then(parte);
            }
            return parte();
          }
          var pas = Promise.resolve();
          if (tms) pas = pas.then(function () { return SC.store.stergeColectie('extra'); }).then(function () {
            return inBucati(atinse, 'golire', function (x) { if (x.inc === 'DA') return; delete x.nt; delete x.dtr; delete x.so; delete x.re; delete x.mnt; },
              function (n) { return 'Golire încărcări: date de transport scoase de pe ' + n + ' comenzi'; }, { faraDetalii: true });
          });
          if (fara) pas = pas.then(function () {
            return inBucati(faraData, 'fără dată', function (x) { if (x.inc === 'DA') return; delete x.na; },
              function (n) { return 'Golire încărcări: Nr AUTO șters de pe ' + n + ' comenzi fără dată de transport'; });
          }).then(function () {
            if (tms || !extraFara.length) return;
            return SC.store.tx(function (t) {
              return t.get('extra', 'fara-data').then(function (d) {
                if (!d) return;
                d.l = {}; d.upd = Date.now(); t.set('extra', 'fara-data', d);
                t.log('Golire încărcări: ' + extraFara.length + ' linii doar din transport fără dată, șterse');
              });
            });
          });
          return pas.then(function () {
            marcheazaSync();
            toast((tms ? 'Datele din fișierele de transport au fost șterse. ' : '') + (fara ? 'Camioanele „Fără dată” au fost șterse (' + nCom(faraData.length) + '). ' : '') + (tms ? 'Importă acum fișierul de transport.' : ''), 'bun');
            redeseneaza();
          });
        }
      }]
    });
  };
  $('btnTransport').onclick = function () {
    var fisier, p;
    alegeFisier().then(function (f) { fisier = f; toast('Se citește fișierul…'); return new Promise(function (ok) { setTimeout(ok, 50); }).then(function () { return citesteFisier(f); }); }).then(function (wb) {
      p = L.parseTransport(wb);
      if (!p.randuri.length) throw L.eroare('Fișierul nu conține rânduri cu ReferintaClient și Masina.');
      /* In TMS data de incarcare este pe fiecare linie, iar o comanda mutata pe alt camion isi pastreaza data veche.
         Data camionului = data cea mai frecventa dintre liniile transportului (la egalitate, cea mai recenta);
         toate liniile transportului o primesc pe aceasta. */
      var peTr = {};
      p.randuri.forEach(function (r) { if (r.nt && r.dtr) { var m = (peTr[r.nt] = peTr[r.nt] || {}); m[r.dtr] = (m[r.dtr] || 0) + 1; } });
      p.randuri.forEach(function (r) {
        var m = r.nt && peTr[r.nt]; if (!m) return;
        r.dtr = Object.keys(m).sort(function (a, b) { return m[b] - m[a] || (a < b ? 1 : -1); })[0];
      });
      /* fisierul TMS este cumulativ: se proceseaza doar transporturile din ultimele zile (si cele fara data) */
      var prag0 = SC.ziPlus(SC.azi(), -SC.ZILE_EXTRA);
      p.recente = p.randuri.filter(function (r) { return !r.dtr || r.dtr >= prag0; });
      p.vechi = p.randuri.length - p.recente.length;
      /* referintele din TMS au uneori puncte la sfarsit ("AV000071254..") - se potrivesc fara ele */
      p.recente.forEach(function (r) { r.refCurat = String(r.ref).replace(/[.,;:\s]+$/, ''); });
      return L.cautaComenzi(p.recente.map(function (r) { return r.refCurat; }));
    }).then(function (exist) {
      var noi = [], schimbate = [], neschimbate = 0, dejaInc = 0, vazute = {}, perZi = {}, nrExtra = 0, preaVechi = p.vechi, potriviri = [], ramase = [], confirmate = [];
      var prag = SC.ziPlus(SC.azi(), -SC.ZILE_EXTRA);
      p.recente.forEach(function (r) {
        var k = SC.cheieComanda(r.refCurat);
        var l = (exist[k] || []).filter(function (o) { return o.st !== ST.ANU && !o.tr; });
        if (r.cl && l.length > 1) { var pc = l.filter(function (o) { return SC.normText(r.cl).indexOf(SC.normText(o.cl)) >= 0; }); if (pc.length) l = pc; }
        if (!l.length) {
          /* nu exista in registru -> rubrica separata "doar din transport" (doar transporturile recente) */
          var zi = L.ziExtra(r); (perZi[zi] = perZi[zi] || []);
          if (!perZi[zi].some(function (y) { return L.cheieExtra(y) === L.cheieExtra(r); })) { perZi[zi].push(r); nrExtra++; }
          return;
        }
        vazute[k] = { r: r, l: l };      /* aceeasi referinta pe mai multe transporturi: ramane ultimul (cel mai recent) */
      });
      Object.keys(vazute).forEach(function (k) {
        var r = vazute[k].r, l = vazute[k].l;
        var libere = l.filter(function (o) { return o.inc !== 'DA'; });
        if (!libere.length) { dejaInc++; potriviri.push({ r: r, o: null }); return; }
        var o = libere[libere.length - 1];
        /* scoasa la incarcare („Nu pleaca”) chiar de pe acest transport: ramane fara camion, daca nu se cere altfel */
        if (o.xnt && r.nt && o.xnt === r.nt && !o.na) { ramase.push({ o: o, r: r }); return; }
        potriviri.push({ r: r, o: o });
        var acelasiAuto = SC.normNrAuto(o.na) === SC.normNrAuto(r.na);
        /* neschimbata = acelasi camion, transport si data, dar si acelasi sofer si aceeasi remorca (daca fisierul le are) */
        if (acelasiAuto && (o.nt || '') === (r.nt || '') && (!r.dtr || (o.dtr || '') === r.dtr) && (!r.so || (o.so || '') === r.so) && (!r.re || (o.re || '') === r.re)) {
          /* trecuta de mana pe transport si ajunsa acum si in fisier: de aici inainte o tine fisierul (daca dispare din el, se scoate) */
          if (o.mnt) confirmate.push({ o: o, r: r }); else neschimbate++;
          return;
        }
        if (o.na && !acelasiAuto) schimbate.push({ o: o, r: r }); else noi.push({ o: o, r: r });
      });
      /* zilele deja existente in rubrica separata, din fereastra importului, se recalculeaza si ele (liniile disparute se scot) */
      SC.extra.forEach(function (x) { if (x._zi === 'fara-data' || x._zi >= prag) perZi[x._zi] = perZi[x._zi] || []; });
      var existente = {}; SC.extra.forEach(function (x) { existente[x._zi + '|' + x._k] = 1; });
      /* o linie doar din transport care isi schimba ziua (camionul a fost mutat pe alta data) isi pastreaza corecturile facute de mana */
      var dupaCheie = {}; SC.extra.forEach(function (x) { if (x.inc !== 'DA') dupaCheie[x._k] = x; });
      var extraNoi = 0;
      Object.keys(perZi).forEach(function (zi) {
        perZi[zi].forEach(function (r) {
          var kx = L.cheieExtra(r), e = dupaCheie[kx];
          if (existente[zi + '|' + kx]) return;
          if (e && e._zi !== zi) r._mutat = e; else extraNoi++;
        });
      });
      /* transporturile care erau deja in aplicatie: ce s-a schimbat fata de varianta dinainte */
      var cmp = L.comparaTransport(p.recente, potriviri, perZi, prag);

      var html = '<div class="nota">Fișier: <b>' + esc(fisier.name) + '</b> (foaia „' + esc(p.foaie) + '”, ' + p.randuri.length + ' rânduri)' +
        '<br>Data încărcării: ' + (p.colData ? 'coloana „<b>' + esc(p.colData) + '</b>”' : '<b>nu am găsit o coloană de dată</b> — camioanele vor apărea „fără dată”') + '</div>' +
        '<div><b>Comenzi din registru</b> — Nr AUTO de completat sau actualizat: <b>' + noi.length + '</b> · de schimbat: <b>' + schimbate.length + '</b> · neschimbate: ' + neschimbate + ' · deja încărcate (sărite): ' + dejaInc + '</div>' +
        (confirmate.length ? '<div class="mic">Trecute de mână în aplicație și găsite acum și în fișier, pe același camion: ' + confirmate.length + ' (de aici înainte le ține fișierul).</div>' : '');
      if (schimbate.length) html += '<div class="mic">Numere auto care se schimbă (fișierul de transport are prioritate):</div>' + listaHtml(schimbate.map(function (x) { return x.o.nc + ': ' + x.o.na + ' → ' + x.r.na; }));
      html += '<div><b>Linii care nu există în registru</b> — merg în rubrica separată „Doar din transport” din tabul Încărcări: <b>' + nrExtra + '</b> (din care noi: ' + extraNoi + ')</div>' +
        (preaVechi ? '<div class="mic">Rânduri din fișier cu transport mai vechi de ' + SC.ZILE_EXTRA + ' zile, ignorate: ' + preaVechi + '.</div>' : '') +
        '<div class="mic">Aceste linii nu intră în registrul de comenzi; apar doar la camionul lor și în borderou.</div>';
      /* ---- transporturi incarcate din nou ---- */
      var nrVechi = cmp.transporturi.length + cmp.laFel;
      html += '<h4 style="margin:14px 0 4px">Transporturi care erau deja în aplicație: ' + nrVechi + '</h4>';
      if (!nrVechi) html += '<div class="mic">Niciun număr de transport din fișier nu era deja în aplicație' + (cmp.noi ? ' (transporturi noi: ' + cmp.noi + ')' : '') + '.</div>';
      else {
        html += '<div>Cu modificări față de ce era în aplicație: <b>' + cmp.transporturi.length + '</b> · fără nicio modificare: ' + cmp.laFel + (cmp.noi ? ' · transporturi noi: ' + cmp.noi : '') + '</div>';
        if (cmp.transporturi.length) {
          html += '<div class="derulare-x" style="max-height:300px;overflow:auto;margin-top:6px"><table class="simplu tr-cmp"><tr><th>Transport</th><th>Camion</th><th>Data</th><th>Ce s-a schimbat</th></tr>' +
            cmp.transporturi.map(function (t) {
              return '<tr><td><b>' + esc(t.nt) + '</b></td><td>' + esc(t.na) + '</td><td>' + esc(t.zi ? SC.fmtDataLunga(t.zi) : 'fără dată') + '</td><td>' +
                t.linii.map(function (x) { return '<div>' + esc(x) + '</div>'; }).join('') +
                (t.tiparit ? '<div class="tr-tip">⚠ Borderoul a fost deja tipărit (' + esc(SC.fmtDT(t.tiparit)) + '): trebuie tipărit din nou.</div>' : '') + '</td></tr>';
            }).join('') + '</table></div>';
        }
      }
      if (cmp.deScos.length) html += '<label class="bifa" style="margin-top:8px"><input type="checkbox" id="trScoate" checked> <span>Scoate de pe camion comenzile din registru care nu mai sunt pe transportul lor: <b>' + cmp.deScos.length +
        '</b> (li se șterg Nr AUTO, Nr transport, data, șoferul și remorca)</span></label>';
      if (ramase.length) html += '<label class="bifa" style="margin-top:8px"><input type="checkbox" id="trRamase"> <span>Pune înapoi pe transportul lor comenzile scoase la încărcare cu „Nu pleacă”: <b>' + ramase.length +
        '</b> (' + esc(ramase.slice(0, 10).map(function (y) { return y.o.nc + ' → ' + y.r.nt; }).join(', ')) + (ramase.length > 10 ? ' …' : '') + '). Nebifat = rămân fără camion.</span></label>';
      if (cmp.transporturi.length) html += '<div class="mic" style="margin-top:6px">La „Aplică”, colegii de la Încărcări primesc câte o notificare pentru fiecare transport modificat.</div>';
      if (cmp.extraOrfane.length) html += '<div class="mic" style="margin-top:6px">Linii „doar din transport” ale unor transporturi care nu mai sunt deloc în fișier (se scot): ' + esc(cmp.extraOrfane.slice(0, 12).join(', ')) +
        (cmp.extraOrfane.length > 12 ? ' … încă ' + (cmp.extraOrfane.length - 12) : '') + '</div>';
      if (!noi.length && !schimbate.length && !confirmate.length && !extraNoi && !nrExtra && !cmp.deScos.length && !cmp.extraOrfane.length && !ramase.length) {
        return alerta('Nimic de actualizat din „' + fisier.name + '”.' + (nrVechi ? '\n\nTransporturi care erau deja în aplicație: ' + nrVechi + ', toate fără nicio modificare.' : ''));
      }
      return modal({
        titlu: 'Import fișier transport', html: html, lat: true,
        butoane: [{ t: 'Renunță', v: null }, {
          t: 'Aplică', cls: 'pri', fn: function (rad) {
            var bifaR = rad.querySelector('#trRamase');
            var toate = noi.concat(schimbate).concat(confirmate).concat(bifaR && bifaR.checked ? ramase : []), i = 0, bifa = rad.querySelector('#trScoate'), deScos = bifa && bifa.checked ? cmp.deScos : [];
            function parte() {
              if (i >= toate.length) return Promise.resolve();
              var bucata = toate.slice(i, i + 100); i += 100;
              $('syncText').textContent = 'transport ' + Math.min(i, toate.length) + '/' + toate.length;
              return L.modifica(bucata.map(function (x) {
                return {
                  n: x.o.n, fn: function (o) {
                    if (o.inc === 'DA') return;
                    o.na = x.r.na; if (x.r.nt) o.nt = x.r.nt; if (x.r.so) o.so = x.r.so; if (x.r.re) o.re = x.r.re; if (x.r.dtr) o.dtr = x.r.dtr;
                    delete o.xnt;      /* a primit din nou un camion: nu mai este „scoasa la incarcare” */
                    delete o.mnt;      /* camionul vine acum din fisier, nu mai este „trecuta de mana” */
                  }
                };
              }), 'Import transport ' + fisier.name + ': Nr AUTO pe ' + bucata.length + ' comenzi').then(parte);
            }
            /* comenzile din registru care nu mai sunt pe transportul lor: raman fara camion */
            function scoate() {
              if (!deScos.length) return Promise.resolve();
              return L.modifica(deScos.map(function (x) {
                return { n: x.n, fn: function (o) { if (o.inc === 'DA' || o.nt !== x.nt) return; delete o.na; delete o.nt; delete o.dtr; delete o.so; delete o.re; delete o.mnt; } };
              }), 'Import transport ' + fisier.name + ': scoase de pe camion, fiindcă nu mai sunt pe transportul lor — ' + nCom(deScos.length), { cuText: true });
            }
            /* Incarcarile afla ce transporturi s-au schimbat (cu textul potrivit, daca s-a ales ca unele comenzi sa ramana pe camion) */
            var deAnuntat = cmp.transporturi.map(function (t) {
              var linii = t.linii.slice();
              if (t.linieScoase >= 0 && !deScos.length) linii[t.linieScoase] += ' (au rămas pe camion)';
              return { nt: t.nt, na: t.na, zi: t.zi, tiparit: t.tiparit, linii: linii };
            });
            return parte().then(scoate).then(function () { return L.importaExtra(perZi, fisier.name); }).then(function (st) {
              return L.notificaTransport(deAnuntat, fisier.name).then(function () { return st; }, function (e) {
                toast('Modificările au fost aplicate, dar notificarea pentru Încărcări nu a putut fi salvată: ' + (e && e.message ? e.message : e), 'rau'); return st;
              });
            }).then(function (st) {
              marcheazaSync();
              toast('Transport: ' + (toate.length === 1 ? '1 comandă actualizată' : toate.length + ' comenzi actualizate') + (deScos.length ? '; scoase de pe camion: ' + nCom(deScos.length) : '') + '; linii doar din transport: ' + st.noi + ' noi, ' + st.actualizate + ' actualizate, ' + st.scoase + ' scoase.' +
                (deAnuntat.length ? ' Încărcările au fost anunțate despre ' + (deAnuntat.length === 1 ? 'transportul modificat.' : 'cele ' + deAnuntat.length + ' transporturi modificate.') : ''), 'bun');
              redeseneaza();
            });
          }
        }]
      });
    }).catch(arataEroare);
  };

  /* ================= KPI ================= */
  /* Totul se calculeaza din ce este deja in memorie (comenzile active si recente + liniile din TMS):
     tabul nu face nicio citire in plus din baza de date. */
  var kpiZi = null;          // 'YYYY-MM-DD' = ziua de incarcare; '' = tot ce este neincarcat, indiferent de zi
  var kpiCamioane = [];
  /* pregatita = terminata, self-pick sau plecata deja cu camionul (incarcata inainte de inchidere, cu paletii numarati la incarcare) */
  function kGata(o) { return !!o.extra || o.st === ST.TER || o.st === ST.SELF || o.inc === 'DA'; }
  /* paletii unei comenzi: reali daca e pregatita, altfel estimarea rotunjita in sus */
  function kPal(o) { return kGata(o) ? (SC.esteNum(o.pr) ? o.pr : 0) : (SC.esteNum(o.pe) ? Math.ceil(o.pe) : 0); }
  function kPick(o) {
    if (SC.esteNum(o.pk)) return o.pk;
    return !kGata(o) && SC.esteNum(o.fpp) ? SC.pickPropus(o.fpp, o.pe, null) : null;
  }
  function kGreu(o) { var v = kGata(o) && SC.esteNum(o.gf) ? o.gf : o.g; return SC.esteNum(v) ? v : 0; }
  function kAduna(l) {
    var s = { n: 0, gata: 0, deschise: 0, inc: 0, pal: 0, palReali: 0, palEst: 0, palInc: 0, palDeInc: 0, palRam: 0, fppRam: 0, pkRam: 0, faraRam: 0, extraRam: 0,
      fpp: 0, pk: 0, pkFacut: 0, pkDeFacut: 0, nExtra: 0, am: 0, kg: 0, kgRam: 0, st: {}, estSum: 0, realSum: 0, nEst: 0 };
    l.forEach(function (o) {
      var g = kGata(o), p = kPal(o), inc = o.inc === 'DA', f = SC.esteNum(o.fpp) ? o.fpp : null, k = kPick(o);
      s.n++; s.pal += p; s.kg += kGreu(o);
      if (g) { s.gata++; s.palReali += p; if (SC.esteNum(o.am)) s.am += o.am; } else { s.deschise++; s.palEst += p; }
      if (o.extra) s.nExtra++; else {
        s.st[o.st] = (s.st[o.st] || 0) + 1;
        if (f != null) s.fpp += f;
        if (k != null) { s.pk += k; if (g) s.pkFacut += k; else s.pkDeFacut += k; }
        if (g && SC.esteNum(o.pe) && SC.esteNum(o.pr)) { s.estSum += o.pe; s.realSum += o.pr; s.nEst++; }
      }
      if (inc) { s.inc++; s.palInc += p; return; }
      s.palRam += p; s.kgRam += kGreu(o);
      if (g && o.st !== ST.SELF) s.palDeInc += p;
      if (o.extra) s.extraRam += p;
      else if (f == null && k == null) s.faraRam += p;
      else { s.fppRam += f || 0; s.pkRam += k || 0; }
    });
    return s;
  }
  function kStare(x) {
    var info = L.infoCamion(x), total = x.toate.length, inc = x.incarcate.length, gata = x.toate.filter(kGata).length;
    if (total && inc === total) return ['Încărcat', 'ok', 4];
    if (inc || (info && info.bt)) return ['În încărcare', 'lucru', 3];
    if (gata === total) return ['Gata de încărcat', 'asteapta', 2];
    if (gata || x.toate.some(function (o) { return o.st === ST.LUC; })) return ['În pregătire', 'gri', 1];
    return ['În așteptare', 'gri', 0];
  }
  function nr(v) { return SC.fmtNum(v, 'int') || '0'; }
  function proc(a, b) { return b ? Math.round(a * 100 / b) : 0; }

  /* ---- KPI: pregatirea comenzilor, dupa data de livrare (Livrare solicitata) ----
     Pentru zilele trecute arata ce s-a pregatit; pentru azi si viitor, ce este de pregatit (chiar daca nu are masina).
     Pregatita = Terminata sau Self-Pick (paleti reali); de pregatit = Initiata / In lucru (paleti estimati, rotunjiti in sus).
     Aplicatia tine in memorie doar comenzile active si recente, asa ca pentru zile mai vechi comenzile se citesc o data
     din arhiva (cautate dupa momentul introducerii) si raman in memorie pana la inchiderea paginii. */
  var kpInt = null;          // { a, b } = livrare de la / pana la; '' = fara limita
  var KP_ZILE = ['du', 'lu', 'ma', 'mi', 'jo', 'vi', 'sâ'];
  var KP_ZILE_INAINTE = 14;  // o comanda este cautata in arhiva daca a fost introdusa cu cel mult atatea zile inainte de livrare
  var KP_AUTO_MAX = 80;      // intervale de arhiva mai lungi de atatea zile se citesc doar la cerere (planul gratuit)
  var kpIst = { acoperit: [], stare: '', cheie: '', cerut: '', grupe: 0, eroare: '' };
  /* cand memoria comenzilor este golita (iesire, schimbarea rolului, migrare), arhiva citita pentru KPI trebuie recitita */
  function kpUitaArhiva() { kpIst.acoperit = []; kpIst.stare = ''; kpIst.cerut = ''; kpIst.eroare = ''; }
  function kpZiText(d) { var x = new Date(d + 'T12:00:00'); return KP_ZILE[x.getDay()] + ' ' + SC.fmtDataLunga(d); }
  function kpData(o) { var d = String(o.dl || '').slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : ''; }
  function kpAreMasina(o) { return !!o.na && !!SC.normNrAuto(o.na).replace(/0/g, ''); }
  function kpAduna(l) {
    var s = { n: 0, gata: 0, self: 0, palGata: 0, fppGata: 0, pkGata: 0, amGata: 0, kgGata: 0, incGata: 0,
      nRam: 0, ini: 0, luc: 0, palRam: 0, kgRam: 0, fppRam: 0, pkRam: 0, faraRam: 0, faraEst: 0, faraMasina: 0, palFaraMasina: 0 };
    l.forEach(function (o) {
      s.n++;
      if (kGata(o)) {
        s.gata++; s.palGata += kPal(o); s.kgGata += kGreu(o);
        if (SC.esteNum(o.fpp)) s.fppGata += o.fpp;
        if (SC.esteNum(o.pk)) s.pkGata += o.pk;
        if (SC.esteNum(o.am)) s.amGata += o.am;
        if (o.st === ST.SELF) s.self++;
        if (o.inc === 'DA') s.incGata++;
        return;
      }
      var pal = kPal(o), f = SC.esteNum(o.fpp) ? o.fpp : null, k = kPick(o);
      s.nRam++; if (o.st === ST.LUC) s.luc++; else s.ini++;
      s.palRam += pal; s.kgRam += kGreu(o);
      if (!(SC.esteNum(o.pe) && o.pe > 0)) s.faraEst++;
      if (f == null && k == null) s.faraRam += pal; else { s.fppRam += f || 0; s.pkRam += k || 0; }
      if (!kpAreMasina(o)) { s.faraMasina++; s.palFaraMasina += pal; }
    });
    return s;
  }
  function kpPresetari(azi) {
    var luna = azi.slice(0, 8) + '01', sfLuna = SC.ziPlus(SC.ziPlus(luna, 32).slice(0, 8) + '01', -1), sfTrecuta = SC.ziPlus(luna, -1);
    return [{ t: 'Azi', a: azi, b: azi, nr: 1 }, { t: 'Mâine', a: SC.ziPlus(azi, 1), b: SC.ziPlus(azi, 1), nr: 1 }, { t: 'Azi + mâine', a: azi, b: SC.ziPlus(azi, 1), nr: 1 },
      { t: 'Următoarele 7 zile', a: azi, b: SC.ziPlus(azi, 6), nr: 1 }, { t: 'Ieri', a: SC.ziPlus(azi, -1), b: SC.ziPlus(azi, -1) },
      { t: 'Luna aceasta', a: luna, b: sfLuna }, { t: 'Luna trecută', a: sfTrecuta.slice(0, 8) + '01', b: sfTrecuta },
      { t: 'Restanțe', a: '', b: SC.ziPlus(azi, -1), nr: 1, rest: true }];
  }
  /* ce trebuie citit din arhiva pentru intervalul ales: [ms de la, ms pana la] dupa momentul introducerii comenzilor; null = nimic */
  function kpNevoie(a, b, azi) {
    if (!a || a >= SC.ziPlus(azi, -1)) return null;
    var sus = b && b < azi ? b : azi;
    return [SC.msDin(SC.ziPlus(a, -KP_ZILE_INAINTE), '00:00'), SC.msDin(SC.ziPlus(sus, 2), '00:00')];
  }
  /* bucatile din r care nu au fost citite inca */
  function kpLipsa(r) {
    var rest = [r.slice()];
    kpIst.acoperit.forEach(function (c) {
      var urm = [];
      rest.forEach(function (x) {
        if (c[1] <= x[0] || c[0] >= x[1]) { urm.push(x); return; }
        if (c[0] > x[0]) urm.push([x[0], c[0]]);
        if (c[1] < x[1]) urm.push([c[1], x[1]]);
      });
      rest = urm;
    });
    return rest;
  }
  function kpCiteste(lipsa, cheie) {
    kpIst.stare = 'incarc'; kpIst.cheie = cheie; kpIst.eroare = '';
    Promise.all(lipsa.map(function (x) { return SC.store.cautaGrupe(x[0], x[1]); })).then(function (rez) {
      var grupe = [].concat.apply([], rez);
      L.aplicaGrupe(grupe.filter(function (d) { return !SC.grupe[d.id] || (SC.grupe[d.id].upd || 0) <= (d.data.upd || 0); }));
      lipsa.forEach(function (x) { kpIst.acoperit.push(x); });
      kpIst.grupe += grupe.length; kpIst.stare = '';
    }, function (e) { kpIst.stare = 'eroare'; kpIst.eroare = (e && e.message) || String(e); }).then(function () { if (stare.tab === 'kpi') deseneazaKpi(); });
  }
  function deseneazaKpiPregatire(client) {
    var azi = SC.azi();
    if (!kpInt) kpInt = { a: azi, b: SC.ziPlus(azi, 1) };
    var a = kpInt.a, b = kpInt.b, gresit = !!(a && b && b < a);
    if (document.activeElement !== $('kpPa')) $('kpPa').value = a;
    if (document.activeElement !== $('kpPb')) $('kpPb').value = b;
    /* comenzile din status care se pregatesc: fara anulate; retururile si liniile „doar transport” nu se pregatesc */
    var toate = SC.comenzi.filter(function (o) { return o.st !== ST.ANU && (!client || o.cl === client); });
    function inInt(o, x, y) { var d = kpData(o); return !!d && (!x || d >= x) && (!y || d <= y); }
    $('kpCipuri').innerHTML = kpPresetari(azi).map(function (pz, i) {
      var deFacut = pz.nr ? toate.filter(function (o) { return !kGata(o) && inInt(o, pz.a, pz.b); }).length : null;
      return '<button type="button" class="cip' + (pz.a === a && pz.b === b ? ' activ' : '') + '" data-kp="' + i + '"' + (pz.nr ? ' title="' + (pz.rest ? 'Comenzi nepregătite cu livrarea înainte de azi' : 'Comenzi de pregătit') + '"' : '') + '>' + pz.t + (pz.nr ? '<b>' + deFacut + '</b>' : '') + '</button>';
    }).join('');
    if (gresit) { $('kpCorp').innerHTML = '<div class="card"><div class="nota rau">„Până la” este înaintea zilei de început. Corectează intervalul.</div></div>'; return; }

    /* zile mai vechi: comenzile pregatite atunci se citesc din arhiva, o singura data */
    var nevoie = kpNevoie(a, b, azi), lipsa = nevoie ? kpLipsa(nevoie) : [], cheie = a + '|' + b, nota = '';
    if (lipsa.length) {
      var zileArh = Math.round(lipsa.reduce(function (t, x) { return t + (x[1] - x[0]); }, 0) / 86400000);
      if (kpIst.stare === 'incarc') { $('kpCorp').innerHTML = '<div class="card"><div class="mic" role="status">Se citesc din arhivă comenzile din perioada aleasă…</div></div>'; return; }
      if (kpIst.stare === 'eroare' && kpIst.cheie === cheie) {
        nota = '<div class="nota rau">Comenzile mai vechi nu au putut fi citite din arhivă (' + esc(kpIst.eroare) + '). Cifrele de mai jos pot fi incomplete. <button type="button" class="legatura" data-kp-ist="1">Încearcă din nou</button></div>';
      } else if (zileArh > KP_AUTO_MAX && kpIst.cerut !== cheie) {
        nota = '<div class="nota atentie">Intervalul cere citirea din arhivă a comenzilor din aproximativ ' + zileArh + ' de zile (un document pentru fiecare 25 de comenzi). Până atunci, cifrele pentru zilele vechi pot fi incomplete. ' +
          '<button type="button" class="legatura" data-kp-ist="1">Citește din arhivă</button></div>';
      } else { kpCiteste(lipsa, cheie); $('kpCorp').innerHTML = '<div class="card"><div class="mic" role="status">Se citesc din arhivă comenzile din perioada aleasă…</div></div>'; return; }
    }

    var l = toate.filter(function (o) { return inInt(o, a, b); }), s = kpAduna(l), h = nota;
    var intText = a && b ? (a === b ? kpZiText(a) : SC.fmtDataLunga(a) + ' – ' + SC.fmtDataLunga(b)) : (a ? 'de la ' + SC.fmtDataLunga(a) : (b ? 'până la ' + SC.fmtDataLunga(b) : 'orice dată'));
    /* ce se pune in fata: zile trecute -> ce s-a pregatit; azi si viitor -> ce este de pregatit; fara inceput (restante) -> doar nepregatite */
    var trecut = !!a && !!b && b < azi, incepeInTrecut = !!a && a < azi, doarRam = !a;
    function tile(t, v, sub, cls) { return '<div class="kpi' + (cls ? ' ' + cls : '') + '"><div class="t">' + t + '</div><div class="v">' + v + '</div><div class="s">' + sub + '</div></div>'; }
    if (!l.length) {
      h += '<div class="card"><div class="mic">Nicio comandă cu livrarea ' + esc(intText) + (client ? ' pentru ' + esc(client) : '') + '.</div></div>';
    } else {
      var total = s.palGata + s.palRam, comenzi = function (n) { return n === 1 ? 'comandă' : 'comenzi'; };
      var pregatit = [
        tile('Paleți pregătiți', nr(s.palGata), '<b>' + s.gata + '</b> din ' + s.n + ' comenzi' + (s.self ? ' · Self-Pick <b>' + s.self + '</b>' : '') + (s.nRam ? ' · <b>' + proc(s.palGata, total) + '%</b> din paleți' +
          '<div class="bara-p" role="img" aria-label="Pregătit ' + proc(s.palGata, total) + '% din paleți"><i class="c-ok" style="width:' + proc(s.palGata, total) + '%"></i></div>' : '<br>paleți reali'), incepeInTrecut ? 'accent' : ''),
        (s.fppGata || s.pkGata ? tile('FPP / Pick pregătiți', nr(s.fppGata) + ' <small>/</small> ' + nr(s.pkGata), 'paleți full / paleți din picking') : ''),
        tile('Amprente și greutate', nr(s.amGata), 'amprente pe comenzile pregătite<br>greutate: <b>' + SC.fmtNum(Math.round(s.kgGata), 'int') + ' kg</b> · încărcate: <b>' + s.incGata + '</b> din ' + s.gata)
      ];
      var dePregatit = [
        tile(trecut ? 'Rămase nepregătite' : 'Paleți de pregătit', '~' + nr(s.palRam), '<b>' + s.nRam + '</b> ' + comenzi(s.nRam) + ': Inițiate <b>' + s.ini + '</b> · În lucru <b>' + s.luc + '</b><br>estimare, rotunjită în sus pe fiecare comandă' +
          (s.faraEst ? '<br><b>' + s.faraEst + '</b> fără paleți estimați (nu intră în total)' : ''), trecut || doarRam ? (s.nRam ? 'atentie' : '') : (incepeInTrecut ? '' : 'accent')),
        /* impartirea FPP / Pick apare doar daca este completata macar pe o comanda nepregatita (altfel ar arata un 0 / 0 inselator) */
        (s.fppRam || s.pkRam ? tile('FPP / Pick de pregătit', nr(s.fppRam) + ' <small>/</small> ' + nr(s.pkRam), 'paleți full / paleți din picking' + (s.faraRam ? '<br>fără FPP / Pick completat: <b>~' + nr(s.faraRam) + '</b>' : '')) : ''),
        tile('De pregătit, fără mașină', '~' + nr(s.palFaraMasina), '<b>' + s.faraMasina + '</b> ' + comenzi(s.faraMasina) + ' fără Nr AUTO<br>cu mașină planificată: <b>~' + nr(s.palRam - s.palFaraMasina) + '</b> paleți'),
        tile('Greutate de pregătit', SC.fmtNum(Math.round(s.kgRam), 'int') + ' <small>kg</small>', 'greutatea comenzilor încă nepregătite')
      ];
      var placute;
      if (doarRam) placute = dePregatit;
      else if (trecut) placute = pregatit.concat(s.nRam ? [dePregatit[0]] : []);
      else if (incepeInTrecut) placute = pregatit.concat(dePregatit);
      else placute = [dePregatit[0], pregatit[0]].concat(dePregatit.slice(1));
      /* restante: nepregatite, cu livrarea inaintea intervalului ales (doar cand intervalul incepe azi sau in viitor) */
      if (a && !incepeInTrecut) {
        var rest = toate.filter(function (o) { return !kGata(o) && inInt(o, '', SC.ziPlus(a, -1)); }), sr = kpAduna(rest);
        placute.push(tile('Restanțe', rest.length, rest.length ? '~<b>' + nr(sr.palRam) + '</b> paleți nepregătiți, cu livrarea înainte de ' + esc(SC.fmtDataLunga(a)) + '<br><button type="button" class="legatura" data-kp-rest="1">arată-le</button>' :
          'nicio comandă nepregătită cu livrarea înainte de ' + esc(SC.fmtDataLunga(a)), rest.length ? 'atentie' : ''));
      }
      h += '<div class="kpi-grila">' + placute.join('') + '</div>';
      /* pe zile de livrare + pe clienti */
      var peZi = {}, peCl = {};
      l.forEach(function (o) { var d = kpData(o); (peZi[d] = peZi[d] || []).push(o); (peCl[o.cl || '—'] = peCl[o.cl || '—'] || []).push(o); });
      var zile = Object.keys(peZi).sort(), sz = {}, maxZi = 1;
      zile.forEach(function (d) { sz[d] = kpAduna(peZi[d]); maxZi = Math.max(maxZi, sz[d].palGata + sz[d].palRam); });
      function sauLinie(v, pre) { return v ? (pre || '') + nr(v) : '—'; }
      var cuFpp = !!(s.fppGata || s.pkGata);      /* coloanele FPP / Pick apar doar daca exista valori */
      h += '<div class="kpi-doua"><div class="card"><h2>Pe zile de livrare</h2><div class="derulare-x"><table class="simplu"><tr><th>Livrare</th><th class="nr">Comenzi</th><th class="nr">Pregătite</th>' +
        '<th class="nr">Paleți pregătiți</th>' + (cuFpp ? '<th class="nr">FPP</th><th class="nr">Pick</th>' : '') + '<th class="nr">De pregătit</th><th>Pregătit / de pregătit</th><th class="nr">Fără mașină</th></tr>' +
        zile.map(function (d) {
          var k = sz[d];
          return '<tr class="clic" data-kp-zi="' + d + '" title="Arată doar ' + esc(kpZiText(d)) + '"><td><b>' + esc(kpZiText(d)) + '</b>' + (d === azi ? ' <span class="mic">azi</span>' : '') + '</td><td class="nr">' + k.n + '</td><td class="nr">' + k.gata + '</td>' +
            '<td class="nr"><b>' + nr(k.palGata) + '</b></td>' + (cuFpp ? '<td class="nr">' + sauLinie(k.fppGata) + '</td><td class="nr">' + sauLinie(k.pkGata) + '</td>' : '') + '<td class="nr">' + (k.palRam ? '<b>~' + nr(k.palRam) + '</b>' : '—') + '</td>' +
            '<td class="kp-bara"><div class="bara-p" role="img" aria-label="Pregătiți ' + k.palGata + ', de pregătit ' + k.palRam + ' paleți" title="pregătiți ' + nr(k.palGata) + ' · de pregătit ~' + nr(k.palRam) + '">' +
            (k.palGata ? '<i class="c-ok" style="width:' + (k.palGata * 100 / maxZi) + '%"></i>' : '') + (k.palRam ? '<i class="c-ram" style="width:' + (k.palRam * 100 / maxZi) + '%"></i>' : '') + '</div></td>' +
            '<td class="nr">' + sauLinie(k.palFaraMasina, '~') + '</td></tr>';
        }).join('') +
        '<tr><th>Total</th><th class="nr">' + s.n + '</th><th class="nr">' + s.gata + '</th><th class="nr">' + nr(s.palGata) + '</th>' + (cuFpp ? '<th class="nr">' + sauLinie(s.fppGata) + '</th><th class="nr">' + sauLinie(s.pkGata) + '</th>' : '') + '<th class="nr">' + sauLinie(s.palRam, '~') + '</th><th></th><th class="nr">' + sauLinie(s.palFaraMasina, '~') + '</th></tr></table></div>' +
        '<div class="legenda"><span style="--c:var(--ok)">paleți pregătiți (reali)</span><span style="--c:#4a7fe0">paleți de pregătit (estimați)</span></div></div>' +
        '<div class="card"><h2>Pe clienți</h2><div class="derulare-x"><table class="simplu"><tr><th>Client</th><th class="nr">Comenzi</th><th class="nr">Paleți pregătiți</th><th class="nr">De pregătit</th></tr>' +
        Object.keys(peCl).map(function (c) { return { c: c, k: kpAduna(peCl[c]) }; }).sort(function (x, y) { return (y.k.palGata + y.k.palRam) - (x.k.palGata + x.k.palRam); }).map(function (x) {
          return '<tr><td><b>' + esc(x.c) + '</b></td><td class="nr">' + x.k.n + '</td><td class="nr">' + nr(x.k.palGata) + '</td><td class="nr">' + (x.k.palRam ? '<b>~' + nr(x.k.palRam) + '</b> <span class="mic">(' + x.k.nRam + ')</span>' : '—') + '</td></tr>';
        }).join('') + '</table></div></div></div>';
    }
    /* ce nu are cum sa apara in niciun interval / de unde vin cifrele vechi */
    var faraData = toate.filter(function (o) { return !kGata(o) && !kpData(o); }).length, note = [];
    if (faraData) note.push('<b>' + faraData + '</b> ' + (faraData === 1 ? 'comandă nepregătită nu are' : 'comenzi nepregătite nu au') + ' dată de livrare, deci nu ' + (faraData === 1 ? 'apare' : 'apar') + ' în niciun interval.');
    if (nevoie && !lipsa.length) note.push('Zilele mai vechi sunt citite din arhivă (comenzile introduse cu cel mult ' + KP_ZILE_INAINTE + ' zile înainte de livrare)' + (kpIst.grupe ? '; de la deschiderea paginii s-au citit ' + kpIst.grupe + ' documente' : '') + '.');
    if (doarRam) note.push('Fără dată de început sunt arătate doar comenzile nepregătite.');
    if (note.length) h += '<div class="mic">' + note.join(' ') + '</div>';
    $('kpCorp').innerHTML = h;
  }
  function kpAlege(a, b) { kpInt = { a: a || '', b: b || '' }; deseneazaKpi(); }
  $('kpPa').onchange = function () { kpAlege(this.value, kpInt && kpInt.b && this.value && kpInt.b < this.value ? this.value : (kpInt ? kpInt.b : this.value)); };
  $('kpPb').onchange = function () { kpAlege(kpInt ? kpInt.a : this.value, this.value); };
  $('kpCipuri').addEventListener('click', function (e) { var c = e.target.closest('[data-kp]'); if (!c) return; var pz = kpPresetari(SC.azi())[+c.dataset.kp]; kpAlege(pz.a, pz.b); });
  $('kpCorp').addEventListener('click', function (e) {
    var z = e.target.closest('[data-kp-zi]');
    if (e.target.closest('[data-kp-rest]')) kpAlege('', SC.ziPlus(kpInt.a, -1));
    else if (e.target.closest('[data-kp-ist]')) { kpIst.cerut = kpInt.a + '|' + kpInt.b; kpIst.stare = ''; deseneazaKpi(); }
    else if (z) kpAlege(z.dataset.kpZi, z.dataset.kpZi);
  });

  function deseneazaKpi() {
    var azi = SC.azi(), client = $('kpiClient').value;
    var opt = '<option value="">Toți clienții</option>' + SC.config.clienti.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('');
    if ($('kpiClient').dataset.opt !== opt) { $('kpiClient').innerHTML = opt; $('kpiClient').dataset.opt = opt; $('kpiClient').value = client; }
    deseneazaKpiPregatire(client);
    var toate = toateCamioanele();
    if (client) {
      toate = toate.map(function (x) {
        var c = Object.assign({}, x);
        ['toate', 'deIncarcat', 'inLucru', 'incarcate', 'doarTransport', 'retururi'].forEach(function (k) { c[k] = x[k].filter(function (o) { return o.cl === client; }); });
        return c;
      }).filter(function (x) { return x.toate.length; });
    }
    var peZi = {}, neinc = 0;
    toate.forEach(function (x) {
      if (x.data) peZi[x.data] = (peZi[x.data] || 0) + 1;
      if (x.deIncarcat.length || x.inLucru.length) neinc++;
    });
    if (kpiZi == null) {
      /* la prima deschidere: azi daca are camioane, altfel prima zi viitoare cu camioane, altfel azi */
      var viitoare = Object.keys(peZi).filter(function (d) { return d >= azi; }).sort();
      kpiZi = peZi[azi] ? azi : (viitoare[0] || azi);
    }
    $('kpiData').value = kpiZi;
    $('kpiOra').textContent = 'actualizat ' + SC.oraAcum() + ' · se reface singur la fiecare modificare';
    var zile = Object.keys(peZi).filter(function (d) { return d >= SC.ziPlus(azi, -2); }).sort().slice(0, 9);
    if (kpiZi && zile.indexOf(kpiZi) < 0) { zile.push(kpiZi); zile.sort(); }
    $('kpiZile').innerHTML = zile.map(function (d) {
      return '<button type="button" class="cip' + (d === kpiZi ? ' activ' : '') + '" data-d="' + d + '">' + (d === azi ? 'Azi' : (d === SC.ziPlus(azi, 1) ? 'Mâine' : esc(SC.fmtDataLunga(d)))) + '<b>' + (peZi[d] || 0) + '</b></button>';
    }).join('') + '<button type="button" class="cip' + (kpiZi === '' ? ' activ' : '') + '" data-d="">Tot ce e neîncărcat<b>' + neinc + '</b></button>';

    var cam = kpiZi === '' ? toate.filter(function (x) { return x.deIncarcat.length || x.inLucru.length; }) : toate.filter(function (x) { return x.data === kpiZi; });
    var comenzi = [];
    cam.forEach(function (x) { x.k = kAduna(x.toate); x.stare = kStare(x); comenzi = comenzi.concat(x.toate); });
    var s = kAduna(comenzi), h = '';
    /* comenzile active care nu au inca un camion */
    var fara = SC.comenzi.filter(function (o) {
      return !o.ar && SC.esteActiva(o) && (!o.na || !SC.normNrAuto(o.na).replace(/0/g, '')) && (!client || o.cl === client);
    }), sf = kAduna(fara);
    var faraPanaLa = kpiZi ? fara.filter(function (o) { return o.dl && String(o.dl).slice(0, 10) <= kpiZi; }) : fara;

    if (!cam.length) {
      h += '<div class="card"><div class="mic">Niciun camion ' + (kpiZi ? 'cu data de încărcare ' + esc(SC.fmtDataLunga(kpiZi)) : 'neîncărcat') + (client ? ' pentru ' + esc(client) : '') +
        '. Data de încărcare vine din fișierul de transport (TMS): dacă ziua lipsește, importă fișierul la zi din tabul Încărcări.</div></div>';
    } else {
      var st = [0, 0, 0, 0, 0];
      cam.forEach(function (x) { st[x.stare[2]]++; });
      var durate = [];
      cam.forEach(function (x) {
        var info = L.infoCamion(x), sf2 = '';
        x.incarcate.forEach(function (o) { if (o.di && String(o.di) > sf2) sf2 = String(o.di); });
        x.inceput = info && info.bt ? info.bt : ''; x.sfarsit = x.stare[2] === 4 ? sf2 : '';
        x.durata = x.inceput && x.sfarsit.length > 10 && x.sfarsit >= x.inceput ? Math.round((SC.msDin(x.sfarsit.slice(0, 10), x.sfarsit.slice(11, 16)) - SC.msDin(x.inceput.slice(0, 10), x.inceput.slice(11, 16))) / 60000) : null;
        if (x.durata != null) durate.push(x.durata);
      });
      var medie = durate.length ? Math.round(durate.reduce(function (a, b) { return a + b; }, 0) / durate.length) : null;
      var abatere = s.estSum ? Math.round((s.realSum - s.estSum) * 1000 / s.estSum) / 10 : null;
      function tile(t, v, sub, accent) { return '<div class="kpi' + (accent ? ' accent' : '') + '"><div class="t">' + t + '</div><div class="v">' + v + '</div><div class="s">' + sub + '</div></div>'; }
      h += '<div class="kpi-grila">' +
        tile('Paleți de încărcat', nr(s.palRam), '<b>' + nr(s.palDeInc) + '</b> reali, gata de încărcat · <b>~' + nr(s.palEst) + '</b> estimați, în pregătire<br>deja încărcați: <b>' + nr(s.palInc) + '</b> din ' + nr(s.pal), true) +
        tile('FPP (paleți full)', nr(s.fppRam), 'de încărcat · total pe zi: <b>' + nr(s.fpp) + '</b>') +
        tile('Pick (paleți din picking)', nr(s.pkRam), 'de încărcat · făcuți: <b>' + nr(s.pkFacut) + '</b> · de făcut: <b>' + nr(s.pkDeFacut) + '</b>') +
        tile('Camioane', cam.length, 'încărcate <b>' + st[4] + '</b> · în încărcare <b>' + st[3] + '</b> · gata <b>' + st[2] + '</b><br>în pregătire <b>' + st[1] + '</b> · în așteptare <b>' + st[0] + '</b>') +
        tile('Comenzi', s.n, [ST.INI, ST.LUC, ST.TER, ST.SELF].filter(function (k) { return s.st[k]; }).map(function (k) { return esc(k) + ' <b>' + s.st[k] + '</b>'; }).join(' · ') +
          (s.nExtra ? '<br>doar din transport <b>' + s.nExtra + '</b>' : '')) +
        tile('Greutate de încărcat', SC.fmtNum(Math.round(s.kgRam), 'int') + ' <small>kg</small>', 'total pe zi: <b>' + SC.fmtNum(Math.round(s.kg), 'int') + ' kg</b> · amprente (pregătite): <b>' + nr(s.am) + '</b>') +
        tile('Durată medie de încărcare', medie == null ? '—' : medie + ' <small>min</small>', durate.length ? 'pe ' + durate.length + (durate.length === 1 ? ' camion încărcat' : ' camioane încărcate') + ' · de la tipărirea borderoului la confirmare' : 'apare după primul camion încărcat cu borderou tipărit') +
        tile('Estimare față de real', abatere == null ? '—' : (abatere > 0 ? '+' : '') + String(abatere).replace('.', ',') + ' <small>%</small>', s.nEst ? 'estimat <b>' + SC.fmtNum(s.estSum, 'num') + '</b> · real <b>' + nr(s.realSum) + '</b> paleți, pe ' + s.nEst + ' comenzi pregătite' : 'apare după prima comandă pregătită') +
        '</div>';
      /* din ce sunt facuti paletii ramasi + cat s-a pregatit / incarcat */
      var totRam = s.fppRam + s.pkRam + s.faraRam + s.extraRam || 1;
      function seg(cls, v) { return v ? '<i class="' + cls + '" style="width:' + (v * 100 / totRam) + '%"></i>' : ''; }
      function linie(nume, a, b, cls) { return '<div>' + nume + '</div><div class="bara-p" role="img" aria-label="' + nume + ': ' + proc(a, b) + '%"><i class="' + cls + '" style="width:' + proc(a, b) + '%"></i></div><div class="dr"><b>' + proc(a, b) + '%</b> · ' + nr(a) + ' / ' + nr(b) + '</div>'; }
      h += '<div class="kpi-doua"><div class="card"><h2>Paleții de încărcat, pe tipuri</h2>' +
        '<div class="bara-p" style="height:18px" role="img" aria-label="FPP ' + s.fppRam + ', Pick ' + s.pkRam + ', fără FPP/Pick ' + s.faraRam + ', doar din transport ' + s.extraRam + '">' + seg('c-fpp', s.fppRam) + seg('c-pick', s.pkRam) + seg('c-fara', s.faraRam) + seg('c-extra', s.extraRam) + '</div>' +
        '<div class="legenda"><span style="--c:var(--navy)">FPP <b>' + nr(s.fppRam) + '</b></span><span style="--c:#e08a00">Pick <b>' + nr(s.pkRam) + '</b></span>' +
        '<span style="--c:#9aa3b5">fără FPP / Pick completat <b>' + nr(s.faraRam) + '</b></span><span style="--c:#7b61c9">doar din transport <b>' + nr(s.extraRam) + '</b></span></div>' +
        '<div class="progres" style="margin-top:14px">' + linie('Pregătire (paleți)', s.palReali, s.pal, 'c-ok') + linie('Picking (paleți)', s.pkFacut, s.pk, 'c-pick') + linie('Încărcare (paleți)', s.palInc, s.pal, 'c-fpp') + linie('Camioane încărcate', st[4], cam.length, 'c-fpp') + '</div></div>';
      /* pe clienti */
      var peCl = {};
      comenzi.forEach(function (o) { (peCl[o.cl || '—'] = peCl[o.cl || '—'] || []).push(o); });
      h += '<div class="card"><h2>Pe clienți</h2><div class="derulare-x"><table class="simplu"><tr><th>Client</th><th class="nr">Comenzi</th><th class="nr">Paleți</th><th class="nr">FPP</th><th class="nr">Pick</th><th class="nr">Încărcați</th></tr>' +
        Object.keys(peCl).sort(function (a, b) { return kAduna(peCl[b]).pal - kAduna(peCl[a]).pal; }).map(function (c) {
          var k = kAduna(peCl[c]);
          return '<tr><td><b>' + esc(c) + '</b></td><td class="nr">' + k.n + '</td><td class="nr">' + nr(k.pal) + '</td><td class="nr">' + nr(k.fpp) + '</td><td class="nr">' + nr(k.pk) + '</td><td class="nr">' + nr(k.palInc) + '</td></tr>';
        }).join('') + '</table></div></div></div>';
      /* fiecare camion */
      var maxPal = Math.max.apply(null, cam.map(function (x) { return x.k.pal; }).concat([1]));
      cam.sort(function (a, b) { return a.stare[2] - b.stare[2] || (a.data || '9').localeCompare(b.data || '9') || b.k.pal - a.k.pal; });
      kpiCamioane = cam;
      function ora(dt) { return dt ? (dt.slice(0, 10) === azi ? dt.slice(11, 16) : SC.fmtDT(dt)) : ''; }
      h += '<div class="card"><h2>Camioane <span class="inc-sub">' + cam.length + (cam.length === 1 ? ' camion' : ' camioane') + ' · ' + nr(s.pal) + ' paleți</span></h2>' +
        '<p>Paleții sunt reali la comenzile pregătite și estimați (rotunjiți în sus, porțiunea hașurată) la cele nepregătite. Apasă pe un camion ca să îl deschizi în Încărcări.</p>' +
        '<div class="derulare-x"><table class="simplu"><tr>' + (kpiZi === '' ? '<th>Data</th>' : '') + '<th>Nr AUTO</th><th>Nr transport</th><th>Stare</th><th class="nr">Comenzi gata</th><th class="nr">Paleți</th><th style="width:16%"></th>' +
        '<th class="nr">FPP</th><th class="nr">Pick</th><th class="nr">Amprente</th><th class="nr">Greutate</th><th>Început încărcare</th><th>Încărcat</th></tr>' +
        cam.map(function (x, i) {
          var k = x.k;
          return '<tr class="clic" data-cam="' + i + '">' + (kpiZi === '' ? '<td>' + esc(x.data ? SC.fmtDataLunga(x.data) : '—') + '</td>' : '') + '<td><b>' + esc(x.na || '—') + '</b></td><td>' + esc(x.nt) + '</td><td><span class="eticheta ' + x.stare[1] + '">' + x.stare[0] + '</span></td>' +
            '<td class="nr">' + k.gata + ' / ' + k.n + '</td><td class="nr"><b>' + nr(k.pal) + '</b>' + (k.palEst ? ' <span class="mic">(~' + nr(k.palEst) + ' est.)</span>' : '') + '</td>' +
            '<td><div class="bara-p" role="img" aria-label="' + k.palReali + ' reali, ' + k.palEst + ' estimați"><i class="c-fpp" style="width:' + (k.palReali * 100 / maxPal) + '%"></i><i class="c-est" style="width:' + (k.palEst * 100 / maxPal) + '%"></i></div></td>' +
            '<td class="nr">' + nr(k.fpp) + '</td><td class="nr">' + nr(k.pk) + '</td><td class="nr">' + (k.am ? nr(k.am) : '') + '</td><td class="nr">' + SC.fmtNum(Math.round(k.kg), 'int') + '</td>' +
            '<td>' + esc(ora(x.inceput)) + '</td><td>' + (x.sfarsit ? esc(ora(x.sfarsit)) + (x.durata != null ? ' <span class="mic">(' + x.durata + ' min)</span>' : '') : '') + '</td></tr>';
        }).join('') +
        '<tr><th colspan="' + (kpiZi === '' ? 4 : 3) + '">Total</th><th class="nr">' + s.gata + ' / ' + s.n + '</th><th class="nr">' + nr(s.pal) + '</th><th></th><th class="nr">' + nr(s.fpp) + '</th><th class="nr">' + nr(s.pk) + '</th><th class="nr">' + nr(s.am) + '</th><th class="nr">' + SC.fmtNum(Math.round(s.kg), 'int') + '</th><th colspan="2"></th></tr></table></div></div>';
    }
    h += '<div class="card"><h2>Comenzi active fără camion alocat</h2><p>Comenzi deschise sau terminate și neîncărcate care nu au încă Nr AUTO, deci nu apar la niciun camion.</p>' +
      (fara.length ? '<div class="kpi-grila">' +
        '<div class="kpi"><div class="t">Comenzi</div><div class="v">' + sf.n + '</div><div class="s">' + [ST.INI, ST.LUC, ST.TER].filter(function (k) { return sf.st[k]; }).map(function (k) { return esc(k) + ' <b>' + sf.st[k] + '</b>'; }).join(' · ') + '</div></div>' +
        '<div class="kpi"><div class="t">Paleți</div><div class="v">' + nr(sf.pal) + '</div><div class="s">reali <b>' + nr(sf.palReali) + '</b> · estimați <b>~' + nr(sf.palEst) + '</b></div></div>' +
        '<div class="kpi"><div class="t">FPP / Pick</div><div class="v">' + nr(sf.fpp) + ' <small>/</small> ' + nr(sf.pk) + '</div><div class="s">picking de făcut: <b>' + nr(sf.pkDeFacut) + '</b></div></div>' +
        (kpiZi ? '<div class="kpi"><div class="t">Cu livrare până la ' + esc(SC.fmtData(kpiZi)) + '</div><div class="v">' + faraPanaLa.length + '</div><div class="s"><b>' + nr(kAduna(faraPanaLa).pal) + '</b> paleți · au nevoie de camion</div></div>' : '') +
        '</div>' : '<div class="mic">Toate comenzile active au camion alocat.</div>') + '</div>' +
      (function () {
        var r = SC.extra.filter(function (x) { return x.retur && (kpiZi === '' ? x.inc !== 'DA' : String(x.dtr || '').slice(0, 10) === kpiZi) && (!client || x.cl === client); });
        return r.length ? '<div class="card"><h2>Retururi <span class="inc-sub">' + r.length + (r.length === 1 ? ' linie' : ' linii') + ' · ' + nr(suma(r, 'pr')) + ' paleți în TMS</span></h2>' +
          '<p>Linii din TMS cu „Ridicare” sau „Preluare” în referință: marfă care se ridică de la client. Nu se încarcă și nu intră în niciuna dintre cifrele de mai sus.</p>' +
          '<div class="derulare-x"><table class="simplu"><tr><th>Nr AUTO</th><th>Nr transport</th><th>Client</th><th>Referință</th><th>Localitate</th><th class="nr">Paleți în TMS</th></tr>' +
          r.map(function (x) { return '<tr><td><b>' + esc(x.na || '') + '</b></td><td>' + esc(x.nt || '') + '</td><td>' + esc(x.cl || '') + '</td><td>' + esc(x.ref) + '</td><td>' + esc(x.or || '') + '</td><td class="nr">' + SC.fmtNum(x.pr, 'int') + '</td></tr>'; }).join('') +
          '</table></div></div>' : '';
      })() +
      '<div class="mic">Cifrele se calculează din comenzile active și din cele recente aflate deja în aplicație; pentru zile mai vechi de câteva zile, camioanele deja încărcate pot lipsi.</div>';
    $('kpiCorp').innerHTML = h;
  }
  function kpiMuta(zile) { kpiZi = SC.ziPlus(kpiZi || SC.azi(), zile); deseneazaKpi(); }
  $('kpiPrev').onclick = function () { kpiMuta(-1); };
  $('kpiNext').onclick = function () { kpiMuta(1); };
  $('kpiData').onchange = function () { if (this.value) { kpiZi = this.value; deseneazaKpi(); } };
  $('kpiClient').onchange = deseneazaKpi;
  $('kpiZile').addEventListener('click', function (e) { var b = e.target.closest('.cip'); if (!b) return; kpiZi = b.dataset.d; deseneazaKpi(); });
  $('kpiCorp').addEventListener('click', function (e) {
    var r = e.target.closest('[data-cam]'); if (!r) return;
    var x = kpiCamioane[+r.dataset.cam]; if (!x) return;
    $('incCauta').value = x.nt || x.na; Object.keys(incDate).forEach(function (d) { delete incDate[d]; }); arataTab('incarcari');
  });

  /* ================= CMR ================= */
  /* Scrisoarea de transport international, dupa formularul din C.M.R_DSV.xlsm: 4 copii pe A4 (negru, rosu, albastru, verde). */
  var CMR_COPII = [['c1', '1', 'Copie pentru expeditor', 'Copy for sender'], ['c2', '2', 'Copie pentru destinatar', 'Copy for consignee'],
    ['c3', '3', 'Copie pentru operator', 'Copy for carrier'], ['c4', '4', 'Copie pentru', 'Copy for']];
  var CMR_LUNI = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var CMR_IMPLICIT = {
    loc: 'Bolintin Deal Romania', st: 'Romania', so: 'Bolintin Deal', kg: 20,
    cl: { KANDIA: { exp: 'Kandia Dulce\nSoseaua Viilor, Nr. 20\n050156, Bucuresti, RO', marfa: 'Produse zaharoase / Sugar products.', instr: 'Temperatura controlata 16°C ~ 20°C\nCounted temperature 16°C ~ 20°C' } }
  };
  var CMR_MAX = 9;
  function cmrText(v) { return esc(v == null ? '' : String(v)).replace(/\n/g, '<br>'); }
  function cmrData(zi, scurt) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(zi || ''))) return '';
    var a = zi.slice(0, 4), l = CMR_LUNI[+zi.slice(5, 7) - 1], z = +zi.slice(8, 10);
    return scurt ? z + '/' + l + '/' + a.slice(2) : z + '-' + l + '-' + a;
  }
  function cmrValori(c) {
    var pal = c.arataPal && SC.esteNum(c.pal) ? c.pal : null;
    return {
      exp: cmrText(c.exp), dest: cmrText(c.de), adresa: cmrText(c.ad), oras: cmrText(c.or), tara: cmrText(c.ta),
      car1: cmrText(c.car[0]), car2: cmrText(c.car[1]), car3: cmrText(c.car[2]),
      loc: cmrText(c.loc), data1: cmrData(c.data), data2: cmrData(c.data, true),
      rez1: cmrText(c.uit ? 'COD UIT: ' + c.uit : ''), rez2: cmrText(c.rez[0]), rez3: cmrText(c.rez[1]), rez4: cmrText(c.rez[2]),
      facturi: cmrText((c.fa || []).filter(Boolean).map(function (f) { return f + ';'; }).join('')), doc2: cmrText(c.doc2),
      marfa: cmrText(c.marfa), cart: SC.esteNum(c.cart) ? String(c.cart) : '', greutate: SC.esteNum(c.g) ? c.g.toFixed(3) : '',
      pal: pal == null ? '' : String(pal), palkg: pal == null ? '' : String(SC.rotunjeste(pal * (SC.esteNum(c.kg) ? c.kg : 0))),
      instr: cmrText(c.instr), instr2: cmrText(c.instr2), stab_tara: cmrText(c.st), stab_oras: cmrText(c.so)
    };
  }
  function htmlCmr(c) {
    var v = cmrValori(c);
    return CMR_COPII.map(function (k) {
      v.nr = k[1]; v.copie_ro = k[2]; v.copie_en = k[3];
      return '<div class="cmr-pag ' + k[0] + '">' + SC.CMR_SABLON.replace(/\{\{(\w+)\}\}/g, function (_, cheie) { return v[cheie] == null ? '' : v[cheie]; }) + '</div>';
    }).join('');
  }
  /* textele scrise de operator care nu incap in caseta lor se micsoreaza pana incap */
  function potrivesteCmr(rad) {
    Array.prototype.forEach.call(rad.querySelectorAll('td.dat'), function (td) {
      var m = parseFloat(td.style.fontSize) || 7, pasi = 0;
      while (pasi++ < 14 && m > 3.2 && (td.scrollWidth > td.clientWidth + 1 || td.scrollHeight > td.clientHeight + 1)) { m *= 0.92; td.style.fontSize = m.toFixed(2) + 'pt'; }
    });
  }
  function tiparesteCmr(c) {
    $('cmrPrint').innerHTML = htmlCmr(c);
    document.body.classList.add('tip-cmr');
    potrivesteCmr($('cmrPrint'));
    window.print();
  }
  window.addEventListener('afterprint', function () { document.body.classList.remove('tip-cmr'); $('cmrPrint').innerHTML = ''; });
  function cmrNou(l, setari) {
    var o = l[0], s = setari || {}, cheie = L.cheieClientCmr(o.cl);
    var pc = (s.cl && s.cl[cheie]) || CMR_IMPLICIT.cl[cheie] || {};
    var remorci = l.map(function (x) { return x.re; }).filter(Boolean), auto = l.map(function (x) { return x.na; }).filter(Boolean);
    return {
      cl: o.cl, n: l.map(function (x) { return x.n; }), nc: l.map(function (x) { return String(x.nc); }), fa: l.map(function () { return ''; }),
      rand: l.map(function (x) { return { g: SC.esteNum(x.g) ? x.g : null, ca: SC.esteNum(x.ca) ? x.ca : null, pr: SC.esteNum(x.pr) ? x.pr : null }; }),
      de: o.de || '', ad: o.ad || '', or: o.or || '', ta: o.ju || '',
      exp: pc.exp || '', marfa: pc.marfa || '', instr: pc.instr || '', instr2: '',
      loc: s.loc || CMR_IMPLICIT.loc, st: s.st || CMR_IMPLICIT.st, so: s.so || CMR_IMPLICIT.so, kg: SC.esteNum(s.kg) ? s.kg : CMR_IMPLICIT.kg,
      data: SC.azi(), car: ['', auto[0] || '', remorci[0] || ''], uit: '', rez: ['', '', ''], doc2: '',
      cart: SC.rotunjeste(suma(l, 'ca')), g: SC.rotunjeste(suma(l, 'g')), pal: suma(l, 'pr'), arataPal: true
    };
  }
  function cmrDinBifate() {
    if (!poate()) return;
    var l = comenziBifate().sort(function (a, b) { return a.n - b.n; });
    if (!l.length) { toast('Bifează comenzile care merg pe același CMR.', 'rau'); return; }
    if (l.length > CMR_MAX) { toast('Pe un CMR încap cel mult ' + CMR_MAX + ' comenzi. Ai bifat ' + l.length + '.', 'rau'); return; }
    var cl = SC.normText(l[0].cl), de = SC.normText(l[0].de);
    if (l.some(function (o) { return SC.normText(o.cl) !== cl || SC.normText(o.de) !== de; })) { toast('Un CMR are un singur destinatar: bifează doar comenzi cu același client și același destinatar.', 'rau'); return; }
    if (l.some(function (o) { return o.st === ST.ANU; })) { toast('Ai bifat și comenzi anulate. Debifează-le.', 'rau'); return; }
    L.citesteCmr().then(function (r) { return r; }, function () { return { lista: [], setari: {}, faraAcces: true }; }).then(function (r) {
      var cheie = l.map(function (o) { return o.n; }).join(',');
      var vechi = r.lista.filter(function (c) { return (c.n || []).join(',') === cheie; })[0];
      deschideCmr(vechi || cmrNou(l, r.setari), l, r.faraAcces);
    });
  }
  function deschideCmr(c, comenzi, faraAcces) {
    var salvat = !!c.id;
    function camp(id, eticheta, val, cls, extra) { return '<label class="camp ' + (cls || '') + '"><span>' + eticheta + '</span><input type="text" id="' + id + '" value="' + esc(val == null ? '' : val) + '"' + (extra || '') + '></label>'; }
    function numar(v) { return SC.esteNum(v) ? String(v).replace('.', ',') : ''; }
    /* ---- greutatea de pe CMR se scrie cu 3 zecimale ----
       Avertismentul se da dupa textul din campul „Greutate brută”, unde se vad si zerourile de la coada (556,590).
       Intr-un numar zerourile nu se pastreaza, asa ca se tine minte cu cate zecimale a fost scrisa greutatea (c.gz),
       iar suma unor greutati care au toate 3 zecimale se arata tot cu 3. */
    var randuri = c.nc.map(function (nc, i) { var x = (c.rand || [])[i] || {}; return { nc: nc, g: x.g, z: SC.zecimale(x.g) }; });
    var randFara = randuri.filter(function (x) { return x.z != null && x.z !== 3; });
    function greutateText() {
      if (!SC.esteNum(c.g)) return '';
      var cuTrei = c.gz === 3 || (!salvat && randuri.length > 0 && randuri.every(function (x) { return x.z === 3; }));
      return (cuTrei && SC.zecimale(c.g) <= 3 ? c.g.toFixed(3) : String(c.g)).replace('.', ',');
    }
    function zecCuvinte(z) { return z === 0 ? 'nu are zecimale' : 'are ' + z + (z === 1 ? ' zecimală' : ' zecimale') + ', nu 3'; }
    function zecStare(rad) {
      var t = rad.querySelector('#cmG').value.trim(), z = SC.zecimale(t);
      return { text: t, z: z, lipsa: z != null && z !== 3 };
    }
    function zecArata(rad) {
      var s = zecStare(rad), nota = rad.querySelector('#cmZec'), buc = [];
      var lista = randFara.map(function (x) { return x.nc + ' (' + SC.fmtKg(x.g) + ' kg)'; }).join(', ');
      if (s.lipsa) {
        buc.push('<b>Greutatea brută „' + esc(s.text) + '” ' + zecCuvinte(s.z) + '.</b> Verifică greutatea cu documentul și scrie-o cu 3 zecimale' +
          (s.z < 3 ? ' (de exemplu ' + esc(SC.parseNum(s.text).toFixed(3).replace('.', ',')) + ', dacă aceasta este greutatea exactă)' : '') + '.');
        if (randFara.length) buc.push((randFara.length === 1 ? 'Comanda cu greutatea fără 3 zecimale: ' : 'Comenzi cu greutatea fără 3 zecimale: ') + esc(lista) + '.');
      } else if (randFara.length && randuri.length > 1) {
        buc.push('Atenție: în comenzi, greutatea nu are 3 zecimale la ' + esc(lista) + '. Verifică dacă totalul este cel exact.');
      }
      nota.innerHTML = buc.join('<br>'); nota.hidden = !buc.length;
      rad.querySelector('#cmG').classList.toggle('zec-lipsa', s.lipsa);
    }
    function zecConfirma(rad) {
      var s = zecStare(rad);
      if (!s.lipsa) return Promise.resolve(true);
      return confirma('Greutatea brută „' + s.text + '” ' + zecCuvinte(s.z) + '.\nPe CMR se tipărește ' + SC.parseNum(s.text).toFixed(3) + ' kg.\n\n' +
        'Verifică greutatea cu documentul. Continui cu această greutate?', { titlu: 'Greutate fără 3 zecimale', da: 'Continuă oricum', nu: 'Corectez' }).then(function (ok) {
        if (!ok) { var el = rad.querySelector('#cmG'); el.focus(); el.select(); }
        return ok;
      });
    }
    var nepregatite = (comenzi || []).filter(function (o) { return o.st !== ST.TER && o.st !== ST.SELF; });
    var html = (salvat ? '<div class="nota">CMR salvat la ' + esc(SC.fmtDT(SC.ymd(new Date(c.t)) + ' ' + SC.p2(new Date(c.t).getHours()) + ':' + SC.p2(new Date(c.t).getMinutes()))) + ' de ' + esc(c.u || '') +
        (c.uu ? ', modificat ultima dată de ' + esc(c.uu) : '') + '. Valorile de mai jos sunt cele salvate.</div>' : '') +
      (faraAcces ? '<div class="nota atentie">CMR-urile nu pot fi salvate încă: publică regulile din firestore.rules în Firebase. Până atunci poți completa și tipări.</div>' : '') +
      (nepregatite.length ? '<div class="nota atentie">' + nepregatite.length + (nepregatite.length === 1 ? ' comandă nu este' : ' comenzi nu sunt') + ' încă Terminata: paleții reali pot lipsi (' + esc(nepregatite.map(function (o) { return o.nc; }).join(', ')) + ').</div>' : '') +
      '<div class="cmr-form">' +
      '<h4>1 · Expeditor</h4><label class="camp l4"><span>Expeditor (nume, adresă, țară) — se ține minte pentru clientul ' + esc(c.cl) + '</span><textarea id="cmExp" rows="3">' + esc(c.exp) + '</textarea></label>' +
      '<h4>2–3 · Destinatar și loc de livrare</h4>' + camp('cmDe', 'Destinatar', c.de, 'l2') + camp('cmAd', 'Adresă', c.ad, 'l2') + camp('cmOr', 'Oraș', c.or, 'l2') + camp('cmTa', 'Țară', c.ta, 'l2') +
      '<h4>4 și 21 · Preluarea mărfii</h4>' + camp('cmLoc', 'Locul preluării', c.loc, 'l2') + '<label class="camp"><span>Data</span><input type="date" id="cmData" value="' + esc(c.data || '') + '"></label><span></span>' +
      camp('cmSt', 'Întocmit în (țara)', c.st) + camp('cmSo', 'Întocmit în (localitatea)', c.so) +
      '<h4>5 · Documente atașate</h4><div class="l4 derulare-x"><table class="simplu"><tr><th>Nr. Comandă</th><th class="nr">Greutate</th><th class="nr">Cartoane</th><th class="nr">Paleți reali</th><th>Factură (Invoice)</th></tr>' +
      c.nc.map(function (nc, i) {
        var x = (c.rand || [])[i] || {};
        var fara = randuri[i].z != null && randuri[i].z !== 3;
        return '<tr><td><b>' + esc(nc) + '</b></td><td class="nr' + (fara ? ' zec-lipsa" title="Greutatea comenzii nu are 3 zecimale' : '') + '">' +
          (fara ? '<span aria-hidden="true">⚠ </span>' : '') + SC.fmtKg(x.g) + '</td><td class="nr">' + SC.fmtNum(x.ca, 'int') + '</td><td class="nr">' + SC.fmtNum(x.pr, 'int') +
          '</td><td><input type="text" data-fa="' + i + '" value="' + esc((c.fa || [])[i] || '') + '" aria-label="Factura pentru comanda ' + esc(nc) + '"></td></tr>';
      }).join('') + '</table></div>' + camp('cmDoc2', 'Alte documente (al doilea rând, ex. „Factura : 1900050959”)', c.doc2, 'l4') +
      '<h4>6–11 · Marfa</h4>' + camp('cmMarfa', 'Natura mărfii — se ține minte pentru client', c.marfa, 'l4') +
      camp('cmCart', 'Cartoane (CAR.)', numar(c.cart), '', ' inputmode="numeric"') + camp('cmG', 'Greutate brută (kg)', greutateText(), '', ' inputmode="decimal"') +
      camp('cmPal', 'Paleți (BUC.)', numar(c.pal), '', ' inputmode="numeric"') + camp('cmKg', 'Kg pe palet', numar(c.kg), '', ' inputmode="decimal"') +
      '<div class="nota atentie l4" id="cmZec" role="status" hidden></div>' +
      '<label class="bifa l4"><input type="checkbox" id="cmArataPal"' + (c.arataPal ? ' checked' : '') + '> <span>Paleții apar pe CMR (debifează la clienții cu vamă)</span></label>' +
      '<h4>16 · Transportator</h4>' + camp('cmCar1', 'Rândul 1 (nume)', c.car[0], 'l2') + camp('cmCar2', 'Rândul 2 (nr. auto)', c.car[1]) + camp('cmCar3', 'Rândul 3 (remorcă)', c.car[2]) +
      '<h4>18 · Rezervările și observațiile transportatorului</h4>' + camp('cmUit', 'Cod UIT (se tipărește „COD UIT: …”)', c.uit, 'l2') + camp('cmRez1', 'Alte mențiuni', c.rez[0], 'l2') + camp('cmRez2', 'Alte mențiuni', c.rez[1], 'l2') + camp('cmRez3', 'Alte mențiuni', c.rez[2], 'l2') +
      '<h4>13 · Instrucțiunile expeditorului</h4><label class="camp l2"><span>Instrucțiuni — se țin minte pentru client</span><textarea id="cmInstr" rows="2">' + esc(c.instr) + '</textarea></label>' +
      '<label class="camp l2"><span>Instrucțiuni suplimentare (doar pentru acest CMR)</span><textarea id="cmInstr2" rows="2">' + esc(c.instr2) + '</textarea></label>' +
      '</div>';
    function citeste(rad) {
      function t(id) { return rad.querySelector('#' + id).value.trim(); }
      function nr(id, nume) { var v = t(id); if (v === '') return null; var x = SC.parseNum(v); if (x == null || x < 0) { toast(nume + ': „' + v + '” nu este un număr valid.', 'rau'); return undefined; } return x; }
      var x = JSON.parse(JSON.stringify(c));
      x.exp = rad.querySelector('#cmExp').value.trim(); x.de = t('cmDe'); x.ad = t('cmAd'); x.or = t('cmOr'); x.ta = t('cmTa');
      x.loc = t('cmLoc'); x.data = rad.querySelector('#cmData').value; x.st = t('cmSt'); x.so = t('cmSo');
      x.fa = c.nc.map(function (_, i) { return rad.querySelector('[data-fa="' + i + '"]').value.trim(); });
      x.doc2 = t('cmDoc2'); x.marfa = t('cmMarfa');
      x.cart = nr('cmCart', 'Cartoane'); x.g = nr('cmG', 'Greutate'); x.pal = nr('cmPal', 'Paleți'); x.kg = nr('cmKg', 'Kg pe palet');
      if (x.cart === undefined || x.g === undefined || x.pal === undefined || x.kg === undefined) return null;
      if (x.g != null) x.gz = SC.zecimale(t('cmG')); else delete x.gz;
      x.arataPal = rad.querySelector('#cmArataPal').checked;
      x.car = [t('cmCar1'), t('cmCar2'), t('cmCar3')]; x.uit = t('cmUit').replace(/^cod\s*uit\s*:?\s*/i, ''); x.rez = [t('cmRez1'), t('cmRez2'), t('cmRez3')];
      x.instr = rad.querySelector('#cmInstr').value.trim(); x.instr2 = rad.querySelector('#cmInstr2').value.trim();
      if (!x.de) { toast('Completează destinatarul.', 'rau'); return null; }
      if (!x.data) { toast('Completează data.', 'rau'); return null; }
      return x;
    }
    function salveaza(rad, apoi) {
      var x = citeste(rad); if (!x) return false;
      return zecConfirma(rad).then(function (ok) {
        if (!ok) return false;
        return L.salveazaCmr(x).then(function (s) { c = s; salvat = true; toast('CMR salvat: ' + s.de + ' (' + s.nc.join(', ') + ').', 'bun'); if (apoi) apoi(s); return apoi ? null : false; }, function (e) {
          /* tiparirea nu se blocheaza daca salvarea nu merge (ex. regulile Firebase nepublicate) */
          if (!apoi) throw e;
          toast('CMR-ul nu a putut fi salvat (' + (e && e.message ? e.message : 'eroare') + '). Îl tipăresc oricum.', 'rau'); apoi(x); return null;
        });
      });
    }
    modal({
      titlu: 'CMR — ' + c.cl + ' → ' + (c.de || '') + ' · ' + nCom(c.nc.length), lat: true, html: html,
      laDeschidere: function (rad) { rad.querySelector('#cmG').addEventListener('input', function () { zecArata(rad); }); zecArata(rad); },
      butoane: (salvat && poate() ? [{ t: 'Șterge CMR', fn: function () {
        return confirma('Ștergi CMR-ul salvat pentru ' + c.de + ' (' + c.nc.join(', ') + ')?\nComenzile nu sunt afectate.').then(function (ok) {
          if (!ok) return false;
          return L.stergeCmr(c).then(function () { toast('CMR șters.', 'bun'); return null; });
        });
      } }] : []).concat([{ t: 'Renunță', v: null }, { t: 'Salvează', fn: function (rad) { return salveaza(rad, null); } },
      /* un singur buton: salveaza, deschide emailul pregatit pentru clientul CMR-ului, apoi fereastra de tiparire */
      { t: 'Salvează, tipărește și email', cls: 'pri', fn: function (rad) { return salveaza(rad, function (s) { emailCmr(s); setTimeout(function () { tiparesteCmr(s); }, 400); }); } }])
    });
  }
  /* ---- CMR pe email: adrese diferite pentru fiecare client ----
     config.cmrEmail = { CLIENT: { catre, copie } }; clientii fara adrese proprii le folosesc pe cele implicite (cmrCatre / cmrCopie). */
  function adreseCmr(client) {
    var e = (SC.config.cmrEmail || {})[String(client || '').toUpperCase()];
    if (e && e.catre) return { catre: e.catre, copie: e.copie || '', proprii: true };
    return { catre: SC.config.cmrCatre || '', copie: SC.config.cmrCopie || '', proprii: false };
  }
  function adreseMailto(s) { return encodeURIComponent(s).replace(/%3B/gi, ';').replace(/%2C/gi, ';').replace(/%40/g, '@').replace(/%20/g, ''); }
  /* deschide programul de email cu mesajul pregatit (destinatari dupa clientul CMR-ului); CMR-ul se ataseaza de mana */
  function emailCmr(x) {
    var cl = String(x.cl || '').toUpperCase(), a = adreseCmr(cl);
    if (!a.catre) {
      toast('Emailul nu s-a deschis: nu sunt setate adrese de email pentru ' + cl + ' și nici adrese implicite. ' + (eAdmin() ? 'Le completezi în Administrare → CMR — adrese de email.' : 'Administratorul le completează în Administrare → CMR — adrese de email.'), 'rau');
      return false;
    }
    var l = document.createElement('a');
    l.href = 'mailto:' + adreseMailto(a.catre) + '?' + (a.copie ? 'cc=' + adreseMailto(a.copie) + '&' : '') +
      'subject=' + encodeURIComponent('CMR ' + x.de + ' ' + x.nc[0]) + '&body=' + encodeURIComponent('Buna ziua,\n\nAtasat regasiti CMR-ul pentru ' + x.de + '.\n\nMultumesc.\nO zi buna.');
    l.click();
    return true;
  }
  $('btnCmrLista').onclick = function () {
    if (!poate()) return;
    L.citesteCmr().then(function (r) {
      var l = r.lista;
      modal({
        titlu: 'CMR-uri emise (ultimele trei luni)', lat: true,
        html: l.length ? '<div class="derulare-x"><table class="simplu"><tr><th>Emis</th><th>De</th><th>Client</th><th>Destinatar</th><th>Țară</th><th>Comenzi</th><th>Facturi</th><th></th></tr>' +
          l.map(function (c, i) {
            return '<tr><td>' + esc(SC.fmtDT(SC.ymd(new Date(c.t)) + ' ' + SC.p2(new Date(c.t).getHours()) + ':' + SC.p2(new Date(c.t).getMinutes()))) + '</td><td>' + esc(c.u || '') + '</td><td>' + esc(c.cl || '') + '</td><td><b>' + esc(c.de || '') +
              '</b></td><td>' + esc(c.ta || '') + '</td><td>' + esc((c.nc || []).join(', ')) + '</td><td>' + esc((c.fa || []).filter(Boolean).join(', ')) + '</td><td><button type="button" class="btn mic" data-cmr="' + i + '">Deschide</button></td></tr>';
          }).join('') + '</table></div><div class="mic" style="margin-top:8px">Un CMR nou se face din lista de comenzi: bifezi comenzile și apeși „CMR”.</div>' :
          '<div class="mic">Niciun CMR salvat în ultimele trei luni. Un CMR nou se face din lista de comenzi: bifezi comenzile și apeși „CMR”.</div>',
        laDeschidere: function (rad) {
          rad.addEventListener('click', function (e) {
            var b = e.target.closest('[data-cmr]'); if (!b) return;
            rad.closest('.fundal').querySelector('.x').click();
            deschideCmr(l[+b.dataset.cmr], null, false);
          });
        },
        butoane: [{ t: 'Închide', cls: 'pri', v: null }]
      });
    }, function (e) {
      toast('CMR-urile salvate nu pot fi citite: publică regulile din firestore.rules în Firebase (blocul „cmr”).', 'rau');
    });
  };

  /* ================= ADRESE ================= */
  var adreseAfisate = [];
  function deseneazaAdrese() {
    adrButoane();
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
  /* ---- Administrator: export / import al nomenclatorului de adrese (Excel) ---- */
  function adrButoane() { var a = rol() === 'admin'; $('btnAdrExport').classList.toggle('ascuns', !a); $('btnAdrImport').classList.toggle('ascuns', !a); }
  $('btnAdrExport').onclick = function () {
    if (rol() !== 'admin') return;
    if (!SC.adrese.length) { toast('Nu există nicio adresă de exportat.'); return; }
    XLSX.writeFile(L.adreseExcel(SC.adrese), 'Adrese Status Comenzi ' + SC.azi() + '.xlsx');
    toast(SC.adrese.length + ' adrese exportate.', 'bun');
  };
  $('btnAdrImport').onclick = function () {
    if (rol() !== 'admin') return;
    var fisier, citit;
    alegeFisier().then(function (f) { fisier = f; return citesteFisier(f); }).then(function (wb) {
      citit = L.adreseDinExcel(wb);
      if (!citit) throw L.eroare('Nu am găsit în fișier o foaie cu adrese: prima linie trebuie să aibă coloanele ' + L.ADRESE_ANTET.join(', ') + ' (cel puțin „Nume 1”).');
      if (!citit.randuri.length) throw L.eroare('Foaia „' + citit.foaie + '” nu conține nicio adresă.');
      var NUME = { cl: 'Client', cod: 'Cod', nume: 'Nume', str: 'Stradă', loc: 'Localitate', jud: 'Județ' };
      function rand(a) { return [a.cl, a.cod, a.nume, a.str, a.loc, a.jud].filter(Boolean).join(' · '); }
      function cuprins(inl) {
        var p = L.planAdrese(citit.randuri, inl);
        return '<table class="simplu"><tr><td>Adrese în fișier</td><td class="nr"><b>' + citit.randuri.length + '</b></td></tr>' +
          '<tr><td>Adrese în aplicație acum</td><td class="nr">' + SC.adrese.length + '</td></tr>' +
          '<tr><td>&nbsp;&nbsp;noi (se adaugă)</td><td class="nr"><b>' + p.noi.length + '</b></td></tr>' +
          '<tr><td>&nbsp;&nbsp;modificate (se actualizează)</td><td class="nr"><b>' + p.schimbate.length + '</b></td></tr>' +
          '<tr><td>&nbsp;&nbsp;la fel</td><td class="nr">' + p.laFel + '</td></tr>' +
          '<tr><td>&nbsp;&nbsp;există în aplicație, dar nu în fișier (' + (inl ? '<b>se șterg</b>' : 'rămân') + ')</td><td class="nr">' + (inl ? '<b>' + p.lipsa.length + '</b>' : p.lipsa.length) + '</td></tr>' +
          '<tr><td>Total după import</td><td class="nr"><b>' + p.final.length + '</b></td></tr></table>' +
          (citit.faraNume ? '<div class="mic">' + citit.faraNume + ' rânduri fără nume au fost sărite.</div>' : '') +
          (citit.lipsa.length ? '<div class="nota atentie">Coloane care lipsesc din fișier: ' + esc(citit.lipsa.map(function (k) { return NUME[k]; }).join(', ')) + '. La adresele din fișier aceste câmpuri rămân goale.</div>' : '') +
          (p.schimbate.length ? '<div class="mic" style="margin-top:8px">Modificate:</div>' + listaHtml(p.schimbate.slice(0, 200).map(function (x) {
            return rand(x.v) + ' — ' + x.campuri.map(function (c) { return NUME[c] + ': ' + (x.v[c] || '(gol)') + ' → ' + (x.n[c] || '(gol)'); }).join('; ');
          })) : '') +
          (p.noi.length ? '<div class="mic" style="margin-top:8px">Noi' + (p.noi.length > 200 ? ' (primele 200)' : '') + ':</div>' + listaHtml(p.noi.slice(0, 200).map(rand)) : '') +
          (inl && p.lipsa.length ? '<div class="mic" style="margin-top:8px">Se șterg' + (p.lipsa.length > 200 ? ' (primele 200)' : '') + ':</div>' + listaHtml(p.lipsa.slice(0, 200).map(rand)) : '');
      }
      return modal({
        titlu: 'Import adrese', lat: true,
        html: '<div class="nota">Fișier: <b>' + esc(fisier.name) + '</b> · foaia „' + esc(citit.foaie) + '”. O adresă din fișier este aceeași cu una din aplicație dacă are același client și cod (fără cod: același client, nume, localitate și stradă). Mai multe adrese cu același cod se păstrează toate.</div>' +
          '<div class="bk-mod"><label class="bifa"><input type="radio" name="adrMod" value="adauga" checked> <span><b>Adaugă și actualizează</b> — adresele care nu sunt în fișier rămân</span></label>' +
          '<label class="bifa"><input type="radio" name="adrMod" value="inlocuieste"> <span><b>Înlocuiește tot</b> — rămân doar adresele din fișier</span></label></div>' +
          '<div id="adrPlan" style="margin-top:8px"></div>',
        laDeschidere: function (rad) {
          function arata() { rad.querySelector('#adrPlan').innerHTML = cuprins(rad.querySelector('[name=adrMod]:checked').value === 'inlocuieste'); }
          Array.prototype.forEach.call(rad.querySelectorAll('[name=adrMod]'), function (x) { x.onchange = arata; });
          arata();
        },
        butoane: [{ t: 'Renunță', v: null }, {
          t: 'Importă', cls: 'pri', fn: function (rad) {
            var inl = rad.querySelector('[name=adrMod]:checked').value === 'inlocuieste', p = L.planAdrese(citit.randuri, inl);
            if (!p.noi.length && !p.schimbate.length && !(inl && p.lipsa.length)) { toast('Nimic de schimbat: adresele din fișier sunt deja în aplicație.'); return null; }
            var pas = inl && p.lipsa.length ? confirma('Înlocuire completă: ' + p.lipsa.length + (p.lipsa.length === 1 ? ' adresă care nu este' : ' adrese care nu sunt') + ' în fișier se ' + (p.lipsa.length === 1 ? 'șterge' : 'șterg') + ' din aplicație.\n\nÎnainte de import se descarcă automat un Excel cu adresele de acum. Continui?', { da: 'Da, înlocuiește', nu: 'Renunță' }) : Promise.resolve(true);
            return pas.then(function (ok) {
              if (!ok) return false;
              /* copie a adreselor de acum, ca importul sa poata fi dat inapoi */
              if (SC.adrese.length) XLSX.writeFile(L.adreseExcel(SC.adrese), 'Adrese inainte de import ' + SC.azi() + ' ' + SC.oraAcum().replace(':', '') + '.xlsx');
              toast('Import adrese în curs…');
              return L.aplicaAdrese(p, inl, fisier.name).then(function () {
                toast('Adrese importate: ' + p.noi.length + ' noi, ' + p.schimbate.length + ' modificate' + (inl ? ', ' + p.lipsa.length + ' șterse' : '') + '. Total ' + p.final.length + '.', 'bun');
              });
            });
          }
        }]
      });
    }).catch(arataEroare);
  };
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
      '<div class="derulare-x"><table class="simplu"><tr><th>Nume</th><th>Rol</th><th title="Cine vede butonul „Paleți” (raportul comenzilor închise). Administratorul îl are mereu.">Raport „Paleți”</th><th>Stare</th><th></th></tr>' +
      stare.utilizatori.map(function (d) {
        var u = d.data, eu = d.id === SC.store.user.uid;
        return '<tr><td>' + esc(u.nume) + (eu ? ' (tu)' : '') + '</td><td><select data-rol="' + d.id + '"' + (eu ? ' disabled' : '') + '>' +
          Object.keys(SC.ROLURI).map(function (r) { return '<option value="' + r + '"' + (r === u.rol ? ' selected' : '') + '>' + SC.ROLURI[r] + '</option>'; }).join('') +
          '</select></td><td><input type="checkbox" data-rappal="' + d.id + '"' + (u.rol === 'admin' ? ' checked disabled' : (u.rapPal ? ' checked' : '')) + ' aria-label="Raport Paleți pentru ' + esc(u.nume) + '"></td><td>' + (u.activ ? '<span class="eticheta ok">activ</span>' : '<span class="eticheta asteapta">dezactivat</span>') + '</td><td>' +
          (eu ? '' : '<button class="btn mic" data-activ="' + d.id + '">' + (u.activ ? 'Dezactivează' : 'Activează') + '</button>') + '</td></tr>';
      }).join('') + '</table></div>' +
      '<div class="rand-form" style="margin-top:10px"><label class="camp"><span>Nume</span><input type="text" id="uNume" maxlength="40"></label>' +
      '<label class="camp"><span>PIN (6 cifre)</span><input type="text" id="uPin" inputmode="numeric" maxlength="6" style="width:110px"></label>' +
      '<label class="camp"><span>Rol</span><select id="uRol">' + ['operator', 'incarcari', 'transport', 'admin'].map(function (x) { return '<option value="' + x + '">' + SC.ROLURI[x] + '</option>'; }).join('') + '</select></label>' +
      '<button class="btn pri" id="uAdauga">Adaugă utilizator</button></div></div>';

    h += '<div class="card"><h2>Clienți și reguli</h2><p>Lista de clienți din formulare și regula de greutate finală automată (greutate + paleți reali × kg/palet).</p>' +
      '<div class="rand-form"><label class="camp" style="flex:1;min-width:260px"><span>Clienți (separați prin virgulă)</span><input type="text" id="cClienti" value="' + esc(SC.config.clienti.join(', ')) + '"></label>' +
      '<label class="camp"><span>Client cu greutate automată</span><input type="text" id="cAuto" value="' + esc(SC.config.clientGreutateAuto) + '" style="width:150px"></label>' +
      '<label class="camp"><span>Clienți cu FPP = 0 din oficiu (despărțiți prin virgulă)</span><input type="text" id="cFpp0" value="' + esc(SC.config.clientiFpp0 || '') + '" style="width:220px"></label>' +
      '<label class="camp"><span>Kg / palet</span><input type="text" id="cKg" value="' + esc(SC.config.kgPalet) + '" style="width:80px"></label>' +
      '<label class="camp"><span>Toleranță paleți (±)</span><input type="text" id="cTol" value="' + esc(SC.config.tolerantaPaleti) + '" style="width:80px"></label>' +
      '<label class="camp" style="flex:1 1 100%"><span>Texte din lista de la Observații (separate prin virgulă)</span><input type="text" id="cObs" value="' + esc((SC.config.observatii || []).join(', ')) + '"></label>' +
      '<button class="btn pri" id="cSalveaza">Salvează</button></div></div>';

    var ceE = SC.config.cmrEmail || {};
    function ceRand(cheie, nume, v) {
      return '<tr><td><b>' + esc(nume) + '</b></td><td><input type="text" data-ce="' + esc(cheie) + '" data-f="catre" value="' + esc(v.catre || '') + '" style="width:100%" aria-label="Către, ' + esc(nume) + '"></td>' +
        '<td><input type="text" data-ce="' + esc(cheie) + '" data-f="copie" value="' + esc(v.copie || '') + '" style="width:100%" aria-label="CC, ' + esc(nume) + '"></td></tr>';
    }
    h += '<div class="card"><h2>CMR — adrese de email</h2><p>Adresele la care se trimite CMR-ul, pentru fiecare client (mai multe adrese se despart prin „;”). La „Salvează, tipărește și email” din fereastra CMR se deschide emailul cu adresele clientului comenzilor; ' +
      'un client fără adrese proprii le folosește pe cele implicite.</p><div class="derulare-x"><table class="simplu" id="ceTabel" style="width:100%;min-width:640px"><tr><th style="width:170px">Client</th><th>Către</th><th>În copie (CC)</th></tr>' +
      ceRand('', 'Implicit (ceilalți clienți)', { catre: SC.config.cmrCatre, copie: SC.config.cmrCopie }) +
      SC.config.clienti.map(function (c) { return ceRand(c, c, ceE[c] || {}); }).join('') + '</table></div>' +
      '<div class="rand-form" style="margin-top:10px"><button class="btn pri" id="ceSalveaza">Salvează adresele</button></div></div>';

    var tmsS = SC.config.tms || {}, tmsC = SC.config.tmsClienti || {};
    h += '<div class="card"><h2>Export pentru TMS</h2><p>Valorile fixe din fișierul de import în TMS (furnizorul este depozitul) și numele clienților așa cum sunt scrise în TMS. ' +
      '„Preia din fișierul model” le citește din fișierul de import pe care îl folosiți acum; apoi apasă Salvează. Exportul se face din tabul Comenzi (Transport și Administrator).</p><div class="rand-form">' +
      L.TMS_SETARI.map(function (c) { return '<label class="camp"' + (c.lat ? ' style="flex:1 1 48%"' : '') + '><span>' + esc(c.t) + '</span><input type="text" id="ts_' + c.k + '" value="' + esc(tmsS[c.k] == null ? '' : tmsS[c.k]) + '"' + (c.k === 'volum' ? ' style="width:110px"' : '') + '></label>'; }).join('') +
      '<label class="camp" style="flex:1 1 100%"><span>Numele clienților în TMS — câte unul pe rând, în forma COD = Nume în TMS</span><textarea id="tsClienti" rows="' + Math.max(4, SC.config.clienti.length) + '" style="width:100%;resize:vertical;padding:6px 8px">' +
      esc(SC.config.clienti.map(function (c) { return c + ' = ' + (tmsC[c] || ''); }).join('\n')) + '</textarea></label>' +
      '<button class="btn" id="tsModel">Preia din fișierul model</button><button class="btn pri" id="tsSalveaza">Salvează</button></div></div>';

    var cand = candidatiArhivare(14).length;
    h += '<div class="card"><h2>Arhivare comenzi neîncărcate</h2><p>Comenzile Terminata fără confirmare de încărcare rămân „active” și se încarcă la fiecare deschidere a aplicației. Arhivarea le scoate din lista activă (rămân în istoric, neschimbate).</p>' +
      '<div class="rand-form"><label class="camp"><span>Mai vechi de (zile)</span><input type="text" id="aZile" value="14" style="width:80px"></label>' +
      '<button class="btn" id="aArhiveaza">Arhivează</button><span class="mic">Acum: ' + cand + ' comenzi mai vechi de 14 zile.</span></div></div>';

    var deCuratat = SC.comenzi.filter(function (o) { return o.tr; }).length;
    if (deCuratat) {
      h += '<div class="card"><h2>Curățare: linii din transport ajunse în registru</h2><p>În registrul de comenzi sunt <b>' + deCuratat + '</b> rânduri adăugate dintr-un import mai vechi al fișierului de transport (eticheta „TRANSPORT: …”). ' +
        'Le poți scoate de aici; la următorul import al fișierului TMS, liniile recente apar în rubrica separată „Doar din transport”.</p>' +
        '<div class="rand-form"><button class="btn rosu" id="xCurata">Scoate cele ' + deCuratat + ' rânduri din registru</button></div></div>';
    }
    h += bkCard();
    h += '<div class="card"><h2>Migrare din Excel</h2><p>Încarcă registrul „Status Comenzi” (.xlsm): toate comenzile, cu Nr Crt păstrat, și foaia Adrese. <b>Înlocuiește tot ce există</b> în aplicație — se folosește la pornire și, dacă e nevoie, încă o dată în ziua trecerii de pe Excel.</p>' +
      '<div class="rand-form"><button class="btn" id="mMigrare">Alege fișierul și migrează…</button></div></div>';

    h += '<div class="card"><h2>Jurnal de modificări</h2><p>Fiecare modificare, cu cine a făcut-o, valoarea veche și cea nouă. Alege ziua sau perioada; opțional caută un număr de comandă sau un nume. „Export Excel” descarcă tot ce corespunde perioadei și căutării.</p><div class="rand-form">' +
      '<label class="camp"><span>De la</span><input type="date" id="jZi" value="' + SC.azi() + '"></label>' +
      '<label class="camp"><span>Până la</span><input type="date" id="jZi2" value="' + SC.azi() + '"></label>' +
      '<label class="camp"><span>Caută</span><input type="search" id="jFiltru" placeholder="Comandă, utilizator, câmp…"></label>' +
      '<button class="btn" id="jArata">Arată</button><button class="btn" id="jExport">Export Excel</button><span class="mic" id="jNumar" role="status"></span></div><div id="jLista" style="margin-top:10px"></div></div>';

    h += '<div class="card"><h2>Despre consum (plan gratuit Firebase)</h2><p>Comenzile sunt păstrate în grupe de ' + SC.MARIME_GRUPA + ', iar aplicația urmărește în timp real doar grupele cu comenzi active și pe cele recente. ' +
      'Acum sunt încărcate ' + Object.keys(SC.grupe).length + ' grupe (' + SC.comenzi.length + ' comenzi). Consumul real se vede în consola Firebase → Firestore → Usage.</p></div>';
    $('pag-admin').innerHTML = h;
    bkArataFolder();
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
    var rp = e.target.closest('[data-rappal]');
    if (rp) { var da = rp.checked; schimbaUtilizator(rp.dataset.rappal, function (u) { if (da) u.rapPal = true; else delete u.rapPal; }).then(function () { toast(da ? 'Utilizatorul vede butonul „Paleți” de la următoarea intrare în aplicație.' : 'Utilizatorul nu mai vede butonul „Paleți” de la următoarea intrare în aplicație.', 'bun'); }, arataEroare); }
  });
  $('pag-admin').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.id && b.id.indexOf('bk') === 0) { bkClick(b); return; }
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
      var cfg = Object.assign({}, SC.config, { clienti: clienti, clientGreutateAuto: $('cAuto').value.trim().toUpperCase(), clientiFpp0: $('cFpp0').value.split(',').map(function (x) { return x.trim().toUpperCase(); }).filter(Boolean).join(', '), kgPalet: kg, tolerantaPaleti: tol,
        observatii: $('cObs').value.split(',').map(function (x) { return x.trim(); }).filter(Boolean) });
      SC.store.tx(function (t) { t.set('meta', 'config', cfg); t.log('Configurare: clienți / reguli modificate'); }).then(function () { toast('Salvat.', 'bun'); }, arataEroare);
    } else if (b.id === 'ceSalveaza') {
      var perClient = {}, implicit = { catre: '', copie: '' }, gresit = null;
      Array.prototype.forEach.call($('ceTabel').querySelectorAll('input[data-ce]'), function (el) {
        var lista = el.value.split(/[;,]/).map(function (x) { return x.trim(); }).filter(Boolean);
        lista.forEach(function (adr) { if (!gresit && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adr)) gresit = { el: el, adr: adr }; });
        var v = lista.join('; '), k = el.dataset.ce;
        if (!k) implicit[el.dataset.f] = v; else if (v) (perClient[k] = perClient[k] || {})[el.dataset.f] = v;
      });
      if (gresit) { gresit.el.focus(); return toast('„' + gresit.adr + '” nu arată ca o adresă de email. Adresele se despart prin „;”.', 'rau'); }
      var faraCatre = Object.keys(perClient).filter(function (k) { return !perClient[k].catre; });
      if (faraCatre.length) return toast(faraCatre[0] + ' are adresă doar la CC. Completează și „Către” sau șterge CC-ul.', 'rau');
      var cfg3 = Object.assign({}, SC.config, { cmrCatre: implicit.catre, cmrCopie: implicit.copie, cmrEmail: perClient });
      SC.store.tx(function (t) { t.set('meta', 'config', cfg3); t.log('Configurare: adresele de email pentru CMR modificate'); }).then(function () { toast('Adresele au fost salvate.', 'bun'); }, arataEroare);
    } else if (b.id === 'tsModel') {
      alegeFisier().then(citesteFisier).then(function (wb) {
        var v = L.tmsCitesteModel(wb), gasite = 0;
        L.TMS_SETARI.forEach(function (c) { if (v[c.k] != null && v[c.k] !== '') { $('ts_' + c.k).value = v[c.k]; gasite++; } });
        if (!gasite) return toast('Nu am găsit în fișier coloanele așteptate (FURNIZOR, TIP FURNIZOR…). Alege fișierul de import în TMS.', 'rau');
        toast('Am preluat ' + gasite + ' din ' + L.TMS_SETARI.length + ' valori din fișier. Verifică-le și apasă Salvează.', 'bun');
      }).catch(arataEroare);
    } else if (b.id === 'tsSalveaza') {
      var tms = {}, cl2 = {}, gresite = [];
      L.TMS_SETARI.forEach(function (c) { var v = $('ts_' + c.k).value.trim(); if (v) tms[c.k] = v; });
      $('tsClienti').value.split('\n').forEach(function (rand) {
        if (!rand.trim()) return;
        var i = rand.indexOf('=');
        if (i < 0) { gresite.push(rand.trim()); return; }
        var cod = rand.slice(0, i).trim().toUpperCase(), nume = rand.slice(i + 1).trim();
        if (cod && nume) cl2[cod] = nume;
      });
      if (gresite.length) return toast('Rând fără „=”: ' + gresite[0] + '. Scrie COD = Nume în TMS.', 'rau');
      if (tms.volum != null && SC.parseNum(tms.volum) == null) return toast('Volum paleți: „' + tms.volum + '” nu este un număr.', 'rau');
      var cfg2 = Object.assign({}, SC.config, { tms: tms, tmsClienti: cl2 });
      SC.store.tx(function (t) { t.set('meta', 'config', cfg2); t.log('Configurare: setările pentru exportul TMS modificate'); }).then(function () { toast('Salvat.', 'bun'); }, arataEroare);
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
    } else if (b.id === 'xCurata') {
      var deSters = SC.comenzi.filter(function (o) { return o.tr; }).map(function (o) { return o.n; });
      confirma(deSters.length + ' rânduri adăugate din fișierul de transport vor fi șterse din registrul de comenzi.\nComenzile venite din borderou, Excel sau introduse manual nu sunt atinse. Continui?').then(function (ok) {
        if (!ok) return;
        b.disabled = true; toast('Curățare în curs…');
        return L.sterge(deSters, 'Curățare: scoase din registru liniile adăugate din transport').then(function () {
          /* daca randurile sterse erau ultimele numere alocate, contorul Nr Crt revine la ultima comanda reala */
          return SC.store.tx(function (t) {
            return t.get('meta', 'contor').then(function (c) {
              var ultim = (c && c.ultim) || 0, maxRamas = SC.comenzi.length ? SC.comenzi[SC.comenzi.length - 1].n : 0;
              var peste = deSters.filter(function (n) { return n > maxRamas; }).length;
              if (maxRamas > 0 && maxRamas < ultim && peste === ultim - maxRamas) { t.set('meta', 'contor', { ultim: maxRamas }); return maxRamas; }
              return ultim;
            });
          });
        }).then(function (ultim) { toast('Scoase ' + deSters.length + ' rânduri. Următorul Nr Crt: ' + (ultim + 1) + '.', 'bun'); deseneazaAdmin(); redeseneaza(); });
      }).catch(arataEroare);
    } else if (b.id === 'mMigrare') {
      migrare();
    } else if (b.id === 'jArata' || b.id === 'jExport') {
      var per = perioadaJurnal(); if (!per) return;
      var exporta = b.id === 'jExport', perText = per.a === per.b ? SC.fmtDataLunga(per.a) : 'perioada ' + SC.fmtDataLunga(per.a) + ' – ' + SC.fmtDataLunga(per.b);
      b.disabled = true; $('jNumar').textContent = 'Se citește jurnalul…';
      citesteJurnal(per).then(function (j) {
        var randuri = j.randuri, total = j.total;
        $('jNumar').textContent = total ? randuri.length + ' din ' + total + ' înregistrări' : '';
        if (!randuri.length) {
          var gol = total ? 'Nicio înregistrare nu corespunde căutării.' : 'Nicio modificare înregistrată în ' + perText + '.';
          if (exporta) toast(gol + ' Nu am ce exporta.', 'rau'); else $('jLista').innerHTML = '<div class="mic">' + esc(gol) + '</div>';
          return;
        }
        if (exporta) {
          exportaJurnal(randuri, 'Jurnal modificari ' + per.a + (per.a === per.b ? '' : ' - ' + per.b) + '.xlsx');
          toast('Jurnal exportat: ' + randuri.length + (randuri.length === 1 ? ' înregistrare' : ' înregistrări') + ' din ' + perText + '.', 'bun');
          return;
        }
        var totalFiltrat = randuri.length, cuZi = per.a !== per.b; randuri = randuri.slice(0, 1500);
        if (totalFiltrat > 1500) $('jNumar').textContent += ' — afișate primele 1500; restrânge cu căutarea sau folosește Export Excel pentru toate';
        $('jLista').innerHTML = '<div class="lista-mica" style="max-height:420px"><table class="simplu"><tr>' + (cuZi ? '<th>Data</th>' : '') + '<th>Ora</th><th>Cine</th><th>Ce</th></tr>' +
          randuri.map(function (r) { var dt = new Date(r.t); return '<tr>' + (cuZi ? '<td>' + SC.p2(dt.getDate()) + '.' + SC.p2(dt.getMonth() + 1) + '.' + dt.getFullYear() + '</td>' : '') + '<td>' + SC.p2(dt.getHours()) + ':' + SC.p2(dt.getMinutes()) + ':' + SC.p2(dt.getSeconds()) + '</td><td>' + esc(r.u) + '</td><td>' + esc(r.x) + '</td></tr>'; }).join('') + '</table></div>';
      }).catch(function (e2) { $('jNumar').textContent = ''; arataEroare(e2); }).then(function () { b.disabled = false; });
    }
  });
  /* ---- jurnal: perioada, citire, export ----
     Jurnalul are cate un document pe ora in care s-a lucrat, deci o zi inseamna cel mult cateva zeci de citiri. */
  var JURNAL_ZILE_MAX = 366;
  $('pag-admin').addEventListener('change', function (e) {
    /* alegerea zilei de inceput muta si sfarsitul pe aceeasi zi: o singura zi ramane un singur click */
    if (e.target.id === 'jZi' && $('jZi2')) $('jZi2').value = e.target.value;
  });
  function perioadaJurnal() {
    var a = $('jZi').value, b = $('jZi2').value || a;
    if (!a) { toast('Alege ziua de început.', 'rau'); $('jZi').focus(); return null; }
    if (b < a) { toast('„Până la” este înaintea zilei de început. Corectează perioada.', 'rau'); $('jZi2').focus(); return null; }
    var zile = Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000) + 1;
    if (zile > JURNAL_ZILE_MAX) { toast('Perioada are ' + zile + ' zile. Alege cel mult ' + JURNAL_ZILE_MAX + ' de zile o dată, ca să nu consumi citirile zilnice din planul gratuit.', 'rau'); $('jZi2').focus(); return null; }
    return { a: a, b: b, cuv: SC.normText($('jFiltru').value).split(' ').filter(Boolean) };
  }
  function citesteJurnal(per) {
    return SC.store.citesteInterval('jurnal', per.a + '_', per.b + '_\uf8ff').then(function (docs) {
      var e2 = [];
      docs.forEach(function (d) { if (d.data && d.data.e) e2 = e2.concat(d.data.e); });
      var randuri = e2.map(function (x) { var p = x.split('|'); return { t: +p[0], u: p[1], x: p.slice(2).join('|') }; }).sort(function (a2, b2) { return b2.t - a2.t; });
      var total = randuri.length;
      if (per.cuv.length) randuri = randuri.filter(function (r2) { var h2 = SC.normText(r2.u + ' ' + r2.x); return per.cuv.every(function (c) { return h2.indexOf(c) >= 0; }); });
      return { randuri: randuri, total: total };
    });
  }
  /* Excel: Data si Ora sunt valori de data adevarate (se pot sorta si filtra pe ani / luni / zile);
     la modificarile de comenzi, comanda si Nr Crt stau in coloane separate. */
  function exportaJurnal(randuri, numeFisier) {
    var aoa = [['Data', 'Ora', 'Utilizator', 'Comandă', 'Nr Crt', 'Modificare']];
    randuri.forEach(function (r) {
      var d = new Date(r.t), zi = Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000) + 25569;
      var ora = (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) / 86400;
      var m = /^(.*?) \(Nr Crt (\d+)\) — ([\s\S]*)$/.exec(r.x);
      aoa.push([{ t: 'n', v: zi, z: 'dd.mm.yyyy' }, { t: 'n', v: ora, z: 'hh:mm:ss' }, r.u, m ? m[1] : null, m ? +m[2] : null, m ? m[3] : r.x]);
    });
    var ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 11 }, { wch: 9 }, { wch: 20 }, { wch: 26 }, { wch: 8 }, { wch: 110 }];
    ws['!autofilter'] = { ref: 'A1:F' + aoa.length };
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Jurnal');
    XLSX.writeFile(wb, numeFisier);
  }
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
      return SC.store.stergeColectie('comenzi', function (a) { $('syncText').textContent = 'ștergere date vechi ' + a; }).then(function () {
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
        L.golesteCache(); kpUitaArhiva(); stare.primaData = true;
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

  /* =====================================================================
     COPIE DE SIGURANTA (backup)
     - un singur „calculator de backup” (config.backup = { disp, nume, de, t }), setat de Administrator chiar de pe el;
       calculatorul se recunoaste dupa un cod tinut in browser (localStorage), iar folderul ales dupa un „handle” tinut
       in IndexedDB-ul browserului (File System Access: Chrome / Edge pe calculator);
     - pe acel calculator, o data pe zi, cand este logat un Administrator sau un Operator date, aplicatia citeste tot
       si scrie un fisier in folder (de exemplu un folder OneDrive), pastrand ultimele BK_PASTREAZA fisiere;
     - evidenta copiilor sta in meta/backup (ultima automata, ultima manuala, ultima eroare);
     - restaurarea (doar Administrator) aduce baza de date la starea din fisier, scriind doar documentele care difera.
     ===================================================================== */
  var BK_PASTREAZA = 30, BK_ZILE_AVERTIZARE = 3, BK_INTARZIERE = 20000, BK_INTERVAL = 30 * 60000;
  var BK_JURNAL_ZILE = 35;       // copiile automate facute de un Administrator iau jurnalul din ultimele zile; copia manuala il ia pe tot
  var BK_PREFIX = 'Backup Status Comenzi ', BK_PREFIX_INAINTE = 'Inainte de restaurare Status Comenzi ';
  var BK_RE = /^Backup Status Comenzi \d{4}-\d{2}-\d{2} \d{4}( manual)?\.json$/;
  /* langa fiecare copie din folder se scrie si registrul in Excel, pe modelul „Status Comenzi” (doar pentru consultat) */
  var BK_PREFIX_XLSX = 'Status Comenzi ', BK_RE_XLSX = /^Status Comenzi \d{4}-\d{2}-\d{2} \d{4}( manual)?\.xlsx$/;
  var bk = { info: undefined, cfgSosit: false, lucreaza: false, incercari: 0, avertizat: false, intarziere: BK_INTARZIERE };

  function bkSuportat() { return typeof window.showDirectoryPicker === 'function' && !!window.indexedDB; }
  function bkDisp() {
    var id = '';
    try { id = localStorage.getItem('sc_disp') || ''; if (!id) { id = SC.idScurt() + SC.idScurt(); localStorage.setItem('sc_disp', id); } } catch (e) { /* fara localStorage nu poate fi calculator de backup */ }
    return id;
  }
  function bkCfg() { var c = SC.config && SC.config.backup; return c && c.disp ? c : null; }
  function bkAici() { var c = bkCfg(); return !!c && c.disp === bkDisp(); }
  /* Doua feluri de a salva copiile pe calculatorul de backup (config.backup.mod):
     'folder' (implicit) = aplicatia scrie direct intr-un folder ales (File System Access) si pastreaza ultimele BK_PASTREAZA fisiere;
     'descarcare' = un fisier .zip pe zi, ca descarcare obisnuita a browserului, pentru cand browserul sau o regula a firmei
     nu permite alegerea unui folder. Aici aplicatia nu poate verifica daca fisierul a ajuns pe disc si nu poate sterge copiile vechi. */
  function bkDescarcare() { var c = bkCfg(); return !!c && c.mod === 'descarcare'; }
  function bkFolderBlocat() { try { return localStorage.getItem('sc_bk_fara_folder') === '1'; } catch (e) { return false; } }
  function bkCand(t) { var d = new Date(t); return SC.fmtDT(SC.ymd(d) + ' ' + SC.p2(d.getHours()) + ':' + SC.p2(d.getMinutes())); }
  function bkNr(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function bkJurnalText(x) { return !x.cuJurnal ? 'fără jurnal' : x.jurnalDela ? 'cu jurnalul de la ' + SC.fmtDataLunga(x.jurnalDela) : 'cu tot jurnalul'; }

  /* ---- folderul ales, tinut minte in browser ---- */
  function bkIdb() {
    return new Promise(function (ok, rau) {
      var r = indexedDB.open('sc-backup', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('kv'); };
      r.onsuccess = function () { ok(r.result); }; r.onerror = function () { rau(r.error); };
    });
  }
  function bkIdbGet(k) {
    if (!window.indexedDB) return Promise.resolve(null);
    return bkIdb().then(function (db) {
      return new Promise(function (ok, rau) {
        var q = db.transaction('kv').objectStore('kv').get(k);
        q.onsuccess = function () { db.close(); ok(q.result || null); }; q.onerror = function () { db.close(); rau(q.error); };
      });
    });
  }
  function bkIdbSet(k, v) {
    return bkIdb().then(function (db) {
      return new Promise(function (ok, rau) {
        var tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k);
        tx.oncomplete = function () { db.close(); ok(); }; tx.onerror = function () { db.close(); rau(tx.error); };
      });
    });
  }
  bk.depozit = { get: bkIdbGet, set: bkIdbSet };
  /* 'granted' | 'prompt' | 'denied' | 'lipsa' ; cu cere=true browserul intreaba utilizatorul (merge doar in urma unui click) */
  function bkPermisiune(h, cere) {
    var opt = { mode: 'readwrite' };
    if (!h) return Promise.resolve('lipsa');
    if (!h.queryPermission) return Promise.resolve('granted');
    return h.queryPermission(opt).then(function (p) { return p === 'prompt' && cere && h.requestPermission ? h.requestPermission(opt) : p; });
  }
  function bkAlegeFolder() {
    return window.showDirectoryPicker({ id: 'sc-backup', mode: 'readwrite' }).then(function (h) {
      return bkPermisiune(h, true).then(function (p) {
        if (p !== 'granted') throw L.eroare('Browserul nu a permis scrierea în folderul ales.');
        try { localStorage.removeItem('sc_bk_fara_folder'); } catch (e) { /* ignor */ }
        return bk.depozit.set('folder', h).then(function () { return h; });
      });
    }, function (e) {
      if (e && e.name === 'AbortError') return null;                       // utilizatorul a inchis fereastra de alegere
      if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) {
        try { localStorage.setItem('sc_bk_fara_folder', '1'); } catch (x) { /* ignor */ }
        var er = L.eroare('Browserul nu permite alegerea unui folder (o setare a lui sau o regulă a firmei). Folosește varianta „Ca descărcare a browserului”.');
        er.folderBlocat = true; throw er;
      }
      throw e;
    });
  }
  /* continut = text (JSON) sau octeti (Excel) */
  function bkScrieInFolder(h, nume, continut) {
    var blob = new Blob([continut], { type: typeof continut === 'string' ? 'application/json' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), marime = blob.size;
    return h.getFileHandle(nume, { create: true }).then(function (fh) {
      return fh.createWritable().then(function (w) {
        return w.write(blob).then(function () { return w.close(); });
      }).then(function () { return fh.getFile(); });
    }).then(function (f) {
      if (f.size !== marime) throw L.eroare('Fișierul de backup nu a fost scris complet (' + f.size + ' din ' + marime + ' octeți).');
      return f.size;
    });
  }
  /* pastreaza in folder doar ultimele BK_PASTREAZA copii si ultimele BK_PASTREAZA registre Excel (dupa numele fisierului, care incepe cu data) */
  function bkCurata(h) {
    var liste = [[], []], it = h.entries();
    function urm() {
      return it.next().then(function (r) {
        if (r.done) return;
        if (r.value[1].kind === 'file') { if (BK_RE.test(r.value[0])) liste[0].push(r.value[0]); else if (BK_RE_XLSX.test(r.value[0])) liste[1].push(r.value[0]); }
        return urm();
      });
    }
    return urm().then(function () {
      var deSters = [];
      liste.forEach(function (nume) { nume.sort(); deSters = deSters.concat(nume.slice(0, Math.max(0, nume.length - BK_PASTREAZA))); });
      return deSters.reduce(function (p, n) { return p.then(function () { return h.removeEntry(n); }); }, Promise.resolve());
    });
  }
  /* registrul Excel din aceeasi copie (fara nicio citire in plus); daca nu reuseste, copia .json ramane buna */
  function bkScrieExcel(copie, folder, manual, rez) {
    return new Promise(function (ok) { setTimeout(ok, 30); }).then(function () {
      var nume = bkNumeFisier(BK_PREFIX_XLSX, copie.t, manual).replace(/\.json$/, '.xlsx');
      var octeti = L.registruOcteti(L.registruExcel(L.comenziDinGrupe(copie.col.comenzi), copie.col.adrese));
      return bkScrieInFolder(folder, nume, octeti).then(function (marime) { rez.excel = nume; rez.excelKb = Math.round(marime / 1024); });
    }).catch(function (e) { rez.excelEr = (e && e.message ? e.message : String(e)).slice(0, 200); }).then(function () { return rez; });
  }
  /* continut = text (JSON) sau octeti (arhiva .zip) */
  function bkDescarca(nume, continut) {
    var tip = typeof continut === 'string' ? 'application/json' : 'application/zip';
    var a = document.createElement('a'), url = URL.createObjectURL(new Blob([continut], { type: tip }));
    a.href = url; a.download = nume; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
  }
  /* copia pentru descarcare: un singur fisier .zip cu copia .json si registrul Excel (o singura descarcare, deci browserul nu intreaba
     de „mai multe fisiere”); daca Excelul nu poate fi facut, arhiva contine doar copia .json */
  function bkArhiva(copie, manual) {
    var numeJson = bkNumeFisier(BK_PREFIX, copie.t, manual), numeXlsx = bkNumeFisier(BK_PREFIX_XLSX, copie.t, manual).replace(/\.json$/, '.xlsx');
    var fisiere = [{ nume: numeJson, octeti: new TextEncoder().encode(JSON.stringify(copie)) }];
    var rez = { fisier: numeJson.replace(/\.json$/, '.zip'), comenzi: copie.nr.comenzi, doc: copie.nr.documente, cuJurnal: !!copie.cuJurnal, jurnalDela: copie.jurnalDela || '', t: copie.t, loc: 'descarcat' };
    try { fisiere.push({ nume: numeXlsx, octeti: new Uint8Array(L.registruOcteti(L.registruExcel(L.comenziDinGrupe(copie.col.comenzi), copie.col.adrese))) }); rez.excel = numeXlsx; }
    catch (e) { rez.excelEr = (e && e.message ? e.message : String(e)).slice(0, 200); }
    var octeti = L.backupArhiva(fisiere);
    rez.kb = Math.round(octeti.length / 1024);
    return { rez: rez, octeti: octeti };
  }
  function bkNumeFisier(prefix, t, manual) {
    var d = new Date(t);
    return prefix + SC.ymd(d) + ' ' + SC.p2(d.getHours()) + SC.p2(d.getMinutes()) + (manual ? ' manual' : '') + '.json';
  }
  /* scrie o copie deja citita: in folder (daca este dat) sau ca descarcare */
  function bkSalveaza(copie, nume, folder) {
    var text = JSON.stringify(copie);
    var rez = { fisier: nume, comenzi: copie.nr.comenzi, doc: copie.nr.documente, kb: Math.round(text.length / 1024), cuJurnal: !!copie.cuJurnal, jurnalDela: copie.jurnalDela || '', t: copie.t };
    if (!folder) { bkDescarca(nume, text); rez.loc = 'descarcat'; return Promise.resolve(rez); }
    return bkScrieInFolder(folder, nume, text).then(function () { rez.loc = 'folder'; rez.folder = folder.name; return rez; });
  }
  /* citeste tot si salveaza; jurnalul intra doar cand drepturile reale sunt de Administrator:
     tot la copia manuala, ultimele BK_JURNAL_ZILE zile la cea automata (ca numarul de citiri sa nu creasca in timp) */
  function bkFa(opt) {
    var jurnal = rolReal() !== 'admin' ? false : opt.manual ? true : { a: SC.ziPlus(SC.azi(), -BK_JURNAL_ZILE) };
    return L.backupCiteste(jurnal, function (ce) { $('syncText').textContent = 'copie de siguranță: ' + ce.toLowerCase(); }).then(function (copie) {
      if (!opt.folder) {
        $('syncText').textContent = 'copie de siguranță: arhiva';
        return new Promise(function (ok) { setTimeout(ok, 30); }).then(function () { var a = bkArhiva(copie, opt.manual); bkDescarca(a.rez.fisier, a.octeti); return a.rez; });
      }
      return bkSalveaza(copie, bkNumeFisier(BK_PREFIX, copie.t, opt.manual), opt.folder).then(function (rez) {
        $('syncText').textContent = 'copie de siguranță: registrul excel';
        return bkScrieExcel(copie, opt.folder, opt.manual, rez).then(function () { return bkCurata(opt.folder); }).then(function () { return rez; }, function () { return rez; });
      });
    }).then(function (rez) { marcheazaSync(); return rez; }, function (e) { marcheazaSync(); throw e; });
  }
  function bkDateEvidenta(rez) {
    var c = bkCfg(), d = { t: rez.t, u: SC.store.user.nume, fisier: rez.fisier, comenzi: rez.comenzi, doc: rez.doc, kb: rez.kb, cuJurnal: rez.cuJurnal, loc: rez.loc };
    if (rez.jurnalDela) d.jurnalDela = rez.jurnalDela;
    if (rez.excel) d.excel = rez.excel;
    if (rez.excelEr) d.excelEr = rez.excelEr;
    if (rez.folder) d.folder = rez.folder;
    if (c && bkAici()) d.nume = c.nume;
    return d;
  }

  /* ---- copia automata zilnica, doar pe calculatorul de backup ---- */
  function bkBanda(ce) {
    var el = $('bandaBackup'), admin = rolReal() === 'admin';
    if (!ce) { el.className = 'ascuns'; el.innerHTML = ''; return; }
    if (ce === 'cere') el.innerHTML = '<span><b>Copia de siguranță de azi așteaptă.</b> Browserul cere confirmarea accesului la folderul de backup.</span><button type="button" class="btn mic" id="bkPermite">Permite și fă copia</button>';
    else if (ce === 'refuzat') el.innerHTML = '<span><b>Copia de siguranță de azi nu s-a făcut:</b> accesul la folderul de backup a fost refuzat în browser.</span><button type="button" class="btn mic" id="bkPermite">Încearcă din nou</button>';
    else el.innerHTML = '<span><b>Copia de siguranță automată nu poate rula:</b> pe acest calculator nu mai este ales folderul de backup. ' +
      (admin ? 'Alege-l din Administrare → Copie de siguranță.' : 'Anunță administratorul.') + '</span>';
    el.className = '';
  }
  $('bandaBackup').addEventListener('click', function (e) { if (e.target.id === 'bkPermite') bkAutomat(true); });
  /* cuGest = apelul vine dintr-un click (browserul poate intreba de acces); fortat = se face si daca azi exista deja o copie */
  function bkAutomat(cuGest, fortat) {
    var r = rolReal();
    if (bk.lucreaza || !SC.store.user || (r !== 'admin' && r !== 'operator')) return Promise.resolve();
    if (!bkAici()) { bkBanda(''); return Promise.resolve(); }
    if (bk.info === undefined) return Promise.resolve();            // evidenta copiilor nu a sosit inca
    var auto = (bk.info || {}).auto;
    if (!fortat && auto && SC.ymd(new Date(auto.t)) === SC.azi()) { bkBanda(''); return Promise.resolve(); }
    var descarcare = bkDescarcare();
    if (!descarcare && !bkSuportat()) { bkBanda('lipsa'); return Promise.resolve(); }
    if (!cuGest && bk.incercari >= 3) return Promise.resolve();
    try { if (Date.now() - (+localStorage.getItem('sc_bk_lucru') || 0) < 10 * 60000) return Promise.resolve(); } catch (e) { /* ignor */ }   // lucreaza alta fereastra
    bk.lucreaza = true;
    /* folderul (cu acordul browserului) sau, la varianta cu descarcare, nimic de pregatit */
    var pregatire = descarcare ? Promise.resolve({ ok: true, folder: null }) : bk.depozit.get('folder').then(function (h) {
      return bkPermisiune(h, cuGest).then(function (p) {
        if (p === 'lipsa') { bkBanda('lipsa'); return { ok: false }; }
        if (p !== 'granted') { bkBanda(p === 'denied' ? 'refuzat' : 'cere'); return { ok: false }; }
        return { ok: true, folder: h };
      });
    });
    return pregatire.then(function (x) {
      if (!x.ok) return;
      bkBanda('');
      try { localStorage.setItem('sc_bk_lucru', String(Date.now())); } catch (e) { /* ignor */ }
      bk.incercari++;
      return bkFa({ folder: x.folder }).then(function (rez) {
        return L.backupNoteaza('auto', bkDateEvidenta(rez), 'Copie de siguranță automată: ' + rez.fisier + ' (' + rez.comenzi + ' comenzi, ' + rez.doc + ' documente)').then(function () {
          toast(rez.loc === 'folder' ? 'Copia de siguranță de azi a fost salvată în folderul „' + rez.folder + '” (' + bkNr(rez.comenzi) + ' comenzi' + (rez.excel ? ', cu registrul Excel' : '') + ').'
            : 'Copia de siguranță de azi a fost descărcată: ' + rez.fisier + ' (' + bkNr(rez.comenzi) + ' comenzi' + (rez.excel ? ', cu registrul Excel' : '') + ').', 'bun');
          if (rez.excelEr) toast('Registrul Excel nu a putut fi făcut: ' + rez.excelEr + ' Copia .json este în regulă.', 'rau');
        });
      });
    }).catch(function (e) {
      var msg = e && e.message ? e.message : String(e);
      toast('Copia de siguranță automată nu a reușit: ' + msg, 'rau');
      return L.backupNoteaza('er', { t: Date.now(), u: SC.store.user ? SC.store.user.nume : '?', msg: msg.slice(0, 200) }).catch(function () { /* ignor */ });
    }).then(function () { bk.lucreaza = false; try { localStorage.removeItem('sc_bk_lucru'); } catch (e) { /* ignor */ } });
  }
  function bkPorneste() {
    var r = rolReal();
    bk.info = undefined;
    if (r !== 'admin' && r !== 'operator') { bkBanda(''); return; }
    stare.opriri.push(SC.store.urmaresteDoc('meta', 'backup', function (d) {
      bk.info = d || null;
      if (stare.tab === 'admin') deseneazaAdmin();
      bkAvertizeaza();
    }));
    var t1 = setTimeout(function () { bkAutomat(false); }, bk.intarziere), t2 = setInterval(function () { bkAutomat(false); }, BK_INTERVAL);
    stare.opriri.push(function () { clearTimeout(t1); clearInterval(t2); });
  }
  /* Administratorul afla la intrare daca ultima copie automata este prea veche (pe calculatorul de backup copia porneste oricum singura) */
  function bkAvertizeaza() {
    if (bk.avertizat || rolReal() !== 'admin' || bk.info === undefined || !bk.cfgSosit) return;
    var c = bkCfg(), auto = (bk.info || {}).auto;
    if (!c || bkAici()) return;
    var zile = auto ? (Date.now() - auto.t) / 86400000 : (Date.now() - (c.t || 0)) / 86400000;
    if (zile <= BK_ZILE_AVERTIZARE) return;
    bk.avertizat = true;
    toast(auto ? 'Atenție: ultima copie de siguranță automată este din ' + bkCand(auto.t) + '. Verifică dacă aplicația este deschisă zilnic pe „' + c.nume + '”.'
      : 'Atenție: pe „' + c.nume + '” nu s-a făcut încă nicio copie de siguranță automată.', 'rau');
  }

  /* ---- cardul din Administrare ---- */
  function bkCard() {
    var c = bkCfg(), info = bk.info || {}, auto = info.auto, man = info.manual, aici = bkAici();
    var zile = auto ? (Date.now() - auto.t) / 86400000 : null, vechi = zile != null && zile > BK_ZILE_AVERTIZARE;
    var h = '<div class="card"><h2>Copie de siguranță (backup)</h2><p>O copie pe zi a tuturor datelor, făcută automat pe <b>un singur calculator</b> (calculatorul de backup): fie direct într-un folder ales de pe el ' +
      '(de exemplu un folder OneDrive; se păstrează ultimele ' + BK_PASTREAZA + ' de fișiere de fiecare fel), fie, dacă browserul nu permite, ca descărcare a browserului (un fișier .zip pe zi). ' +
      'Lângă copie (.json, din care se face restaurarea) vine și registrul în Excel, pe modelul „Status Comenzi”, doar pentru consultat. Copia conține comenzile, adresele, încărcările, CMR-urile, notificările și setările; ' +
      'jurnalul de modificări intră doar când copia este făcută de un Administrator (ultimele ' + BK_JURNAL_ZILE + ' de zile la copia automată, tot la „Copie de siguranță acum”). ' +
      'O copie consumă câte o citire pentru fiecare document (câteva sute din cele 50.000 zilnice).</p>';
    if (bk.info === undefined) h += '<div class="mic" role="status">Se citește evidența copiilor…</div>';
    else if (!c) h += '<div class="nota atentie"><b>Copia automată nu este configurată.</b> Datele există acum doar în Firebase.' + (auto ? ' Ultima copie automată: ' + esc(bkCand(auto.t)) + '.' : '') + '</div>';
    else if (!auto) h += '<div class="nota atentie">Calculatorul de backup este setat, dar încă nu s-a făcut nicio copie automată.</div>';
    else h += '<div class="nota ' + (vechi ? 'rau' : 'bun') + '">Ultima copie automată: <b>' + esc(bkCand(auto.t)) + '</b> · ' + esc(auto.nume || '') + ' · ' + esc(auto.u || '') + ' · ' + bkNr(auto.comenzi) + ' comenzi · ' +
      bkNr(auto.doc) + ' documente · ' + bkNr(auto.kb) + ' KB · ' + esc(bkJurnalText(auto)) + '<br>Fișier: ' + esc(auto.fisier) + (auto.folder ? ' în folderul „' + esc(auto.folder) + '”' : auto.loc === 'descarcat' ? ' — pornit ca descărcare a browserului' : '') +
      (auto.excel ? (auto.loc === 'descarcat' ? '<br>Arhiva conține copia .json și registrul Excel: ' : '<br>Registru Excel: ') + esc(auto.excel) : auto.excelEr ? '<br><b>Registrul Excel nu a putut fi făcut:</b> ' + esc(auto.excelEr) : '') +
      (vechi ? '<br><b>Este mai veche de ' + BK_ZILE_AVERTIZARE + ' zile.</b> Verifică dacă aplicația este deschisă zilnic pe calculatorul de backup, cu un Operator date sau un Administrator.' : '') + '</div>';
    if (info.er && (!auto || info.er.t > auto.t)) h += '<div class="nota rau" style="margin-top:6px">Ultima încercare automată (' + esc(bkCand(info.er.t)) + ', ' + esc(info.er.u || '') + ') nu a reușit: ' + esc(info.er.msg || '') + '</div>';
    if (man) h += '<div class="mic" style="margin-top:6px">Ultima copie manuală: ' + esc(bkCand(man.t)) + ' · ' + esc(man.u || '') + ' · ' + esc(man.fisier) +
      (man.loc === 'folder' ? ' în folderul „' + esc(man.folder || '') + '”' + (man.excel ? ' + ' + esc(man.excel) : '') : ' (descărcată)') + ' · ' + esc(bkJurnalText(man)) + '</div>';
    h += '<table class="simplu bk-tabel" style="margin-top:10px"><tr><td>Calculatorul de backup</td><td>' + (c ? '<b>' + esc(c.nume) + '</b> — ' + (aici ? 'acest calculator' : 'alt calculator') +
      ' <span class="mic">(setat de ' + esc(c.de || '') + (c.t ? ' la ' + esc(bkCand(c.t)) : '') + ')</span>' : 'nesetat') + '</td></tr>' +
      (c ? '<tr><td>Cum se salvează copiile</td><td>' + (c.mod === 'descarcare' ? 'ca <b>descărcare a browserului</b>: un fișier .zip pe zi, în folderul de descărcări' : 'direct într-un <b>folder ales</b>') + '</td></tr>' : '') +
      (aici && c.mod !== 'descarcare' ? '<tr><td>Folderul de pe acest calculator</td><td id="bkFolder">…</td></tr>' : '') + '</table>';
    if (c && c.mod === 'descarcare') h += '<div class="nota atentie" style="margin-top:6px">La varianta cu descărcare aplicația nu poate verifica dacă fișierul a ajuns pe disc și nu poate șterge copiile vechi. ' +
      'Uită-te din când în când în folderul de descărcări al calculatorului de backup: trebuie să apară câte un „Backup Status Comenzi ….zip” pe zi; pe cele vechi le ștergi de mână.</div>';
    if (!bkSuportat()) h += '<div class="mic" style="margin-top:6px">Pe acest browser scrierea direct într-un folder nu este disponibilă; pentru copia automată se poate folosi varianta cu descărcare.</div>';
    h += '<div class="rand-form" style="margin-top:10px">' +
      (aici ? '<button class="btn" id="bkSeteaza">Modifică setările de backup…</button>' + (c.mod !== 'descarcare' ? '<button class="btn" id="bkFolderAlt">Schimbă folderul…</button>' : '') +
          '<button class="btn" id="bkOpreste">Oprește copia automată</button>'
        : '<button class="btn" id="bkSeteaza">' + (c ? 'Mută backup-ul pe acest calculator…' : 'Setează acest calculator ca și calculator de backup…') + '</button>' +
          (c ? '<button class="btn" id="bkOpreste">Oprește copia automată</button>' : '')) +
      '<button class="btn" id="bkAcum">Copie de siguranță acum</button><button class="btn rosu" id="bkRestaureaza">Restaurare din copie…</button></div></div>';
    return h;
  }
  function bkArataFolder() {
    if (!$('bkFolder')) return;
    bk.depozit.get('folder').then(function (h) {
      return bkPermisiune(h, false).then(function (p) {
        var el = $('bkFolder'); if (!el) return;
        el.innerHTML = p === 'lipsa' ? '<span class="nota rau">neales — apasă „Schimbă folderul…”</span>'
          : '<b>' + esc(h.name) + '</b> — ' + (p === 'granted' ? 'acces permis' : p === 'denied' ? 'acces refuzat în browser' : 'browserul va cere confirmarea la următoarea copie');
      });
    }).catch(function () { var el = $('bkFolder'); if (el) el.textContent = 'nu poate fi citit'; });
  }
  function bkSalveazaCfg(backup, text) {
    var cfg = Object.assign({}, SC.config);
    if (backup) cfg.backup = backup; else delete cfg.backup;
    return SC.store.tx(function (t) { t.set('meta', 'config', cfg); t.log(text); }).then(function () { SC.config = cfg; });
  }
  function bkClick(b) {
    if (!eAdmin()) return;
    if (b.id === 'bkSeteaza') bkSeteaza();
    else if (b.id === 'bkFolderAlt') {
      bkAlegeFolder().then(function (h) { if (h) { toast('Folderul de backup este acum „' + h.name + '”.', 'bun'); bkBanda(''); deseneazaAdmin(); } }).catch(arataEroare);
    } else if (b.id === 'bkOpreste') {
      var c = bkCfg();
      confirma('Oprești copia de siguranță automată de pe „' + (c ? c.nume : '') + '”?\nFișierele deja salvate rămân în folder.').then(function (ok) {
        if (!ok) return;
        return bkSalveazaCfg(null, 'Copie de siguranță: copia automată a fost oprită').then(function () { bkBanda(''); toast('Copia automată a fost oprită.', 'bun'); deseneazaAdmin(); });
      }).catch(arataEroare);
    } else if (b.id === 'bkAcum') {
      b.disabled = true; toast('Se face copia de siguranță…');
      (bkAici() && !bkDescarcare() && bkSuportat() ? bk.depozit.get('folder').then(function (h) { return bkPermisiune(h, true).then(function (p) { return p === 'granted' ? h : null; }); }) : Promise.resolve(null)).then(function (h) {
        return bkFa({ manual: true, folder: h });
      }).then(function (rez) {
        return L.backupNoteaza('manual', bkDateEvidenta(rez), 'Copie de siguranță manuală: ' + rez.fisier + ' (' + rez.comenzi + ' comenzi, ' + rez.doc + ' documente)').then(function () {
          toast(rez.loc === 'folder' ? 'Copie salvată în folderul „' + rez.folder + '”: ' + rez.fisier + (rez.excel ? ' și ' + rez.excel : '') : 'Copie descărcată: ' + rez.fisier + (rez.excel ? ' (copia .json și registrul Excel)' : '') + '. Ține-o într-un loc sigur.', 'bun');
          if (rez.excelEr) toast('Registrul Excel nu a putut fi făcut: ' + rez.excelEr + ' Copia .json este în regulă.', 'rau');
        });
      }).catch(arataEroare).then(function () { b.disabled = false; });
    } else if (b.id === 'bkRestaureaza') bkRestaureaza();
  }
  function bkSeteaza() {
    if (!bkDisp()) { alerta('Browserul nu permite păstrarea setărilor pe acest calculator (localStorage), deci nu poate fi calculator de backup.'); return; }
    var c = bkCfg(), aici = bkAici(), cuFolder = bkSuportat();
    var modAcum = aici ? (c.mod === 'descarcare' ? 'descarcare' : 'folder') : (cuFolder && !bkFolderBlocat() ? 'folder' : 'descarcare');
    var NOTE = {
      folder: 'La pasul următor alegi folderul în care se scriu copiile, de exemplu un folder nou din OneDrive („Backup Status Comenzi”). Browserul cere acordul pentru a scrie în el.',
      descarcare: '<b>Înainte de prima copie</b>, în setările browserului de pe acest calculator, la Descărcări: 1) alege ca loc al descărcărilor folderul în care vrei copiile (de exemplu un folder din OneDrive); ' +
        '2) oprește întrebarea „ce să fac cu fiecare descărcare”, ca fișierul să se salveze singur. Aplicația nu poate verifica dacă fișierul a ajuns pe disc și nu poate șterge copiile vechi.'
    };
    modal({
      titlu: 'Calculatorul de backup',
      html: (c && !aici ? '<div class="nota atentie">Copia automată este setată acum pe „' + esc(c.nume) + '”. Dacă continui, se mută pe acest calculator.</div>' : '') +
        '<p>Copia automată se va face <b>doar de pe acest calculator</b> (din acest browser), o dată pe zi, când aplicația este deschisă de un Operator date sau de un Administrator.</p>' +
        '<label class="camp"><span>Numele acestui calculator (apare în Administrare)</span><input type="text" id="bkNume" maxlength="40" value="' + esc(aici ? c.nume : c ? '' : 'PC Operator date') + '" placeholder="ex. PC Operator date"></label>' +
        '<fieldset class="bk-mod"><legend>Cum se salvează copiile</legend>' +
        '<label' + (cuFolder ? '' : ' class="oprit"') + '><input type="radio" name="bkMod" value="folder"' + (modAcum === 'folder' ? ' checked' : '') + (cuFolder ? '' : ' disabled') + '> <span><b>Direct într-un folder ales</b> — aplicația scrie copia .json și registrul Excel și păstrează singură ultimele ' + BK_PASTREAZA + '.' +
        (cuFolder ? ' Merge doar dacă browserul și regulile firmei permit.' : ' Nu este disponibil în acest browser.') + '</span></label>' +
        '<label><input type="radio" name="bkMod" value="descarcare"' + (modAcum === 'descarcare' ? ' checked' : '') + '> <span><b>Ca descărcare a browserului</b> — un fișier .zip pe zi (copia .json + registrul Excel), în folderul de descărcări al browserului. Pentru când alegerea unui folder nu este permisă.</span></label>' +
        '</fieldset><p class="mic" id="bkModNota">' + NOTE[modAcum] + '</p>',
      laDeschidere: function (rad) {
        Array.prototype.forEach.call(rad.querySelectorAll('input[name=bkMod]'), function (r) {
          r.addEventListener('change', function () { rad.querySelector('#bkModNota').innerHTML = NOTE[this.value]; });
        });
      },
      butoane: [{ t: 'Renunță', v: null }, {
        t: 'Continuă', cls: 'pri', fn: function (rad) {
          var nume = rad.querySelector('#bkNume').value.trim(), ales = rad.querySelector('input[name=bkMod]:checked');
          if (nume.length < 2) { toast('Scrie un nume pentru calculator.', 'rau'); return false; }
          var baza = { disp: bkDisp(), nume: nume, de: SC.store.user.nume, t: Date.now() };
          if (!ales || ales.value === 'descarcare') {
            baza.mod = 'descarcare';
            return bkSalveazaCfg(baza, 'Copie de siguranță: calculatorul de backup este „' + nume + '”, copiile se salvează ca descărcare a browserului').then(function () { return true; });
          }
          return bkAlegeFolder().then(function (h) {
            if (!h) return false;
            return bkSalveazaCfg(baza, 'Copie de siguranță: calculatorul de backup este „' + nume + '”, folderul „' + h.name + '”').then(function () { return true; });
          }, function (e) {
            if (!e || !e.folderBlocat) throw e;
            /* browserul a refuzat alegerea unui folder: ramane fereastra deschisa, cu varianta de descarcare aleasa */
            toast(e.message, 'rau');
            var d = rad.querySelector('input[name=bkMod][value=descarcare]'); d.checked = true; rad.querySelector('#bkModNota').innerHTML = NOTE.descarcare;
            return false;
          });
        }
      }]
    }).then(function (ok) {
      if (ok !== true) return;
      toast('Calculatorul de backup a fost setat. Fac prima copie…', 'bun');
      bk.incercari = 0; deseneazaAdmin();
      return bkAutomat(true, true).then(function () { deseneazaAdmin(); });
    }).catch(arataEroare);
  }

  /* ---- restaurarea dintr-o copie (doar Administrator) ---- */
  function bkAlegeJson() {
    return new Promise(function (ok) {
      var inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,.zip,application/json,application/zip'; inp.id = 'bkFisier'; inp.style.display = 'none';
      document.body.appendChild(inp);
      inp.onchange = function () { var f = inp.files && inp.files[0]; inp.remove(); if (f) ok(f); };
      inp.click();
    });
  }
  function bkPlanHtml(copie, acum, plan) {
    var randuri = [['comenzi', 'adrese', 'extra', 'notificari', 'cmr', 'meta'], copie.col.jurnal && acum.col.jurnal ? ['jurnal'] : []];
    var h = '<table class="simplu bk-plan"><tr><th></th><th class="nr">În copie</th><th class="nr">Acum</th><th class="nr">Se rescriu</th><th class="nr">Se șterg</th></tr>' +
      '<tr><td><b>Comenzi</b></td><td class="nr"><b>' + bkNr(L.backupNumaraComenzi(copie.col.comenzi)) + '</b></td><td class="nr"><b>' + bkNr(L.backupNumaraComenzi(acum.col.comenzi)) + '</b></td><td></td><td></td></tr>';
    randuri[0].concat(randuri[1]).forEach(function (col) {
      var p = plan.pe[col] || { scrie: 0, sterge: 0 };
      h += '<tr><td>' + esc(L.BACKUP_NUME[col]) + '</td><td class="nr">' + (copie.col[col] ? bkNr(Object.keys(copie.col[col]).length) : '—') + '</td><td class="nr">' + bkNr(Object.keys(acum.col[col] || {}).length) +
        '</td><td class="nr">' + bkNr(p.scrie) + '</td><td class="nr">' + bkNr(p.sterge) + '</td></tr>';
    });
    return h + '<tr><th>Total documente</th><th></th><th></th><th class="nr">' + bkNr(plan.nrScrie) + '</th><th class="nr">' + bkNr(plan.nrSterge) + '</th></tr></table>' +
      '<div class="mic" style="margin-top:4px">' + bkNr(plan.nrLaFel) + ' documente sunt identice și nu se ating. Consum: ' + bkNr(plan.nrScrie + plan.nrSterge) + ' scrieri din cele 20.000 zilnice ale planului gratuit.</div>';
  }
  function bkRestaureaza() {
    if (!eAdmin()) return;
    var fisier, copie;
    bkAlegeJson().then(function (f) {
      fisier = f; toast('Se citește copia…');
      return f.arrayBuffer();
    }).then(function (buf) {
      var octeti = new Uint8Array(buf);
      /* arhiva .zip facuta la varianta cu descarcare (incepe cu „PK”) sau direct fisierul .json */
      var text = octeti[0] === 0x50 && octeti[1] === 0x4B ? L.backupDinArhiva(octeti) : new TextDecoder('utf-8').decode(octeti);
      try { copie = JSON.parse(text); } catch (e) { throw L.eroare('Fișierul nu poate fi citit: nu este o copie de siguranță Status Comenzi întreagă.'); }
      var er = L.backupVerifica(copie); if (er) throw L.eroare(er);
      toast('Se compară copia cu datele de acum…');
      return L.backupCiteste(L.backupIntervalJurnal(copie), function (ce) { $('syncText').textContent = 'citesc: ' + ce.toLowerCase(); });
    }).then(function (acum) {
      marcheazaSync();
      var plan = L.backupPlan(copie, acum, true);
      var altMediu = copie.mod !== acum.mod || (copie.proiect || '') !== (acum.proiect || '');
      if (!plan.nrScrie && !plan.nrSterge) { alerta('Copia este identică cu datele de acum. Nu este nimic de restaurat.'); return null; }
      var html = '<div class="nota">Fișier: <b>' + esc(fisier.name) + '</b><br>Copie făcută la <b>' + esc(bkCand(copie.t)) + '</b> de ' + esc(copie.user || '?') + ' · aplicația ' + esc(copie.aplicatie || '?') +
        ' · ' + esc(bkJurnalText(copie)) + '</div>' +
        (altMediu ? '<div class="nota rau" style="margin-top:6px"><b>Copia provine din alt mediu</b> (' + esc(copie.mod === 'demo' ? 'mod demonstrație' : 'proiectul ' + (copie.proiect || '?')) + '). Continuă doar dacă știi că asta vrei.</div>' : '') +
        '<div id="bkPlan" style="margin-top:8px">' + bkPlanHtml(copie, acum, plan) + '</div>' +
        '<label class="bifa" style="margin-top:8px"><input type="checkbox" id="bkCuSetari" checked> <span>Restaurează și setările (clienți, reguli, adresele de email pentru CMR, exportul TMS)</span></label>' +
        '<div class="nota atentie" style="margin-top:8px"><b>Tot ce s-a modificat după ' + esc(bkCand(copie.t)) + ' se pierde</b>: comenzi adăugate, statusuri, încărcări, CMR-uri. ' +
        'Înainte de restaurare, starea de acum se salvează într-un fișier „' + esc(BK_PREFIX_INAINTE.trim()) + ' …”, din care se poate reveni. ' +
        (copie.col.jurnal ? 'Jurnalul nu se șterge: se adaugă doar orele care lipsesc. ' : 'Jurnalul de modificări rămâne cel de acum. ') + 'Utilizatorii și PIN-urile nu se schimbă.<br>' +
        'Cere colegilor să nu lucreze în aplicație până se termină și apoi să reîncarce pagina (Ctrl+F5).</div>' +
        '<label class="camp" style="margin-top:8px"><span>Scrie RESTAUREZ pentru confirmare</span><input type="text" id="bkConfirm" autocomplete="off"></label>';
      return modal({
        titlu: 'Restaurare din copia de siguranță', lat: true, html: html,
        laDeschidere: function (rad) {
          rad.querySelector('#bkCuSetari').addEventListener('change', function () {
            rad.querySelector('#bkPlan').innerHTML = bkPlanHtml(copie, acum, L.backupPlan(copie, acum, this.checked));
          });
        },
        butoane: [{ t: 'Renunță', v: null }, {
          t: 'Restaurează', cls: 'pri', fn: function (rad) {
            if (rad.querySelector('#bkConfirm').value.trim().toUpperCase() !== 'RESTAUREZ') { toast('Scrie RESTAUREZ în câmpul de confirmare.', 'rau'); return false; }
            return { cuSetari: rad.querySelector('#bkCuSetari').checked };
          }
        }]
      });
    }).then(function (ales) {
      if (!ales) return;
      var plan, rezInainte;
      toast('Restaurare în curs… nu închide pagina.');
      /* starea se citeste inca o data chiar inainte de scriere: planul si fisierul „inainte de restaurare” sunt cele de acum */
      return L.backupCiteste(L.backupIntervalJurnal(copie), function (ce) { $('syncText').textContent = 'citesc: ' + ce.toLowerCase(); }).then(function (acum) {
        plan = L.backupPlan(copie, acum, ales.cuSetari);
        return (bkAici() && bkSuportat() ? bk.depozit.get('folder').then(function (h) { return bkPermisiune(h, false).then(function (p) { return p === 'granted' ? h : null; }); }) : Promise.resolve(null)).then(function (h) {
          return bkSalveaza(acum, bkNumeFisier(BK_PREFIX_INAINTE, acum.t, false), h);
        });
      }).then(function (rez) {
        rezInainte = rez;
        opresteUrmarireaComenzilor();
        return L.backupAplica(plan, 'Restaurare din copia de siguranță „' + fisier.name + '” (făcută la ' + bkCand(copie.t) + ' de ' + (copie.user || '?') + '): ' +
          plan.nrScrie + ' documente rescrise, ' + plan.nrSterge + ' șterse' + (ales.cuSetari ? ', cu setări' : ', fără setări') + '. Starea dinainte: ' + rez.fisier,
          function (a, b) { $('syncText').textContent = 'restaurare ' + a + '/' + b; });
      }).then(function () {
        L.golesteCache(); kpUitaArhiva(); stare.primaData = true;
        repornesteUrmarireaComenzilor();
        return alerta('Restaurare terminată.\n\nDocumente rescrise: ' + plan.nrScrie + '\nDocumente șterse: ' + plan.nrSterge + '\n\nStarea dinainte a fost salvată în:\n' + rezInainte.fisier +
          (rezInainte.loc === 'folder' ? ' (folderul „' + rezInainte.folder + '”)' : ' (descărcat)') + '\n\nCere colegilor să reîncarce pagina (Ctrl+F5).');
      }, function (e) { if (!stare.pornit) repornesteUrmarireaComenzilor(); throw e; });
    }).catch(function (e) { marcheazaSync(); arataEroare(e); });
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
  SC._test = { stare: stare, schimbaStatus: schimbaStatus, redeseneaza: redeseneaza, bk: bk, bkAutomat: bkAutomat };
})();
