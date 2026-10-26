# Campagne: tre badge personali — 26 ottobre 2026

## Funzione

Nella composizione delle email Admin/Manager, accanto al caricamento dei file,
tre caselle indipendenti permettono di selezionare uno o più sfondi:
**Piazza Inferiore · viola**, **Prato Basilica superiore · verde** e
**Basilica Inferiore · arancione**. Per ogni badge selezionato e partecipante
vengono aggiunti:

- il badge come immagine JPEG incorporata nel corpo dell'email tramite CID;
- lo stesso badge in PDF allegato, stampabile e scaricabile.

Gli sfondi sono i tre PNG originali forniti dall'utente, conservati senza
alterazioni in `lib/email/assets/`, con identificativi versionati `*-v1.png`. Nome completo e gruppo sono
centrati nella fascia bianca; il testo va a capo e riduce il carattere quando
necessario. I nomi non vengono abbreviati. Senza gruppo, la relativa area resta
vuota. Il PDF incorpora esattamente il JPEG del messaggio, su una sola pagina
con le proporzioni originali (282,3 × 501,6 punti, circa 100 × 177 mm).

Le caselle sono inizialmente disattivate e disponibili per l'audience
Partecipanti. Cambiando audience si azzerano; il server rifiuta richieste attive
per altre audience. Gli altri file restano disponibili, con i limiti preesistenti
(5 file, 5 MB ciascuno, 10 MB totali senza badge). Con badge, il totale dei file
comuni, di tutti i PDF e delle immagini incorporate è limitato a 6 MiB, lasciando margine
alla codifica base64 e al testo entro il limite conservativo del trasporto.

## Anteprima, prova e coda

L'anteprima mostra separatamente ogni badge selezionato e offre i relativi PDF. L'email di
prova contiene immagine e PDF. Una selezione deterministica del destinatario
campione mantiene allineati anteprima e prova anche quando le query restituiscono
ordini diversi. Modificare la casella invalida l'anteprima e la prova precedente.
Nomi file e CID sono distinti per sfondo, anche selezionando tutti e tre.
L'invio definitivo conserva la conferma esplicita e il requisito della prova.

Le versioni dei badge selezionati sono salvate in `filters_snapshot.badgeTemplates`, già JSONB:
nessuna migration o nuovo permesso. Le campagne preesistenti senza questa chiave
non cambiano. Le bozze con la precedente chiave singola `badgeTemplate`
continuano a produrre il badge viola. La RPC di reinvio esistente copia l'intero snapshot: anche gli
reinvii espliciti mantengono l'opzione e la versione dello sfondo. I vecchi asset
versionati devono restare disponibili per code e reinvii.

Nome, cognome e gruppo provengono dagli stessi dati canonici della
personalizzazione del messaggio, riletti al momento dell'invio come nel flusso
esistente. Un recapito delegato riceve il badge del partecipante, non quello del
capogruppo. Non si producono badge aggiuntivi per figli o altri membri non
selezionati. Errori nel recupero del gruppo/nome o nella generazione impediscono
l'invio di quel messaggio invece di produrre un badge incompleto.

Solo gli allegati comuni e lo sfondo vengono riutilizzati: nessuna cache del badge
personale tra destinatari. Non viene pubblicato un URL con dati personali.
Il font Noto Sans locale è caricato esplicitamente; il testo è escapato prima
del rendering Pango. Sharp e PDFKit sono dipendenze già presenti. Il tracing
Next include sfondo e font per API e cron; claim, deduplica e gestione degli
esiti incerti del trasporto restano nel flusso canonico.

## Verifica e stato

- Test del generatore: dimensioni, PDF di una sola pagina, identità tra JPEG
  incorporato nel PDF e immagine del messaggio, nomi lunghi/accentati/markup,
  gruppo assente, opzione disattivata, limiti e isolamento tra destinatari.
- Test del worker originale con database e trasporto simulati: due partecipanti
  allo stesso delegato ricevono badge diversi, allegati comuni conservati;
  errore lettura gruppo impedisce l'invio; campagne precedenti senza badge.
- Browser sul componente originale con dati/API sintetici a 320, 390 e 1440 px:
  casella, file libero, anteprima immagine, download PDF, prova, invalidazione e
  cambio audience. Nessun errore JavaScript o overflow orizzontale.
- Controllo visivo del PDF rasterizzato e dei JPEG, anche con nome e gruppo lunghi.
- Copia isolata da npm ci: 1.175 test superati; build production riuscita.
  TypeScript e lint mirato dei file modificati verificati separatamente.
  Il lint generale segnala soltanto i tre errori preesistenti e un warning in
  `tests/ceremony-navigation.test.mts`.
- Trace della build: sfondo e font presenti sia nell'API campagne sia nel cron.
  SHA-256 dello sfondo identico al file originale fornito dall'utente.
- La cache `.next` del checkout di lavoro contiene duplicati preesistenti che
  impediscono il TypeScript generale: le verifiche pulite non li modificano.
  Non è stata verificata la consegna su caselle reali o un deployment remoto.

Nessun invio reale, modifica dati operativi o migration durante le verifiche.
Il 26 ottobre l’utente ha autorizzato commit, push e rilascio in produzione
dell’intera funzione con i tre badge; rilascio tramite il flusso Git di main.

## Estensione verde/arancione

Le tre scelte sono indipendenti e possono essere attivate insieme. Il server
valida gli identificativi contro il catalogo, deduplica e usa un ordine stabile;
valori sconosciuti o malformati sono rifiutati. La cache degli sfondi è distinta
per versione. Il limite di 6 MiB comprende tutte le coppie PDF/JPEG selezionate.

Verifiche aggiuntive: tutte le otto combinazioni, colori originali, unicità dei
CID e dei nomi file, immagine esatta incorporata nel PDF, compatibilità della
vecchia scelta viola, invio simulato di tre badge a ciascuno di due partecipanti.
Controllo visivo dei PDF verde e arancione rasterizzati. Nessun invio reale.

Browser finale: verde da solo a 320 px, arancione da solo a 390 px, tutti e tre
a 1440 px; anteprime, download dei PDF corretti, prova simulata, azzeramento
al cambio audience e file ordinari conservati. Lint dei file modificati pulito.
