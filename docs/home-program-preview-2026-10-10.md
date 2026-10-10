# Prima home con programma e panel — 10 ottobre 2026

Preparazione su main; rilascio del codice in production autorizzato il
10 ottobre, mantenendo la home pubblica attuale. Home attuale conservata
integralmente in `app/registration-home.tsx`: modalità DB `internal` restituisce
questa pagina prima di qualsiasi caricamento del programma. Nessuna modifica
alla modalità dell’evento, alle migration o ai permessi delle prenotazioni.

## Contenuti e aggiornamento

La home futura e l’anteprima usano `app/program-home.tsx`, con colori, superfici,
identità evento e responsive già presenti nell’app. Il programma generale è
trascritto dalla fonte fornita dall’utente, consultata il 10 ottobre 2026:
https://meetingsforpeace.santegidio.org/pageID/32281/langID/it/PROGRAMMA.html

- 25 ottobre, 16:30: assemblea d’inaugurazione, Umbria Fiere, Bastia Umbra.
- 27 ottobre, 15:30: preghiere per la pace, nei luoghi delle diverse tradizioni
  religiose presso il Sacro Convento, Assisi.
- 27 ottobre, 16:15: cerimonia conclusiva, Assisi.

Non inventati orari finali, indirizzi o capienze. Orari Europe/Rome, inclusa
la fine dell’ora legale il 25 ottobre. Contenuto e interfaccia in sette lingue.
Il programma generale è una trascrizione versionata, non una sincronizzazione
automatica con il sito esterno; aggiornamenti futuri richiedono modifica locale.

I panel non sono copiati dal sito esterno: provengono dal gestionale dell’evento
corrente. L’anteprima include bozze e pubblicati, legge a ogni caricamento titoli,
descrizioni, orari, location, indirizzi e occupazione reale delle quote.
Il conteggio disponibile riguarda solo gli iscritti, esclude scuole e ospiti e
non confonde prenotazioni con presenze. Nessuna nuova prenotazione o pubblicazione.
Le bozze senza orari/location compaiono nell’elenco “Panel da completare”.

## Anteprima riservata

`/dashboard/anteprima-home`, collegata dal pulsante “Anteprima home” nel catalogo
Panel Admin. Su correzione esplicita dell’utente, il pulsante è rimosso dal
catalogo Manager. Il percorso diretto conserva il controllo Admin/Manager. Guard condiviso per Admin globale e Manager dell’evento
corrente, prima dei loader; dati riletti con client autenticato e RLS, senza
nuove API privilegiate. Viewer, Manager di altri eventi, Capogruppo, partecipanti
e anonimi esclusi. Pagina dinamica e noindex/nofollow. Il form email è disabilitato
nell’anteprima, i comandi di prenotazione panel/scuole non sono esposti.

Quando verrà autorizzata l’apertura, la home pubblica userà la RPC pubblica
esistente, che legge gli stessi record ma esclude le bozze. Pubblicare un panel
nel gestionale non cambia la modalità dell’evento e non apre la home.
Il conteggio numerico dell’anteprima non amplia il contratto della RPC pubblica,
che continua a fornire uno stato aggregato di disponibilità. Posti numerici
pubblici/lista d’attesa e apertura Capogruppo restano nella tranche da concordare.

## Verifiche

- 21 test mirati: propagazione dati, bozze incomplete, quote individuali,
  occupazione assente, date/lingue, guard e accessi esistenti.
- ESLint mirato, TypeScript e build production passati.
- Browser su Next locale e servizio Supabase sintetico: home internal invariata,
  home catalog con programma e soli panel pubblicati, anteprima con bozze per
  Admin/Manager, diniego degli altri ruoli, ricaricamento dopo modifiche di titolo,
  data/orario, location e quota. Resa desktop/mobile e sette lingue.
- Nessuna migration remota, scrittura dati reali, email, commit, push o deployment.
  Branch panel, relativo lavoro precedente, stash e altro worktree preservati.

Riproduzione browser: avviare `tests/browser/home-program-mock.mjs`, poi Next
locale sulla porta 3125 con URL Supabase anon/service entrambi
`http://127.0.0.1:55441` e chiavi sintetiche. Eseguire
`node tests/browser/home-program.mjs`; se Playwright non è installato nel repo,
impostare `PLAYWRIGHT_MODULE` al modulo Playwright del runtime disponibile.
Non puntare questi test a servizi reali.

## Preparazione del rilascio autorizzato

L’utente ha confermato il rilascio del codice, conservando la home pubblica
attuale, e ha corretto la richiesta sul pulsante: rimuoverlo dalla dashboard
Manager. Il collegamento rimane nel catalogo Admin; l’accesso diretto conserva
le autorizzazioni già verificate, senza ampliare i ruoli.

Verifiche prima del push: 738 test, ESLint completo e build production con
TypeScript passati. Progetto Vercel `iscrizioni-pace`, owner
`giovaniperlapaces-projects`, confermato tramite CLI. Home production prima del
rilascio HTTP 200, form email presente, nessun programma generale o panel.

Inventario SQL read-only nel container production
`supabase-db-ammnuajlmd83t94cfy3us6cw`: tutte le dieci migration richieste dai
loader di questa tranche presenti, modalità `internal`. Verificato anche con
identità di un Manager esistente, in transazione con rollback: 24 panel e
72 quote leggibili dalla RPC autenticata. Nessuna nuova identità/sessione Auth
né modifica al DB. Configurazione Vercel production censita senza leggere i
segreti: Postmark, stream distinti e variabili Supabase cifrate presenti;
nessuna modifica alla configurazione email o invio di collaudo.

