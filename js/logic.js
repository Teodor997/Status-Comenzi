/* Status Comenzi - regulile registrului (portate din VBA): grupe, Nr Crt, statusuri, adrese, importuri */
(function () {
  'use strict';
  var SC = window.SC, ST = SC.ST;
  var L = SC.L = {};

  SC.grupe = {};        // id grupa -> document
  SC.comenzi = [];      // toate comenzile incarcate, sortate dupa Nr Crt
  SC.dupaNr = {};       // Nr Crt -> comanda
  SC.config = JSON.parse(JSON.stringify(SC.CONFIG_IMPLICIT));
  SC.adrese = [];       // [{id, cl, cod, nume, str, loc, jud, _c}]
  SC.extra = [];        // liniile din fisierul de transport care nu exista in registru: [{ref, cl, de, na, nt, dtr, ..., _zi, _k}]
  var adrNorm = null;   // cache normalizat pentru cautari

  /* ---------- grupe ---------- */
  L.curata = function (o) {
    Object.keys(o).forEach(function (k) { if (o[k] == null || o[k] === '') delete o[k]; });
    return o;
  };
  L.recalc = function (g) {
    var act = 0, chei = {}, cmin = 0, cmax = 0, n0 = 0, timpi = [];
    Object.keys(g.o).forEach(function (n) {
      var o = g.o[n];
      if (SC.esteActiva(o)) act++;
      var k = SC.cheieComanda(o.nc); if (k) chei[k] = 1;
      var ct = o.ct || 0;
      if (ct) { timpi.push(ct); if (!cmin || ct < cmin) cmin = ct; if (ct > cmax) cmax = ct; }
      if (!n0 || +n < n0) n0 = +n;
    });
    /* cmed = momentul median al introducerii comenzilor din grupa: dupa el se cauta istoricul pe perioada
       (cmax poate fi tras in sus de o singura comanda reintrodusa mai tarziu) */
    timpi.sort(function (a, b) { return a - b; });
    g.act = act; g.k = Object.keys(chei); g.cmin = cmin; g.cmax = cmax; g.cmed = timpi.length ? timpi[Math.floor(timpi.length / 2)] : 0; g.n0 = n0; g.upd = Date.now();
    return g;
  };
  L.aplicaGrupe = function (lista) {
    if (!lista || !lista.length) return false;
    lista.forEach(function (d) { SC.grupe[d.id] = d.data; });
    var toate = [], idx = {};
    Object.keys(SC.grupe).forEach(function (id) {
      var o = SC.grupe[id].o || {};
      /* judetul apare peste tot in forma „Bucuresti”, si la comenzile salvate mai demult cu majuscule (fara nicio scriere in baza de date) */
      Object.keys(o).forEach(function (n) { var c = o[n]; c.n = +n; if (c.ju) c.ju = SC.fmtJudet(c.ju); toate.push(c); idx[+n] = c; });
      SC.rev = (SC.rev || 0) + 1;
    });
    toate.sort(function (a, b) { return a.n - b.n; });
    SC.comenzi = toate; SC.dupaNr = idx;
    return true;
  };
  L.golesteCache = function () { SC.grupe = {}; SC.comenzi = []; SC.dupaNr = {}; };

  /* Modifica una sau mai multe comenzi existente intr-o singura tranzactie.
     modificari: [{n, fn(o)}]; fn poate arunca eroare (tranzactia se anuleaza). */
  var FARA_JURNAL = { ut: 1, uu: 1, ct: 1, cu: 1, n: 1, _h: 1, jd: 1, tr: 1, prm: 1, gfm: 1, _zi: 1, _k: 1, tx: 1, txu: 1, txm: 1 };
  function scurt(v) { var s = String(v); return s.length > 60 ? s.slice(0, 57) + '…' : s; }
  /* "Camp: vechi → nou; ..." pentru jurnal; '' daca nu s-a schimbat nimic */
  L.diferente = function (a, b) {
    var chei = {}, parti = [];
    Object.keys(a).concat(Object.keys(b)).forEach(function (k) { if (!FARA_JURNAL[k]) chei[k] = 1; });
    Object.keys(chei).forEach(function (k) {
      var x = a[k] == null ? '' : a[k], y = b[k] == null ? '' : b[k];
      if (String(x) === String(y)) return;
      var nume = SC.COL[k] ? SC.COL[k].t : (k === 'ar' ? 'Arhivată' : k === 'ipr' ? 'Paleți numărați la încărcare' : k === 'iam' ? 'Amprente numărate la încărcare' : k === 'xnt' ? 'Scoasă la încărcare de pe transportul' : k === 'mnt' ? 'Trecută de mână pe transportul' : k);
      parti.push(nume + ': ' + (x === '' ? '(gol)' : scurt(x)) + ' → ' + (y === '' ? '(gol)' : scurt(y)));
    });
    return parti.join('; ');
  };
  /* optiuni: faraDetalii = in jurnal intra doar textul de ansamblu (operatii in masa fara interes pe comanda) */
  L.modifica = function (modificari, textJurnal, opt) {
    opt = opt || {};
    var ids = {}, user = SC.store.user ? SC.store.user.nume : '?';
    modificari.forEach(function (m) { ids[SC.idGrupa(m.n)] = 1; });
    var listaId = Object.keys(ids);
    return SC.store.tx(function (t) {
      /* opt.citeste / opt.scrie: un document in plus citit si scris in aceeasi tranzactie (ex. notificarea), ca sa nu existe una fara cealalta */
      return Promise.all([Promise.all(listaId.map(function (id) { return t.get('comenzi', id); })), opt.citeste ? opt.citeste(t) : null]).then(function (rr) {
        var docs = rr[0], g = {}, linii = [], schimbate = {};
        listaId.forEach(function (id, i) { g[id] = docs[i]; });
        modificari.forEach(function (m) {
          var gr = g[SC.idGrupa(m.n)], o = gr && gr.o && gr.o[m.n];
          if (!o) throw eroare('Comanda cu Nr Crt ' + m.n + ' nu mai există în baza de date.');
          if (o.ju) o.ju = SC.fmtJudet(o.ju);      /* inainte de comparare: rescrierea cu litere mici nu apare in jurnal ca modificare */
          var inainte = JSON.parse(JSON.stringify(o));
          o.n = m.n;
          m.fn(o);
          delete o.n;
          if (o.ju) o.ju = SC.fmtJudet(o.ju);
          L.curata(o);
          var d = L.diferente(inainte, o);
          if (d) {
            o.ut = Date.now(); o.uu = user; schimbate[m.n] = { inainte: inainte, dupa: o };
            if (!opt.faraDetalii) linii.push(((o.cl || inainte.cl || '') + ' ' + (o.nc || inainte.nc || '')).trim() + ' (Nr Crt ' + m.n + ') — ' + d);
          }
        });
        var rez = listaId.map(function (id) { L.recalc(g[id]); t.set('comenzi', id, g[id]); return { id: id, data: g[id] }; });
        /* fiecare modificare ramane in jurnal cu valoarea veche si cea noua */
        if (textJurnal && (modificari.length > 1 || opt.faraDetalii || opt.cuText)) t.log(textJurnal);
        linii.forEach(function (x) { t.log(x); });
        if (opt.scrie) opt.scrie(t, rr[1], schimbate);
        return rez;
      });
    }).then(function (rez) { L.aplicaGrupe(rez); return rez; });
  };

  /* ---------- notificari (raman salvate in baza de date, un document pe luna) ---------- */
  SC.notif = [];
  L.lunaNotif = function (ms) { var d = ms ? new Date(ms) : new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2); };
  L.seteazaNotificari = function (docs) {
    var l = [];
    docs.forEach(function (d) {
      var e = d.data.e || {};
      Object.keys(e).forEach(function (k) { var x = e[k]; x._luna = d.id; x._k = k; l.push(x); });
    });
    l.sort(function (a, b) { return b.t - a.t; });
    /* notificarile despre transporturi modificate conteaza doar cateva zile */
    var pragTra = Date.now() - L.NOTIF_TRA_ZILE * 86400000;
    SC.notif = l.filter(function (x) { return x.tip !== 'tra' || x.t >= pragTra; });
  };
  /* Notificari pentru Incarcari: transporturile care erau deja in aplicatie si au fost incarcate din nou cu modificari.
     lista = [{ nt, na, zi, linii: [text], tiparit }]. Se scriu in documentul lunii, o singura scriere; cele mai vechi de
     NOTIF_TRA_ZILE zile se scot cu aceasta ocazie (modificarile raman oricum in jurnal), ca documentul sa ramana mic. */
  L.NOTIF_TRA_ZILE = 7;
  L.notificaTransport = function (lista, numeFisier) {
    if (!lista || !lista.length) return Promise.resolve(0);
    var acum = Date.now(), luna = L.lunaNotif(acum), user = SC.store.user ? SC.store.user.nume : '?';
    return SC.store.tx(function (t) {
      return t.get('notificari', luna).then(function (doc) {
        doc = doc || { e: {} }; doc.e = doc.e || {};
        var prag = acum - L.NOTIF_TRA_ZILE * 86400000;
        Object.keys(doc.e).forEach(function (k) { if (doc.e[k].tip === 'tra' && doc.e[k].t < prag) delete doc.e[k]; });
        lista.forEach(function (x, i) {
          var text = x.linii.join(' · ');
          if (text.length > 600) text = text.slice(0, 597) + '…';
          doc.e[acum + '_t' + i] = L.curata({ t: acum, u: user, tip: 'tra', nt: x.nt, na: x.na, zi: x.zi, txt: text, bt: x.tiparit || '', f: numeFisier });
        });
        doc.upd = acum;
        t.set('notificari', luna, doc);
        return lista.length;
      });
    });
  };
  /* Transport: schimba data de livrare a unei comenzi; in aceeasi tranzactie se salveaza notificarea pentru Operatorul de date */
  L.schimbaLivrare = function (n, nou) {
    var acum = Date.now(), luna = L.lunaNotif(acum), user = SC.store.user ? SC.store.user.nume : '?';
    return L.modifica([{
      n: n, fn: function (x) {
        if (x.st === ST.ANU) throw eroare('Comanda ' + x.nc + ' este anulată; data de livrare nu mai poate fi schimbată.');
        if (x.inc === 'DA') throw eroare('Comanda ' + x.nc + ' este deja încărcată; data de livrare nu mai poate fi schimbată.');
        x.dl = nou;
      }
    }], null, {
      citeste: function (t) { return t.get('notificari', luna); },
      scrie: function (t, doc, schimbate) {
        var s = schimbate[n]; if (!s) return;
        doc = doc || { e: {} }; doc.e = doc.e || {};
        doc.e[acum + '_' + n] = L.curata({ t: acum, u: user, tip: 'dl', n: n, cl: s.dupa.cl, nc: s.dupa.nc, de: s.dupa.de, v: s.inainte.dl, nou: nou });
        doc.upd = acum;
        t.set('notificari', luna, doc);
      }
    });
  };
  /* ---------- CMR (scrisoare de transport international) ----------
     Fiecare CMR emis ramane salvat in „cmr/AAAA-LL” (un document pe luna); „cmr/_setari” tine minte, pe client,
     expeditorul, descrierea marfii si instructiunile folosite ultima data. */
  L.citesteCmr = function () {
    var acum = new Date(), dela = new Date(acum.getFullYear(), acum.getMonth() - 2, 1);
    return Promise.all([SC.store.citesteInterval('cmr', L.lunaNotif(dela.getTime()), L.lunaNotif()), SC.store.citesteDoc('cmr', '_setari')]).then(function (r) {
      var l = [];
      (r[0] || []).forEach(function (d) { var e = (d.data || {}).e || {}; Object.keys(e).forEach(function (k) { l.push(e[k]); }); });
      l.sort(function (a, b) { return (b.t || 0) - (a.t || 0); });
      return { lista: l, setari: r[1] || {} };
    });
  };
  L.cheieClientCmr = function (cl) { return String(cl || '').trim().toUpperCase() || '-'; };
  L.salveazaCmr = function (c) {
    var acum = Date.now(), user = SC.store.user ? SC.store.user.nume : '?', nou = !c.id;
    c = JSON.parse(JSON.stringify(c));
    if (nou) { c.id = String(acum); c.luna = L.lunaNotif(acum); c.t = acum; c.u = user; } else { c.ut = acum; c.uu = user; }
    return SC.store.tx(function (t) {
      return Promise.all([t.get('cmr', c.luna), t.get('cmr', '_setari')]).then(function (r) {
        var doc = r[0] || { e: {} }, s = r[1] || {};
        doc.e = doc.e || {}; doc.e[c.id] = c; doc.upd = acum;
        t.set('cmr', c.luna, doc);
        s.cl = s.cl || {};
        s.cl[L.cheieClientCmr(c.cl)] = { exp: c.exp || '', marfa: c.marfa || '', instr: c.instr || '' };
        s.loc = c.loc || ''; s.st = c.st || ''; s.so = c.so || ''; s.kg = c.kg; s.upd = acum;
        t.set('cmr', '_setari', s);
        t.log('CMR ' + (nou ? 'emis' : 'modificat') + ': ' + c.cl + ' → ' + c.de + ' (' + (c.nc || []).join(', ') + ')');
      });
    }).then(function () { return c; });
  };
  L.stergeCmr = function (c) {
    return SC.store.tx(function (t) {
      return t.get('cmr', c.luna).then(function (doc) {
        if (!doc || !doc.e || !doc.e[c.id]) return;
        delete doc.e[c.id]; doc.upd = Date.now();
        t.set('cmr', c.luna, doc);
        t.log('CMR șters: ' + c.cl + ' → ' + c.de + ' (' + (c.nc || []).join(', ') + ')');
      });
    });
  };
  /* Operatorul de date confirma ca a vazut notificarile (ramane cine si cand) */
  L.vazutNotificari = function (lista) {
    var peLuna = {}, user = SC.store.user ? SC.store.user.nume : '?', acum = Date.now();
    lista.forEach(function (x) { (peLuna[x._luna] = peLuna[x._luna] || []).push(x._k); });
    return Promise.all(Object.keys(peLuna).map(function (luna) {
      return SC.store.tx(function (t) {
        return t.get('notificari', luna).then(function (doc) {
          if (!doc || !doc.e) return;
          peLuna[luna].forEach(function (k) { if (doc.e[k] && !doc.e[k].vz) doc.e[k].vz = { u: user, t: acum }; });
          doc.upd = acum; t.set('notificari', luna, doc);
        });
      });
    }));
  };

  /* Adauga comenzi noi; Nr Crt se aloca dintr-un contor unic (fara dubluri intre colegi). */
  L.creeaza = function (comenziNoi, textJurnal) {
    var PAS = 250, parti = [], total = [];
    for (var i = 0; i < comenziNoi.length; i += PAS) parti.push(comenziNoi.slice(i, i + PAS));
    var user = SC.store.user ? SC.store.user.nume : '?';
    function unPas(idx) {
      if (idx >= parti.length) return Promise.resolve(total);
      var parte = parti[idx];
      return SC.store.tx(function (t) {
        return t.get('meta', 'contor').then(function (c) {
          var ultim = (c && c.ultim) || 0, numere = [], ids = {};
          parte.forEach(function (_, j) { var n = ultim + 1 + j; numere.push(n); ids[SC.idGrupa(n)] = 1; });
          var listaId = Object.keys(ids);
          return Promise.all(listaId.map(function (id) { return t.get('comenzi', id); })).then(function (docs) {
            var g = {}, acum = Date.now();
            listaId.forEach(function (id, k) { g[id] = docs[k] || { o: {} }; });
            parte.forEach(function (src, j) {
              var o = L.curata(JSON.parse(JSON.stringify(src)));
              delete o.n;
              if (o.ju) o.ju = SC.fmtJudet(o.ju);
              o.ct = acum; o.cu = user;
              g[SC.idGrupa(numere[j])].o[numere[j]] = o;
            });
            var rez = listaId.map(function (id) { L.recalc(g[id]); t.set('comenzi', id, g[id]); return { id: id, data: g[id] }; });
            t.set('meta', 'contor', { ultim: ultim + parte.length });
            if (textJurnal) t.log(textJurnal + ' (Nr Crt ' + numere[0] + (numere.length > 1 ? '–' + numere[numere.length - 1] : '') + ')');
            return { rez: rez, numere: numere };
          });
        });
      }).then(function (r) { L.aplicaGrupe(r.rez); total = total.concat(r.numere); return unPas(idx + 1); });
    }
    return unPas(0);
  };

  /* Sterge definitiv comenzi din registru (folosit doar la curatarea liniilor adaugate gresit din transport). */
  L.sterge = function (numere, textJurnal) {
    var i = 0;
    function pas() {
      if (i >= numere.length) return Promise.resolve();
      var buc = numere.slice(i, i + 150), ids = {}; i += 150;
      buc.forEach(function (n) { ids[SC.idGrupa(n)] = 1; });
      var listaId = Object.keys(ids);
      return SC.store.tx(function (t) {
        return Promise.all(listaId.map(function (id) { return t.get('comenzi', id); })).then(function (docs) {
          var g = {};
          listaId.forEach(function (id, j) { g[id] = docs[j] || { o: {} }; });
          buc.forEach(function (n) { delete g[SC.idGrupa(n)].o[n]; });
          var rez = listaId.map(function (id) { L.recalc(g[id]); t.set('comenzi', id, g[id]); return { id: id, data: g[id] }; });
          t.log(textJurnal + ' (' + buc.length + ' rânduri, Nr Crt ' + buc[0] + '–' + buc[buc.length - 1] + ')');
          return rez;
        });
      }).then(function (rez) { L.aplicaGrupe(rez); return pas(); });
    }
    return pas();
  };

  /* Cauta in toata baza de date (nu doar in ce e incarcat) comenzile cu numerele date.
     Intoarce {cheie: [comenzi]} */
  L.cautaComenzi = function (numere) {
    var rez = {}, deCautat = [];
    numere.forEach(function (nr) {
      var k = SC.cheieComanda(nr);
      if (k && !rez[k]) { rez[k] = []; deCautat.push(k); }
    });
    /* ce se gaseste deja in comenzile incarcate nu se mai cauta in baza de date (economie de citiri) */
    var inCache = {};
    SC.comenzi.forEach(function (o) { var k = SC.cheieComanda(o.nc); if (rez[k]) inCache[k] = 1; });
    deCautat = deCautat.filter(function (k) { return !inCache[k]; });
    return (deCautat.length ? SC.store.cautaChei(deCautat) : Promise.resolve([])).then(function (grupe) {
      /* grupele gasite sunt mai proaspete decat cache-ul doar daca nu sunt urmarite in timp real */
      var noi = grupe.filter(function (d) { return !SC.grupe[d.id] || (SC.grupe[d.id].upd || 0) < (d.data.upd || 0); });
      L.aplicaGrupe(noi);
      SC.comenzi.forEach(function (o) {
        var k = SC.cheieComanda(o.nc);
        if (rez[k]) rez[k].push(o);
      });
      return rez;
    });
  };

  function eroare(msg) { var e = new Error(msg); e.prietenos = true; return e; }
  L.eroare = eroare;

  /* Regula: la o comanda pregatita (Terminata / Self-Pick) paletii reali = FPP + Pick.
     Amprentele urmeaza suma cat timp nu au fost modificate separat (erau egale cu paletii reali sau goale). */
  L.sincPaleti = function (x) {
    if (x.st !== ST.TER && x.st !== ST.SELF) return false;
    if (!SC.esteNum(x.fpp) || !SC.esteNum(x.pk)) return false;
    var nou = x.fpp + x.pk, vechi = x.pr;
    if (nou === vechi) return false;
    var urmeaza = !SC.esteNum(x.am) || x.am === vechi;
    x.pr = nou;
    if (urmeaza) x.am = nou;
    if (L.greutateAuto(x) && !x.cum) x.gf = SC.rotunjeste(x.g + nou * SC.config.kgPalet);
    return true;
  };

  /* ---------- statusuri ---------- */
  /* Aplica un status pe comanda (in tranzactie). date = {pr, am, gf} pentru Terminata / Self-Pick. */
  L.aplicaStatus = function (o, st, date) {
    var cfg = SC.config;
    if (st === ST.INI || st === ST.LUC) {
      delete o.dp; delete o.op;
    } else if (st === ST.TER || st === ST.SELF) {
      var auto = SC.normText(o.cl) === SC.normText(cfg.clientGreutateAuto) && SC.esteNum(o.g);
      o.pr = date.pr; o.am = date.am;
      if (date.fpp != null) o.fpp = date.fpp;
      if (date.pk != null) o.pk = date.pk;
      if (date.cumul) {
        /* comanda dintr-un cumul: greutatea ramane cea din tabel (goala daca e goala), fara calcul si fara intrebare */
        if (SC.esteNum(o.g)) o.gf = o.g; else delete o.gf;
      } else if (auto) {
        o.gf = SC.rotunjeste(o.g + date.pr * cfg.kgPalet);
      } else {
        o.gf = date.gf;
        if (SC.gol(o.g)) o.g = date.gf;
      }
      o.dp = SC.azi(); o.op = SC.oraAcum();
      if (st === ST.SELF) o.co = 'RIDICARE CLIENT';
    } else if (st === ST.ANU) {
      SC.CAMPURI_ANULARE.forEach(function (k) { delete o[k]; });
      o.co = 'COMANDA ANULATA';
      o.dp = SC.azi(); o.op = SC.oraAcum();
    }
    o.st = st;
  };
  /* greutatea finala se calculeaza automat? (KANDIA cu Greutate numerica) */
  L.greutateAuto = function (o) {
    return SC.normText(o.cl) === SC.normText(SC.config.clientGreutateAuto) && SC.esteNum(o.g);
  };

  /* ---------- Adrese ---------- */
  function normCod(v) {
    var s = SC.normText(v);
    if (/^\d+(\.0+)?$/.test(s)) s = s.replace(/\.0+$/, '').replace(/^0+(?=\d)/, '');
    return s;
  }
  L.seteazaAdrese = function (docs) {
    var l = [];
    docs.forEach(function (d) { (d.data.r || []).forEach(function (r) { r._c = d.id; if (r.jud) r.jud = SC.fmtJudet(r.jud); l.push(r); }); });
    SC.adrese = l; adrNorm = null;
  };
  function norm() {
    if (adrNorm) return adrNorm;
    adrNorm = SC.adrese.map(function (a) {
      return {
        a: a, cl: SC.normText(a.cl), cod: normCod(a.cod), nume: SC.normText(a.nume), str: SC.normText(a.str),
        loc: SC.normText(a.loc), jud: String(a.jud || '').trim(), locN: SC.normLoc(a.loc), strN: SC.normLoc(a.str),
        judN: SC.normLoc(a.jud)
      };
    });
    return adrNorm;
  }
  L.adresaDupaCod = function (client, cod) {
    var c = normCod(cod), cl = SC.normText(client);
    if (!c) return null;
    var l = norm();
    for (var i = 0; i < l.length; i++) if (l[i].cl === cl && l[i].cod === c) return l[i].a;
    return null;
  };
  /* nume + strada; apoi nume + localitate; apoi doar nume, daca e unic */
  L.adresaDupaNume = function (client, nume, strada, localitate) {
    var cl = SC.normText(client), nN = SC.normText(nume), nS = SC.normText(strada), nL = SC.normText(localitate);
    if (!nN) return null;
    var l = norm(), pLoc = null, pNume = null, nr = 0;
    for (var i = 0; i < l.length; i++) {
      var r = l[i];
      if (r.cl !== cl || r.nume !== nN) continue;
      nr++; pNume = r.a;
      if (nS && r.str === nS) return r.a;
      if (nL && !pLoc && r.loc === nL) pLoc = r.a;
    }
    return pLoc || (nr === 1 ? pNume : null);
  };
  L.judetDupaLocalitate = function (localitate) {
    var nLoc = SC.normLoc(localitate);
    if (!nLoc) return '';
    var l = norm(), exact = {}, partial = {}, inAdr = {};
    for (var i = 0; i < l.length; i++) {
      var r = l[i];
      if (!r.jud) continue;
      if (r.judN === nLoc) return r.jud;
      if ((nLoc.slice(0, 6) === 'sector' || nLoc.indexOf('bucuresti') >= 0) && r.judN === 'bucuresti') return r.jud;
      if (r.locN) {
        if (r.locN === nLoc) exact[r.jud] = (exact[r.jud] || 0) + 1;
        else if (nLoc.length >= 4 && (r.locN.indexOf(nLoc) >= 0 || nLoc.indexOf(r.locN) >= 0)) partial[r.jud] = (partial[r.jud] || 0) + 1;
      }
      if (nLoc.length >= 4 && r.strN.indexOf(nLoc) >= 0) inAdr[r.jud] = (inAdr[r.jud] || 0) + 1;
    }
    function top(m) { var b = '', mx = 0; Object.keys(m).forEach(function (k) { if (m[k] > mx) { mx = m[k]; b = k; } }); return b; }
    return top(exact) || top(partial) || top(inAdr);
  };
  /* ---- sugestia de judet dupa oras ----
     Lista judetelor (scrise fara diacritice, ca in registru) si orasele fiecaruia: resedintele, municipiile si localitatile
     mari din jurul lor. Numele care exista in mai multe judete (Floresti, Domnesti, Magurele...) lipsesc intentionat:
     pentru ele, ca si pentru orice localitate care nu este in lista, sugestia vine din Adrese. */
  var JUDETE_ORASE = {
    'Alba': 'Alba Iulia, Aiud, Blaj, Sebes, Cugir, Ocna Mures, Campeni, Zlatna, Abrud, Teius',
    'Arad': 'Arad, Lipova, Pecica, Santana, Curtici, Nadlac, Chisineu Cris',
    'Arges': 'Pitesti, Mioveni, Campulung, Campulung Muscel, Curtea de Arges, Topoloveni',
    'Bacau': 'Bacau, Onesti, Moinesti, Comanesti, Buhusi, Targu Ocna',
    'Bihor': 'Oradea, Salonta, Marghita, Beius, Alesd, Stei',
    'Bistrita-Nasaud': 'Bistrita, Beclean, Nasaud, Sangeorz Bai',
    'Botosani': 'Botosani, Dorohoi, Darabani, Flamanzi',
    'Braila': 'Braila, Ianca, Insuratei, Faurei',
    'Brasov': 'Brasov, Fagaras, Zarnesti, Codlea, Rasnov, Predeal, Ghimbav, Rupea',
    'Bucuresti': 'Bucuresti, Bucharest, Sector',
    'Buzau': 'Buzau, Ramnicu Sarat, Rm Sarat, Nehoiu',
    'Calarasi': 'Calarasi, Oltenita, Fundulea, Lehliu Gara',
    'Caras-Severin': 'Resita, Caransebes, Bocsa, Oravita, Moldova Noua, Otelu Rosu, Baile Herculane',
    'Cluj': 'Cluj Napoca, Cluj, Turda, Dej, Campia Turzii, Gherla, Huedin, Apahida',
    'Constanta': 'Constanta, Mangalia, Medgidia, Navodari, Cernavoda, Ovidiu, Eforie, Eforie Nord, Eforie Sud, Harsova, Murfatlar, Techirghiol, Valu lui Traian, Agigea, Cumpana',
    'Covasna': 'Sfantu Gheorghe, Sf Gheorghe, Targu Secuiesc, Covasna, Baraolt, Intorsura Buzaului',
    'Dambovita': 'Targoviste, Moreni, Pucioasa, Gaesti, Titu, Fieni, Racari',
    'Dolj': 'Craiova, Bailesti, Calafat, Filiasi, Segarcea, Dabuleni',
    'Galati': 'Galati, Tecuci, Targu Bujor, Beresti',
    'Giurgiu': 'Giurgiu, Bolintin Vale, Bolintin Deal',
    'Gorj': 'Targu Jiu, Tg Jiu, Motru, Rovinari, Bumbesti Jiu, Targu Carbunesti, Novaci, Turceni, Tismana, Ticleni',
    'Harghita': 'Miercurea Ciuc, Odorheiu Secuiesc, Gheorgheni, Toplita, Cristuru Secuiesc, Vlahita, Borsec',
    'Hunedoara': 'Deva, Hunedoara, Petrosani, Petrila, Orastie, Simeria, Hateg, Calan, Uricani',
    'Ialomita': 'Slobozia, Fetesti, Urziceni, Tandarei, Amara',
    'Iasi': 'Iasi, Pascani, Harlau, Targu Frumos, Podu Iloaiei',
    'Ilfov': 'Voluntari, Buftea, Popesti Leordeni, Bragadiru, Chitila, Otopeni, Chiajna, Mogosoaia, Stefanestii de Jos, Tunari, Dragomiresti Vale, Jilava, Cernica, Balotesti, Snagov, Corbeanca, Clinceni, Glina, Dobroesti',
    'Maramures': 'Baia Mare, Sighetu Marmatiei, Sighet, Baia Sprie, Viseu de Sus, Targu Lapus, Seini, Somcuta Mare, Cavnic',
    'Mehedinti': 'Drobeta Turnu Severin, Turnu Severin, Orsova, Strehaia, Vanju Mare, Baia de Arama',
    'Mures': 'Targu Mures, Tg Mures, Reghin, Sighisoara, Tarnaveni, Ludus, Sovata, Iernut',
    'Neamt': 'Piatra Neamt, Roman, Targu Neamt, Tg Neamt, Roznov',
    'Olt': 'Slatina, Caracal, Bals, Corabia, Scornicesti, Draganesti Olt',
    'Prahova': 'Ploiesti, Campina, Baicoi, Mizil, Comarnic, Valenii de Munte, Boldesti Scaeni, Sinaia, Busteni, Azuga, Urlati, Plopeni',
    'Salaj': 'Zalau, Simleu Silvaniei, Jibou, Cehu Silvaniei',
    'Satu Mare': 'Satu Mare, Carei, Negresti Oas, Tasnad',
    'Sibiu': 'Sibiu, Medias, Cisnadie, Avrig, Agnita, Selimbar, Copsa Mica, Talmaciu',
    'Suceava': 'Suceava, Falticeni, Radauti, Campulung Moldovenesc, Vatra Dornei, Gura Humorului, Siret',
    'Teleorman': 'Alexandria, Rosiorii de Vede, Rosiori de Vede, Turnu Magurele, Zimnicea, Videle',
    'Timis': 'Timisoara, Lugoj, Sannicolau Mare, Jimbolia, Recas, Faget, Deta, Buzias, Giroc, Ghiroda, Mosnita Noua',
    'Tulcea': 'Tulcea, Babadag, Macin, Isaccea, Sulina',
    'Valcea': 'Ramnicu Valcea, Rm Valcea, Dragasani, Calimanesti, Horezu, Brezoi, Baile Olanesti, Baile Govora, Ocnele Mari',
    'Vaslui': 'Vaslui, Barlad, Husi',
    'Vrancea': 'Focsani, Adjud, Marasesti, Panciu'
  };
  var judeteN = {}, oraseN = {};
  Object.keys(JUDETE_ORASE).forEach(function (j) {
    judeteN[SC.normLoc(j)] = j;
    JUDETE_ORASE[j].split(',').forEach(function (o) { oraseN[SC.normLoc(o)] = j; });
  });
  /* numele corect al judetului daca textul este un judet (oricum ar fi scris), altfel '' */
  L.numeJudet = function (v) { return judeteN[SC.normLoc(v)] || ''; };
  /* judetul sugerat pentru un oras: intai lista de orase, apoi Adrese (doar daca de acolo iese un judet adevarat) */
  L.sugestieJudet = function (oras) {
    var n = SC.normLoc(oras);
    if (!n) return '';
    if (oraseN[n]) return oraseN[n];
    if (n.indexOf('bucuresti') >= 0) return 'Bucuresti';
    return L.numeJudet(L.judetDupaLocalitate(oras));
  };

  var MARIME_ADRESE = 400;
  /* salveaza (adauga / modifica / sterge) un rand din Adrese */
  L.salveazaAdresa = function (rand, sterge) {
    var chunk = rand._c, date = { id: rand.id || SC.idScurt(), cl: rand.cl || '', cod: rand.cod || '', nume: rand.nume || '',
      str: rand.str || '', loc: rand.loc || '', jud: SC.fmtJudet(rand.jud) };
    if (!chunk) {
      var numar = {}, max = -1;
      SC.adrese.forEach(function (a) { numar[a._c] = (numar[a._c] || 0) + 1; });
      Object.keys(numar).forEach(function (c) { var i = +c.slice(1); if (i > max) max = i; });
      chunk = (max >= 0 && numar['a' + ('000' + max).slice(-3)] < MARIME_ADRESE) ? 'a' + ('000' + max).slice(-3) : 'a' + ('000' + (max + 1)).slice(-3);
    }
    return SC.store.tx(function (t) {
      return t.get('adrese', chunk).then(function (d) {
        d = d || { r: [] };
        var i = d.r.findIndex(function (x) { return x.id === date.id; }), detalii = '';
        if (!sterge && i >= 0) {
          var NUME = { cl: 'Client', cod: 'Cod', nume: 'Nume', str: 'Stradă', loc: 'Localitate', jud: 'Județ' }, v = d.r[i], p = [];
          Object.keys(NUME).forEach(function (k) { if (String(v[k] || '') !== String(date[k] || '')) p.push(NUME[k] + ': ' + (v[k] || '(gol)') + ' → ' + (date[k] || '(gol)')); });
          detalii = p.length ? ' — ' + p.join('; ') : '';
        }
        if (sterge) { if (i >= 0) d.r.splice(i, 1); }
        else if (i >= 0) d.r[i] = date; else d.r.push(date);
        t.set('adrese', chunk, d);
        t.log('Adrese: ' + (sterge ? 'șters' : (i >= 0 ? 'modificat' : 'adăugat')) + ' ' + date.cl + ' / ' + date.nume + detalii);
      });
    });
  };
  L.adreseInDocumente = function (randuri) {
    var docs = [];
    for (var i = 0; i < randuri.length; i += MARIME_ADRESE) {
      docs.push({ id: 'a' + ('000' + (i / MARIME_ADRESE)).slice(-3), data: { r: randuri.slice(i, i + MARIME_ADRESE) } });
    }
    return docs;
  };

  /* ---------- citire Excel (SheetJS) ---------- */
  function cel(ws, r, c) { return ws[XLSX.utils.encode_cell({ r: r, c: c })]; }
  function eData(c) { return c && c.t === 'n' && c.z && XLSX.SSF.is_date(String(c.z)); }
  function vText(c) {
    if (!c || c.v == null) return '';
    if (c.t === 'n') {
      if (eData(c)) { var s = SC.serialExcel(c.v); return SC.fmtDataLunga(s.ymd) + (s.areOra ? ' ' + s.hm : ''); }
      return String(c.v);
    }
    if (c.t === 'b') return c.v ? 'DA' : 'NU';
    if (c.t === 'e') return '';
    return String(c.v).replace(/ /g, ' ').trim();
  }
  /* adresa: o strada de tip "22 Decembrie 1989" ajunge in Excel ca data - o refacem ca text */
  function vAdresa(c, stat) {
    if (c && c.t === 'n' && (eData(c) || (Number.isInteger(c.v) && c.v > 20000 && c.v < 60000))) {
      if (stat) stat.adreseCorectate = (stat.adreseCorectate || 0) + 1;
      return SC.dataCaAdresa(SC.serialExcel(c.v).ymd);
    }
    return vText(c);
  }
  function vData(c) {
    if (!c || c.v == null) return '';
    if (c.t === 'n') return (c.v > 1 && c.v < 110000) ? SC.serialExcel(c.v).ymd : String(c.v);
    var s = String(c.v).trim();
    return SC.dataDinText(s) || s;
  }
  function vDataOra(c) {
    if (!c || c.v == null) return '';
    if (c.t === 'n') { var s = SC.serialExcel(c.v); return s.ymd + (s.areOra ? ' ' + s.hm : ''); }
    var t = String(c.v).trim(), d = SC.dataDinText(t);
    if (!d) return t;
    var m = /(\d{1,2})[:.](\d{2})\s*$/.exec(t.slice(10));
    return d + (m ? ' ' + SC.p2(+m[1]) + ':' + m[2] : '');
  }
  function vOra(c) {
    if (!c || c.v == null) return '';
    if (c.t === 'n') return SC.serialExcel(c.v).hm;
    return String(c.v).trim();
  }
  function vNum(c) {
    if (!c || c.v == null) return '';
    if (c.t === 'n') return SC.rotunjeste(c.v, 6);
    var s = String(c.v).trim();
    if (s === '') return '';
    var n = SC.parseNum(s);
    return n == null ? s : n;
  }
  function vDupaTip(c, col, stat) {
    switch (col.typ) {
      case 'int': case 'num': return vNum(c);
      case 'date': return vData(c);
      case 'dt': return vDataOra(c);
      case 'time': return vOra(c);
      default: return col.k === 'ad' ? vAdresa(c, stat) : vText(c);
    }
  }
  function zona(ws) { return XLSX.utils.decode_range(ws['!ref'] || 'A1:A1'); }
  L.citesteExcel = function (buffer) { return XLSX.read(buffer, { type: 'array', cellNF: true, cellDates: false }); };

  /* data ("10.09.2026") si ora ("16.00") dintr-un text care contine "ora" (ExtrageDataOra) */
  L.extrageDataOra = function (text) {
    var s = String(text || '').trim().replace(/\.xlsx$/i, ''), rez = { data: '', ora: '' };
    var p = s.toLowerCase().indexOf(' ora ');
    if (p >= 0) p += 1; else p = s.toLowerCase().indexOf('ora');
    if (p < 0) return rez;
    var stanga = s.slice(0, p).trim(), dreapta = s.slice(p + 3).trim();
    var cifre = (dreapta.split(' ')[0] || '').replace(/\D/g, '');
    if (cifre.length === 4) rez.ora = cifre.slice(0, 2) + '.' + cifre.slice(2);
    else if (cifre.length === 3) rez.ora = '0' + cifre.slice(0, 1) + '.' + cifre.slice(1);
    else return rez;
    var ultim = stanga.split(' ').pop() || '';
    cifre = ultim.replace(/\D/g, '');
    if (cifre.length > 8) cifre = cifre.slice(0, 8);
    if (cifre.length === 8) rez.data = cifre.slice(0, 2) + '.' + cifre.slice(2, 4) + '.' + cifre.slice(4);
    else if (cifre.length === 6) rez.data = cifre.slice(0, 2) + '.' + cifre.slice(2, 4) + '.20' + cifre.slice(4);
    else rez.data = ultim;
    return rez;
  };

  /* Borderou Kandia: foaia 1, antet pe randul 2 ("Document" = comenzi, "Nr. aviz" = materiale), date de la randul 3 */
  L.parseBorderou = function (wb, numeFisier, modificatLa) {
    var ws = wb.Sheets[wb.SheetNames[0]], z = zona(ws), stat = {};
    var a2 = SC.normAntet(vText(cel(ws, 1, 0))), tip, prefix;
    if (a2 === 'document') { tip = 'comenzi'; prefix = 'EDI: '; }
    else if (a2 === 'nr. aviz') { tip = 'materiale'; prefix = 'EDI MAT: '; }
    else throw eroare('Fișierul nu arată ca un borderou: în celula A2 mă așteptam la „Document” sau „Nr. aviz”, am găsit „' + vText(cel(ws, 1, 0)) + '”.');

    var randuri = [], r = 2, ultimaCol = Math.max(z.e.c, 8);
    for (; r <= z.e.r; r++) {
      var a = vText(cel(ws, r, 0));
      if (a === '' || a.indexOf('*') >= 0 || /^total/i.test(a)) break;
      if (tip === 'comenzi' && !/^\d+$/.test(a)) break;
      var obs = [];
      for (var c = 9; c <= ultimaCol; c++) { var tx = vText(cel(ws, r, c)); if (tx && tx !== '-') obs.push(tx); }
      randuri.push({
        nc: a, dc: vData(cel(ws, r, 1)), dl: vData(cel(ws, r, 2)), de: vText(cel(ws, r, 3)), ad: vAdresa(cel(ws, r, 4), stat),
        or: vText(cel(ws, r, 5)), g: vNum(cel(ws, r, 6)), ca: vNum(cel(ws, r, 7)), pe: vNum(cel(ws, r, 8)), ob: obs.join(' | ')
      });
    }
    /* randuri care arata a comanda dupa punctul de oprire (in Excel se pierdeau fara avertisment) */
    var ramase = 0;
    for (var r2 = r + 1; r2 <= z.e.r; r2++) {
      var a3 = vText(cel(ws, r2, 0));
      if (a3 && a3.indexOf('*') < 0 && !/^total/i.test(a3) && vText(cel(ws, r2, 3))) ramase++;
    }
    if (!randuri.length) throw eroare('Borderoul nu conține nicio comandă.');

    var d = L.extrageDataOra(numeFisier);
    if (!d.ora) {
      for (var c2 = 0; c2 <= ultimaCol && !d.ora; c2++) d = L.extrageDataOra(vText(cel(ws, 1, c2)));
    }
    if (!d.ora) {
      var m = new Date(modificatLa || Date.now());
      d = { data: SC.p2(m.getDate()) + '.' + SC.p2(m.getMonth() + 1) + '.' + m.getFullYear(), ora: SC.p2(m.getHours()) + '.' + SC.p2(m.getMinutes()) };
    }
    return { tip: tip, eticheta: prefix + d.data + ' ' + d.ora, randuri: randuri, ramase: ramase, adreseCorectate: stat.adreseCorectate || 0 };
  };

  /* Fisier cu aceleasi antete ca registrul (Status Comenzi.xlsm sau un extras din el) */
  L.parseRegistru = function (wb) {
    var numeFoaie = wb.SheetNames.indexOf('Sheet1') >= 0 ? 'Sheet1' : wb.SheetNames[0];
    var ws = wb.Sheets[numeFoaie], z = zona(ws), stat = {}, harta = {}, lipsa = [];
    var toate = SC.COLS.concat(SC.COLS_INC);
    for (var c = 0; c <= z.e.c; c++) {
      var h = SC.normAntet(vText(cel(ws, 0, c)));
      if (!h) continue;
      toate.forEach(function (col) { if (SC.normAntet(col.x) === h && harta[col.k] == null) harta[col.k] = c; });
    }
    if (harta.nc == null) throw eroare('Fișierul nu are coloana „Nr. Comanda” pe rândul 1 al foii „' + numeFoaie + '”.');
    SC.COLS.forEach(function (col) { if (harta[col.k] == null && col.k !== 'nt' && col.k !== 'fpp' && col.k !== 'pk') lipsa.push(col.x); });
    var comenzi = [];
    for (var r = 1; r <= z.e.r; r++) {
      var nc = vText(cel(ws, r, harta.nc));
      if (!nc) continue;
      var o = {};
      Object.keys(harta).forEach(function (k) {
        var v = vDupaTip(cel(ws, r, harta[k]), SC.COL[k], stat);
        if (v !== '' && v != null) o[k] = v;
      });
      o.nc = nc;
      o.st = SC.statusCanonic(o.st || ST.INI);
      if (o.inc) o.inc = /^da/i.test(String(o.inc)) ? 'DA' : String(o.inc).toUpperCase();
      if (o.cl) o.cl = String(o.cl).toUpperCase().trim();
      comenzi.push(o);
    }
    /* foaia Adrese, daca exista */
    var adrese = [], wsA = wb.Sheets['Adrese'];
    if (wsA) {
      var za = zona(wsA), ha = {};
      for (var ca = 0; ca <= za.e.c; ca++) {
        var t = SC.normText(vText(cel(wsA, 0, ca)));
        if (t === 'client') ha.cl = ca; else if (t === 'cod') ha.cod = ca; else if (t === 'nume 1') ha.nume = ca;
        else if (t.slice(0, 5) === 'strad') ha.str = ca; else if (t === 'localitate') ha.loc = ca; else if (t === 'judet') ha.jud = ca;
      }
      if (ha.nume != null) {
        for (var ra = 1; ra <= za.e.r; ra++) {
          var nume = vText(cel(wsA, ra, ha.nume));
          if (!nume) continue;
          adrese.push({
            id: SC.idScurt(), cl: ha.cl != null ? vText(cel(wsA, ra, ha.cl)).toUpperCase() : '', cod: ha.cod != null ? vText(cel(wsA, ra, ha.cod)) : '',
            nume: nume, str: ha.str != null ? vAdresa(cel(wsA, ra, ha.str)) : '', loc: ha.loc != null ? vText(cel(wsA, ra, ha.loc)) : '',
            jud: ha.jud != null ? SC.fmtJudet(vText(cel(wsA, ra, ha.jud))) : ''
          });
        }
      }
    }
    return { foaie: numeFoaie, comenzi: comenzi, adrese: adrese, lipsa: lipsa, adreseCorectate: stat.adreseCorectate || 0 };
  };

  /* momentul crearii unei comenzi din istoric: din eticheta de import, altfel data comenzii / pregatirii */
  function momentCreare(o) {
    var m = /(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2})[.:](\d{2})/.exec(String(o.im || ''));
    if (m) return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]).getTime();
    var d = /^\d{4}-\d{2}-\d{2}/.test(o.dc || '') && o.dc >= '2020-01-01' ? o.dc : (/^\d{4}-\d{2}-\d{2}/.test(o.dp || '') ? o.dp : '');
    return d ? SC.msDin(d, '12:00') : 0;
  }
  /* Construieste documentele pentru migrarea initiala. zileActive = cat timp in urma o comanda
     Terminata si neincarcata mai este considerata "in asteptarea incarcarii". */
  L.construiesteMigrare = function (comenzi, zileActive) {
    var folosite = {}, faraNr = [], max = 0, stat = { total: comenzi.length, renumerotate: [], arhivate: 0, active: 0, peStatus: {} };
    var prag = SC.ziPlus(SC.azi(), -zileActive);
    comenzi.forEach(function (o) {
      var n = SC.esteNum(o.n) && Number.isInteger(o.n) && o.n > 0 ? o.n : 0;
      if (n && !folosite[n]) { folosite[n] = o; if (n > max) max = n; }
      else faraNr.push({ o: o, vechi: o.n });
    });
    faraNr.forEach(function (x) { max++; folosite[max] = x.o; stat.renumerotate.push({ nc: x.o.nc, vechi: x.vechi, nou: max }); });
    var g = {}, ultimCt = 0;
    Object.keys(folosite).map(Number).sort(function (a, b) { return a - b; }).forEach(function (n) {
      var o = JSON.parse(JSON.stringify(folosite[n]));
      delete o.n;
      if (o.ju) o.ju = SC.fmtJudet(o.ju);
      o.ct = momentCreare(o) || ultimCt || Date.now();
      ultimCt = o.ct;
      if (o.st === ST.TER && o.inc !== 'DA' && (!o.dp || String(o.dp) < prag)) { o.ar = 1; stat.arhivate++; }
      if (SC.esteActiva(o)) stat.active++;
      stat.peStatus[o.st] = (stat.peStatus[o.st] || 0) + 1;
      var id = SC.idGrupa(n);
      (g[id] = g[id] || { o: {} }).o[n] = L.curata(o);
    });
    var docs = Object.keys(g).sort().map(function (id) { return { id: id, data: L.recalc(g[id]) }; });
    stat.grupe = docs.length; stat.ultimNr = max;
    return { docs: docs, contor: max, stat: stat };
  };

  /* Export TMS "Status Livrari TRANSPORT": ReferintaClient = nr comanda, Masina = nr auto, NumarTransport ... */
  L.parseTransport = function (wb) {
    var nume = wb.SheetNames.indexOf('Sheet') >= 0 ? 'Sheet' : wb.SheetNames[wb.SheetNames.length > 1 ? 1 : 0];
    var ws = wb.Sheets[nume], z = zona(ws), rAntet = -1, h = {};
    function cheie(v) { return SC.normText(v).replace(/[^a-z0-9]/g, ''); }
    for (var r = 0; r <= Math.min(z.e.r, 20) && rAntet < 0; r++) {
      for (var c = 0; c <= z.e.c; c++) if (cheie(vText(cel(ws, r, c))) === 'referintaclient') { rAntet = r; break; }
    }
    if (rAntet < 0) throw eroare('Nu găsesc coloana „ReferintaClient” în foaia „' + nume + '”. Acesta este exportul „Status Livrari TRANSPORT”?');
    for (var c2 = 0; c2 <= z.e.c; c2++) {
      var k = cheie(vText(cel(ws, rAntet, c2)));
      if (k === 'referintaclient') h.ref = c2; else if (k === 'masina' || k === 'nrauto') h.na = c2;
      else if (k === 'numartransport' || k === 'nrtransport') h.nt = c2; else if (k === 'sofer') h.so = c2;
      else if (k === 'remorca') h.re = c2; else if (k === 'client' || k === 'numeclient') h.cl = c2;
      else if (k === 'destinatar' || k === 'beneficiar' || k === 'numedestinatar') h.de = c2;
      else if (k === 'localitatebeneficiar') h.or = c2; else if (k === 'judetbeneficiar') h.ju = c2;
      else if (k === 'unitatitotale') h.un = c2; else if (k === 'masatotala') h.ma = c2;
      else if (k === 'datatransport') h.dtr = c2;              /* ziua in care se incarca masina */
      else if (k === 'dataestimataincarcare') h.dtr2 = c2;     /* rezerva, daca lipseste DataTransport */
    }
    if (h.dtr == null) { h.dtr = h.dtr2; h.dtr2 = null; }
    var numeColData = h.dtr != null ? vText(cel(ws, rAntet, h.dtr)) : '';
    function ziua(c) { if (c == null) return ''; var dv = vData(cel(ws, r2, c)); return /^\d{4}-\d{2}-\d{2}$/.test(dv) && dv >= '2020-01-01' ? dv : ''; }
    if (h.na == null) throw eroare('Nu găsesc coloana „Masina” în foaia „' + nume + '”.');
    var randuri = [];
    var r2;
    for (r2 = rAntet + 1; r2 <= z.e.r; r2++) {
      var ref = vText(cel(ws, r2, h.ref));
      if (!ref) continue;
      var x = { ref: ref, na: vText(cel(ws, r2, h.na)).toUpperCase() };
      ['nt', 'so', 're', 'cl', 'de', 'or', 'ju'].forEach(function (kk) { if (h[kk] != null) x[kk] = vText(cel(ws, r2, h[kk])); });
      if (x.ju) x.ju = SC.fmtJudet(x.ju);
      ['un', 'ma'].forEach(function (kk) { if (h[kk] != null) { var nv = vNum(cel(ws, r2, h[kk])); if (SC.esteNum(nv)) x[kk] = SC.rotunjeste(nv, 2); } });
      x.dtr = ziua(h.dtr) || ziua(h.dtr2);
      if (x.na || x.nt) randuri.push(x);
    }
    return { foaie: nume, randuri: randuri, areClient: h.cl != null, colData: numeColData };
  };

  /* ---------- linii doar din transport (nu sunt in registrul de comenzi) ----------
     Colectia "extra": un document pe zi de transport (sau "fara-data"), cu liniile intr-o harta. */
  L.seteazaExtra = function (docs) {
    var l = [];
    docs.forEach(function (d) {
      var m = d.data.l || {};
      Object.keys(m).forEach(function (k) { var x = m[k]; x._zi = d.id; x._k = k; x.retur = SC.esteRetur(x.ref); if (x.ju) x.ju = SC.fmtJudet(x.ju); l.push(x); });
    });
    SC.extra = l;
    /* pe acelasi document al zilei se tine si evidenta camioanelor: cand s-a tiparit borderoul = cand a inceput incarcarea */
    var cam = {};
    docs.forEach(function (d) { var c = d.data.c || {}; Object.keys(c).forEach(function (k) { cam[d.id + '|' + k] = c[k]; }); });
    SC.camInfo = cam;
    SC.areOrdine = Object.keys(cam).some(function (k) { return cam[k].o > 0; });
    SC.rev = (SC.rev || 0) + 1;
  };
  SC.camInfo = {};
  /* Ordinea in care se incarca masinile unei zile, pusa de Transport: c[cheie].o = 1, 2, 3...
     Camionul este asezat pe locul cerut, iar celelalte se renumeroteaza singure (fara locuri duble sau goluri).
     pozitie = null scoate camionul din ordine. cheiZi = camioanele care exista acum in ziua respectiva:
     ordinea ramasa pe camioane disparute (dupa un nou import TMS) este curatata. */
  L.seteazaOrdine = function (x, pozitie, cheiZi) {
    var zi = x.data || 'fara-data', k = L.cheieCamion(x);
    return SC.store.tx(function (t) {
      return t.get('extra', zi).then(function (d) {
        d = d || { l: {} };
        d.c = d.c || {};
        var exista = {}, loc = null;
        (cheiZi || []).forEach(function (c) { exista[c] = 1; });
        exista[k] = 1;
        Object.keys(d.c).forEach(function (c) { if (!exista[c] && d.c[c].o != null) delete d.c[c].o; });
        var ordonate = Object.keys(d.c).filter(function (c) { return c !== k && d.c[c].o > 0; }).sort(function (a, b) { return d.c[a].o - d.c[b].o; });
        if (pozitie != null) {
          loc = Math.max(1, Math.min(Math.round(pozitie), ordonate.length + 1));
          ordonate.splice(loc - 1, 0, k);
          d.c[k] = d.c[k] || {};
        } else if (d.c[k]) {
          delete d.c[k].o;
          if (!Object.keys(d.c[k]).length) delete d.c[k];
        }
        ordonate.forEach(function (c, i) { d.c[c].o = i + 1; });
        d.upd = Date.now();
        t.set('extra', zi, d);
        t.log('Ordine la încărcare, ' + (x.data ? SC.fmtDataLunga(x.data) : 'fără dată') + ': ' + x.na + (x.nt ? ' / transport ' + x.nt : '') + (loc ? ' pe locul ' + loc : ' scos din ordine'));
        return loc;
      });
    });
  };
  /* Incarcari: comanda nu pleaca efectiv cu camionul. Este scoasa de pe el (Nr AUTO, transport, data, sofer, remorca) si
     tine minte de pe ce transport a fost scoasa (xnt), ca urmatorul import al graficului sa nu o puna singur inapoi. */
  L.scoateDePeCamion = function (n, x) {
    return L.modifica([{
      n: n, fn: function (o) {
        if (o.inc === 'DA') throw eroare('Comanda ' + o.nc + ' este deja confirmată ca încărcată.');
        if (o.nt) o.xnt = o.nt; else delete o.xnt;
        delete o.na; delete o.nt; delete o.dtr; delete o.so; delete o.re; delete o.mnt;
      }
    }], 'Încărcare ' + x.na + (x.nt ? ' / transport ' + x.nt : '') + ': o comandă nu pleacă cu acest camion și a fost scoasă de pe el', { cuText: true });
  };
  L.cheieCamion = function (x) { return String(x.cheie || '').replace(/[.\/\[\]*`~]/g, '_') || '_'; };
  L.infoCamion = function (x) { return SC.camInfo[(x.data || 'fara-data') + '|' + L.cheieCamion(x)] || null; };
  /* La tiparirea borderoului: prima tiparire = inceputul incarcarii (ramane fixa), plus ultima tiparire si numarul de tipariri. */
  L.marcheazaBorderou = function (x) {
    var zi = x.data || 'fara-data', k = L.cheieCamion(x), user = SC.store.user ? SC.store.user.nume : '?';
    return SC.store.tx(function (t) {
      return t.get('extra', zi).then(function (d) {
        d = d || { l: {} };
        d.c = d.c || {};
        var e = d.c[k] || {}, acum = SC.dtAcum(), prima = !e.bt;
        if (prima) { e.bt = acum; e.bu = user; }
        e.bl = acum; e.bn = (e.bn || 0) + 1;
        d.c[k] = e; d.upd = Date.now();
        t.set('extra', zi, d);
        t.log((prima ? 'Început încărcare (borderou tipărit): ' : 'Borderou retipărit (a ' + e.bn + '-a oară): ') + x.na + (x.nt ? ' / transport ' + x.nt : ''));
        return e;
      });
    });
  };
  L.cheieExtra = function (r) {
    return (SC.cheieComanda(r.ref) + '~' + (r.nt || SC.normNrAuto(r.na))).replace(/[.\/\[\]*`]/g, '_');
  };
  L.ziExtra = function (r) { return r.dtr || 'fara-data'; };
  /* ---------- un transport incarcat din nou: ce s-a schimbat fata de ce este acum in aplicatie ----------
     recente = randurile din fisier (ultimele zile); potriviri = [{ r: rand, o: comanda din registru careia i se aplica sau null daca
     este deja incarcata }]; perZi = liniile din fisier care nu sunt in registru, pe zile; prag = prima zi din fereastra importului.
     Se compara doar numerele de transport care apar si in fisier, si in aplicatie. Intoarce:
       transporturi: [{ nt, na, zi, tiparit, linii: [text] }] = cele cu modificari;  laFel / noi = cate sunt neschimbate / noi;
       deScos: comenzile din registru care nu mai sunt pe transportul lor (si nu au fost mutate pe altul, nici incarcate);
       extraOrfane: liniile „doar din transport” ale unor transporturi care nu mai sunt deloc in fisier. */
  function celMaiDes(l) {
    var m = {}, ales = '', n = 0;
    l.forEach(function (v) { if (v == null || v === '') return; m[v] = (m[v] || 0) + 1; if (m[v] > n) { n = m[v]; ales = v; } });
    return ales;
  }
  L.comparaTransport = function (recente, potriviri, perZi, prag) {
    var peNt = {}, tinta = {}, extraFisier = {}, toateCheile = {};
    var rez = { transporturi: [], noi: 0, laFel: 0, deScos: [], extraOrfane: [], areExtra: false };
    recente.forEach(function (r) { if (r.nt) (peNt[r.nt] = peNt[r.nt] || []).push(r); });
    potriviri.forEach(function (x) { if (x.o) tinta[x.o.n] = x.r; });
    Object.keys(perZi).forEach(function (zi) {
      perZi[zi].forEach(function (r) { var k = L.cheieExtra(r); toateCheile[k] = 1; if (r.nt) (extraFisier[r.nt] = extraFisier[r.nt] || {})[k] = r; });
    });
    function zi10(v) { return String(v || '').slice(0, 10); }
    Object.keys(peNt).sort().forEach(function (nt) {
      var randuri = peNt[nt];
      var inainteC = SC.comenzi.filter(function (o) { return o.nt === nt && o.st !== SC.ST.ANU && !o.ar; });
      var inainteE = SC.extra.filter(function (x) { return x.nt === nt; });
      if (!inainteC.length && !inainteE.length) { rez.noi++; return; }
      var inainte = inainteC.concat(inainteE), linii = [];
      var a = { na: celMaiDes(inainte.map(function (o) { return o.na; })), dtr: celMaiDes(inainte.map(function (o) { return zi10(o.dtr); })),
        so: celMaiDes(inainte.map(function (o) { return o.so; })), re: celMaiDes(inainte.map(function (o) { return o.re; })) };
      var b = { na: celMaiDes(randuri.map(function (r) { return r.na; })), dtr: celMaiDes(randuri.map(function (r) { return r.dtr; })),
        so: celMaiDes(randuri.map(function (r) { return r.so; })), re: celMaiDes(randuri.map(function (r) { return r.re; })) };
      if (b.na && SC.normNrAuto(a.na) !== SC.normNrAuto(b.na)) linii.push('Nr AUTO: ' + (a.na || '—') + ' → ' + b.na);
      if (b.dtr && a.dtr !== b.dtr) linii.push('Data încărcării: ' + (a.dtr ? SC.fmtDataLunga(a.dtr) : 'fără dată') + ' → ' + SC.fmtDataLunga(b.dtr));
      if (b.so && (a.so || '') !== b.so) linii.push('Șofer: ' + (a.so || '—') + ' → ' + b.so);
      if (b.re && (a.re || '') !== b.re) linii.push('Remorcă: ' + (a.re || '—') + ' → ' + b.re);
      /* comenzile din registru */
      var cheiFisier = {}; randuri.forEach(function (r) { cheiFisier[SC.cheieComanda(r.refCurat != null ? r.refCurat : r.ref)] = 1; });
      var adaugate = potriviri.filter(function (x) { return x.r.nt === nt && x.o && x.o.nt !== nt; }).map(function (x) { return x.o.nc + (x.o.nt ? ' (era pe ' + x.o.nt + ')' : ''); });
      var scoase = [], mutate = [], ramanInc = [], deMana = [];
      inainteC.forEach(function (o) {
        if (cheiFisier[SC.cheieComanda(o.nc)]) return;
        if (o.inc === 'DA') { ramanInc.push(o.nc); return; }
        var r = tinta[o.n];
        if (r && r.nt !== nt) { mutate.push(o.nc + ' → ' + (r.nt || r.na)); return; }
        /* trecuta de mana pe acest transport (mnt) si inca neajunsa in fisier: ramane pe camion, fisierul nu o scoate */
        if (o.mnt === nt) { deMana.push(o.nc); return; }
        scoase.push(o.nc); rez.deScos.push(o);
      });
      /* liniile doar din transport */
      var eF = extraFisier[nt] || {}, eInainte = {}, eAdaug = [], eScoase = [], eCant = [], eInc = [];
      inainteE.forEach(function (x) { eInainte[x._k] = x; });
      Object.keys(eF).forEach(function (k) {
        var x = eInainte[k], r = eF[k], s = [];
        if (!x) { eAdaug.push(r.ref); return; }
        if (x.inc === 'DA') return;
        if (r.un != null && x.un != null && r.un !== x.un) s.push('paleți ' + x.un + ' → ' + r.un);
        if (r.ma != null && x.ma != null && r.ma !== x.ma) s.push('kg ' + x.ma + ' → ' + r.ma);
        if (s.length) eCant.push(r.ref + ' (' + s.join(', ') + ')');
      });
      inainteE.forEach(function (x) {
        if (eF[x._k]) return;
        if (x.inc === 'DA') { eInc.push(x.ref); return; }
        eScoase.push(x.ref + (cheiFisier[SC.cheieComanda(x.ref)] ? ' (este acum în registru)' : ''));
      });
      if (adaugate.length) linii.push('Comenzi adăugate: ' + adaugate.join(', '));
      var linieScoase = -1;
      if (scoase.length) { linieScoase = linii.length; linii.push('Comenzi care nu mai sunt pe transport: ' + scoase.join(', ')); }
      if (mutate.length) linii.push('Comenzi mutate pe alt transport: ' + mutate.join(', '));
      if (eAdaug.length) linii.push('Linii doar din transport adăugate: ' + eAdaug.join(', '));
      if (eScoase.length) linii.push('Linii doar din transport scoase: ' + eScoase.join(', '));
      if (eCant.length) linii.push('Cantități schimbate în TMS: ' + eCant.join(', '));
      if (eAdaug.length || eScoase.length || eCant.length) rez.areExtra = true;
      if (!linii.length) { rez.laFel++; return; }
      /* doar ca informatie, langa modificarile adevarate: ce a fost deja incarcat nu se mai atinge */
      if (ramanInc.length || eInc.length) linii.push('Nu mai sunt în fișier, dar sunt deja încărcate (rămân): ' + ramanInc.concat(eInc).join(', '));
      if (deMana.length) linii.push('Trecute de mână în aplicație, nu sunt în fișier (rămân): ' + deMana.join(', '));
      var info = SC.camInfo[(a.dtr || 'fara-data') + '|' + L.cheieCamion({ cheie: nt + '|' + SC.normNrAuto(a.na) })];
      rez.transporturi.push({ nt: nt, na: b.na || a.na, zi: b.dtr || a.dtr, tiparit: info && info.bt ? info.bt : '', linii: linii, linieScoase: linieScoase });
    });
    /* liniile doar din transport din fereastra importului care nu mai apar deloc in fisier si nu tin de un transport din fisier */
    SC.extra.forEach(function (x) {
      if (x.inc === 'DA' || toateCheile[x._k] || (x.nt && peNt[x.nt])) return;
      if (x._zi === 'fara-data' || x._zi >= prag) rez.extraOrfane.push(x.ref + (x.nt ? ' (' + x.nt + ')' : ''));
    });
    return rez;
  };
  /* perZi: {zi: [linii din fisier care nu exista in registru]}. Liniile deja incarcate nu se ating;
     cele care au disparut din fisier (sau au aparut intre timp in registru) se scot, daca nu sunt incarcate. */
  L.importaExtra = function (perZi, numeFisier) {
    var zile = Object.keys(perZi).sort(), stat = { noi: 0, actualizate: 0, scoase: 0 }, i = 0;
    function pas() {
      if (i >= zile.length) return Promise.resolve();
      var zi = zile[i++];
      return SC.store.tx(function (t) {
        return t.get('extra', zi).then(function (d) {
          var vechi = (d && d.l) || {}, nou = {}, s = { noi: 0, actualizate: 0, scoase: 0 };
          perZi[zi].forEach(function (r) {
            var k = L.cheieExtra(r), v = vechi[k];
            if (v && v.inc === 'DA') { nou[k] = v; return; }
            var x = v ? JSON.parse(JSON.stringify(v)) : {};
            /* linia vine din alta zi (camionul a fost mutat pe alta data): isi pastreaza corecturile facute de mana */
            if (!v && r._mutat) { x = JSON.parse(JSON.stringify(r._mutat)); delete x._zi; delete x._k; delete x.retur; }
            ['ref', 'cl', 'de', 'or', 'ju', 'na', 'nt', 'so', 're', 'dtr', 'un', 'ma'].forEach(function (f) { if (r[f] != null && r[f] !== '') x[f] = r[f]; });
            /* paletii si greutatea vin din TMS (UnitatiTotale, MasaTotala), cat timp nu au fost corectate de mana (prm / gfm) */
            if (!x.prm && x.un != null) x.pr = x.un;
            if (!x.gfm && x.ma != null) x.gf = x.ma;
            if (!v) s.noi++; else if (JSON.stringify(v) !== JSON.stringify(x)) s.actualizate++;
            nou[k] = x;
          });
          Object.keys(vechi).forEach(function (k) {
            if (nou[k]) return;
            if (vechi[k].inc === 'DA') nou[k] = vechi[k]; else s.scoase++;
          });
          if (s.noi || s.actualizate || s.scoase) t.set('extra', zi, { l: nou, c: (d && d.c) || {}, upd: Date.now() });
          return s;
        });
      }).then(function (s) { stat.noi += s.noi; stat.actualizate += s.actualizate; stat.scoase += s.scoase; return pas(); });
    }
    return pas().then(function () {
      if (!(stat.noi || stat.actualizate || stat.scoase)) return stat;
      return SC.store.tx(function (t) {
        t.log('Import transport ' + numeFisier + ': linii doar din transport — ' + stat.noi + ' noi, ' + stat.actualizate + ' actualizate, ' + stat.scoase + ' scoase');
      }).then(function () { return stat; });
    });
  };
  /* modificari pe linii doar din transport: [{zi, k, fn(linie)}] */
  L.modificaExtra = function (modificari, textJurnal) {
    var ids = {}, user = SC.store.user ? SC.store.user.nume : '?';
    modificari.forEach(function (m) { ids[m.zi] = 1; });
    var listaId = Object.keys(ids);
    return SC.store.tx(function (t) {
      return Promise.all(listaId.map(function (id) { return t.get('extra', id); })).then(function (docs) {
        var g = {}, linii = [];
        listaId.forEach(function (id, i) { g[id] = docs[i]; });
        modificari.forEach(function (m) {
          var x = g[m.zi] && g[m.zi].l && g[m.zi].l[m.k];
          if (!x) throw eroare('Linia de transport nu mai există (fișierul TMS a fost reimportat între timp). Reîncarcă lista.');
          if (x.ju) x.ju = SC.fmtJudet(x.ju);
          var inainte = JSON.parse(JSON.stringify(x));
          m.fn(x);
          if (x.ju) x.ju = SC.fmtJudet(x.ju);
          L.curata(x);
          var d = L.diferente(inainte, x);
          if (d) { x.ut = Date.now(); x.uu = user; linii.push('Doar transport ' + ((x.cl || '') + ' ' + (x.ref || '')).trim() + ' (' + (x.na || x.nt || '') + ') — ' + d); }
        });
        listaId.forEach(function (id) { g[id].upd = Date.now(); t.set('extra', id, g[id]); });
        if (textJurnal && modificari.length > 1) t.log(textJurnal);
        linii.forEach(function (x) { t.log(x); });
      });
    });
  };

  /* ---------- export ---------- */
  /* ================= export pentru TMS =================
     Fisierul de import in TMS (foaia „SCHENKERDSV IMPORT”) se face din comenzile din status.
     Cheia de verificare: fiecare comanda exportata primeste un marcaj (tx = momentul exportului, txu = cine, txm = 1 daca a fost
     doar marcata, fara fisier). O comanda „de exportat” este una care are nevoie de transport si nu are nici marcaj,
     nici numar de transport venit din TMS - deci numarul lor arata oricand ce a ramas neexportat, indiferent de perioada aleasa. */
  L.TMS_FOAIE = 'SCHENKERDSV IMPORT';
  L.TMS_ANTET = ['NUMAR COMANDA', 'DATA COMANDA', 'CLIENT', 'BENEFICIAR', 'ADRESA BENEFICIAR', 'LOCALITATE BENEFICIAR', 'JUDET BENEFICIAR',
    'NUMAR PALETI', 'MASA PALETI', 'VOLUM PALETI', 'LIVRARE DE LA', 'LIVRARE PANA LA', 'Expediere de la', 'Expediere pana la', 'TARA BENEFICIAR',
    'TIP FURNIZOR', 'FURNIZOR', 'TARA FURNIZOR', 'LOCALITATE FURNIZOR', 'ADRESA FURNIZOR', 'JUDET FURNIZOR', 'TIP BENEFICIAR', 'ESTE RETUR', 'UDF_FLOAT_6'];
  /* valorile fixe ale fisierului (furnizorul = depozitul): se tin in configurare, nu in cod; a = antetul coloanei din fisierul model */
  L.TMS_SETARI = [
    { k: 'tipF', t: 'Tip furnizor', a: 'tip furnizor' }, { k: 'furn', t: 'Furnizor', a: 'furnizor', lat: 1 },
    { k: 'taraF', t: 'Țara furnizor', a: 'tara furnizor' }, { k: 'locF', t: 'Localitate furnizor', a: 'localitate furnizor' },
    { k: 'adrF', t: 'Adresa furnizor', a: 'adresa furnizor', lat: 1 }, { k: 'judF', t: 'Județ furnizor', a: 'judet furnizor' },
    { k: 'tipB', t: 'Tip beneficiar', a: 'tip beneficiar' }, { k: 'volum', t: 'Volum paleți', a: 'volum paleti' }];
  var TMS_TARI = ['germania', 'polonia', 'italia', 'spania', 'grecia', 'ungaria', 'croatia', 'irlanda', 'marea britanie', 'canada', 'sua', 'bulgaria',
    'belgia', 'franta', 'estonia', 'letonia', 'lituania', 'republica moldova', 'moldova', 'austria', 'olanda', 'cehia', 'slovacia', 'slovenia',
    'serbia', 'portugalia', 'suedia', 'danemarca', 'elvetia', 'turcia', 'ucraina', 'finlanda', 'norvegia', 'luxemburg', 'cipru', 'malta'];
  L.tmsSetariComplete = function () { var s = SC.config.tms || {}; return L.TMS_SETARI.every(function (c) { return !SC.gol(s[c.k]); }); };
  /* 'anulata' | 'exportata' (marcaj) | 'inTms' (are numar de transport) | 'incheiata' (incarcata / arhivata) | 'faraTransport' | 'deExportat' */
  /* faraMarcaj = true: starea ca si cum comanda n-ar fi fost exportata niciodata (o comanda poate fi exportata de mai multe ori;
     marcajul arata doar care comenzi nu au ajuns inca in niciun fisier) */
  L.tmsStare = function (o, faraMarcaj) {
    if (o.st === ST.ANU) return 'anulata';
    if (o.tx && !faraMarcaj) return 'exportata';
    if (o.nt) return 'inTms';
    if (o.inc === 'DA' || o.ar) return 'incheiata';
    if (o.st === ST.SELF || o.sp === 'DA' || /ridica(re)? (client|personal)/.test(SC.normText([o.ob, o.ju, o.or].join(' | ')))) return 'faraTransport';
    return 'deExportat';
  };
  /* paleti pentru transport: amprente, altfel paleti reali, altfel estimarea rotunjita in sus;  masa: greutatea finala, altfel greutatea comenzii */
  L.tmsPaleti = function (o) {
    if (SC.esteNum(o.am) && o.am > 0) return o.am;
    if (SC.esteNum(o.pr) && o.pr > 0) return o.pr;
    return SC.esteNum(o.pe) && o.pe > 0 ? Math.ceil(SC.rotunjeste(o.pe, 3)) : null;
  };
  L.tmsMasa = function (o) {
    if (SC.esteNum(o.gf) && o.gf > 0) return SC.rotunjeste(o.gf, 2);
    return SC.esteNum(o.g) && o.g > 0 ? SC.rotunjeste(o.g, 2) : null;
  };
  L.tmsTara = function (o) { return TMS_TARI.indexOf(SC.normText(o.ju)) >= 0 ? String(o.ju).trim().toLocaleUpperCase('ro-RO') : ''; };
  /* date fara de care linia nu are cum sa fie importata in TMS (se completeaza in comanda); [] = in regula */
  L.tmsLipsa = function (o) {
    var l = [];
    if (SC.gol(o.nc)) l.push('număr comandă');
    if (SC.gol(o.de)) l.push('destinatar');
    if (SC.gol(o.or)) l.push('oraș');
    if (SC.gol(o.ju)) l.push('județ');
    if (SC.gol(o.dl)) l.push('livrare solicitată');
    return l;
  };
  /* valori pe care statusul nu le are inca (la unii clienti greutatea se afla abia la terminare): celula ramane goala
     si se completeaza in fisier, inainte de import */
  L.tmsDeCompletat = function (o) {
    var l = [];
    if (L.tmsPaleti(o) == null) l.push('paleți');
    if (L.tmsMasa(o) == null) l.push('greutate');
    return l;
  };
  L.TMS_PALETI_MULTI = 66;      /* peste doua camioane pline: aproape sigur o greseala de scriere in status */
  function tmsData(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || ''));
    return m ? { t: 'n', v: Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000) + 25569, z: 'm/d/yy' } : null;
  }
  L.tmsRand = function (o) {
    var s = SC.config.tms || {}, cl = (SC.config.tmsClienti || {})[String(o.cl || '').toUpperCase()] || o.cl || '', tara = L.tmsTara(o);
    var vol = SC.parseNum(s.volum);
    return [o.nc != null ? String(o.nc) : null, tmsData(o.dc), cl, o.de || null, o.ad || null, o.or || null,
      o.ju ? String(o.ju).toLocaleUpperCase('ro-RO') : null, L.tmsPaleti(o), L.tmsMasa(o), vol != null ? vol : (s.volum || null),
      tmsData(o.dl), tmsData(o.dl), tmsData(o.dl), tmsData(o.dl), tara || 'ROMANIA',
      s.tipF || null, s.furn || null, s.taraF || null, s.locF || null, s.adrF || null, s.judF || null, s.tipB || null, 0, null];
  };
  L.tmsFisier = function (comenzi, numeFisier) {
    var aoa = [L.TMS_ANTET].concat(comenzi.slice().sort(function (a, b) { return a.n - b.n; }).map(L.tmsRand));
    var ws = XLSX.utils.aoa_to_sheet(aoa);
    for (var r = 1; r < aoa.length; r++) { var c = ws[XLSX.utils.encode_cell({ r: r, c: 8 })]; if (c && c.t === 'n') c.z = '#,##0.00'; }
    ws['!cols'] = [16, 13, 22, 38, 40, 22, 16, 13, 12, 13, 13, 15, 14, 16, 16, 13, 36, 14, 20, 50, 15, 14, 11, 12].map(function (w) { return { wch: w }; });
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, L.TMS_FOAIE);
    XLSX.writeFile(wb, numeFisier);
  };
  /* valorile fixe citite din randul 2 al fisierului de import folosit acum (dupa antet, nu dupa pozitia coloanei) */
  L.tmsCitesteModel = function (wb) {
    var ws = wb.Sheets[L.TMS_FOAIE] || wb.Sheets[wb.SheetNames[0]], z = zona(ws), col = {}, rez = {};
    for (var c = z.s.c; c <= z.e.c; c++) { var a = SC.normText(vText(cel(ws, z.s.r, c))); if (a && col[a] == null) col[a] = c; }
    L.TMS_SETARI.forEach(function (s) {
      if (col[s.a] == null) return;
      for (var r = z.s.r + 1; r <= Math.min(z.e.r, z.s.r + 50); r++) { var v = vText(cel(ws, r, col[s.a])); if (v) { rez[s.k] = v; break; } }
    });
    return rez;
  };
  /* Aceeasi modificare ca L.modifica, dar pentru multe comenzi: cate 8 grupe pe tranzactie, ca sa nu depaseasca limita Firebase.
     In jurnal: textul o singura data (la prima transa), apoi cate o linie pe comanda, cu valoarea veche si cea noua.
     Intoarce numarul de comenzi trimise. */
  L.modificaPeLoturi = function (modificari, text) {
    var peGrupa = {};
    modificari.forEach(function (m) { var id = SC.idGrupa(m.n); (peGrupa[id] = peGrupa[id] || []).push(m); });
    var ids = Object.keys(peGrupa).sort(), loturi = [];
    for (var i = 0; i < ids.length; i += 8) loturi.push(ids.slice(i, i + 8).reduce(function (a, id) { return a.concat(peGrupa[id]); }, []));
    function pas(k) {
      if (k >= loturi.length) return Promise.resolve(modificari.length);
      return L.modifica(loturi[k], k === 0 ? text : '', { cuText: true }).then(function () { return pas(k + 1); });
    }
    return pas(0);
  };
  /* Campurile care vin din borderoul Kandia si pot rescrie o comanda existenta (doar Administratorul) */
  L.BORDEROU_CAMPURI = ['de', 'ad', 'or', 'ju', 'dc', 'dl', 'g', 'ca', 'pe'];
  /* Ce s-ar schimba pe comanda o daca ar fi rescrisa cu randul r din borderou: [{k, vechi, nou}].
     O celula goala in borderou nu sterge ce exista pe comanda. Observatiile intra doar la cerere (cuObs). */
  L.diferenteBorderou = function (o, r, cuObs) {
    var nou = { de: r.de, ad: r.ad, or: r.or, dc: r.dc, dl: r.dl, g: r.g, ca: r.ca, pe: r.pe }, dif = [], jd = false;
    var a = L.adresaDupaNume(o.cl, r.de, r.ad, r.or);
    if (a && a.jud) nou.ju = SC.fmtJudet(a.jud);
    else { var j = L.judetDupaLocalitate(r.or); if (j) { nou.ju = SC.fmtJudet(j); jd = true; } }
    if (cuObs) nou.ob = r.ob;
    L.BORDEROU_CAMPURI.concat(cuObs ? ['ob'] : []).forEach(function (k) {
      var n = nou[k], v = o[k];
      if (n == null || n === '') return;
      var col = SC.COL[k] || {}, numeric = col.typ === 'num' || col.typ === 'int';
      var egal = numeric ? (SC.esteNum(v) && Math.abs(v - n) < 0.005) : String(v == null ? '' : v).trim() === String(n).trim();
      if (!egal) dif.push({ k: k, vechi: v, nou: n });
    });
    return { dif: dif, jd: jd };
  };
  /* aplica diferentele pe comanda (in tranzactie); greutatea finala calculata automat se reface dupa noua greutate */
  L.aplicaBorderou = function (x, dif, jd) {
    dif.forEach(function (d) {
      x[d.k] = d.nou;
      if (d.k === 'ju') { if (jd) x.jd = 1; else delete x.jd; }
      if (d.k === 'g' && (x.st === ST.TER || x.st === ST.SELF) && L.greutateAuto(x) && !x.cum && !x.gfm && SC.esteNum(x.pr)) x.gf = SC.rotunjeste(x.g + x.pr * SC.config.kgPalet);
    });
  };
  /* Marcheaza comenzile ca exportate, in transe mici (cate 8 grupe pe tranzactie). O comanda marcata intre timp de altcineva
     este sarita, deci nu poate ajunge in doua fisiere. Intoarce { ts, eroare? }; comenzile marcate sunt cele cu tx === ts. */
  L.tmsMarcheaza = function (numere, faraFisier, text) {
    var ts = Date.now(), user = SC.store.user ? SC.store.user.nume : '?', peGrupa = {};
    numere.forEach(function (n) { var id = SC.idGrupa(n); (peGrupa[id] = peGrupa[id] || []).push(n); });
    var ids = Object.keys(peGrupa).sort(), loturi = [];
    for (var i = 0; i < ids.length; i += 8) loturi.push(ids.slice(i, i + 8).reduce(function (a, id) { return a.concat(peGrupa[id]); }, []));
    function pas(k) {
      if (k >= loturi.length) return Promise.resolve();
      return L.modifica(loturi[k].map(function (n) {
        return { n: n, fn: function (x) { if (x.tx || x.st === ST.ANU) return; x.tx = ts; x.txu = user; if (faraFisier) x.txm = 1; else delete x.txm; } };
      }), k === 0 ? text : '', { faraDetalii: true }).then(function () { return pas(k + 1); });
    }
    return pas(0).then(function () { return { ts: ts }; }, function (e) { return { ts: ts, eroare: e }; });
  };
  L.tmsExportate = function (ts) { return SC.comenzi.filter(function (o) { return o.tx === ts; }); };
  /* anuleaza marcajul unui export: comenzile lui redevin „de exportat” */
  L.tmsAnuleaza = function (ts, text) {
    var numere = L.tmsExportate(ts).map(function (o) { return o.n; }), loturi = [];
    for (var i = 0; i < numere.length; i += 60) loturi.push(numere.slice(i, i + 60));
    function pas(k) {
      if (k >= loturi.length) return Promise.resolve(numere.length);
      return L.modifica(loturi[k].map(function (n) {
        return { n: n, fn: function (x) { if (x.tx !== ts) return; delete x.tx; delete x.txu; delete x.txm; } };
      }), k === 0 ? text : '', { faraDetalii: true }).then(function () { return pas(k + 1); });
    }
    return pas(0);
  };

  L.exportExcel = function (comenzi, numeFisier) {
    var cols = SC.COLS.concat(SC.COLS_INC);
    var aoa = [cols.map(function (c) { return c.x; })];
    comenzi.forEach(function (o) {
      aoa.push(cols.map(function (c) {
        var v = o[c.k];
        if (v == null || v === '') return null;
        if (c.typ === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return SC.fmtDataLunga(v);
        if (c.typ === 'dt') return SC.fmtDataLunga(String(v).slice(0, 10)) + String(v).slice(10);
        if (c.k === 'nc' && /^[1-9]\d{0,14}$/.test(v)) return +v;
        return v;
      }));
    });
    var ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = cols.map(function (c) { return { wch: Math.max(10, Math.round((c.w || 90) / 7)) }; });
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Comenzi');
    XLSX.writeFile(wb, numeFisier);
  };

  /* =====================================================================
     COPIA DE SIGURANTA (backup) SI RESTAURAREA
     Copia este un singur fisier JSON cu toate documentele din Firebase, asa cum sunt ele (grupele de comenzi, adresele,
     camioanele si liniile din transport, notificarile, CMR-urile, setarile si contorul; jurnalul doar daca cel care face
     copia este Administrator, fiindca regulile il lasa doar pe el sa-l citeasca).
     Costul unei copii: o citire pentru fiecare document (cateva sute), fara nicio scriere in afara de „ultima copie”.
     ===================================================================== */
  L.BACKUP_TIP = 'status-comenzi-backup';
  L.BACKUP_COLECTII = ['comenzi', 'adrese', 'extra', 'notificari', 'cmr', 'meta'];
  L.BACKUP_NUME = { comenzi: 'Grupe de comenzi', adrese: 'Adrese', extra: 'Camioane și linii din transport (zile)', notificari: 'Notificări (luni)', cmr: 'CMR-uri (luni + setări)', meta: 'Setări și contoare', jurnal: 'Jurnal de modificări (ore)' };
  /* documentele din meta care nu se restaureaza: marcajul de configurare si evidenta copiilor */
  var META_FARA_RESTAURARE = { setup: 1, backup: 1 };

  function numaraComenzi(grupe) {
    var n = 0;
    Object.keys(grupe || {}).forEach(function (id) { n += Object.keys((grupe[id] || {}).o || {}).length; });
    return n;
  }
  /* Citeste tot ce intra in copie. Jurnalul (doar Administratorul il poate citi) creste cu un document pe ora, asa ca:
     jurnal = false: fara jurnal; true: tot jurnalul; { a, b }: doar orele dintre zilele / id-urile a si b (b poate lipsi). */
  L.backupCiteste = function (jurnal, progres) {
    var cuJurnal = !!jurnal, interval = jurnal && typeof jurnal === 'object' ? jurnal : null;
    var colectii = L.BACKUP_COLECTII.concat(cuJurnal ? ['jurnal'] : []), rez = {}, i = 0, documente = 0;
    function urm() {
      if (i >= colectii.length) return Promise.resolve();
      var col = colectii[i++];
      if (progres) progres(L.BACKUP_NUME[col] || col, i, colectii.length);
      return (col === 'jurnal' && interval ? SC.store.citesteInterval('jurnal', interval.a, interval.b || '9999-99-99_99~') : SC.store.citesteColectie(col)).then(function (docs) {
        var o = {};
        docs.forEach(function (d) { o[d.id] = d.data; });
        rez[col] = o; documente += docs.length;
        return urm();
      });
    }
    return urm().then(function () {
      var u = SC.store.user || {}, acum = new Date();
      return {
        tip: L.BACKUP_TIP, v: 1, t: acum.getTime(), cand: SC.ymd(acum) + ' ' + SC.p2(acum.getHours()) + ':' + SC.p2(acum.getMinutes()),
        aplicatie: SC.VERSIUNE, mod: SC.store.mod, proiect: (window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.projectId) || '',
        user: u.nume || '', rol: u.rolReal || u.rol || '', cuJurnal: cuJurnal, jurnalDela: interval ? interval.a : '',
        nr: { comenzi: numaraComenzi(rez.comenzi), documente: documente }, col: rez
      };
    });
  };
  /* verifica un fisier citit; intoarce textul erorii sau '' */
  L.backupVerifica = function (b) {
    if (!b || typeof b !== 'object' || b.tip !== L.BACKUP_TIP) return 'Fișierul nu este o copie de siguranță Status Comenzi.';
    if (b.v !== 1) return 'Copia a fost făcută cu o versiune mai nouă a aplicației (format ' + b.v + '). Actualizează aplicația și încearcă din nou.';
    if (!b.col || typeof b.col.comenzi !== 'object' || !b.col.meta) return 'Copia este incompletă: lipsesc comenzile sau setările.';
    var rau = Object.keys(b.col.comenzi).filter(function (id) { var g = b.col.comenzi[id]; return !/^g\d+$/.test(id) || !g || typeof g.o !== 'object'; });
    if (rau.length) return 'Copia conține grupe de comenzi stricate (' + rau.slice(0, 3).join(', ') + ').';
    return '';
  };
  L.backupNumaraComenzi = numaraComenzi;
  /* ce parte din jurnalul de acum trebuie citita ca sa se vada ce ore lipsesc fata de copie: doar intervalul copiei */
  L.backupIntervalJurnal = function (copie) {
    var ids = Object.keys((copie.col || {}).jurnal || {}).sort();
    return ids.length ? { a: ids[0], b: ids[ids.length - 1] + '~' } : false;
  };
  /* text cu cheile ordonate, ca doua documente identice sa dea acelasi text oricum le-ar intoarce baza de date */
  function stabil(x) {
    if (x === null || typeof x !== 'object') return JSON.stringify(x === undefined ? null : x);
    if (Array.isArray(x)) return '[' + x.map(stabil).join(',') + ']';
    return '{' + Object.keys(x).sort().filter(function (k) { return x[k] !== undefined; }).map(function (k) { return JSON.stringify(k) + ':' + stabil(x[k]); }).join(',') + '}';
  }
  L.backupStabil = stabil;
  /* Planul de restaurare: ce documente se rescriu, ce se sterge si ce ramane neatins, comparand copia cu starea de acum
     (acum = tot o copie, citita chiar inainte). Se scriu doar documentele care difera, ca sa se consume cat mai putine scrieri.
     - comenzi, adrese, extra, notificari, cmr: devin exact ca in copie (ce nu este in copie se sterge);
     - meta: contorul si evidenta importurilor mereu; setarile (config) doar la cerere, pastrand calculatorul de backup de acum;
     - jurnal: nu se rescrie si nu se sterge nimic; se adauga doar orele care lipsesc acum. */
  L.backupPlan = function (copie, acum, cuSetari) {
    var plan = { scrie: {}, sterge: {}, nrScrie: 0, nrSterge: 0, nrLaFel: 0, pe: {} };
    function pune(col, id, data) { (plan.scrie[col] = plan.scrie[col] || []).push({ id: id, data: data }); plan.nrScrie++; plan.pe[col].scrie++; }
    ['comenzi', 'adrese', 'extra', 'notificari', 'cmr'].forEach(function (col) {
      var c = copie.col[col], a = acum.col[col] || {};
      plan.pe[col] = { scrie: 0, sterge: 0, laFel: 0 };
      if (!c) return;                                   // colectia lipseste din copie (copie veche): nu o atingem
      Object.keys(c).forEach(function (id) {
        if (a[id] && stabil(a[id]) === stabil(c[id])) { plan.nrLaFel++; plan.pe[col].laFel++; } else pune(col, id, c[id]);
      });
      var deSters = Object.keys(a).filter(function (id) { return !c[id]; });
      if (deSters.length) { plan.sterge[col] = deSters; plan.nrSterge += deSters.length; plan.pe[col].sterge = deSters.length; }
    });
    plan.pe.meta = { scrie: 0, sterge: 0, laFel: 0 };
    Object.keys(copie.col.meta || {}).forEach(function (id) {
      if (META_FARA_RESTAURARE[id]) return;
      var data = copie.col.meta[id], a = (acum.col.meta || {})[id];
      if (id === 'config') {
        if (!cuSetari) return;
        data = JSON.parse(JSON.stringify(data));
        if (a && a.backup) data.backup = a.backup; else delete data.backup;
      }
      if (a && stabil(a) === stabil(data)) { plan.nrLaFel++; plan.pe.meta.laFel++; } else pune('meta', id, data);
    });
    /* acum.col.jurnal contine macar orele din intervalul copiei (vezi L.backupIntervalJurnal) */
    plan.pe.jurnal = { scrie: 0, sterge: 0, laFel: 0 };
    if (copie.col.jurnal && acum.col.jurnal) {
      Object.keys(copie.col.jurnal).forEach(function (id) { if (!acum.col.jurnal[id]) pune('jurnal', id, copie.col.jurnal[id]); });
    }
    return plan;
  };
  /* aplica planul: intai stergerile, apoi scrierile, colectie cu colectie; la sfarsit o linie in jurnal */
  L.backupAplica = function (plan, text, progres) {
    var pasi = [], facut = 0, total = plan.nrScrie + plan.nrSterge;
    Object.keys(plan.sterge).forEach(function (col) { pasi.push({ col: col, sterge: plan.sterge[col] }); });
    ['meta', 'adrese', 'extra', 'notificari', 'cmr', 'jurnal', 'comenzi'].forEach(function (col) { if (plan.scrie[col]) pasi.push({ col: col, scrie: plan.scrie[col] }); });
    function urm(i) {
      if (i >= pasi.length) return Promise.resolve();
      var pas = pasi[i], baza = facut, n = (pas.sterge || pas.scrie).length;
      function prog(a) { if (progres) progres(baza + a, total); }
      return (pas.sterge ? SC.store.stergeMulte(pas.col, pas.sterge, prog) : SC.store.setMulte(pas.col, pas.scrie, prog)).then(function () { facut = baza + n; return urm(i + 1); });
    }
    return urm(0).then(function () { return SC.store.tx(function (t) { t.log(text); }); });
  };
  /* ---- registrul in Excel, pe modelul „Status Comenzi” ----
     Se scrie langa fiecare copie din folder, doar pentru consultat (restaurarea se face din fisierul .json).
     Foaia „Sheet1”: primele 25 de coloane sunt exact cele din registrul Excel, in aceeasi ordine, cu date, ore si numere
     adevarate (se pot sorta si filtra); in dreapta lor vin coloanele pe care le are doar aplicatia. Foaia „Adrese” ca in registru.
     Fisierul poate fi citit inapoi cu „Migrare din Excel”. */
  L.REGISTRU_MODEL = ['n', 'cl', 'st', 'nc', 'cc', 'dc', 'dl', 'de', 'ad', 'or', 'ju', 'g', 'ca', 'pe', 'gf', 'pr', 'am', 'dp', 'op', 'ob', 'co', 'inc', 'di', 'na', 'im'];
  L.REGISTRU_IN_PLUS = ['fpp', 'pk', 'nt', 'dtr', 'sc', 'te', 'se', 'so', 're', 'sp', 'cum'];
  var FMT_REGISTRU = { date: 'dd.mm.yyyy', dt: 'dd.mm.yyyy hh:mm', time: 'hh:mm' };
  function serialZi(ymd) { return Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10)) / 86400000 + 25569; }
  function serialOra(hm) { var m = /^(\d{1,2})[:.](\d{2})/.exec(hm); return m && +m[1] < 24 && +m[2] < 60 ? (+m[1] * 60 + +m[2]) / 1440 : null; }
  /* toate comenzile dintr-o copie (sau din grupele date), in ordinea Nr Crt */
  L.comenziDinGrupe = function (grupe) {
    var l = [];
    Object.keys(grupe || {}).forEach(function (id) {
      var o = (grupe[id] || {}).o || {};
      Object.keys(o).forEach(function (n) { var c = Object.assign({}, o[n]); c.n = +n; if (c.ju) c.ju = SC.fmtJudet(c.ju); l.push(c); });
    });
    return l.sort(function (a, b) { return a.n - b.n; });
  };
  L.registruExcel = function (comenzi, adreseDocs) {
    var cols = L.REGISTRU_MODEL.concat(L.REGISTRU_IN_PLUS).map(function (k) { return SC.COL[k]; });
    var aoa = [cols.map(function (c) { return c.x; })], cuFormat = [];
    comenzi.forEach(function (o, r) {
      aoa.push(cols.map(function (c, ci) {
        var v = o[c.k], s;
        if (v == null || v === '') return null;
        if (c.typ === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(v)) { cuFormat.push([r + 1, ci, FMT_REGISTRU.date]); return serialZi(v); }
        if (c.typ === 'dt' && /^\d{4}-\d{2}-\d{2}( \d{1,2}[:.]\d{2})?$/.test(v)) {
          s = String(v).length > 10 ? serialOra(String(v).slice(11)) : 0;
          if (s != null) { cuFormat.push([r + 1, ci, String(v).length > 10 ? FMT_REGISTRU.dt : FMT_REGISTRU.date]); return serialZi(v) + s; }
        }
        if (c.typ === 'time' && typeof v === 'string') { s = serialOra(v); if (s != null) { cuFormat.push([r + 1, ci, FMT_REGISTRU.time]); return s; } }
        if (c.k === 'nc' && /^[1-9]\d{0,14}$/.test(v)) return +v;
        return v;
      }));
    });
    var ws = XLSX.utils.aoa_to_sheet(aoa);
    cuFormat.forEach(function (x) { var cel = ws[XLSX.utils.encode_cell({ r: x[0], c: x[1] })]; if (cel) cel.z = x[2]; });
    ws['!cols'] = cols.map(function (c) { return { wch: Math.max(10, Math.round((c.w || 90) / 7)) }; });
    if (ws['!ref']) ws['!autofilter'] = { ref: ws['!ref'] };
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    var adr = [['Client', 'Cod', 'Nume 1', 'Stradă', 'Localitate', 'Judet']];
    Object.keys(adreseDocs || {}).sort().forEach(function (id) {
      ((adreseDocs[id] || {}).r || []).forEach(function (a) { adr.push([a.cl || null, a.cod || null, a.nume || null, a.str || null, a.loc || null, a.jud ? SC.fmtJudet(a.jud) : null]); });
    });
    var wsA = XLSX.utils.aoa_to_sheet(adr);
    wsA['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 40 }, { wch: 40 }, { wch: 22 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, wsA, 'Adrese');
    return wb;
  };
  L.registruOcteti = function (wb) { return XLSX.write(wb, { bookType: 'xlsx', type: 'array', compression: true, bookSST: true }); };

  /* ---- arhiva .zip, pentru copia salvata ca descarcare a browserului (un singur fisier: copia .json + registrul Excel) ----
     Se foloseste scrierea / citirea de arhive din biblioteca SheetJS, deja incarcata. */
  L.backupArhiva = function (fisiere) {
    var cfb = XLSX.CFB.utils.cfb_new();
    fisiere.forEach(function (f) { XLSX.CFB.utils.cfb_add(cfb, f.nume, f.octeti); });
    var o = XLSX.CFB.write(cfb, { fileType: 'zip', type: 'array', compression: true });
    return o instanceof Uint8Array ? o : new Uint8Array(o);
  };
  /* textul copiei .json dintr-o arhiva facuta de aplicatie */
  L.backupDinArhiva = function (octeti) {
    var cfb, i = -1;
    try { cfb = XLSX.CFB.read(octeti, { type: 'array' }); } catch (e) { throw eroare('Arhiva nu poate fi citită: nu este o copie de siguranță făcută de aplicație sau fișierul este stricat.'); }
    (cfb.FullPaths || []).forEach(function (cale, k) { if (i < 0 && /\.json$/i.test(cale)) i = k; });
    if (i < 0) throw eroare('Arhiva nu conține nicio copie de siguranță (.json).');
    var c = cfb.FileIndex[i].content;
    return new TextDecoder('utf-8').decode(c instanceof Uint8Array ? c : new Uint8Array(c));
  };

  /* evidenta copiilor (meta/backup): ultima copie automata, ultima manuala, ultima eroare. Un document mic, citit o data la pornire. */
  L.backupNoteaza = function (camp, date, textJurnal) {
    return SC.store.tx(function (t) {
      return t.get('meta', 'backup').then(function (d) {
        d = d || {};
        if (date === null) delete d[camp]; else d[camp] = date;
        if (camp === 'auto' && date) delete d.er;
        t.set('meta', 'backup', d);
        if (textJurnal) t.log(textJurnal);
      });
    });
  };
})();
