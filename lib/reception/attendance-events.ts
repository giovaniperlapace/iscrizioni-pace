const changeEvent = "iscrizioni:attendance-changed";
let source: string | undefined;
const tabSource = () => source ??= crypto.randomUUID();

// Invalidation only: never send names, QR codes or presence data between tabs.
// Every reader still obtains its own authorized snapshot from the server.
export function notifyEventAttendanceChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(changeEvent));
  try {
    const channel = new BroadcastChannel(changeEvent);
    channel.postMessage({ type: "changed", source: tabSource() });
    channel.close();
  } catch { /* Manual refresh and reconciliation also work without channels. */ }
}

export function subscribeEventAttendanceChanges(listener: () => void) {
  window.addEventListener(changeEvent, listener);
  let channel: BroadcastChannel | undefined;
  try {
    channel = new BroadcastChannel(changeEvent);
    channel.onmessage = event => {
      if (event.data?.type === "changed" && typeof event.data.source === "string" && event.data.source !== tabSource()) listener();
    };
  } catch { /* BroadcastChannel can be unavailable in restricted browsers. */ }
  return () => { window.removeEventListener(changeEvent, listener); channel?.close(); };
}
