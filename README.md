# Status Comenzi — aplicație web

Înlocuiește registrul Excel „Status Comenzi 2026_2.xlsm” și fișierul „Status Incarcari”:
comenzi, statusuri, import borderou Kandia, Adrese, Nr AUTO, confirmarea încărcării, borderou de încărcare.

## Ce conține pachetul

| Fișier | Rol |
|---|---|
| `index.html`, `js/` | aplicația |
| `config.js` | configurația proiectului Firebase (goală = mod demonstrație) |
| `firestore.rules` | regulile de acces, de lipit în consola Firebase |
| `firestore.indexes.json` | excepțiile de indexare (opțional, vezi pasul 4) |
| `manifest.json` | pentru „Adaugă pe ecranul principal” pe telefon / PDA |

## Probă rapidă, fără niciun cont

Deschide `index.html` în Edge sau Chrome. Cu `config.js` gol, aplicația pornește în **mod demonstrație**:
creezi un administrator, apoi din *Administrare → Migrare din Excel* încarci registrul `.xlsm`.
Datele rămân doar în acel browser, deci este bun pentru probă, nu pentru lucru în echipă.

## Punere în funcțiune (o singură dată)

1. **Proiect Firebase** — console.firebase.google.com → *Add project* (fără Google Analytics).
2. **Authentication** → *Get started* → *Sign-in method* → activează **Email/Password**.
3. **Firestore Database** → *Create database* → locație `eur3 (Europe)` → *Production mode*.
   Apoi tabul **Rules**: șterge tot, lipește conținutul din `firestore.rules`, *Publish*.
4. **Excepții de indexare** (recomandat, 2 minute): Firestore → *Indexes* → *Single field* → *Add exemption*:
   colecția `comenzi`, câmpul `o`, dezactivează toate opțiunile. Repetă pentru `adrese` / `r` și `jurnal` / `e`.
   Fără acest pas aplicația merge la fel, dar ocupă de câteva ori mai mult spațiu.
5. **Aplicația web** — *Project settings* → *Your apps* → `</>` → înregistrează aplicația și copiază valorile
   din `firebaseConfig` în `config.js`.
6. **GitHub Pages** — încarcă toate fișierele într-un repository, *Settings → Pages → Deploy from branch → main / root*.
7. **Prima deschidere** — aplicația cere crearea administratorului (numele tău + PIN de 6 cifre).
   Fă acest pas imediat după publicare: primul care deschide pagina devine administrator.
8. **Migrare** — *Administrare → Migrare din Excel* → alege `Status Comenzi 2026_2.xlsm`.
9. **Utilizatori** — *Administrare → Utilizatori*: nume, PIN, rol.

În ziua trecerii de pe Excel rulează din nou migrarea cu ultima versiune a registrului: înlocuiește tot ce e în aplicație.

## Roluri

| Rol | Ce poate face |
|---|---|
| **Administrator** | Tot: utilizatori, migrare, arhivare, jurnal, plus tot ce pot celelalte roluri. |
| **Operator date** | Toată partea de comenzi: adaugă manual, modifică orice câmp al comenzii, schimbă statusuri, importă borderoul Kandia, fișiere Excel și fișierul de transport din TMS; editează Adrese. Nu confirmă încărcări. În fereastra comenzii nu are câmpurile camionului (Stare camion, Temperatură, Semnătură, Șofer, Remorcă); acestea rămân vizibile în listă și la Administrator. |
| **Încărcări** | Taburile *Încărcări* și *KPI's*: confirmă camioanele (stare camion, temperatură, semnătură) și tipărește borderoul. Vede și tabul *Comenzi*, doar pentru citit: poate căuta, filtra și exporta, dar comanda nu se deschide la click și nu poate modifica nimic acolo. |
| **Transport** | Face fișierul de import pentru TMS (*Export pentru TMS*) și stabilește ordinea în care se încarcă mașinile. Un click pe celula *Observații* sau *Comentarii* deschide tot textul într-o fereastră (se închide cu Esc sau cu un click în afara ei). Vede comenzile și încărcările; pune comenzile pe camion (**Nr AUTO** + **Nr transport**) din fereastra camionului — click pe celula Nr AUTO sau Nr transport, ori „Creează TRA…” pentru comenzile bifate —, cât timp comanda nu e încărcată (vezi „Camioane scrise de mână”). Poate bifa comenzi ca să vadă suma greutății și a paleților estimați și poate importa fișierul TMS. |

**Comenzi bifate.** Operatorul de date, Administratorul și Transportul pot bifa comenzi în listă; deasupra tabelului apare
o bară cu numărul lor și cu totalul de greutate și de paleți estimați. Operatorul de date și Administratorul văd acolo și
totalul de **cartoane**.

**Vezi ca alt rol (doar Administrator).** În bara de sus, lângă nume, administratorul are lista **Vezi ca**: alege
*Operator date*, *Încărcări* sau *Transport* și aplicația se reface exact cum o vede acel rol (taburi, butoane, ce se
poate modifica). O bandă galbenă arată rolul ales și are butonul *Înapoi la Administrator*. Atenție: nu este o
simulare — ce modifici în această vedere se salvează cu adevărat, pe numele tău. Vederea revine la Administrator la
ieșire sau la reîncărcarea paginii. Nu consumă nimic în plus din planul gratuit (se recitesc o dată aceleași date).

