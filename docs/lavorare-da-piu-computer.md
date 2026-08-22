# Lavorare da più computer senza perdere modifiche

## Regola fondamentale

Il codice si sincronizza soltanto tramite GitHub. Ogni computer deve avere un
proprio clone locale del repository, fuori da OneDrive, Dropbox, iCloud e
cartelle simili.

OneDrive resta utile per documenti e materiali non versionati, ma non deve
contenere la cartella di lavoro Git. In particolare, la directory nascosta
`.git` non deve essere sincronizzata da OneDrive: due sistemi che la modificano
possono creare ref duplicate, lock e oggetti corrotti.

## Messaggio da inviare a Stefano

> Ciao Stefano, abbiamo cambiato il metodo di lavoro su `iscrizioni-pace` per
> poter usare più computer senza rischiare di perdere o sovrascrivere
> modifiche. GitHub è ora l'unico punto di sincronizzazione del codice; ogni
> computer usa una propria copia locale e non si lavora mai direttamente nella
> cartella OneDrive.
>
> Quando rientri, prima di fare qualsiasi modifica apri in Codex la tua copia
> `/Users/stefanolaptop/Documents/codex_new/iscrizioni-pace` e scrivi:
>
> “Prepara questa postazione per lavorare su iscrizioni-pace con il nuovo
> workflow multi-computer. Prima controlla se ci sono modifiche o commit locali
> non pubblicati; non cancellare nulla. Poi aggiorna da origin/main e dimmi
> quando la copia è pronta.”
>
> Se Codex trova modifiche vecchie, non fare pull e non iniziare altro lavoro:
> fagli prima mettere al sicuro quelle modifiche su un branch. Se invece la
> copia è pulita, Codex la aggiornerà da GitHub.
>
> Per ogni nuovo intervento apri una nuova attività Codex in modalità
> **Worktree**, basata su `main`. Il lavoro deve stare su un branch breve
> `codex/...`, non direttamente su `main`.
>
> Anche quando lavori normalmente da un solo computer, alla fine di ogni
> sessione devi sempre chiedere a Codex di chiudere e sincronizzare. Non lasciare
> modifiche soltanto in locale pensando di riprenderle in seguito. Scrivi:
>
> “Chiudi e sincronizza questo lavoro: controlla il diff, esegui i test
> pertinenti, integra origin/main se necessario, fai commit e push del branch,
> verifica che non restino modifiche locali e dammi il link della pull
> request. Non fare il merge senza conferma.”
>
> Dopo il push puoi continuare dallo stesso branch su un altro computer, ma non
> lavorare sullo stesso branch contemporaneamente da due dispositivi. File
> `.env.local`, password e chiavi non passano da GitHub e non vanno mai inviati
> in chat o committati.

## Guida semplice per Giovani

### La prima volta su ogni computer

1. La cartella corretta deve essere locale e fuori dal cloud. Su questo Mac è:
   `/Users/giovaniperlapace/Developer/iscrizioni-pace`.
2. Apri quella cartella nell'app Codex. Non aprire più la vecchia copia dentro
   `Library/CloudStorage/OneDrive-.../codex/iscrizioni-pace`.
3. Codex mostrerà una richiesta per autorizzare gli hook del progetto. Controlla
   che il file sia `.codex/hooks.json`, quindi autorizzalo. La richiesta torna
   solo se gli hook cambiano.
4. Verifica che `.env.local` esista sulla postazione. Questo file contiene
   segreti, è ignorato da Git e deve essere trasferito separatamente con un
   canale sicuro quando si configura un nuovo computer.

### Per iniziare un nuovo lavoro

Il percorso consigliato non richiede comandi Terminale:

1. Apri il progetto locale in Codex.
2. Crea una nuova attività in modalità **Worktree**, scegliendo `main` come
   base.
3. Descrivi la modifica. All'avvio, l'hook esegue automaticamente il fetch da
   GitHub e aggiorna il worktree quando può farlo con un fast-forward sicuro.
4. Se Codex segnala modifiche locali, divergenze o un problema di fetch, non
   procedere: chiedigli di diagnosticare e mettere al sicuro il lavoro.

Se serve lavorare senza il worktree dell'app, Codex può usare:

```bash
npm run work:start -- nome-breve-del-lavoro
```

Il comando aggiorna `main` da GitHub e crea un branch
`codex/nome-breve-del-lavoro`. Si interrompe senza modificare nulla se la copia
non è pulita, non è su `main` o si trova dentro una cartella cloud.

### Per finire e sincronizzare

Scrivi a Codex esattamente:

> Chiudi e sincronizza questo lavoro: controlla il diff, esegui i test
> pertinenti, integra origin/main se necessario, fai commit e push del branch,
> verifica che non restino modifiche locali e dammi il link della pull request.
> Non fare il merge senza conferma.

Questa frase costituisce l'autorizzazione esplicita per commit e push. Il merge
della pull request resta separato, così una modifica non viene pubblicata per
errore.

Codex può usare il comando assistito:

```bash
npm run work:finish -- "Descrizione chiara della modifica"
```

Il comando esegue lint, typecheck e test; blocca file che sembrano segreti o
troppo grandi; committa, fa push e verifica che branch locale e remoto
coincidano. Se nel frattempo `main` o lo stesso branch remoto sono cambiati, si
ferma e chiede un intervento di Codex invece di tentare una risoluzione
rischiosa. Per includere anche la build completa:

```bash
npm run work:finish:full -- "Descrizione chiara della modifica"
```

### Per cambiare computer durante un lavoro

Sul primo computer esegui sempre la procedura “Chiudi e sincronizza”. Sul
secondo computer apri Codex e scrivi:

> Riprendi dal branch `codex/nome-del-lavoro`, controlla che la copia locale sia
> pulita e allineala con GitHub prima di modificare file.

Il comando corrispondente è:

```bash
npm run work:resume -- codex/nome-del-lavoro
```

Non tenere lo stesso branch aperto e modificabile su due computer nello stesso
momento.

### Cosa viene automatizzato e cosa no

- Automatico all'apertura Codex: controllo percorso, fetch da GitHub e
  fast-forward sicuro di `main` o del worktree appena creato.
- Automatico con “Chiudi e sincronizza”: review guidata da Codex, test, commit,
  push e verifica finale.
- Non automatico: merge della pull request, risoluzione di conflitti e
  pubblicazione di segreti. Sono intenzionalmente separati perché richiedono
  una decisione umana.
- OneDrive: sincronizza soltanto materiali esterni. Non è richiesta né
  desiderabile una copia automatica del repository locale su OneDrive.

## Controllo rapido dello stato

Quando c'è un dubbio, chiedere a Codex “controlla se questa postazione è pronta
e sincronizzata” oppure eseguire:

```bash
npm run work:status
```

Il comando mostra branch, modifiche locali e differenza rispetto a GitHub.

## Riferimenti Codex

- [Hook del ciclo di vita Codex](https://learn.chatgpt.com/docs/hooks)
- [Worktree Git nell'app Codex](https://learn.chatgpt.com/docs/environments/git-worktrees)
