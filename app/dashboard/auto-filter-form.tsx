"use client";

import { type ReactNode, useEffect, useRef, useTransition } from "react";
import { WorkStatus } from "@/components/work-status";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type AutoFilterFormProps = {
  action: string;
  children: ReactNode;
  className?: string;
  defaults?: Record<string, string>;
  debounceMs?: number;
  blockWhilePending?: boolean;
};

const OVERLAY_PARAMS = [
  "edit",
  "editMode",
  "groupId",
  "groupLinkGroupId",
  "groupLinkToken",
  "groupTool",
];

export function AutoFilterForm({
  action,
  children,
  className,
  defaults = {},
  debounceMs = 450,
  blockWhilePending = true,
}: AutoFilterFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  function applyFilters() {
    const form = formRef.current;

    if (!form) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    const formData = new FormData(form);

    for (const name of OVERLAY_PARAMS) {
      nextParams.delete(name);
    }

    for (const [name, value] of formData.entries()) {
      if (typeof value !== "string") {
        continue;
      }

      const normalizedValue = value.trim();
      const defaultValue = defaults[name];

      if (!normalizedValue || normalizedValue === defaultValue) {
        nextParams.delete(name);
      } else {
        nextParams.set(name, normalizedValue);
      }
    }

    const query = nextParams.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname);
    });
  }

  return (
    <form
      ref={formRef}
      action={action}
      className={className}
      data-pending={isPending ? "true" : "false"}
      onChange={(event) => {
        const target = event.target;

        if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) {
          return;
        }

        if (target.type === "hidden") {
          return;
        }

        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }

        if (target instanceof HTMLInputElement && target.type === "text") {
          debounceRef.current = setTimeout(applyFilters, debounceMs);
          return;
        }

        applyFilters();
      }}
      onSubmit={(event) => {
        event.preventDefault();

        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }

        applyFilters();
      }}
    >
      <div className="relative">
        <fieldset
          className={[
            "m-0 min-w-0 border-0 p-0 transition disabled:cursor-wait",
            isPending && blockWhilePending
              ? "pointer-events-none select-none blur-[1px]"
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
          disabled={isPending && blockWhilePending}
          aria-busy={isPending}
        >
          {children}
        </fieldset>
        {isPending && blockWhilePending ? (
          <div
            className="absolute inset-0 z-10 grid place-items-center rounded-md bg-white/55"
          >
            <WorkStatus className="rounded-md border border-[var(--peace-border-strong)] bg-white/90 px-3 py-2 text-sm text-[var(--peace-blue-800)] shadow-sm" />
          </div>
        ) : isPending ? (
          <WorkStatus className="mt-2 text-sm text-[var(--peace-blue-800)]" />
        ) : null}
      </div>
    </form>
  );
}
