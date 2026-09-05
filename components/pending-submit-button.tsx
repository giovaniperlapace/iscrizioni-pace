"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useReliableFormPending } from "@/components/reliable-form";
import { useFormStatus } from "react-dom";

type PendingSubmitButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  pendingLabel?: ReactNode;
};

export function PendingSubmitButton({
  children,
  className = "",
  disabled,
  pendingLabel,
  type = "submit",
  ...props
}: PendingSubmitButtonProps) {
  const { pending: nativePending } = useFormStatus();
  const reliablePending = useReliableFormPending();
  const pending = nativePending || reliablePending;

  return (
    <button
      {...props}
      type={type}
      disabled={disabled || pending}
      aria-busy={pending}
      data-pending={pending ? "true" : "false"}
      className={`pending-submit-button ${className}`}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
