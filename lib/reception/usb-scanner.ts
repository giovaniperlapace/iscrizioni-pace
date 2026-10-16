// USB-HID scanners send characters followed by Enter. Keep the opaque payload
// only in memory; never repair keyboard-layout corruption or accept URLs.
export class UsbScannerBuffer {
  private value = "";
  private previous = 0;
  private overflow = false;
  private terminated = -Infinity;
  clear() { this.value = ""; this.previous = 0; this.overflow = false; }
  key(key: string, now: number): { consumed: boolean; code?: string } {
    if (key === "Enter") {
      if (now - this.previous > 1000) this.clear();
      const consumed = this.value.length > 0 || this.overflow || now - this.terminated < 150;
      const code = this.overflow ? "!invalid" : this.value;
      this.clear();
      if (consumed) this.terminated = now;
      return { consumed, ...(code ? { code } : {}) };
    }
    if (key.length !== 1) { if (key !== "Shift") this.clear(); return { consumed: false }; }
    // Space activates native buttons/checkboxes for keyboard operators. Valid
    // event QR payloads never start with a space.
    if (key === " " && !this.value && !this.overflow) return { consumed: false };
    if (now - this.previous > 1000) this.clear();
    this.previous = now;
    if (this.value.length >= 45) this.overflow = true;
    else this.value += key;
    return { consumed: true };
  }
}
