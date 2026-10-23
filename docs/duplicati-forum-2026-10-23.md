# Forum nel controllo duplicati — 23 ottobre 2026

La tabella condivisa Admin/Manager mostra una sola colonna per ciascuna
iscrizione: «Forum prenotati e/o in coda». Il contatore somma prenotazioni e
code attive, con massimo visualizzato pari a 3 (anche per somme superiori).
Le offerte ancora valide sono incluse nella coda; quelle scadute sono escluse. Prenotazioni
annullate e code concluse sono escluse. Sono incluse anche le prenotazioni
inserite da un capogruppo, quindi la presenza o assenza di Forum non costituisce
una classificazione automatica dell’utilizzo dell’account.

Lettura server dopo `qualityAccess`, limitata all’evento corrente e agli ID
presenti nelle 50 coppie della pagina. Query paginate e in lotti; nessuna lettura
aggiunta alle altre viste iscritti. Dati non disponibili distinti da zero:
un errore rende esplicita l’indisponibilità senza restituire risultati parziali.
Permessi esistenti e azioni sui duplicati conservati. Nessuna migration.

Verifiche: 1.063 test superati, TypeScript e build production superati. Lint dei file modificati superato;
il lint globale segnala tre errori preesistenti di tipo `any` e un avviso in
`tests/ceremony-navigation.test.mts`, estraneo a questa modifica.
Test dedicati per separazione degli account, ordinamento, offerte scadute,
filtri evento/iscrizioni, errori e pagina vuota. Fixture browser aggiornata con
prenotazione e offerta sintetiche, selettore confronto reso indipendente dalla
posizione della colonna. Collaudo browser non eseguito in questa sessione.
Nessun dato operativo modificato; commit, push e rilascio non eseguiti.

Revisione: contatore unico limitato a 3; verificati TypeScript e lint dei componenti modificati.


## Rilascio congiunto — 23 ottobre 2026

Incluso nel rilascio autorizzato dei campi email e della modale cerimonie;
nessuna migration aggiuntiva. In copia isolata: 1.070 test, TypeScript,
build production e lint dei file coinvolti superati. Controllo mirato sul
componente originale: contatore Forum e tabella desktop/mobile, senza overflow
né errori JavaScript. Il vecchio scenario browser complessivo si arresta prima
dei duplicati nell’editing anagrafico della fixture; non è dichiarato superato.
Dettagli del backup e della migration nel verbale della modale cerimonie.
