"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useReliableFormPending, useReliableFormFailed } from "@/components/reliable-form";
import { ProgressButton } from "@/components/button-progress";
import { WorkStatus } from "@/components/work-status";
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
  const failed = useReliableFormFailed();
  const pending = nativePending || reliablePending;

  return (
    <ProgressButton
      {...props}
      type={type}
      disabled={disabled || pending}
      aria-busy={pending}
      progressError={failed}
      data-pending={pending ? "true" : "false"}
      className={`pending-submit-button ${className}`}
    >
      {pending && pendingLabel ? pendingLabel : children}
      {pending && <WorkStatus spinner={false} className="sr-only" />}
    </ProgressButton>
  );
}
