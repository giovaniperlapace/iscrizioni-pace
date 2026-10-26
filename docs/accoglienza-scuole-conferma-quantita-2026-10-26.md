# Scuole: conferma delle quantità — 26 ottobre 2026

Segnalazione: impossibile premere la conferma dopo aver indicato le quantità.
La UI disabilitava il pulsante per quantità mancanti, fuori limite o totale zero,
senza mostrare i limiti né spiegare il motivo. Lettura aggregata di produzione:
una delle cinque prenotazioni attive ha 20 studenti e 1 accompagnatore per il
Forum, mentre la scuola ha 20 studenti e 2 accompagnatori. Nessun dato modificato.
Il flusso con quantità ammesse è risultato funzionante anche prima della modifica.

La finestra ora espone i massimi canonici, richiede esplicitamente 0 per una
categoria assente e spiega gli errori. Il pulsante resta cliccabile per attivare
la validazione nativa dei campi. La guardia sul submit continua a impedire invii
non validi, incluso il totale zero. Nessun aumento delle quote, migration o
scrittura operativa in produzione.

Regressione browser sui componenti originali, dati sintetici e PostgreSQL locale:
campi vuoti, accompagnatori oltre limite e totale zero non scrivono ingressi;
correzione a 8 studenti e 1 accompagnatore registra esattamente evento e Forum.
Verificati anche QR, autorizzazioni, replay e concorrenza del flusso scuole.
Test generali, TypeScript e build inizialmente bloccati dalla dipendenza locale
pdfkit mancante: ripristino delle dipendenze dal lockfile prima della verifica finale.

Verifica finale in copia isolata: 1.163 test, TypeScript e build production
passati; lint mirato e browser/SQL passati. Lockfile normalizzato soltanto nella
copia temporanea per compatibilità con npm locale; nessuna modifica alle dipendenze
del repository. Integrati i due commit main già pubblicati sulla finestra della coda.

L’utente precisa 16 studenti e 4 accompagnatori: tutte le cinque prenotazioni
attive prevedono meno di 4 accompagnatori. La correzione UI non autorizza quantità
oltre prenotazione; richiesti scuola e Forum per risolvere il dato specifico.
