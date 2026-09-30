"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { cameraErrorMessage, startQrCamera, type CameraSource } from "@/lib/reception/camera";

export function ReceptionCamera({ paused, onCode, onNoCode, source = startQrCamera }: {
  paused: boolean;
  onCode: (value: string) => void;
  onNoCode: () => void;
  source?: CameraSource;
}) {
  const abort = useRef<AbortController | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [requested, setRequested] = useState(false);
  const [status, setStatus] = useState("Fotocamera pronta da avviare.");
  const [failed, setFailed] = useState(false);
  const receive = useEffectEvent((value: string) => { if (!document.hidden) onCode(value); });

  const receiveEmpty = useEffectEvent(() => { if (!document.hidden) onNoCode(); });

  useEffect(() => {
    const suspend = () => {
      if (document.hidden) {
        abort.current?.abort();
        setRequested(false);
        setStatus("Fotocamera sospesa. Avviala quando sei pronto a riprendere.");
      }
    };
    const leave = () => { abort.current?.abort(); setRequested(false); };
    document.addEventListener("visibilitychange", suspend);
    window.addEventListener("pagehide", leave);
    return () => { document.removeEventListener("visibilitychange", suspend); window.removeEventListener("pagehide", leave); };
  }, []);

  useEffect(() => {
    if (!requested || !video.current) return;
    const controller = new AbortController();
    abort.current = controller;
    let release: (() => void) | undefined;
    const fail = (error?: unknown) => {
      if (controller.signal.aborted) return;
      controller.abort();
      setRequested(false); setFailed(true); setStatus(cameraErrorMessage(error));
    };
    void source({ video: video.current, facing: "environment", signal: controller.signal, onCode: receive, onNoCode: receiveEmpty, onError: fail })
      .then(stop => {
        if (controller.signal.aborted) { stop(); return; }
        release = stop; setStatus("Fotocamera attiva. Inquadra il QR.");
      }).catch(fail);
    return () => { controller.abort(); release?.(); };
  }, [requested, source]);

  return <section className="grid gap-3" aria-label="Scanner fotocamera">
    <div className="relative mx-auto aspect-[3/4] w-full max-w-sm overflow-hidden rounded-2xl bg-slate-950">
      <video ref={video} muted playsInline autoPlay aria-label="Anteprima fotocamera" className="absolute inset-0 h-full w-full object-contain" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-2/3 -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 border-white/80" aria-hidden="true" />
      {paused && <p className="absolute inset-x-2 bottom-2 rounded-lg bg-slate-950 p-3 text-center font-semibold text-white">Scansione sospesa · completa l’operazione</p>}
    </div>
    <p role={failed ? "alert" : "status"} className="text-sm text-[var(--peace-ink)]">{status}</p>
    <div className="flex flex-wrap gap-2">
      <button type="button" className="btn-primary min-h-12 px-4" disabled={paused && !requested}
        onClick={() => {
          setRequested(!requested); setFailed(false);
          setStatus(requested ? "Fotocamera in pausa." : "Consenti la fotocamera se il browser lo richiede…");
        }}>{requested ? "Ferma fotocamera" : "Avvia fotocamera"}</button>

    </div>
  </section>;
}
