export type CameraFacing = "environment" | "user";
export type CameraSource = (options: {
  video: HTMLVideoElement;
  facing: CameraFacing;
  signal: AbortSignal;
  onCode: (value: string) => void;
  onError: () => void;
}) => Promise<() => void>;

// Decode only in the browser. No images, tokens or device labels are sent to
// logs, storage, analytics or third-party services.
export const startQrCamera: CameraSource = async ({ video, facing, signal, onCode, onError }) => {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error("unsupported");
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const canvas = document.createElement("canvas");
  let stopped = false;
  const stop = () => {
    stopped = true;
    clearTimeout(timer);
    for (const track of stream.getTracks()) { track.onended = null; track.stop(); }
    video.srcObject = null;
    canvas.width = canvas.height = 0;
    signal.removeEventListener("abort", stop);
  };
  if (signal.aborted) { stop(); return stop; }
  signal.addEventListener("abort", stop, { once: true });
  try {
    for (const track of stream.getVideoTracks()) track.onended = () => { stop(); onError(); };
    video.srcObject = stream;
    await video.play();
    const { default: jsQR } = await import("jsqr");
    if (signal.aborted || stopped) { stop(); return stop; }
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("canvas");
    const readFrame = () => {
      if (stopped || signal.aborted) return;
      try {
        if (video.readyState >= 2 && video.videoWidth && video.videoHeight) {
          const scale = Math.min(1, 960 / Math.max(video.videoWidth, video.videoHeight));
          canvas.width = Math.round(video.videoWidth * scale);
          canvas.height = Math.round(video.videoHeight * scale);
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          const frame = context.getImageData(0, 0, canvas.width, canvas.height);
          const qr = jsQR(frame.data, frame.width, frame.height, { inversionAttempts: "dontInvert" });
          if (qr) onCode(qr.data);
        }
        timer = setTimeout(readFrame, 250);
      } catch { stop(); onError(); }
    };
    readFrame();
    return stop;
  } catch (error) { stop(); throw error; }
};

export function cameraErrorMessage(error: unknown) {
  const name = error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "Fotocamera non autorizzata. Consenti l’accesso nelle impostazioni del browser oppure usa il codice manuale.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "Fotocamera non trovata. Prova l’altra fotocamera oppure usa il codice manuale.";
  if (name === "NotReadableError" || name === "AbortError") return "Fotocamera occupata o interrotta. Chiudi le altre app che la usano e riprova, oppure usa il codice manuale.";
  return "Fotocamera non disponibile. Apri la preview HTTPS in Safari o Chrome, oppure usa il codice manuale.";
}
