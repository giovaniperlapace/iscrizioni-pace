# Lingue disponibili nei forum — 20 ottobre 2026

Le schede del programma pubblico/anteprima, la scelta personale, il forum
selezionato dal capogruppo e il selettore scuole/docente mostrano una riga
«Lingue: …», carattere 12px e interlinea 20px, a capo quando necessario.
Etichetta e nomi delle lingue seguono le sette lingue dell'interfaccia.

Fonte: Programma stampa definitivo.pdf ricevuto il 20 ottobre, creato alle
09:58:29, pagine italiane 6–52. SHA-256:
`d7c8fdfe7806c77e9bf1571a188006ea6a0f7f40b92238544f4afebed06de761`.
Il forum 10 comprende italiano, inglese e giapponese, senza spagnolo.

La configurazione editoriale è specifica per Assisi 2026, in
`lib/events/assisi-2026-forum-languages.ts`, collegata agli UUID effettivi dei
24 forum riletti dopo il riallineamento al programma. Non deriva lingue da
numero, titolo, sala, relatore o lingua del sito. UUID sconosciuti non mostrano
la riga. Per nuovi forum/eventi o revisioni del programma occorre aggiornare
esplicitamente questa configurazione: non è un campo modificabile dal Manager.
Nessuna migration, lettura aggiuntiva, modifica a prenotazioni, capienze,
permessi, visibilità del catalogo o apertura delle iscrizioni.

Verifica: npm ci dal lockfile, 965 test riusciti, lint, TypeScript e build
production riusciti. Aggiornato il mock decorativo del test intent esistente.
Controllo dei 24 UUID nelle sette lingue, caso sconosciuto e forum 10.
Browser con componenti reali e dati sintetici: quattro viste, sette lingue,
390/1440px; conteggio delle righe e assenza overflow, screenshot italiano
ispezionato. Fixture temporanea rimossa prima della build e del commit.