**Jurnal.** Fiecare modificare rămâne în *Administrare → Jurnal de modificări*: cine, când, comanda, câmpul,
valoarea veche → valoarea nouă. Jurnalul nu poate fi șters sau citit decât de administrator. Se poate afișa pe o zi sau pe o
perioadă (*De la* / *Până la*, cel mult 366 de zile o dată), cu căutare după comandă, utilizator sau câmp, iar
**Export Excel** descarcă tot ce corespunde perioadei și căutării: Data, Ora, Utilizator, Comandă, Nr Crt, Modificare
(Data și Ora sunt valori de dată adevărate, deci se pot sorta și filtra în Excel). Jurnalul are câte un document pe
ora în care s-a lucrat: o zi înseamnă cel mult câteva zeci de citiri, o lună câteva sute.

**Unde sunt impuse drepturile.** Regulile bazei de date împart utilizatorii în trei trepte: cine poate crea comenzi și
modifica adrese (Administrator, Operator date), cine poate doar modifica comenzi existente (Încărcări, Transport) și cine
administrează. Limitarea *pe câmp* (Transport doar Nr AUTO, Încărcări doar confirmarea) este impusă de aplicație.

## Regulile preluate din Excel

- Statusuri: Initiata, In lucru, Terminata, Self-Pick, Anulata, cu aceleași întrebări și culori.
- Terminata / Self-Pick: paleți reali, amprente, greutate finală; KANDIA = greutate + paleți × 20 kg, ceilalți manual
  (cu avertisment la peste 5× greutatea comenzii); toleranță ±1 palet față de estimare.
- FPP și Pick (paleți full / paleți din picking): la completarea FPP, Pick se propune singur (estimarea rotunjită în sus − FPP;
  după terminare, paleți reali − FPP). La Terminata / Self-Pick ambele se confirmă obligatoriu și rămân modificabile după.
- Anulata: se șterg datele comenzii, rămân Nr Crt, client, număr comandă și eticheta de import.
- Comandă manuală: „MANUAL: data ora”, verificare de dublură pe același client, completare din Adrese după Cod Client.
- Import borderou: „Document” = comenzi (EDI), „Nr. aviz” = materiale (EDI MAT); comenzile existente sunt sărite;
  județul din Adrese după destinatar, altfel după oraș (roșu), altfel se cere.
- **Rescriere din borderou (doar Administratorul)**: la importul unui borderou care conține comenzi existente, fereastra
  arată pentru fiecare ce diferă (destinatar, adresă, oraș, județ, date, greutate, cartoane, paleți estimați; Observațiile
  doar la cerere), iar administratorul bifează ce comenzi să fie rescrise. Statusul, paleții reali, Nr AUTO și încărcarea
  rămân neschimbate, o celulă goală din borderou nu șterge nimic, iar valorile vechi rămân în jurnal. La o comandă
  Terminata cu greutate finală calculată automat, greutatea finală se recalculează după noua greutate.
- Încărcată = DA doar pentru comenzi Terminata.
- **Sugestie de județ în fereastra comenzii** (comandă nouă sau modificare): când orașul are un județ cunoscut și în
  câmpul Județ este altceva (gol, numele orașului, alt județ), lângă eticheta „Județ” apare sugestia („sugestie: Vrancea”,
  sau „corect: Vrancea” când în câmp nu este scris un județ). Un click o completează; nu blochează salvarea. Sugestia
  vine dintr-o listă a județelor cu orașele lor mai mari (din cod), iar pentru celelalte localități din Adrese — de acolo
  doar dacă rezultatul este un nume de județ adevărat.
- Județul se scrie peste tot în forma „Bucuresti”, nu „BUCURESTI” (prima literă a fiecărui cuvânt mare: „Satu Mare”,
  „Caras-Severin”), indiferent de unde vine: scris de mână, Adrese, borderou, Excel, fișierul TMS. Rămân cu majuscule
  prescurtările (SUA) și codurile de 1–2 litere scrise singure (MH, B). Comenzile salvate mai demult cu majuscule apar
  direct în forma nouă, fără nicio scriere în baza de date; se rescriu acolo abia când comanda este modificată.

## Ce diferă față de Excel

- Nr Crt vine dintr-un contor unic, deci nu se mai pot dubla numerele când doi colegi adaugă simultan.
- Borderoul nu mai este mutat în „Importate” (un browser nu poate muta fișiere); aplicația ține minte numele
  fișierelor importate și avertizează la reimport.
- Avertisment dacă în borderou rămân rânduri necitite și dacă amprentele depășesc paleții.
- Adresele transformate de Excel în dată („22 Decembrie 1989”) sunt refăcute ca text.
- Încărcarea se confirmă în tabul *Încărcări* (camion → comenzi → stare camion, temperatură, semnătură).

## Fișierul de transport (TMS)

