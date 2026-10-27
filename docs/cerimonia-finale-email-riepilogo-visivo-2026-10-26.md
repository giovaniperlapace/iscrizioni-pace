# Cerimonia finale: riepilogo visivo ai capigruppo — 26 ottobre 2026

Modifica locale del messaggio `leader_contacts`, in italiano e inglese: titolo
con punto esclamativo, testo richiesto senza promessa di istruzioni successive,
paragrafo PDF abbreviato e saluto finale. Data della cerimonia e aggiornamento
restano dinamici, in Europe/Rome.

Nel corpo HTML, le pagine dei badge dei delegati sono presentate come immagini
PNG incorporate tramite CID, in sequenza per settore e pagina, al posto della
lista. Ogni immagine è allegata una sola volta e riusata nelle due lingue.
Coordinate, a capo e tracciati del font locale sono condivisi con il PDF;
la sola carta vuota prima del piè di pagina è rimossa nelle immagini email.
Restano i PDF A4 orizzontali, sette badge per pagina e un PDF per settore.
Fontkit, già usato da PDFKit, è ora una dipendenza diretta per i tracciati.

Le deleghe e i destinatari non cambiano. Solo le persone con
`communicationDelegated=true` producono badge PDF/immagini. Eventuali altre
persone del report restano nominate separatamente, senza badge allegato.
Il testo alternativo dell'email conserva tutti i nomi per i lettori senza HTML.
Notifiche dei posti da assegnare e badge personali conservati. Nessuna migration,
modifica remota, riaccodamento, commit/push o pubblicazione eseguiti.

Verifiche: 1.216 test passati, TypeScript, lint mirato e build production.
Prova Postmark con token ufficiale POSTMARK_API_TEST: badge personali, famiglia,
notifica gruppo, report senza deleghe e 1.005 delegati su tre settori accettati
senza consegna reale. Il caso con deleghe comprende tre PDF e 144 immagini,
entro 6 MiB di allegati e 9 MB di payload trasporto. Anteprima sintetica desktop
e mobile 390px verificata, immagini caricate e nessun overflow orizzontale;
PDF renderizzato con Poppler e confrontato visivamente con l'immagine.
La resa nei singoli client di posta non è stata collaudata con invii reali.

Anteprima riproducibile: `node scripts/preview-closing-leader-email.mjs`.
Artefatti locali: `output/closing-leader-email-preview/`.

## Commit e push richiesti — 27 ottobre 2026

Recuperate dallo stash `backup-before-removing-local-changes-20261027` soltanto
le modifiche di questo riepilogo, conservando la correzione più recente della
compressione dei badge familiari. Gli altri lavori nello stash e nella directory
restano esclusi. Verifica sul main aggiornato: 1.234 test passati, TypeScript e
lint mirato; build production verificata prima del push. Nessuna migration o
riaccodamento dei messaggi storici previsto dal rilascio.