## Panel nel riepilogo generale

Su successiva richiesta del 10 ottobre, il programma generale mostra anche
le fasce dei panel, con “Panel in vari luoghi”, inizio/fine effettivi e link
all’elenco dettagliato. Deduplicazione per coppia di istanti, non per titolo,
location o sola ora del giorno. Il riepilogo è cronologico insieme agli altri
appuntamenti, conserva i giorni distinti e gli orari eccezionali (per esempio
un panel alle 17:00 rimane separato da quelli alle 16:00). Le fasce seguono i
record già caricati: bozze nell’anteprima, solo pubblicati nella futura home.
Home pubblica internal e pulsante preview riservato al catalogo Admin invariati.

## Richiamo all’iscrizione e accesso email

A fine elenco panel, pulsante “Iscriviti o accedi per prenotare il tuo posto”
e istruzione per chi deve ancora iscriversi e per chi deve accedere tramite
link email. Su correzione esplicita con immagine, il collegamento `#personal-access`
riporta all’intero riquadro blu, con titolo, istruzioni e modulo, con scorrimento fluido,
freccia e stile del richiamo iniziale e margine per la testata fissa.
L’anteprima mostra questo elemento senza abilitare il form o le prenotazioni.
Il catalogo pubblico conserva il vincolo delle prenotazioni aperte; home
internal e rimozione del pulsante di preview Manager rimangono invariate.

## Correzione: tre riquadri giornalieri

L’utente sostituisce il riepilogo per singolo appuntamento con tre riquadri,
uno per il 25, 26 e 27 ottobre. In ciascuno gli eventi compaiono in ordine
cronologico, con fascia oraria, titolo e luogo oppure collegamento ai panel.
Il panel delle 17 non ha un richiamo separato: confluisce nel cappello dei
panel dalle 16. Fasce panel sovrapposte dello stesso giorno sono riassunte
tra inizio minimo e fine massima, mantenendo intatto l’elenco dettagliato.
Più padding e spazio verticale per separare gli appuntamenti, senza fissare
un’altezza massima ai riquadri. Home pubblica e controlli di apertura invariati.

## Forum e navigazione per fascia

Rimosso il pulsante generale sotto i tre riquadri del programma. I richiami
nei momenti conducono al gruppo del giorno e della fascia corrispondenti,
con ancore derivate dagli stessi record e intervalli del riepilogo. Il Forum
delle 17 resta nella fascia dalle 16. Rinominata la terminologia visibile
nel sito, nelle dashboard, nelle prenotazioni, negli export e nei testi
email in sette lingue; identificatori e contratti tecnici conservati.
Nessuna modifica dati, apertura pubblica o invio email.


## Invito ai Forum e percorso di accesso

La futura home evidenzia nel riquadro blu la frase “Dalla tua area personale
potrai scegliere i forum e prenotare il tuo posto” in un riquadro bianco compatto
e mostra un pulsante su ciascun Forum disponibile, senza freccia o frase
di accesso ripetuta sotto ogni scheda. Il click conserva
il Forum scelto, mostra il titolo e le istruzioni accanto all’email e porta
al modulo. Nelle anteprime il percorso è consultabile, ma il form è disabilitato.
Anche prima del caricamento JavaScript il link mantiene la scelta.

L’ingresso `/forum/[id]` controlla UUID, modalità open e catalogo pubblicato
dell’evento corrente prima di indirizzare alla scheda personale (sessione
esistente) o al modulo email. La scelta attraversa magic link, nuova iscrizione,
conferma e retry; la scheda personale evidenzia il Forum e richiede comunque
la conferma di prenotazione, conservando quote, capienza e controlli già presenti.
Il link nell’email di conferma della nuova iscrizione mantiene la destinazione.
Una richiesta bloccata dal cooldown email mostra il limite, conservando la scelta,
anziché promettere un nuovo link con una destinazione non aggiornata.

Le schede sono ordinate per numero entro ogni fascia; il Forum 9 delle 17 è
primo nella fascia pomeridiana dalle 16, con orario individuale invariato.
I Forum completi mostrano che la lista d’attesa è prevista e non ancora attiva:
questa modifica prepara il messaggio, non introduce iscrizioni in coda o
regole di promozione. La lista operativa resta requisito prima dell’apertura.

Verificati 754 test, ESLint, TypeScript e build production; browser sintetico desktop/mobile nelle
sette lingue, CTA e selezione, ingresso anonimo/autenticato, chiusura internal,
bozze, ruoli e form anteprima disabilitato. Nessun invio email o dato reale
modificato. Cambiamenti locali su main, senza pubblicazione.


## Aggiornamento del link temporaneo autorizzato

L’utente richiede di aggiornare il link della preview già condiviso con le
modifiche della futura home. Rilascio tramite commit/push su main e normale
deployment Vercel; home pubblica internal conservata. Il token e la scadenza
originale del 13 ottobre 2026 alle 11:46 (Europe/Rome) restano invariati.
Confermata la sola preparazione del messaggio della lista d’attesa. Nessuna
migration remota, modifica dei dati o email autorizzata da questo rilascio.
