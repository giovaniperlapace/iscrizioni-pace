// One print at a time on this page. The browser/postation must be configured
// for silent printing; a normal browser still shows its native dialog.
let activeFrame: HTMLIFrameElement | null = null;

export function printQrLabel(url: string, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
  if (activeFrame) return Promise.reject(new Error("Print already in progress"));
  const target = new URL(url, window.location.href);
  if (target.origin !== window.location.origin) return Promise.reject(new Error("Invalid print origin"));
  target.searchParams.set("printRequest", crypto.randomUUID());
  return new Promise((resolve, reject) => {
    const frame = document.createElement("iframe");
    activeFrame = frame;
    frame.title = "Etichetta QR da stampare";
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;left:-10000px;top:0;width:1px;height:1px;border:0";
    let finished = false;
    let printStarted = false;
    let timer: ReturnType<typeof setTimeout>;
    function finish(error?: Error) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      frame.remove();
      if (activeFrame === frame) activeFrame = null;
      if (error) reject(error); else resolve();
    }
    function abort() { finish(new DOMException("Aborted", "AbortError")); }
    signal.addEventListener("abort", abort, { once: true });
    timer = setTimeout(() => finish(new Error("Print document unavailable")), 15000);
    frame.onload = async () => {
      if (finished || printStarted) return;
      try {
        const doc = frame.contentDocument;
        const view = frame.contentWindow;
        if (!view || !doc || doc.documentElement.dataset.qrLabel !== "29x90") throw new Error("Print document unavailable");
        // Never print an auth redirect, an HTTP error page, or incomplete images.
        await Promise.all(Array.from(doc.images, image => image.decode()));
        if (finished || signal.aborted) return;
        printStarted = true;
        clearTimeout(timer);
        // afterprint only releases resources. It does not confirm a physical label.
        view.addEventListener("afterprint", () => { clearTimeout(timer); timer = setTimeout(() => finish(), 1000); }, { once: true });
        timer = setTimeout(() => finish(), 30000);
        view.print();
      } catch (error) { finish(error instanceof Error ? error : new Error("Print failed")); }
    };
    frame.src = target.href;
    document.body.append(frame);
  });
}