- Se importă din *Încărcări → Import fișier transport (TMS)*, de către Administrator sau Operator date.
- Fișierul este cumulativ, așa că se procesează doar transporturile din ultimele 14 zile (și rândurile fără dată).
- Comenzile găsite în registru primesc Nr AUTO, Nr transport, șofer, remorcă și data transportului.
- **Același transport încărcat din nou** (al doilea grafic, cu aceleași numere de transport): înainte de „Aplică”, fereastra de
  import compară fiecare transport din fișier cu ce este acum în aplicație și arată, pe transport, ce s-a schimbat — alt
  Nr AUTO, altă dată de încărcare, alt șofer sau altă remorcă, comenzi adăugate, comenzi care nu mai sunt pe transport,
  comenzi mutate pe alt transport, linii „doar din transport” adăugate / scoase și cantități schimbate în TMS — plus câte
  transporturi sunt neschimbate și câte sunt noi. Dacă borderoul transportului a fost deja tipărit, apare un avertisment că
  trebuie tipărit din nou. La „Aplică”: comenzile primesc noile date (și șoferul / remorca, chiar dacă doar ele s-au schimbat),
  iar comenzile din registru care nu mai sunt pe transportul lor rămân fără camion (li se șterg Nr AUTO, Nr transport, data,
  șoferul și remorca) — bifa „Scoate de pe camion…” se poate scoate dacă nu vrei asta. Se compară doar transporturile care
  apar în fișier; comenzile deja încărcate nu se ating. O linie „doar din transport” mutată pe altă zi își păstrează
  corecturile făcute de mână. Borderoul nu este salvat: se face din datele comenzilor, deci după import arată situația nouă.
- Rândurile care **nu există în registru** nu intră în tabul Comenzi: merg în rubrica „Doar din transport” din tabul
  Încărcări, apar la camionul lor și în borderou. Paleții și greutatea lor vin din TMS (`UnitatiTotale`, `MasaTotala`)
  și pot fi corectate acolo; amprentele se completează manual.
- Liniile din TMS cu „Ridicare” sau „Preluare” în referință sunt retururi: nu se încarcă, iar paleții și greutatea lor nu
  intră în niciun total (Încărcări, borderou, KPI's). Rămân vizibile, marcate „Retur”.
- **Comenzi încărcate înainte să fie închise.** În fereastra „Confirmare încărcare” apar și comenzile camionului care nu
  sunt încă Terminata (Inițiată / În lucru). Ele nu pot fi sărite: la „Confirmă încărcarea”, aplicația duce la prima comandă
  neterminată fără **paleții și amprentele numărate** (rândul se înroșește, cursorul intră în câmp) și nu confirmă nimic până
  nu sunt scrise la toate. Dacă o comandă chiar nu pleacă cu camionul, pe rândul ei este butonul **„Nu pleacă”** (și la
  comenzile Terminata): după confirmare, comanda este scoasă pe loc de pe camion (i se șterg Nr AUTO, Nr transport, data,
  șoferul și remorca), dispare din fereastră și rămâne în jurnal. Aplicația ține minte de pe ce transport a fost scoasă, așa
  că următorul import al graficului nu o pune singur înapoi pe același transport: fereastra de import o arată separat, cu
  bifa „Pune înapoi pe transportul lor…” (nebifată). Pe alt transport sau cu Nr AUTO pus de mână se planifică normal. Comanda devine *Încărcată = DA* pe loc, statusul
  rămâne cel de dinainte, iar camionul apare ca încărcat — nu mai trebuie redeschis. Cifrele se păstrează separat (în jurnal:
  „Paleți / Amprente numărate la încărcare”) și apar în borderou, în totalurile camionului și în KPI's (comanda se numără ca
  pregătită). Operatorul de date vede aceste comenzi cu eticheta „de închis” în celula Nr AUTO și are în tabul Comenzi
  butonul **„Încărcate, de închis N”**, care le filtrează (apare doar când există). La trecerea pe Terminata, fereastra arată
  ce s-a numărat la încărcare, pune amprentele ca sugestie și avertizează (fără să blocheze) dacă FPP + Pick diferă de paleții
  numărați. Butonul „Încarcă” apare și la camioanele care au doar comenzi neterminate. Comenzile vechi din registrul Excel
  care erau „încărcate” cu status deschis nu intră în această numărătoare.
- **Notificări pentru Încărcări.** Când un transport care era deja în aplicație este încărcat din nou cu modificări (alt camion,
  altă dată, comenzi adăugate / scoase etc.), colegii de la Încărcări primesc o notificare pentru fiecare transport modificat
  (butonul *Notificări*, cu număr roșu), cu ce s-a schimbat și, dacă e cazul, cu avertismentul că borderoul fusese deja
  tipărit. Un click pe numărul de transport deschide camionul în tabul Încărcări; „Am văzut” notează cine a luat la cunoștință.
  Notificările de transport se păstrează 7 zile (modificările rămân oricum în jurnal). Operatorul de date vede în continuare
  doar notificările despre datele de livrare, iar Administratorul pe toate.
- Ora de început a încărcării se înregistrează automat la prima tipărire a borderoului (Administrator sau Încărcări);
  ora de sfârșit este confirmarea încărcării. Lista de camioane arată ambele și durata.
