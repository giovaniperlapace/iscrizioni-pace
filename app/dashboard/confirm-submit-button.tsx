"use client";

import type { ReactNode } from "react";

import { PendingSubmitButton } from "@/components/pending-submit-button";

type ConfirmSubmitButtonProps = {
  children: ReactNode;
  className?: string;
  confirmMessage: string;
  formAction?: (formData: FormData) => void | Promise<void>;
  name: string;
  value: string;
};

export function ConfirmSubmitButton({
  children,
  className,
  confirmMessage,
  formAction,
  name,
  value,
}: ConfirmSubmitButtonProps) {
  return (
    <PendingSubmitButton
      name={name}
      value={value}
      formAction={formAction}
      className={className}
      onClick={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      {children}
    </PendingSubmitButton>
  );
}
