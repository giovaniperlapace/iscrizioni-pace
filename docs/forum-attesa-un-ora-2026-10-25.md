# Lista d’attesa: inviti di un’ora — 25 ottobre 2026

Modifica preparata localmente, non pubblicata né applicata in produzione.

Nuovi inviti Forum principali e sale collegate: un’ora alla promozione e finestra completa di un’ora al claim della notifica. La migration `20261025200000_forum_waitlist_one_hour.sql` sostituisce le due funzioni mantenendo controlli, FIFO, famiglie, lock, privilegi e claim. Nessun aggiornamento delle righe esistenti: gli inviti già notificati conservano la scadenza comunicata; i pending ricevono la nuova finestra al claim ordinario.

Aggiornati testi partecipante, capogruppo e sale collegate nelle sette lingue. Nessun reinvio o test email reale.

Verifiche: 77 test applicativi mirati superati; ESLint mirato e diff check superati. PostgreSQL temporaneo: tutte le migration, test Forum individuali e sale collegate superati, inclusa conservazione integrale delle offerte esistenti all’applicazione della nuova migration. Il runner completo incontra una fixture preesistente capogruppo con Forum del 25 ottobre alle 16 già passato; i controlli individuali e relay sono stati eseguiti separatamente con lo stesso bootstrap canonico.

Repository aggiornato in fast-forward a origin/main 6d54d31, preservando i file locali estranei. L’utente ha successivamente autorizzato pubblicazione e migration. Per attivare: backup verificato, applicazione e registrazione della migration e pubblicazione dei testi aggiornati.

## Tentativo di rilascio autorizzato

1.163 test applicativi e build production con TypeScript superati in copia isolata da npm ci. Vercel CLI autenticata: progetto e team confermati, produzione READY sul commit precedente 6d54d31. Il connettore Vercel non dispone dell’accesso al team; la CLI funziona.

Accesso SSH al server canonico in timeout ripetuto, anche con connessione nuova senza multiplexing. Impossibile verificare backup e database: nessuna migration applicata. Modifica conservata in commit locale; push e deploy rinviati per non mostrare un’ora mentre il database mantiene due ore. Nessun cambiamento operativo remoto.