- Data de încărcare a camionului este ziua din coloana `DataTransport` (dacă lipsește, `DataEstimataIncarcare`).
- *Golește încărcările…* (Administrator, tabul Încărcări) șterge tot ce a venit din fișierele de transport — liniile „doar din
  transport”, orele de început de încărcare, Nr transport / Data transport / Șofer / Remorcă de pe comenzile neîncărcate —
  ca următorul import să pornească de la zero. Nr AUTO și comenzile deja încărcate rămân.
  A doua opțiune a aceleiași ferestre șterge camioanele „Fără dată”: Nr AUTO de pe comenzile neîncărcate care nu au dată de
  transport (valoarea veche rămâne în jurnal).

## Versiunea aplicației
- Versiunea care rulează pe calculator apare în antet, lângă nume (ex. „v2.46”).
- Pachetul conține `versiune.json`. Aplicația îl citește de pe GitHub Pages (nu din Firebase) la pornire, din 10 în 10 minute și
  la revenirea în pagină; dacă pe server este altă versiune, apare o bandă albastră cu butonul „Reîncarcă acum”.
- La fiecare actualizare se urcă **toate** fișierele din pachet, inclusiv `index.html` și `versiune.json`.

## Statusuri: întrebări de siguranță
- Anularea unei comenzi deja încărcate cere o confirmare separată, care arată camionul, data și cine a încărcat-o.
- Redeschiderea (Terminata / Self-Pick / Anulata → Initiata / In lucru) cere confirmare și spune ce se pierde: data și ora
  pregătirii; la o comandă anulată, toate datele ei (revine goală, fără comentariul „COMANDA ANULATA”).
- Trecerea între Initiata și In lucru rămâne fără întrebare.

## Anularea unei încărcări (doar Administratorul)
În tabul *Încărcări*, cu „arată și camioanele deja încărcate” bifat, camioanele încărcate au butonul **„Anulează încărcarea”**.
Fereastra arată liniile camionului (toate bifate); de pe cele bifate se șterg Încărcată, data încărcării, starea camionului,
temperatura și semnătura. La comenzile plecate neînchise se șterg și paleții și amprentele numărate la încărcare. Camionul
apare din nou de încărcat. Totul rămâne în jurnal.

## Camioane scrise de mână (fără fișierul de transport)
Pentru câteva comenzi nu mai e nevoie de importul graficului: Transportul le pune pe camion direct din tabul *Comenzi*.
- **O comandă**: click pe celula *Nr AUTO* sau *Nr transport*. **Mai multe**: le bifezi și apeși **„Creează TRA…”** în bara de
  bifare (Administratorul are același buton; Operatorul de date nu pune comenzi pe mașini și nu are buton pentru Nr AUTO).
- Fereastra are câmpurile *Nr AUTO* și *Nr transport (TRA)*, iar dedesubt lista derulantă a camioanelor care există deja (cele
  care mai au ceva de încărcat sau sunt de azi încolo). Lista se scurtează pe măsură ce scrii; un click pe un rând îl alege.
  Ajunge și numărul de transport scris întreg: camionul lui se completează singur.
- **Camion existent**: comanda se adaugă pe el și primește data încărcării, șoferul și remorca lui.
- **Camion nou** (numere care nu există): apar câmpurile *Data încărcării* (propusă: azi), *Șofer* și *Remorcă*. Se poate crea
  și un camion doar cu Nr AUTO, fără număr de transport.
- Un număr de transport nu poate fi pus pe alt număr auto decât cel pe care există deja; excepție: dacă alegi toate comenzile
  transportului, îi corectezi numărul auto. Ambele câmpuri goale = comanda rămâne fără camion. Enter salvează.
- Încărcările primesc notificare când se adaugă sau se scot comenzi de pe un camion existent ori i se schimbă numărul auto.
- **La următorul import al graficului**: o comandă trecută de mână pe un transport și care nu este (încă) în fișier **rămâne**
  pe camion — apare doar ca informație, „Trecute de mână în aplicație, nu sunt în fișier (rămân)”. Din momentul în care fișierul
  o conține pe același transport, o ține fișierul: dacă dispare apoi din el, se propune scoaterea, ca la orice altă comandă.
  Dacă fișierul o are pe alt transport, fișierul are prioritate.

## Căutarea în tabul Încărcări
Căutarea după Nr AUTO sau Nr transport ține cont de zilele alese în calendar: cu una sau mai multe zile bifate apar doar camioanele din
acele zile (titlul spune câte mai sunt în alte zile); fără nicio zi bifată („Toate datele”) caută în toate. Căutarea găsește și
camioanele deja încărcate.

## Adrese: export și import în Excel (doar Administratorul)
În tabul *Adrese*, Administratorul are două butoane:
- **Export adrese (Excel)** — descarcă toate adresele, foaia „Adrese”, cu coloanele Client, Cod, Nume 1, Stradă, Localitate, Judet
  (aceleași ca în registru). Codurile sunt text, ca să nu se piardă zerourile din față.
