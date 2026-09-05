"use client";

import { createContext, useContext, useEffect, useId, useRef, useState, useTransition, type FormHTMLAttributes } from "react";
import { useRouter, unstable_rethrow } from "next/navigation";
import { FORM_COPY } from "@/lib/forms/copy";
import { formFailureFromRedirect, issueFromMessage, validateContactFields, type FormFailure, type FormIssue } from "@/lib/forms/result";
import { normalizeLocale, type SupportedLocale } from "@/lib/i18n/config";
import { parseManualRegistrationForm } from "@/lib/registrations/manual-registration";

const PendingContext = createContext(false);
export function useReliableFormPending() { return useContext(PendingContext); }

type Props = Omit<FormHTMLAttributes<HTMLFormElement>, "action" | "onSubmit"> & {
  action: string | ((formData: FormData) => Promise<unknown>);
  validation?: "manualRegistration";
  locale?: SupportedLocale;
};
type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
function controls(form: HTMLFormElement): Control[] {
  return Array.from(form.querySelectorAll<Control>("input,select,textarea")).filter((field) => !field.disabled && field.type !== "hidden");
}

export function ReliableForm({ action, children, validation, locale, ...props }: Props) {
  const ref = useRef<HTMLFormElement>(null);
  const summaryRef = useRef<HTMLParagraphElement>(null);
  const submitting = useRef(false);
  const [pending, startTransition] = useTransition();
  const [issues, setIssues] = useState<FormIssue[]>([]);
  const [resolvedLocale, setResolvedLocale] = useState<SupportedLocale>(locale ?? "en");
  const id = useId();
  const router = useRouter();
  const copy = FORM_COPY[locale ?? resolvedLocale];


  useEffect(() => {
    const form = ref.current;
    if (!form || !issues.length) return;
    const fields = controls(form);
    const cleanups: Array<() => void> = [];
    const invalidFields: Control[] = [];
    issues.forEach((issue, index) => {
      const aliases: Record<string, string[]> = { groupId: ["groupId", "groupIds", "groupPlacement"], label: ["label", "eventServiceLabel", "operationalTagLabel"] };
      const names = issue.field ? aliases[issue.field] ?? [issue.field] : [];
      const matching = fields.filter((field) => names.includes(field.name));
      const field = matching[0];
      if (!field) return;
      const message = document.createElement("p");
      message.id = `${id}-error-${index}`;
      message.className = "mt-1 text-sm font-normal text-[#8a3323]";
      message.textContent = copy[issue.code as keyof typeof copy] ?? copy.invalid;
      message.dataset.formError = "true";
      const label = field.closest("label");
      if (label) label.append(message); else field.after(message);
      matching.forEach((control) => {
        const describedBy = control.getAttribute("aria-describedby");
        const invalid = control.getAttribute("aria-invalid");
        control.setAttribute("aria-invalid", "true");
        control.setAttribute("aria-describedby", [describedBy, message.id].filter(Boolean).join(" "));
        cleanups.push(() => {
          if (describedBy === null) control.removeAttribute("aria-describedby"); else control.setAttribute("aria-describedby", describedBy);
          if (invalid === null) control.removeAttribute("aria-invalid"); else control.setAttribute("aria-invalid", invalid);
        });
      });
      invalidFields.push(...matching);
      cleanups.push(() => message.remove());
    });
    const first = fields.find((field) => invalidFields.includes(field)) ?? summaryRef.current;
    first?.focus();
    first?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [issues, copy, id]);

  return (
    <PendingContext.Provider value={pending}>
      <form
        {...props}
        ref={ref}
        action={typeof action === "string" ? action : async (data) => { await action(data); }}
        noValidate
        aria-busy={pending}
        onSubmit={(event) => {
          event.preventDefault();
          setResolvedLocale(normalizeLocale(document.documentElement.lang) ?? "en");
          if (submitting.current) return;
          const form = event.currentTarget;
          const submitter = (event.nativeEvent as SubmitEvent).submitter;
          const data = new FormData(form, submitter);
          const errors: FormIssue[] = controls(form).filter((field) => !field.validity.valid || field.required && !field.value.trim()).map((field) => ({
            field: field.name,
            code: field.validity.valueMissing || field.required && !field.value.trim() ? "required" : field.type === "email" ? "email" : "invalid",
          }));
          errors.push(...validateContactFields(data));
          if (validation === "manualRegistration") {
            const parsed = parseManualRegistrationForm(data);
            if (!parsed.ok) errors.push(...parsed.errors.map(issueFromMessage));
          }
          if (errors.length) {
            setIssues(errors.filter((issue, index) => errors.findIndex((other) => other.field === issue.field) === index));
            return;
          }
          setIssues([]);
          submitting.current = true;
          startTransition(async () => {
            try {
              let result: unknown;
              if (typeof action === "string") {
                const response = await fetch(action, { method: "POST", body: data, headers: { Accept: "application/json" } });
                if (response.headers.get("content-type")?.includes("application/json")) {
                  result = await response.json();
                } else if (response.redirected) {
                  const failure = formFailureFromRedirect(response.url);
                  if ([...new URL(response.url).searchParams.keys()].some((key) => /error$/i.test(key))) result = failure;
                  else { router.push(response.url); router.refresh(); return; }
                } else throw new Error("Unexpected form response");
              } else result = await action(data);
              if (result && typeof result === "object" && "status" in result && result.status === "error") {
                setIssues((result as FormFailure).issues);
              } else if (result && typeof result === "object" && "redirect" in result && typeof result.redirect === "string") {
                router.push(result.redirect); router.refresh();
              }
            } catch (error) {
              unstable_rethrow(error);
              setIssues([{ field: null, code: "failed" }]);
            } finally { submitting.current = false; }
          });
        }}
      >
        {issues.length > 0 ? (
          <p ref={summaryRef} role="alert" tabIndex={-1} className="col-span-full rounded-md border border-[#e0b5a9] bg-[#fff3ef] px-3 py-2 text-sm text-[#8a3323]">
            {copy.summary} {issues.filter((issue) => !issue.field).map((issue) => copy[issue.code as keyof typeof copy] ?? copy.failed).join(" ")}
          </p>
        ) : null}
        {children}
      </form>
    </PendingContext.Provider>
  );
}
