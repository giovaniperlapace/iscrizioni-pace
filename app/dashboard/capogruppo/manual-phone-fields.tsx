"use client";

import { useId, useState } from "react";
import type { SupportedLocale } from "@/lib/i18n/config";
import { PHONE_INPUT_COPY } from "@/lib/i18n/phone-input";
import { OTHER_PHONE_PREFIX, PHONE_PREFIX_OPTIONS } from "@/lib/registrations/phone-prefixes";

export function ManualPhoneFields({ locale, label }: { locale: SupportedLocale; label: string }) {
  const [prefix, setPrefix] = useState("+39");
  const [customPrefix, setCustomPrefix] = useState("");
  const [number, setNumber] = useState("");
  const numberId = useId();
  const copy = PHONE_INPUT_COPY[locale];
  const countries = new Intl.DisplayNames([locale], { type: "region" });
  const digits = number.replace(/[\s().-]/g, "");
  const selectedPrefix = prefix === OTHER_PHONE_PREFIX ? customPrefix.trim() : prefix;

  return (
    <div className="grid content-start gap-1 text-sm font-semibold text-[var(--peace-ink)]">
      <label htmlFor={numberId}>{label}</label>
      <input type="hidden" name="phone" value={digits ? `${selectedPrefix}${digits}` : ""} />
      <div className="grid gap-2 sm:grid-cols-[minmax(8rem,12rem)_minmax(0,1fr)]">
        <select className="field min-w-0" aria-label={copy.phonePrefixLabel} value={prefix}
          onChange={event => {
            setPrefix(event.target.value);
            if (event.target.value !== OTHER_PHONE_PREFIX) setCustomPrefix("");
          }}>
          {PHONE_PREFIX_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>
              {option.value === "+1" ? `${countries.of("US")} / ${countries.of("CA")}` : countries.of(option.country)} {option.value}
            </option>
          ))}
          <option value={OTHER_PHONE_PREFIX}>{copy.phoneOther}</option>
        </select>
        <input id={numberId} type="tel" className="field min-w-0" autoComplete="tel-national"
          inputMode="tel" pattern="[0-9 .()\-]{4,14}" title={copy.phoneTitle}
          placeholder={copy.phoneNumberPlaceholder} value={number} data-field="phone"
          onChange={event => setNumber(event.target.value)} />
      </div>
      {prefix === OTHER_PHONE_PREFIX ? (
        <input type="tel" className="field" inputMode="tel" pattern="\+[1-9][0-9]{0,3}"
          aria-label={copy.phonePrefixLabel} placeholder={copy.phonePrefixPlaceholder}
          required={number.length > 0} value={customPrefix} data-field="phone"
          onChange={event => setCustomPrefix(event.target.value)} />
      ) : null}
    </div>
  );
}