- **Import adrese (Excel)…** — citește un fișier cu aceleași coloane (foaia „Adrese” sau prima foaie care are coloana „Nume 1”).
  Fereastra arată câte adrese sunt noi, modificate, la fel și câte există doar în aplicație, apoi alegi:
  *Adaugă și actualizează* (ce nu e în fișier rămâne) sau *Înlocuiește tot* (rămân doar adresele din fișier; cere o confirmare).
  O adresă este „aceeași” dacă are același client și cod; fără cod: același client, nume, localitate și stradă.
  Adresele care împart același cod (puncte de livrare diferite) se păstrează toate; un export importat înapoi neschimbat nu modifică nimic.
  Înainte de import se descarcă automat un Excel cu adresele de dinainte, ca importul să poată fi dat înapoi.
- Consum: importul rescrie nomenclatorul întreg — câte un document la 400 de adrese (câteva scrieri).

## Export pentru TMS: contorul și perioada
- Cifra de pe butonul „Export pentru TMS” = comenzile **neexportate cu livrare solicitată mâine**; dacă mâine e weekend, intră și
  zilele până la prima zi lucrătoare inclusiv (vinerea: sâmbătă, duminică și luni).
  Totalul neexportatelor apare când ții mouse-ul pe buton.
- În fereastra de export, „Perioada după” pornește pe **Livrare solicitată** (se poate schimba pe Data comandă).

## FPP completat din oficiu cu 0
La clienții trecuți în Administrare → Configurare → „Clienți cu FPP = 0 din oficiu” (implicit NATURA), câmpul FPP apare completat
cu 0 în fereastra de terminare și în „FPP și Pick”, dacă nu are deja o valoare. Se poate modifica înainte de salvare.

## Ordinea la încărcare

În tabul Încărcări, prima coloană („Ordine”) arată în ce ordine se încarcă mașinile unei zile. O stabilește **Transportul**
(și Administratorul): scrie locul direct în celulă — Enter salvează, Esc renunță, săgețile sus / jos trec la camionul
vecin. Camionul este așezat pe locul cerut, iar celelalte se renumerotează singure (fără locuri duble sau goluri); celula
golită scoate camionul din ordine. Lista se sortează după această ordine, în cadrul fiecărei zile.

**Încărcări** și **Operatorul de date** văd ordinea, fără să o poată modifica: în tabul Încărcări, pe borderou („Locul la
încărcare”) și în lista de comenzi, ca o bulină cu numărul în fața Nr AUTO. Ordinea se ține pe zi, în documentul zilei
din colecția `extra` (o scriere la fiecare modificare), iar fiecare modificare rămâne în jurnal.

## Export pentru TMS (fișierul de import al comenzilor)

Butonul **Export pentru TMS** din tabul Comenzi (Transport și Administrator) face fișierul de import în TMS direct din
comenzile din status: foaia „SCHENKERDSV IMPORT”, cu aceleași 24 de coloane și aceleași formate ca fișierul completat
până acum de mână. Comenzile „doar transport” se adaugă în continuare de mână în fișier.

- **Ce se scrie**: număr comandă, data comenzii, client (numele din TMS), destinatar, adresă, oraș, județ (cu majuscule,
  ca în fișierul vechi), paleți (amprente, altfel paleți reali, altfel estimarea rotunjită în sus), masă (greutatea
  finală, altfel greutatea comenzii), livrare și expediere = *Livrare solicitată*, țara (ROMANIA; pentru comenzile
  externe se ia din câmpul Județ), apoi valorile fixe ale furnizorului (depozitul) și „ESTE RETUR” = 0.
- **Setări (o singură dată)**: Administrare → *Export pentru TMS*. Valorile fixe se pot prelua din fișierul de import
  folosit acum („Preia din fișierul model”), iar numele clienților se scriu în forma `COD = Nume în TMS`. Se păstrează
  în Firebase, nu în codul public.
- **Filtre**: client și perioadă (după *Data comandă* sau *Livrare solicitată*). În fișier intră toate comenzile din
  filtru care au nevoie de transport, **chiar dacă au mai fost exportate** — o comandă poate fi exportată de câte ori
  este nevoie. În fereastră se alege una dintre două variante, fiecare cu numărul ei de comenzi: **Toate comenzile**
  din filtru (aleasă implicit) sau **Doar comenzile care nu au mai fost exportate**.
- **Ce nu intră niciodată**: comenzile anulate, cele încărcate, cele care au deja număr de transport din raportul TMS și
  cele Self-Pick / „Ridicare client”.
- **Verificare**: aplicația ține minte, cu un marcaj pe comandă (când și de cine), care comenzi au ajuns deja într-un
  fișier. Numărul de pe buton arată câte comenzi care au nevoie de transport nu au fost exportate niciodată, iar
  fereastra spune câte astfel de comenzi rămân în afara filtrului ales. Marcajul nu oprește exportul repetat.
