# Data di nascita obbligatoria e verifica età inferiore a un anno

## Diagnosi del 23 settembre 2026

Verifica di produzione in transazioni READ ONLY, limitata all’evento corrente e
alle iscrizioni non eliminate. Nessuna scrittura né email di prova.

- Primo controllo: 33 date mancanti su 265 iscrizioni di origine capogruppo;
  tutte e 33 mancavano anche nello snapshot originale dell’inserimento.
  Nessuna data mancante nelle 1.627 iscrizioni pubbliche.
- Durante l’analisi sono arrivate altre quattro iscrizioni incomplete:
  l’elenco locale finale contiene 37 date mancanti.
- 15 partecipanti principali risultano di 0 anni al 25 ottobre 2026.
  Altri controlli rilevano 8 date future rispetto al 23 settembre;
  quattro rientrano anche nei 15 casi precedenti: 19 schede distinte da verificare.
  I due figli accompagnati di 0 anni non sono inclusi nelle anomalie degli iscritti.
- Nomi e codici sono nell’elenco riservato locale in `output/`, escluso da questo
  documento tecnico. I conteggi sono una fotografia durante le iscrizioni attive.
  Le date recenti richiedono verifica, non dimostrano automaticamente un errore.

## Cause

Il modulo capogruppo e il suo parser ammettevano la data vuota. La tabella
`participants` la ammette perché contiene anche identità operative prive di
iscrizione personale. Anche l’importazione Excel permetteva di ometterla.
Le modifiche di identità potevano svuotarla.

Il modulo pubblico richiedeva la presenza della data ma il validatore sul server
controllava solo il formato AAAA-MM-GG: una data futura veniva accettata.
Il campo browser non aveva un massimo. L’età mostrata usa l’inizio dell’evento;
una nascita successiva all’evento dà età non disponibile, non zero.

## Correzione

- Data obbligatoria, reale e non futura nell’iscrizione pubblica (anche da link),
  nell’inserimento capogruppo e nell’importazione manager/admin.
- Le modifiche di identità non possono cancellare la data; gli aggiornamenti
  parziali dei soli contatti continuano a ometterla senza riscriverla.
- Campo condiviso accessibile: avviso nelle sette lingue per un partecipante
  principale che risulta di meno di un anno alla data di compilazione. La
  conferma esplicita contiene la data esatta; modificarla azzera la conferma.
  Stesso controllo nei parser/server e nelle modifiche, anche per richieste
  costruite direttamente senza i controlli del browser.
- Excel verifica la data sia nell’anteprima sia alla conferma, comprese anteprime
  firmate create dalla versione precedente. Per età inferiore a un anno richiede
  una conferma specifica per quella riga/data. Guida web e modello condividono
  le istruzioni aggiornate.
- Figli accompagnati invariati: un neonato è ammesso tramite il flusso dedicato.
  Nessun anno viene dedotto o corretto automaticamente.
- Nessuna migration: il requisito è applicato agli ingressi dell’applicazione;
  rendere globalmente NOT NULL `participants.birth_date` impedirebbe la gestione
  di identità operative e richiederebbe inventare dati storici mancanti.
  RLS, ruoli, schema e dati esistenti invariati.

## Verifica

- `npm test`: parser pubblici/capogruppo, azione reale con guardia contro scritture,
  route identità manager/admin, Excel e anteprime pregresse; campi omessi/vuoti,
  date impossibili/future, neonati confermati e conferma invalidata dal cambio data.
- `tests/browser/birth-date.mjs`: componente reale e modulo pubblico da link,
  sette lingue, errori e focus, conferma, reset al cambio data e mobile. Azioni
  sintetiche senza database né email. Si esegue separatamente dalla suite perché
  monta due route temporanee.
- Lint, TypeScript e build da copia pulita con `npm ci` dal lockfile. Il vecchio
  `node_modules` locale aveva Next 16.3.0, diverso dal 16.2.9 del lockfile, e `.next`
  conteneva tipi di route rimosse: non usarli per giudicare questo rilascio.

Esito finale integrato con la modifica delle città pubbliche iscrivibili: 462 test, lint, TypeScript, build production e browser nelle sette
lingue/mobile superati. Nessun errore browser.

Pubblicazione autorizzata dall’utente il 23 settembre 2026 tramite commit e push
su main, insieme alla visualizzazione delle città pubbliche iscrivibili.
Nessuna migration o correzione automatica delle date storiche.
