"use client";

import { useEffect, useState } from "react";

type CopyLinkButtonProps = {
  label?: string;
  url: string;
};

type AutoCopyLinkNoticeProps = {
  url: string | null;
};

export function CopyLinkButton({ label = "Copia link", url }: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const [isCopying, setIsCopying] = useState(false);

  return (
    <button
      type="button"
      disabled={isCopying}
      aria-busy={isCopying}
      data-pending={isCopying ? "true" : "false"}
      className="pending-submit-button min-h-9 rounded-md border border-[var(--peace-border-strong)] px-3 text-xs font-semibold text-[var(--peace-blue-800)] transition hover:bg-[var(--peace-sky-100)]"
      onClick={async () => {
        if (isCopying) {
          return;
        }

        setIsCopying(true);
        let didCopy = false;

        try {
          didCopy = await copyTextFromUserGesture(url);
        } finally {
          setIsCopying(false);
        }

        setCopied(didCopy);
        setFailed(!didCopy);
        window.setTimeout(() => {
          setCopied(false);
          setFailed(false);
        }, 1800);
      }}
    >
      {isCopying ? "Copia..." : copied ? "Copiato" : failed ? "Copia non riuscita" : label}
    </button>
  );
}

export function AutoCopyLinkNotice({ url }: AutoCopyLinkNoticeProps) {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!url) {
      return;
    }

    safeWriteClipboard(url).then((didCopy) => {
      if (didCopy) {
        setMessage("Link generato e copiato negli appunti.");
        window.setTimeout(() => setMessage(null), 3200);
        return;
      }

      setMessage("Link generato. Copialo con il pulsante qui sotto.");
      window.setTimeout(() => setMessage(null), 4200);
    });
  }, [url]);

  return message ? (
    <p className="rounded-md border border-[var(--peace-border-strong)] bg-[var(--peace-sky-100)] px-3 py-2 text-sm font-semibold text-[var(--peace-blue-800)]">
      {message}
    </p>
  ) : null;
}

async function safeWriteClipboard(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard?.writeText) {
      return false;
    }

    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

async function copyTextFromUserGesture(text: string): Promise<boolean> {
  return copyTextWithTextarea(text) || (await safeWriteClipboard(text));
}

function copyTextWithTextarea(text: string): boolean {
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "0";
    textarea.style.left = "0";
    textarea.style.width = "1px";
    textarea.style.height = "1px";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);

    const didCopy = document.execCommand("copy");
    document.body.removeChild(textarea);

    return didCopy;
  } catch {
    return false;
  }
}