- **Bifa „Comandă Self-Pick”**: Operatorul de date (și Administratorul) o pune în fereastra comenzii, la introducere
  sau la modificare. Comanda bifată nu intră în exportul pentru TMS și apare în listă cu eticheta „Self-Pick” în celula
  Nr AUTO. Dacă bifa se pune după ce comanda a fost deja exportată sau are număr de transport, aplicația avertizează că
  trebuie anunțat Transportul. Bifa este separată de statusul „Self-Pick”, care se pune la închiderea comenzii.
- **Date lipsă**: fără destinatar, oraș, județ sau dată de livrare comanda nu se exportă (rămâne la numărătoare până se
  completează), decât dacă se bifează explicit. Fără greutate sau paleți se exportă cu celula goală și fereastra spune
  câte sunt de completat în fișier înainte de import.
- **Marcaje de export**: lista de jos arată loturile de comenzi aflate la primul export; un lot se poate descărca din
  nou sau i se poate anula marcajul (comenzile lui revin la numărătoarea de pe buton). „Marchează ca exportate, fără
  fișier” este pentru comenzile aflate deja în TMS, ca să nu mai apară la numărătoare.
- În jurnal rămâne o linie pentru fiecare export, cu numărul de comenzi și câte erau la primul export.

## Cumul (comenzi legate)
- Operatorul de date (și Administratorul) bifează două sau mai multe comenzi deschise și apasă **Cumulat**. Se pot lega doar
  comenzi cu același client și același destinatar. Comenzile legate au o dungă albastră pe celula Nr Crt (nu există coloană separată).
- Comenzile legate își schimbă statusul împreună. La Terminata / Self-Pick paleții (FPP, Pick) se trec o singură dată, pe
  comanda la care se schimbă statusul; celelalte se închid cu 0 paleți. Greutatea finală rămâne greutatea din tabel.
- Un cumul plecat cu camionul înainte să fie închis (încărcat de Încărcări cu paleții numărați) se închide la fel: Operatorul
  trece pe Terminata oricare comandă din el și se închid toate, iar fereastra arată suma paleților și amprentelor numărate la
  încărcare ca sugestie. Comenzile deja încărcate **și** închise nu se mai ating; anularea unui cumul ocolește comenzile plecate.
- La încărcarea unui cumul neînchis, Încărcările scriu paleții și amprentele o singură dată, pe una dintre comenzile lui; celelalte
  rămân goale și pleacă cu 0. Când Operatorul închide apoi cumulul, paleții se trec pe aceeași comandă pe care au fost numărați la
  încărcare, indiferent pe care comandă din cumul schimbă statusul.
- La căutare sau filtrare, dacă apare o comandă dintr-un cumul, apar și celelalte.
- Cumulul se vede și se anulează (cu confirmare) din bara de bifare: bifezi una dintre comenzi, apoi „Vezi cumulul” sau „Anulează cumulul”.

## Notificări (data de livrare schimbată de Transport)
- Transportul poate schimba *Livrare solicitată* direct în celulă, cu confirmare, la comenzile neîncărcate și neanulate.
- Fiecare schimbare se salvează ca notificare (colecția `notificari`, un document pe lună) în aceeași operație cu modificarea.
- Operatorul de date și Administratorul au butonul **Notificări**, cu numărul celor noi. „Am văzut” notează cine și când a luat
  la cunoștință. Lista arată ultimele două luni; notificările mai vechi rămân în baza de date.
- Necesită regulile din `firestore.rules` publicate (blocul `notificari`).

## CMR (scrisoare de transport internațional)
- Înlocuiește fișierul `C.M.R_DSV.xlsm`. Operatorul de date (și Administratorul) bifează în lista de comenzi comenzile care merg
  pe același CMR (același client și destinatar, cel mult 9) și apasă **CMR** în bara de bifare.
- Destinatarul, adresa, orașul, țara (coloana Județ), cartoanele, greutatea și paleții reali vin din comenzi. Se completează
  factura fiecărei comenzi, transportatorul, codul UIT și mențiunile. Toate câmpurile pot fi corectate înainte de tipărire.
- Expeditorul, natura mărfii și instrucțiunile se țin minte pe client (ultimele folosite).
- **Greutatea cu 3 zecimale.** Dacă în „Greutate brută” nu sunt scrise exact 3 zecimale (ex. `556,59`), sub câmp apare un
  avertisment, iar la „Salvează” și „Salvează, tipărește și email” aplicația întreabă „Corectez / Continuă oricum”. Nu blochează.
  În tabelul cu documente, comenzile a căror greutate nu are 3 zecimale sunt marcate cu ⚠ (greutatea se arată cu zecimalele ei reale).
  Se numără ce este scris în câmp, deci `556,590` este corect; zecimalele scrise se țin minte la salvare (`gz`).
- „Salvează, tipărește și email” scoate cele 4 copii (negru, roșu, albastru, verde) pe A4. CMR-urile rămân salvate (colecția `cmr`,
  un document pe lună) și se redeschid din **CMR-uri emise** sau bifând din nou aceleași comenzi.
- Același buton deschide și programul de email, cu destinatarii clientului comenzilor, subiectul și textul standard (nu mai
  există buton „Email” separat și nu se mai întreabă clientul). CMR-ul se atașează de mână: din fereastra de tipărire alegi
  „Salvare ca PDF” și tragi fișierul în email. Dacă clientul nu are adrese setate, apare un mesaj și se tipărește doar. Adresele se setează în Administrare → *CMR — adrese de email*:
  câte un rând (Către / CC) pentru fiecare client, plus un rând „Implicit” pentru clienții fără adrese proprii.
