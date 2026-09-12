"use client";

import { useRef, useState, type AnchorHTMLAttributes } from "react";
import { WorkStatus } from "@/components/work-status";

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "download" | "onClick" | "href"> & {
  href: string;
  filename: string;
};

// These authenticated Excel endpoints return a file without navigating the page.
export function PendingDownload({ href, filename, children, ...props }: Props) {
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  return <>
    <a {...props} href={href} download={filename} aria-busy={pending} aria-disabled={pending}
      onClick={async (event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        if (inFlight.current) return;
        inFlight.current = true;
        setPending(true);
        setError(false);
        try {
          const response = await fetch(href);
          if (!response.ok || !response.headers.get("content-type")?.includes("spreadsheetml")) throw new Error("Download failed");
          const url = URL.createObjectURL(await response.blob());
          const link = document.createElement("a");
          link.href = url;
          link.download = filename;
          document.body.append(link);
          link.click();
          link.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch {
          setError(true);
        } finally {
          inFlight.current = false;
          setPending(false);
        }
      }}>
      {children}{pending && <WorkStatus className="link-work-status" />}
    </a>
    {error && <span role="alert" className="text-sm text-[#8a3323]">Impossibile scaricare il file. Riprova.</span>}
  </>;
}
