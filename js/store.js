/* Status Comenzi - stratul de date.
   Doua implementari cu aceeasi interfata:
     - Firebase (Firestore + Auth), cand config.js contine configuratia proiectului
     - Demo (in browser, IndexedDB), cand config.js este gol - pentru proba, fara server
   Colectii: comenzi (grupe de cate 25 de comenzi), adrese, meta, utilizatori, jurnal, public */
(function () {
  'use strict';
  var SC = window.SC;
  var FB_VER = '10.12.2';
  var DOMENIU = '@statuscomenzi.local';

  function clona(x) { return x == null ? x : JSON.parse(JSON.stringify(x)); }
  function eroare(msg) { var e = new Error(msg); e.prietenos = true; return e; }

  /* ===================================================================
     DEMO: totul in memorie, salvat in IndexedDB-ul browserului
     =================================================================== */
  function StoreDemo() {
    this.mod = 'demo';
    this.user = null;
    this.docs = {};            // 'col/id' -> data
    this.ascultatori = [];     // {col, id, cb, filtru}
    this.idb = null;
  }
  StoreDemo.prototype._deschideIDB = function () {
    var self = this;
    return new Promise(function (ok) {
      if (!window.indexedDB) return ok();
      var rq;
      try { rq = indexedDB.open('statuscomenzi-demo', 1); } catch (e) { return ok(); }
      rq.onupgradeneeded = function () { rq.result.createObjectStore('docs'); };
      rq.onerror = function () { ok(); };
      rq.onsuccess = function () {
        self.idb = rq.result;
        var tx = self.idb.transaction('docs', 'readonly'), st = tx.objectStore('docs');
        var c = st.openCursor();
        c.onsuccess = function () {
          var cur = c.result;
          if (cur) { self.docs[cur.key] = cur.value; cur.continue(); } else ok();
        };
        c.onerror = function () { ok(); };
      };
    });
  };
  StoreDemo.prototype._scrie = function (chei) {
    if (!this.idb) return;
    var tx = this.idb.transaction('docs', 'readwrite'), st = tx.objectStore('docs'), self = this;
    chei.forEach(function (k) {
      if (self.docs[k] === undefined) st.delete(k); else st.put(self.docs[k], k);
    });
  };
  StoreDemo.prototype._anunta = function (chei) {
    var self = this, peCol = {};
    chei.forEach(function (k) { var col = k.split('/')[0]; (peCol[col] = peCol[col] || []).push(k); });
    this.ascultatori.slice().forEach(function (a) {
      if (!peCol[a.col]) return;
      if (a.tip === 'doc') {
        if (peCol[a.col].indexOf(a.col + '/' + a.id) >= 0) a.cb(clona(self.docs[a.col + '/' + a.id]) || null);
      } else if (a.tip === 'col') {
        a.cb(self._colectie(a.col).filter(function (d) { return !a.idMin || d.id >= a.idMin; }));
      } else if (a.tip === 'comenzi') {
        a.cb(peCol[a.col].filter(function (k) { return self.docs[k]; }).map(function (k) {
          return { id: k.split('/')[1], data: clona(self.docs[k]) };
        }));
      }
    });
  };
  StoreDemo.prototype._colectie = function (col) {
    var self = this, pre = col + '/';
    return Object.keys(this.docs).filter(function (k) { return k.indexOf(pre) === 0; }).sort().map(function (k) {
      return { id: k.slice(pre.length), data: clona(self.docs[k]) };
    });
  };
  StoreDemo.prototype.init = function () {
    var self = this;
    return this._deschideIDB().then(function () {
      var uid = null;
      try { uid = sessionStorage.getItem('sc-demo-uid'); } catch (e) { /* fara sessionStorage */ }
      var u = uid && self.docs['utilizatori/' + uid];
      self.user = (u && u.activ) ? { uid: uid, nume: u.nume, rol: u.rol } : null;
      SC.onAuth(self.user);
    });
  };
  StoreDemo.prototype.citesteNume = function () {
    var d = this.docs['public/nume'];
    return Promise.resolve({ setup: !!d, lista: d ? clona(d.lista) : [] });
  };
  StoreDemo.prototype._intra = function (uid) {
    var u = this.docs['utilizatori/' + uid];
    this.user = { uid: uid, nume: u.nume, rol: u.rol };
    try { sessionStorage.setItem('sc-demo-uid', uid); } catch (e) { /* ignor */ }
    SC.onAuth(this.user);
  };
  StoreDemo.prototype.bootstrap = function (nume, pin) {
    if (this.docs['public/nume']) return Promise.reject(eroare('Configurarea inițială a fost deja făcută.'));
    var uid = 'u' + SC.idScurt(), email = SC.slug(nume) + DOMENIU;
    this.docs['utilizatori/' + uid] = { nume: nume, rol: 'admin', activ: true, email: email, pin: pin };
    this.docs['public/nume'] = { lista: [{ n: nume, e: email }] };
    this.docs['meta/setup'] = { de: nume, la: Date.now() };
    this._scrie(['utilizatori/' + uid, 'public/nume', 'meta/setup']);
    this._intra(uid);
    return Promise.resolve();
  };
  StoreDemo.prototype.login = function (email, pin) {
    var self = this, gasit = null;
    Object.keys(this.docs).forEach(function (k) {
      if (k.indexOf('utilizatori/') === 0 && self.docs[k].email === email) gasit = k.slice(12);
    });
    var u = gasit && this.docs['utilizatori/' + gasit];
    if (!u || u.pin !== pin) return Promise.reject(eroare('Nume sau PIN greșit.'));
    if (!u.activ) return Promise.reject(eroare('Contul este dezactivat.'));
    this._intra(gasit);
    return Promise.resolve();
  };
  StoreDemo.prototype.logout = function () {
    this.user = null;
    try { sessionStorage.removeItem('sc-demo-uid'); } catch (e) { /* ignor */ }
    SC.onAuth(null);
    return Promise.resolve();
  };
  StoreDemo.prototype.schimbaPin = function (pinNou) {
    var k = 'utilizatori/' + this.user.uid;
    this.docs[k].pin = pinNou; this._scrie([k]);
    return Promise.resolve();
  };
  StoreDemo.prototype.creeazaUtilizator = function (nume, pin, rol) {
    var uid = 'u' + SC.idScurt(), baza = SC.slug(nume), email = baza + DOMENIU, i = 1, self = this;
    function exista(e) {
      return Object.keys(self.docs).some(function (k) { return k.indexOf('utilizatori/') === 0 && self.docs[k].email === e; });
    }
    while (exista(email)) { i++; email = baza + '.' + i + DOMENIU; }
    this.docs['utilizatori/' + uid] = { nume: nume, rol: rol, activ: true, email: email, pin: pin };
    var p = this.docs['public/nume'] || { lista: [] };
    p.lista = p.lista.filter(function (x) { return x.n !== nume; }).concat([{ n: nume, e: email }]);
    this.docs['public/nume'] = p;
    this._scrie(['utilizatori/' + uid, 'public/nume']);
    this._anunta(['utilizatori/' + uid, 'public/nume']);
    return Promise.resolve(uid);
  };
  StoreDemo.prototype.tx = function (fn) {
    var self = this, scrieri = {}, jurnal = [];
    var t = {
      get: function (col, id) { return Promise.resolve(clona(self.docs[col + '/' + id]) || null); },
      set: function (col, id, data) { scrieri[col + '/' + id] = clona(data); },
      del: function (col, id) { scrieri[col + '/' + id] = undefined; },
      log: function (text) { jurnal.push(text); }
    };
    return Promise.resolve().then(function () { return fn(t); }).then(function (rez) {
      var chei = Object.keys(scrieri);
      chei.forEach(function (k) { if (scrieri[k] === undefined) delete self.docs[k]; else self.docs[k] = scrieri[k]; });
      if (jurnal.length) {
        var kj = 'jurnal/' + SC.idJurnal() + (jurnal.length > 40 ? '_' + SC.idScurt() : ''), dj = self.docs[kj] || { e: [] };
        jurnal.forEach(function (x) { dj.e.push(Date.now() + '|' + (self.user ? self.user.nume : '?') + '|' + x); });
        self.docs[kj] = dj; chei.push(kj);
      }
      self._scrie(chei);
      self._anunta(chei);
      return rez;
    });
  };
  StoreDemo.prototype.setMulte = function (col, lista, progres) {
    var self = this, chei = [];
    lista.forEach(function (d) { self.docs[col + '/' + d.id] = clona(d.data); chei.push(col + '/' + d.id); });
    this._scrie(chei); this._anunta(chei);
    if (progres) progres(lista.length, lista.length);
    return Promise.resolve();
  };
  StoreDemo.prototype.stergeColectie = function (col) {
    var self = this, pre = col + '/', chei = Object.keys(this.docs).filter(function (k) { return k.indexOf(pre) === 0; });
    chei.forEach(function (k) { delete self.docs[k]; });
    this._scrie(chei);
    return Promise.resolve(chei.length);
  };
  StoreDemo.prototype.citesteDoc = function (col, id) { return Promise.resolve(clona(this.docs[col + '/' + id]) || null); };
  StoreDemo.prototype.urmaresteDoc = function (col, id, cb) {
    var a = { tip: 'doc', col: col, id: id, cb: cb }, self = this;
    this.ascultatori.push(a); cb(clona(this.docs[col + '/' + id]) || null);
    return function () { self.ascultatori = self.ascultatori.filter(function (x) { return x !== a; }); };
  };
  StoreDemo.prototype.urmaresteColectie = function (col, cb) {
    var a = { tip: 'col', col: col, cb: cb }, self = this;
    this.ascultatori.push(a); cb(this._colectie(col));
    return function () { self.ascultatori = self.ascultatori.filter(function (x) { return x !== a; }); };
  };
  StoreDemo.prototype.urmaresteDela = function (col, idMin, cb) {
    var a = { tip: 'col', col: col, cb: cb, idMin: idMin }, self = this;
    this.ascultatori.push(a); cb(this._colectie(col).filter(function (d) { return d.id >= idMin; }));
    return function () { self.ascultatori = self.ascultatori.filter(function (x) { return x !== a; }); };
  };
  StoreDemo.prototype.citesteInterval = function (col, a, b) {
    return Promise.resolve(this._colectie(col).filter(function (d) { return d.id >= a && d.id <= b; }));
  };
  StoreDemo.prototype.urmaresteComenzi = function (pragRecent, cb) {
    var a = { tip: 'comenzi', col: 'comenzi', cb: cb }, self = this;
    this.ascultatori.push(a);
    cb(this._colectie('comenzi').filter(function (d) { return d.data.act > 0 || d.data.cmax >= pragRecent; }));
    return function () { self.ascultatori = self.ascultatori.filter(function (x) { return x !== a; }); };
  };
  StoreDemo.prototype.cautaGrupe = function (dela, panala) {
    return Promise.resolve(this._colectie('comenzi').filter(function (d) { return d.data.cmed >= dela && d.data.cmed <= panala; }));
  };
  StoreDemo.prototype.cautaChei = function (chei) {
    var set = {}; chei.forEach(function (k) { set[k] = 1; });
    return Promise.resolve(this._colectie('comenzi').filter(function (d) {
      return (d.data.k || []).some(function (k) { return set[k]; });
    }));
  };

  /* ===================================================================
     FIREBASE
     =================================================================== */
  function StoreFirebase(cfg) {
    this.mod = 'firebase';
    this.cfg = cfg;
    this.user = null;
    this.inBootstrap = false;
  }
  StoreFirebase.prototype.init = function () {
    var self = this, baza = 'https://www.gstatic.com/firebasejs/' + FB_VER + '/';
    return Promise.all([
      import(baza + 'firebase-app.js'), import(baza + 'firebase-auth.js'), import(baza + 'firebase-firestore.js')
    ]).then(function (m) {
      self.A = m[0]; self.AU = m[1]; self.F = m[2];
      self.app = self.A.initializeApp(self.cfg);
      self.auth = self.AU.getAuth(self.app);
      try {
        self.db = self.F.initializeFirestore(self.app, {
          ignoreUndefinedProperties: true,
          localCache: self.F.persistentLocalCache({ tabManager: self.F.persistentMultipleTabManager() })
        });
      } catch (e) {
        self.db = self.F.initializeFirestore(self.app, { ignoreUndefinedProperties: true });
      }
      self.AU.onAuthStateChanged(self.auth, function (fu) {
        if (self.inBootstrap) return;
        if (!fu) { self.user = null; SC.onAuth(null); return; }
        self._profil(fu).catch(function (e) {
          self.user = null; SC.onAuth(null, e.prietenos ? e.message : 'Nu am putut citi profilul utilizatorului: ' + e.message);
          self.AU.signOut(self.auth);
        });
      });
    });
  };
  StoreFirebase.prototype._ref = function (col, id) { return this.F.doc(this.db, col, id); };
  StoreFirebase.prototype._profil = function (fu) {
    var self = this;
    return this.F.getDoc(this._ref('utilizatori', fu.uid)).then(function (s) {
      if (!s.exists()) throw eroare('Contul nu are drepturi în aplicație. Cere administratorului să te adauge.');
      var u = s.data();
      if (!u.activ) throw eroare('Contul este dezactivat.');
      self.user = { uid: fu.uid, nume: u.nume, rol: u.rol };
      SC.onAuth(self.user);
    });
  };
  StoreFirebase.prototype.citesteNume = function () {
    return this.F.getDoc(this._ref('public', 'nume')).then(function (s) {
      return { setup: s.exists(), lista: s.exists() ? (s.data().lista || []) : [] };
    });
  };
  StoreFirebase.prototype.bootstrap = function (nume, pin) {
    var self = this, email = SC.slug(nume) + DOMENIU;
    this.inBootstrap = true;
    return this.AU.createUserWithEmailAndPassword(this.auth, email, pin).then(function (cred) {
      var b = self.F.writeBatch(self.db);
      b.set(self._ref('utilizatori', cred.user.uid), { nume: nume, rol: 'admin', activ: true, email: email });
      b.set(self._ref('meta', 'setup'), { de: nume, la: Date.now() });
      b.set(self._ref('public', 'nume'), { lista: [{ n: nume, e: email }] });
      return b.commit().then(function () { self.inBootstrap = false; return self._profil(cred.user); });
    }).catch(function (e) { self.inBootstrap = false; throw traduce(e); });
  };
  StoreFirebase.prototype.login = function (email, pin) {
    return this.AU.signInWithEmailAndPassword(this.auth, email, pin).then(function () { }, function (e) { throw traduce(e); });
  };
  StoreFirebase.prototype.logout = function () { return this.AU.signOut(this.auth); };
  StoreFirebase.prototype.schimbaPin = function (pinNou) {
    return this.AU.updatePassword(this.auth.currentUser, pinNou).catch(function (e) { throw traduce(e); });
  };
  /* utilizator nou, creat printr-o a doua instanta a aplicatiei (ca administratorul sa ramana autentificat) */
  StoreFirebase.prototype.creeazaUtilizator = function (nume, pin, rol) {
    var self = this, baza = SC.slug(nume);
    var app2 = this.A.initializeApp(this.cfg, 'sec' + Date.now()), auth2 = this.AU.getAuth(app2);
    function incearca(i) {
      var email = baza + (i > 1 ? '.' + i : '') + DOMENIU;
      return self.AU.createUserWithEmailAndPassword(auth2, email, pin).then(function (cred) {
        return { uid: cred.user.uid, email: email };
      }, function (e) {
        if (e.code === 'auth/email-already-in-use' && i < 20) return incearca(i + 1);
        throw traduce(e);
      });
    }
    return incearca(1).then(function (nou) {
      return self.AU.signOut(auth2).then(function () { return self.A.deleteApp(app2); }).then(function () {
        return self.F.runTransaction(self.db, function (tr) {
          return tr.get(self._ref('public', 'nume')).then(function (s) {
            var lista = s.exists() ? (s.data().lista || []) : [];
            lista = lista.filter(function (x) { return x.n !== nume; }).concat([{ n: nume, e: nou.email }]);
            tr.set(self._ref('utilizatori', nou.uid), { nume: nume, rol: rol, activ: true, email: nou.email });
            tr.set(self._ref('public', 'nume'), { lista: lista });
          });
        });
      }).then(function () { return nou.uid; });
    });
  };
  StoreFirebase.prototype.tx = function (fn) {
    var self = this;
    return this.F.runTransaction(this.db, function (tr) {
      var jurnal = [];
      var t = {
        get: function (col, id) {
          return tr.get(self._ref(col, id)).then(function (s) { return s.exists() ? s.data() : null; });
        },
        set: function (col, id, data) { tr.set(self._ref(col, id), data); },
        del: function (col, id) { tr.delete(self._ref(col, id)); },
        log: function (text) { jurnal.push(text); }
      };
      return Promise.resolve(fn(t)).then(function (rez) {
        if (jurnal.length) {
          var acum = Date.now(), nume = self.user ? self.user.nume : '?';
          var linii = jurnal.map(function (x, i) { return (acum + i) + '|' + nume + '|' + x; });
          /* operatiile in masa isi scriu jurnalul intr-un document propriu, ca documentul orei sa nu ajunga la limita de 1 MB */
          var idJ = SC.idJurnal() + (linii.length > 40 ? '_' + SC.idScurt() : '');
          tr.set(self._ref('jurnal', idJ), { e: self.F.arrayUnion.apply(null, linii) }, { merge: true });
        }
        return rez;
      });
    }).catch(function (e) { throw traduce(e); });
  };
  StoreFirebase.prototype.setMulte = function (col, lista, progres) {
    var self = this, i = 0, PAS = 20;
    function pas() {
      if (i >= lista.length) return Promise.resolve();
      var b = self.F.writeBatch(self.db);
      lista.slice(i, i + PAS).forEach(function (d) { b.set(self._ref(col, d.id), d.data); });
      i += PAS;
      return b.commit().then(function () { if (progres) progres(Math.min(i, lista.length), lista.length); return pas(); });
    }
    return pas().catch(function (e) { throw traduce(e); });
  };
  StoreFirebase.prototype.stergeColectie = function (col) {
    var self = this, total = 0;
    function pas() {
      return self.F.getDocs(self.F.query(self.F.collection(self.db, col), self.F.limit(200))).then(function (qs) {
        if (qs.empty) return total;
        var b = self.F.writeBatch(self.db);
        qs.forEach(function (d) { b.delete(d.ref); });
        total += qs.size;
        return b.commit().then(pas);
      });
    }
    return pas();
  };
  StoreFirebase.prototype.citesteDoc = function (col, id) {
    return this.F.getDoc(this._ref(col, id)).then(function (s) { return s.exists() ? s.data() : null; });
  };
  StoreFirebase.prototype.urmaresteDoc = function (col, id, cb) {
    return this.F.onSnapshot(this._ref(col, id), function (s) { cb(s.exists() ? s.data() : null); }, raporteaza);
  };
  StoreFirebase.prototype.urmaresteColectie = function (col, cb) {
    return this.F.onSnapshot(this.F.collection(this.db, col), function (qs) {
      var l = []; qs.forEach(function (d) { l.push({ id: d.id, data: d.data() }); });
      l.sort(function (a, b) { return a.id < b.id ? -1 : 1; });
      cb(l);
    }, raporteaza);
  };
  StoreFirebase.prototype.urmaresteDela = function (col, idMin, cb) {
    var F = this.F;
    return F.onSnapshot(F.query(F.collection(this.db, col), F.where(F.documentId(), '>=', idMin)), function (qs) {
      var l = []; qs.forEach(function (d) { l.push({ id: d.id, data: d.data() }); });
      cb(l);
    }, raporteaza);
  };
  StoreFirebase.prototype.citesteInterval = function (col, a, b) {
    var F = this.F;
    return F.getDocs(F.query(F.collection(this.db, col), F.where(F.documentId(), '>=', a), F.where(F.documentId(), '<=', b)))
      .then(function (qs) { var l = []; qs.forEach(function (d) { l.push({ id: d.id, data: d.data() }); }); return l; });
  };
  /* doua interogari in timp real: grupele cu comenzi active + grupele create recent.
     Cand o grupa iese dintr-o interogare (nu mai are comenzi active) o recitim o data, ca sa nu ramana veche. */
  StoreFirebase.prototype.urmaresteComenzi = function (pragRecent, cb) {
    var self = this, F = this.F, col = F.collection(this.db, 'comenzi');
    var vii = [{}, {}];
    function asculta(q, idx) {
      return F.onSnapshot(q, function (qs) {
        var schimbate = [];
        qs.docChanges().forEach(function (ch) {
          if (ch.type === 'removed') {
            delete vii[idx][ch.doc.id];
            if (!vii[1 - idx][ch.doc.id]) {
              F.getDoc(ch.doc.ref).then(function (s) { if (s.exists()) cb([{ id: s.id, data: s.data() }]); });
            }
          } else {
            vii[idx][ch.doc.id] = 1;
            schimbate.push({ id: ch.doc.id, data: ch.doc.data() });
          }
        });
        if (schimbate.length || !qs.metadata.fromCache) cb(schimbate);
      }, raporteaza);
    }
    var u1 = asculta(F.query(col, F.where('act', '>', 0)), 0);
    var u2 = asculta(F.query(col, F.where('cmax', '>=', pragRecent)), 1);
    return function () { u1(); u2(); };
  };
  StoreFirebase.prototype.cautaGrupe = function (dela, panala) {
    var F = this.F;
    return F.getDocs(F.query(F.collection(this.db, 'comenzi'), F.where('cmed', '>=', dela), F.where('cmed', '<=', panala)))
      .then(function (qs) { var l = []; qs.forEach(function (d) { l.push({ id: d.id, data: d.data() }); }); return l; });
  };
  StoreFirebase.prototype.cautaChei = function (chei) {
    var F = this.F, col = F.collection(this.db, 'comenzi'), rez = {}, parti = [];
    for (var i = 0; i < chei.length; i += 30) parti.push(chei.slice(i, i + 30));
    return Promise.all(parti.map(function (p) {
      return F.getDocs(F.query(col, F.where('k', 'array-contains-any', p))).then(function (qs) {
        qs.forEach(function (d) { rez[d.id] = { id: d.id, data: d.data() }; });
      });
    })).then(function () { return Object.keys(rez).map(function (k) { return rez[k]; }); });
  };

  function raporteaza(e) { if (SC.onEroareSync) SC.onEroareSync(traduce(e)); }
  function traduce(e) {
    if (!e || e.prietenos) return e;
    var c = e.code || '', m;
    if (c === 'auth/invalid-credential' || c === 'auth/wrong-password' || c === 'auth/user-not-found' ||
        c === 'auth/invalid-login-credentials') m = 'Nume sau PIN greșit.';
    else if (c === 'auth/too-many-requests') m = 'Prea multe încercări. Așteaptă câteva minute.';
    else if (c === 'auth/network-request-failed' || c === 'unavailable') m = 'Nu există conexiune la internet.';
    else if (c === 'auth/weak-password') m = 'PIN-ul trebuie să aibă 6 cifre.';
    else if (c === 'auth/requires-recent-login') m = 'Pentru schimbarea PIN-ului ieși din cont, intră din nou și repetă.';
    else if (c === 'auth/email-already-in-use') m = 'Există deja un cont cu acest nume.';
    else if (c === 'permission-denied') m = 'Nu ai drepturi pentru această operație.';
    else if (c === 'resource-exhausted') m = 'Limita zilnică a planului gratuit Firebase a fost atinsă. Aplicația revine după resetarea cotei (dimineața, ora României).';
    else if (c === 'failed-precondition' || c === 'aborted') m = 'Altcineva a modificat aceleași comenzi în același moment. Încearcă din nou.';
    if (!m) return e;
    var n = eroare(m); n.code = c; return n;
  }

  SC.creeazaStore = function () {
    var cfg = window.FIREBASE_CONFIG;
    var areCfg = cfg && cfg.apiKey && cfg.projectId && !/^(PUNE|YOUR)/i.test(cfg.apiKey);
    var demoFortat = /[?&]demo=1/.test(location.search);
    SC.store = (areCfg && !demoFortat) ? new StoreFirebase(cfg) : new StoreDemo();
    return SC.store;
  };
})();