- Formularul tipărit este generat din foaia `CMR_Black` (`js/cmr-sablon.js`). Necesită regulile din `firestore.rules` (blocul `cmr`).

## Tabul KPI's
- **Pregătire comenzi** (partea de sus), după **livrare solicitată**, pe ziua sau intervalul ales (două date sau butoanele
  rapide: Azi, Mâine, Azi + mâine, Următoarele 7 zile, Ieri, Luna aceasta, Luna trecută, Restanțe):
  - pentru **zile trecute** arată ce s-a pregătit: paleți pregătiți (reali), FPP / Pick, amprente, greutate, câte comenzi
    au fost încărcate, plus ce a rămas nepregătit;
  - pentru **azi și viitor** arată ce este de pregătit, chiar dacă nu are mașină: paleți estimați (rotunjiți în sus pe
    fiecare comandă), câți sunt fără mașină, greutatea și restanțele;
  - un interval care le cuprinde pe amândouă (de exemplu luna întreagă) le arată pe amândouă, cu tabelul pe zile de livrare
    (click pe o zi = doar acea zi) și pe clienți.
  *Pregătit* = Terminata / Self-Pick; *de pregătit* = Inițiată / În lucru. Nu intră comenzile anulate, retururile și liniile
  „doar transport”; comenzile fără paleți estimați sau fără dată de livrare sunt numărate separat.
  **Zilele mai vechi se citesc din arhivă** (aplicația ține în memorie doar comenzile active și recente): o singură dată
  pentru fiecare perioadă, până la închiderea paginii, cam un document pentru fiecare 25 de comenzi — o lună întreagă
  înseamnă câteva sute de citiri. Sunt căutate comenzile introduse cu cel mult 14 zile înainte de livrare. Intervalele
  care cer mai mult de 80 de zile de arhivă se citesc doar la cerere („Citește din arhivă”).
- **Încărcări** (partea de jos), ca până acum. Pe ziua de încărcare aleasă arată: paleții de încărcat (reali la comenzile
  pregătite, estimați la celelalte), împărțirea FPP / Pick, camioanele pe stări și paleții fiecăruia, comenzile pe statusuri,
  greutatea, durata medie de încărcare, abaterea estimării față de real și comenzile active fără camion alocat.
- Se calculează din datele aflate deja în aplicație: nu face citiri suplimentare din Firebase.
- Paleți reali = FPP + Pick la comenzile pregătite; amprentele pornesc de la aceeași sumă și pot fi corectate.

## Copie de siguranță (backup) și restaurare
Codul aplicației este pe GitHub (cu istoricul fiecărei versiuni). **Datele** stau doar în Firebase, iar planul gratuit nu are
backup propriu, așa că aplicația își face singură copii într-un folder de pe un calculator (de exemplu un folder OneDrive).

- **Un singur calculator de backup.** Administratorul intră în aplicație chiar de pe calculatorul care va face copiile (de
  regulă cel al Operatorului de date), în Chrome sau Edge, și apasă Administrare → *Copie de siguranță* → „Setează acest
  calculator ca și calculator de backup…”: îi dă un nume și alege folderul. Calculatorul este recunoscut după un cod ținut în
  browser, deci același utilizator intrat de pe alt calculator (sau din alt browser) nu face copii. Mutarea pe alt calculator
  și oprirea le poate face doar Administratorul.
- **Două feluri de a salva copiile** (se aleg la setarea calculatorului de backup și se pot schimba din „Modifică setările de backup…”):
  1. *Direct într-un folder ales* — aplicația scrie copia `.json` și registrul Excel în folder și păstrează singură ultimele 30.
     Merge doar dacă browserul și regulile firmei permit (File System Access, Chrome / Edge). Dacă browserul refuză
     („The request is not allowed by the user agent…”), aplicația spune asta și trece pe varianta a doua.
  2. *Ca descărcare a browserului* — un singur fișier pe zi, `Backup Status Comenzi AAAA-LL-ZZ OOMM.zip`, care conține copia
     `.json` și registrul Excel, salvat în folderul de descărcări al browserului. Înainte de prima copie, în setările
     browserului de pe acel calculator, la Descărcări: se alege ca loc al descărcărilor folderul dorit (de exemplu unul din
     OneDrive) și se oprește întrebarea „ce să fac cu fiecare descărcare”. **Limite:** aplicația nu poate verifica dacă
     fișierul a ajuns pe disc (în Administrare apare momentul în care descărcarea a pornit) și nu poate șterge copiile vechi,
     deci folderul trebuie verificat și curățat de mână din când în când; toate descărcările din acel browser ajung în același
     folder. Restaurarea primește direct fișierul `.zip`.
- **Copia automată**: o dată pe zi, la scurt timp după ce aplicația este deschisă pe calculatorul de backup de un Operator
  date sau de un Administrator (și din 30 în 30 de minute se verifică dacă a început o zi nouă). Fișierul se numește
  `Backup Status Comenzi AAAA-LL-ZZ OOMM.json`; în folder se păstrează ultimele 30 de copii, restul se șterg singure.
- **Registrul în Excel.** Lângă fiecare copie scrisă în folder apare și `Status Comenzi AAAA-LL-ZZ OOMM.xlsx`, făcut din aceeași
  copie (fără citiri în plus): foaia `Sheet1` cu toate comenzile, cu primele 25 de coloane exact ca în registrul Excel
  „Status Comenzi” (aceeași ordine și aceleași nume; datele, orele și numerele sunt valori adevărate, se pot sorta și filtra),
  urmate de coloanele pe care le are doar aplicația (FPP, Pick, Numar Transport, Data Transport, Stare Camion, Temperatura,
  Semnatura, Sofer, Remorca, Self-Pick, Cumul), și foaia `Adrese`. Este doar pentru consultat: restaurarea se face din `.json`.
  La nevoie poate fi citit și cu „Migrare din Excel”. Se păstrează tot ultimele 30. Dacă Excelul nu poate fi scris, copia
  `.json` rămâne bună, iar Administrare arată eroarea.
- **Acordul browserului.** După ce browserul a fost închis, poate cere din nou acordul de a scrie în folder: apare o bandă
  galbenă cu butonul „Permite și fă copia”. Alege „Permite la fiecare vizită” (dacă browserul oferă varianta) ca să nu mai întrebe.
- **Ce conține**: grupele de comenzi, adresele, camioanele și liniile din transport, notificările, CMR-urile, setările și
  contorul Nr Crt. Jurnalul de modificări intră doar când copia este făcută de un Administrator (regulile îl lasă doar pe el
  să-l citească): ultimele 35 de zile la copia automată, tot jurnalul la „Copie de siguranță acum”. Utilizatorii și PIN-urile
  nu intră în copie.
- **„Copie de siguranță acum”** (Administrator): pe calculatorul de backup cu folder ales scrie în folder (`… manual.json` și
  `… manual.xlsx`); în rest descarcă un `… manual.zip` cu amândouă. Util înaintea unei operațiuni mari (migrare, rescriere din borderou, golirea încărcărilor).
- **Evidență și avertizări**: Administrare arată ultima copie automată (când, de pe ce calculator, câte comenzi), ultima copie
  manuală și ultima eroare. Dacă ultima copie automată este mai veche de 3 zile, cardul devine roșu, iar Administratorul
  primește un mesaj la intrarea în aplicație.
- **„Restaurare din copie…”** (doar Administrator): alegi un fișier de backup; aplicația îl compară cu datele de acum și arată
  câte documente se rescriu și câte se șterg (se scriu doar cele care diferă). După confirmare (se scrie `RESTAUREZ`), starea de
  acum se salvează întâi în `Inainte de restaurare Status Comenzi ….json` (în folderul de backup sau ca descărcare), apoi
  comenzile, adresele, încărcările, notificările și CMR-urile devin exact ca în copie. Setările se restaurează doar dacă rămâne
  bifa; calculatorul de backup rămâne cel de acum. Jurnalul nu se șterge și nu se rescrie: se adaugă doar orele care lipsesc.
  Tot ce s-a lucrat după momentul copiei se pierde, deci ceilalți nu trebuie să lucreze în timpul restaurării și reîncarcă
  pagina după.
- **Dacă se pierde tot proiectul Firebase**: se face un proiect nou (pașii de la „Punere în funcțiune”), se creează din nou
  utilizatorii, apoi „Restaurare din copie…” aduce datele înapoi.
- **Consum**: o copie = o citire pentru fiecare document (câteva sute) și o scriere pentru evidență (`meta/backup`). O
  restaurare citește datele de două ori și scrie doar documentele care diferă.
- Nu necesită schimbări în `firestore.rules`.

## Consum în planul gratuit Firebase (Spark)

Limite: 50.000 citiri/zi, 20.000 scrieri/zi, 1 GiB stocare, 10 GiB transfer/lună.

Comenzile sunt păstrate în grupe de 25 (un document = o grupă), iar aplicația urmărește în timp real doar grupele
cu comenzi active și pe cele din ultimele 2 zile. Estimare pentru ~270 comenzi/zi și 6 colegi conectați:

| Resursă | Estimare | Limită |
|---|---|---|
| Citiri | 8.000–10.000 / zi | 50.000 / zi |
| Scrieri | 1.000–2.000 / zi | 20.000 / zi |
| Stocare | ~3 MB acum, ~25–30 MB / an | 1 GiB |
| Transfer | 1,5–2 GiB / lună | 10 GiB / lună |

Ce poate apropia aplicația de limite: peste ~25 de colegi conectați simultan, sau mii de comenzi Terminata lăsate
fără confirmare de încărcare (rămân „active”). Pentru al doilea caz există *Administrare → Arhivare*.
La depășire, planul gratuit nu costă nimic: aplicația afișează un mesaj și revine a doua zi dimineață.
Consumul real: consola Firebase → Firestore → *Usage*.
