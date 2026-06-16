"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { submitPublicRegistration } from "@/app/actions";
import {
  findMatchingGroupCandidates,
  formatGroupOptionLabel,
  normalizeMatchText,
} from "@/lib/groups/matching";
import {
  ACCESSIBILITY_DIFFICULTIES,
  EUROPEAN_CITY_OPTIONS,
  EUROPEAN_COUNTRIES,
  NATIONALITY_OPTIONS,
  PLACEHOLDER_GROUPS,
} from "@/lib/questionnaire/registration";
import type { PublicRegistrationOptions } from "@/lib/registrations/public-flow";

type RegistrationFormProps = {
  email: string;
  error?: string;
  options: PublicRegistrationOptions;
};

const OTHER_COUNTRY = "Altro / non in lista";
const OTHER_CITY = "Altro / non in lista";
const OTHER_PHONE_PREFIX = "other";
const FORM_STORAGE_PREFIX = "iscrizioni-pace.registration-form";
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const EVENT_DAY_FORMATTER = new Intl.DateTimeFormat("it-IT", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const PHONE_PREFIX_OPTIONS = [
  { value: "+39", label: "Italia +39" },
  { value: "+33", label: "Francia +33" },
  { value: "+49", label: "Germania +49" },
  { value: "+34", label: "Spagna +34" },
  { value: "+351", label: "Portogallo +351" },
  { value: "+44", label: "Regno Unito +44" },
  { value: "+353", label: "Irlanda +353" },
  { value: "+41", label: "Svizzera +41" },
  { value: "+43", label: "Austria +43" },
  { value: "+32", label: "Belgio +32" },
  { value: "+31", label: "Paesi Bassi +31" },
  { value: "+45", label: "Danimarca +45" },
  { value: "+46", label: "Svezia +46" },
  { value: "+47", label: "Norvegia +47" },
  { value: "+358", label: "Finlandia +358" },
  { value: "+48", label: "Polonia +48" },
  { value: "+420", label: "Cechia +420" },
  { value: "+421", label: "Slovacchia +421" },
  { value: "+36", label: "Ungheria +36" },
  { value: "+386", label: "Slovenia +386" },
  { value: "+385", label: "Croazia +385" },
  { value: "+30", label: "Grecia +30" },
  { value: "+40", label: "Romania +40" },
  { value: "+359", label: "Bulgaria +359" },
  { value: "+380", label: "Ucraina +380" },
  { value: "+1", label: "Stati Uniti / Canada +1" },
  { value: "+55", label: "Brasile +55" },
  { value: "+54", label: "Argentina +54" },
  { value: "+52", label: "Messico +52" },
  { value: "+91", label: "India +91" },
  { value: "+86", label: "Cina +86" },
  { value: "+81", label: "Giappone +81" },
  { value: "+61", label: "Australia +61" },
  { value: "+212", label: "Marocco +212" },
  { value: "+216", label: "Tunisia +216" },
  { value: "+20", label: "Egitto +20" },
] as const;

type StoredRegistrationForm = {
  email: string;
  savedAt: number;
  fields: Record<string, string[]>;
  state: {
    hasAccessibilityNeeds: string;
    hasPreviousParticipation: string;
    participatesWithGroup: string;
    birthDate: string;
    countrySearch: string;
    selectedCountry: string;
    customCountry: string;
    citySearch: string;
    selectedCity: string;
    customCity: string;
    nationalitySearch: string;
    selectedNationality: string;
    groupSearch: string;
    cannotFindLeader: boolean;
    selectedGroupValue: string;
    phonePrefix: string;
    customPhonePrefix: string;
    phoneNumber: string;
    selectedEventDays: string[];
    availabilityUnknown: boolean;
  };
};

export function RegistrationForm({
  email,
  error,
  options,
}: RegistrationFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [hasAccessibilityNeeds, setHasAccessibilityNeeds] = useState("");
  const [hasPreviousParticipation, setHasPreviousParticipation] = useState("");
  const [participatesWithGroup, setParticipatesWithGroup] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [countrySearch, setCountrySearch] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");
  const [customCountry, setCustomCountry] = useState("");
  const [showCountryOptions, setShowCountryOptions] = useState(false);
  const [citySearch, setCitySearch] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [customCity, setCustomCity] = useState("");
  const [showCityOptions, setShowCityOptions] = useState(false);
  const [nationalitySearch, setNationalitySearch] = useState("");
  const [selectedNationality, setSelectedNationality] = useState("");
  const [showNationalityOptions, setShowNationalityOptions] = useState(false);
  const [groupSearch, setGroupSearch] = useState("");
  const [showGroupOptions, setShowGroupOptions] = useState(false);
  const [cannotFindLeader, setCannotFindLeader] = useState(false);
  const [selectedGroupValue, setSelectedGroupValue] = useState("");
  const [phonePrefix, setPhonePrefix] = useState("+39");
  const [customPhonePrefix, setCustomPhonePrefix] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedEventDays, setSelectedEventDays] = useState<string[]>([]);
  const [availabilityUnknown, setAvailabilityUnknown] = useState(false);

  const eventDays = buildEventDays(
    options.event?.starts_on ?? null,
    options.event?.ends_on ?? null
  );
  const filteredCountries = EUROPEAN_COUNTRIES.filter((country) =>
    normalizeSearchText(country).includes(normalizeSearchText(countrySearch))
  );
  const countryValue =
    selectedCountry === OTHER_COUNTRY ? customCountry : selectedCountry;
  const cityOptions =
    selectedCountry && selectedCountry !== OTHER_COUNTRY
      ? EUROPEAN_CITY_OPTIONS[selectedCountry] ?? []
      : [];
  const filteredCities = cityOptions.filter((city) =>
    normalizeSearchText(city).includes(normalizeSearchText(citySearch))
  );
  const cityValue = selectedCity === OTHER_CITY ? customCity : selectedCity;
  const selectedCountryId = findCountryId(options.countries, countryValue);
  const selectedCityId = selectedCountryId
    ? findCityId(options.cities, selectedCountryId, cityValue)
    : null;
  const matchingGroups = findMatchingGroupCandidates(
    options.groups,
    {
      countryId: selectedCountryId,
      cityId: selectedCityId,
      birthDate,
      eventStartsOn: options.event?.starts_on ?? null,
    },
    { publicOnly: true }
  );
  const searchedGroups = matchingGroups.filter((group) =>
    normalizeMatchText(formatGroupOptionLabel(group)).includes(
      normalizeMatchText(groupSearch)
    )
  );
  const hasRealGroups = options.groups.length > 0;
  const groupOptions = hasRealGroups
    ? searchedGroups.map((group) => ({
        value: group.id,
        label: formatGroupOptionLabel(group),
      }))
    : PLACEHOLDER_GROUPS.map((group) => ({ value: group, label: group }));
  const filteredNationalities = NATIONALITY_OPTIONS.filter((nationality) =>
    normalizeSearchText(nationality).includes(normalizeSearchText(nationalitySearch))
  );
  const normalizedPhoneNumber = phoneNumber.replace(/[\s().-]/g, "");
  const selectedPhonePrefix =
    phonePrefix === OTHER_PHONE_PREFIX ? customPhonePrefix.trim() : phonePrefix;
  const phoneValue = normalizedPhoneNumber
    ? `${selectedPhonePrefix}${normalizedPhoneNumber}`
    : "";

  const saveCurrentForm = useCallback(() => {
    const form = formRef.current;

    if (!form) {
      return;
    }

    writeStoredForm(email, form, {
      hasAccessibilityNeeds,
      hasPreviousParticipation,
      participatesWithGroup,
      birthDate,
      countrySearch,
      selectedCountry,
      customCountry,
      citySearch,
      selectedCity,
      customCity,
      nationalitySearch,
      selectedNationality,
      groupSearch,
      cannotFindLeader,
      selectedGroupValue,
      phonePrefix,
      customPhonePrefix,
      phoneNumber,
      selectedEventDays,
      availabilityUnknown,
    });
  }, [
    email,
    hasAccessibilityNeeds,
    hasPreviousParticipation,
    participatesWithGroup,
    birthDate,
    countrySearch,
    selectedCountry,
    customCountry,
    citySearch,
    selectedCity,
    customCity,
    nationalitySearch,
    selectedNationality,
    groupSearch,
    cannotFindLeader,
    selectedGroupValue,
    phonePrefix,
    customPhonePrefix,
    phoneNumber,
    selectedEventDays,
    availabilityUnknown,
  ]);

  useEffect(() => {
    const saveTimer = window.setTimeout(saveCurrentForm, 0);

    return () => window.clearTimeout(saveTimer);
  }, [saveCurrentForm]);

  useEffect(() => {
    if (!error || !email) {
      return;
    }

    const stored = readStoredForm(email);

    if (!stored) {
      focusFieldForError(formRef.current, error);
      return;
    }

    const restoreTimer = window.setTimeout(() => {
      setHasAccessibilityNeeds(stored.state.hasAccessibilityNeeds);
      setHasPreviousParticipation(stored.state.hasPreviousParticipation);
      setParticipatesWithGroup(stored.state.participatesWithGroup);
      setBirthDate(stored.state.birthDate);
      setCountrySearch(stored.state.countrySearch);
      setSelectedCountry(stored.state.selectedCountry);
      setCustomCountry(stored.state.customCountry);
      setCitySearch(stored.state.citySearch);
      setSelectedCity(stored.state.selectedCity);
      setCustomCity(stored.state.customCity);
      setNationalitySearch(stored.state.nationalitySearch);
      setSelectedNationality(stored.state.selectedNationality);
      setGroupSearch(stored.state.groupSearch);
      setCannotFindLeader(stored.state.cannotFindLeader);
      setSelectedGroupValue(stored.state.selectedGroupValue);
      setPhonePrefix(stored.state.phonePrefix);
      setCustomPhonePrefix(stored.state.customPhonePrefix);
      setPhoneNumber(stored.state.phoneNumber);
      setSelectedEventDays(stored.state.selectedEventDays);
      setAvailabilityUnknown(stored.state.availabilityUnknown);

      window.setTimeout(() => {
        restoreNativeFields(formRef.current, stored);
        focusFieldForError(formRef.current, error);
      }, 0);
    }, 0);

    return () => window.clearTimeout(restoreTimer);
  }, [email, error]);

  function clearCitySelection() {
    setCitySearch("");
    setSelectedCity("");
    setCustomCity("");
    setShowCityOptions(false);
    setGroupSearch("");
    setCannotFindLeader(false);
    setSelectedGroupValue("");
  }

  return (
    <form
      ref={formRef}
      action={submitPublicRegistration}
      className="mx-auto grid w-full max-w-5xl gap-6 px-5 py-8 sm:px-8"
      onChange={saveCurrentForm}
      onInput={saveCurrentForm}
      onSubmit={(event) => {
        saveCurrentForm();

        if (
          !hasAccessibilityNeeds ||
          !hasPreviousParticipation ||
          (hasPreviousParticipation === "yes" && !participatesWithGroup) ||
          (hasPreviousParticipation === "yes" &&
            participatesWithGroup === "yes" &&
            !cannotFindLeader &&
            !selectedGroupValue) ||
          (!availabilityUnknown && selectedEventDays.length === 0)
        ) {
          event.preventDefault();
          focusClientSideMissingField(formRef.current, {
            hasAccessibilityNeeds,
            hasPreviousParticipation,
            participatesWithGroup,
            availabilityUnknown,
            selectedEventDays,
            needsGroupChoice:
              hasPreviousParticipation === "yes" &&
              participatesWithGroup === "yes" &&
              !cannotFindLeader &&
              !selectedGroupValue,
          });
        }
      }}
    >
      <header className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#5d765f]">
          Nuova iscrizione
        </p>
        <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">
          {options.event?.title}
        </h1>
        <p className="mt-3 text-[#4b5a50]">
          Questa è la prima iscrizione all&apos;evento. Dopo l&apos;invio potrai
          accedere alla tua dashboard, scaricare il QR code per l&apos;ingresso e,
          quando sarà pubblicato il programma completo, scegliere i momenti a
          cui partecipare, come panel tematici ed eventi.
        </p>
        {error ? (
          <p className="mt-4 rounded-md border border-[#e0b5a9] bg-[#fff3ef] px-3 py-2 text-sm text-[#8a3323]">
            {error}
          </p>
        ) : null}
      </header>

      <section className="grid gap-4 rounded-lg border border-[#d8dece] bg-white p-5 sm:grid-cols-2">
        <Field label="Email" className="sm:col-span-2">
          <input
            name="email"
            type="email"
            required
            defaultValue={email}
            className="field"
            autoComplete="email"
            data-field="email"
          />
        </Field>
        <Field label="Nome">
          <input
            name="firstName"
            required
            className="field"
            autoComplete="given-name"
            data-field="firstName"
          />
        </Field>
        <Field label="Cognome">
          <input
            name="lastName"
            required
            className="field"
            autoComplete="family-name"
            data-field="lastName"
          />
        </Field>
        <div className="grid gap-2 text-sm font-medium text-[#38453c]">
          <span>Paese in cui vivi abitualmente</span>
          <input type="hidden" name="countryOther" value={countryValue} />
          <div className="relative">
            <input
              className="field"
              placeholder="Cerca il paese in cui vivi"
              required
              value={countrySearch}
              data-field="country"
              onBlur={() => {
                window.setTimeout(() => setShowCountryOptions(false), 120);
              }}
              onChange={(event) => {
                setCountrySearch(event.target.value);
                setSelectedCountry("");
                setShowCountryOptions(true);
              }}
              onFocus={() => setShowCountryOptions(true)}
            />
            {showCountryOptions ? (
              <div className="absolute z-10 mt-2 max-h-64 w-full overflow-auto rounded-md border border-[#cbd3c0] bg-white shadow-lg">
                {(filteredCountries.length > 0
                  ? filteredCountries
                  : ["Nessun paese trovato"]
                ).map((country) => (
                  <button
                    key={country}
                    type="button"
                    disabled={country === "Nessun paese trovato"}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-[#eef3e8] disabled:cursor-default disabled:text-[#7a867b] disabled:hover:bg-white"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      if (country === "Nessun paese trovato") {
                        return;
                      }

                      setSelectedCountry(country);
                      setCountrySearch(country);
                      setCustomCountry("");
                      clearCitySelection();
                      setShowCountryOptions(false);
                    }}
                  >
                    {country}
                  </button>
                ))}
                <button
                  type="button"
                  className="block w-full border-t border-[#e6eadf] px-3 py-2 text-left text-sm font-medium text-[#2f5e46] hover:bg-[#eef3e8]"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setSelectedCountry(OTHER_COUNTRY);
                    setCountrySearch(OTHER_COUNTRY);
                    clearCitySelection();
                    setShowCountryOptions(false);
                  }}
                >
                  {OTHER_COUNTRY}
                </button>
              </div>
            ) : null}
          </div>
          {selectedCountry === OTHER_COUNTRY ? (
            <input
              className="field"
              placeholder="Scrivi il paese in cui vivi"
              required
              value={customCountry}
              data-field="country"
              onChange={(event) => {
                setCustomCountry(event.target.value);
                clearCitySelection();
              }}
            />
          ) : null}
        </div>
        <div className="grid gap-2 text-sm font-medium text-[#38453c]">
          <span>Città in cui vivi abitualmente</span>
          <input type="hidden" name="cityOther" value={cityValue} />
          {selectedCountry === OTHER_COUNTRY ? (
            <input
              className="field"
              placeholder="Scrivi la città in cui vivi"
              required
              value={customCity}
              data-field="city"
              onChange={(event) => {
                setSelectedCity(OTHER_CITY);
                setCustomCity(event.target.value);
              }}
            />
          ) : (
            <div className="relative">
              <input
                className="field"
                placeholder={
                  selectedCountry
                    ? "Cerca la città in cui vivi"
                    : "Seleziona prima il paese"
                }
                required
                disabled={!selectedCountry}
                value={citySearch}
                data-field="city"
                onBlur={() => {
                  window.setTimeout(() => setShowCityOptions(false), 120);
                }}
                onChange={(event) => {
                  setCitySearch(event.target.value);
                  setSelectedCity("");
                  setShowCityOptions(true);
                }}
                onFocus={() => {
                  if (selectedCountry) {
                    setShowCityOptions(true);
                  }
                }}
              />
              {showCityOptions && selectedCountry ? (
                <div className="absolute z-10 mt-2 max-h-64 w-full overflow-auto rounded-md border border-[#cbd3c0] bg-white shadow-lg">
                  {(filteredCities.length > 0
                    ? filteredCities
                    : ["Nessuna città trovata"]
                  ).map((city) => (
                    <button
                      key={city}
                      type="button"
                      disabled={city === "Nessuna città trovata"}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-[#eef3e8] disabled:cursor-default disabled:text-[#7a867b] disabled:hover:bg-white"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        if (city === "Nessuna città trovata") {
                          return;
                        }

                        setSelectedCity(city);
                        setCitySearch(city);
                        setCustomCity("");
                        setShowCityOptions(false);
                      }}
                    >
                      {city}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="block w-full border-t border-[#e6eadf] px-3 py-2 text-left text-sm font-medium text-[#2f5e46] hover:bg-[#eef3e8]"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setSelectedCity(OTHER_CITY);
                      setCitySearch(OTHER_CITY);
                      setShowCityOptions(false);
                    }}
                  >
                    {OTHER_CITY}
                  </button>
                </div>
              ) : null}
            </div>
          )}
          {selectedCountry !== OTHER_COUNTRY && selectedCity === OTHER_CITY ? (
            <input
              className="field"
              placeholder="Scrivi la città in cui vivi"
              required
              value={customCity}
              data-field="city"
              onChange={(event) => setCustomCity(event.target.value)}
            />
          ) : null}
        </div>
        <Field label="Data di nascita">
          <input
            name="birthDate"
            type="date"
            required
            className="field"
            value={birthDate}
            data-field="birthDate"
            onChange={(event) => setBirthDate(event.target.value)}
          />
        </Field>
        <Field label="Luogo di nascita (paese e città)">
          <input
            name="birthPlace"
            required
            className="field"
            autoComplete="off"
            placeholder="Per esempio: Italia, Roma"
            data-field="birthPlace"
          />
        </Field>
        <div className="grid gap-2 text-sm font-medium text-[#38453c]">
          <span>Nazionalità</span>
          <input type="hidden" name="nationality" value={selectedNationality} />
          <div className="relative">
            <input
              className="field"
              placeholder="Cerca la nazionalità"
              required
              value={nationalitySearch}
              data-field="nationality"
              onBlur={() => {
                window.setTimeout(() => setShowNationalityOptions(false), 120);
              }}
              onChange={(event) => {
                setNationalitySearch(event.target.value);
                setSelectedNationality("");
                setShowNationalityOptions(true);
              }}
              onFocus={() => setShowNationalityOptions(true)}
            />
            {showNationalityOptions ? (
              <div className="absolute z-10 mt-2 max-h-64 w-full overflow-auto rounded-md border border-[#cbd3c0] bg-white shadow-lg">
                {(filteredNationalities.length > 0
                  ? filteredNationalities
                  : ["Nessuna nazionalità trovata"]
                ).map((nationality) => (
                  <button
                    key={nationality}
                    type="button"
                    disabled={nationality === "Nessuna nazionalità trovata"}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-[#eef3e8] disabled:cursor-default disabled:text-[#7a867b] disabled:hover:bg-white"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      if (nationality === "Nessuna nazionalità trovata") {
                        return;
                      }

                      setSelectedNationality(nationality);
                      setNationalitySearch(nationality);
                      setShowNationalityOptions(false);
                    }}
                  >
                    {nationality}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <div className="grid gap-2 text-sm font-medium text-[#38453c]">
          <span>Telefono (opzionale)</span>
          <input type="hidden" name="phone" value={phoneValue} />
          <div className="grid gap-2 sm:grid-cols-[minmax(8rem,12rem)_1fr]">
            <select
              className="field"
              value={phonePrefix}
              onChange={(event) => {
                setPhonePrefix(event.target.value);
                if (event.target.value !== OTHER_PHONE_PREFIX) {
                  setCustomPhonePrefix("");
                }
              }}
              aria-label="Prefisso internazionale"
            >
              {PHONE_PREFIX_OPTIONS.map((prefix) => (
                <option key={`${prefix.value}-${prefix.label}`} value={prefix.value}>
                  {prefix.label}
                </option>
              ))}
              <option value={OTHER_PHONE_PREFIX}>Altro</option>
            </select>
            <input
              type="tel"
              className="field"
              autoComplete="tel-national"
              inputMode="tel"
              pattern="[0-9 .()\\-]{4,14}"
              title="Inserisci solo cifre, spazi, punti, parentesi o trattini."
              placeholder="Numero"
              value={phoneNumber}
              data-field="phone"
              onChange={(event) => setPhoneNumber(event.target.value)}
            />
          </div>
          {phonePrefix === OTHER_PHONE_PREFIX ? (
            <input
              className="field"
              inputMode="tel"
              pattern="\\+[1-9][0-9]{0,3}"
              placeholder="Scrivi il prefisso, per esempio +234"
              required={phoneNumber.length > 0}
              title="Inserisci il prefisso internazionale iniziando con +."
              value={customPhonePrefix}
              data-field="phone"
              onChange={(event) => setCustomPhonePrefix(event.target.value)}
            />
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 rounded-lg border border-[#d8dece] bg-white p-5">
        <div className="grid gap-3 text-sm font-medium text-[#38453c]">
          <span>
            Hai una disabilità, una condizione di salute o un bisogno di
            accessibilità che desideri segnalarci per organizzare meglio
            l&apos;accoglienza?
          </span>
          <input
            name="hasAccessibilityNeeds"
            type="hidden"
            value={hasAccessibilityNeeds}
          />
          <div className="grid grid-cols-2 gap-3 sm:max-w-xs">
            <ChoiceButton
              active={hasAccessibilityNeeds === "yes"}
              label="Sì"
              dataField="hasAccessibilityNeeds"
              onClick={() => setHasAccessibilityNeeds("yes")}
            />
            <ChoiceButton
              active={hasAccessibilityNeeds === "no"}
              label="No"
              dataField="hasAccessibilityNeeds"
              onClick={() => setHasAccessibilityNeeds("no")}
            />
          </div>
          {!hasAccessibilityNeeds ? (
            <p className="text-xs text-[#8a3323]">
              Seleziona una risposta per proseguire.
            </p>
          ) : null}
        </div>

        {hasAccessibilityNeeds === "yes" ? (
          <div className="grid gap-4">
            <div>
              <h2 className="text-lg font-semibold">
                Quali aspetti dobbiamo considerare?
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5e6d63]">
                Puoi selezionare una o più opzioni utili per organizzare meglio
                l&apos;accoglienza.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {ACCESSIBILITY_DIFFICULTIES.map((difficulty) => (
                <label
                  key={difficulty.key}
                  className="flex min-h-14 items-start gap-3 rounded-md border border-[#d8dece] p-3 text-sm text-[#38453c]"
                >
                  <input
                    name={`accessibility_${difficulty.key}`}
                    type="checkbox"
                    className="mt-1 h-4 w-4"
                    data-field="accessibilityAnswers"
                  />
                  <span>{difficulty.label.it}</span>
                </label>
              ))}
            </div>
            <Field label="Ci sono indicazioni pratiche che vuoi comunicarci? (opzionale)">
              <textarea
                name="accessibilityNotes"
                className="field min-h-24"
                placeholder="Per esempio: orari in cui preferisci essere contattato, accompagnatore, esigenze operative specifiche."
                data-field="accessibilityNotes"
              />
            </Field>
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 rounded-lg border border-[#d8dece] bg-white p-5">
        <div className="grid gap-3 text-sm font-medium text-[#38453c]">
          <span>
            Hai mai partecipato ad altri eventi o attività della Comunità di
            Sant&apos;Egidio nella tua città?
          </span>
          <input
            name="hasPreviousSantegidioParticipation"
            type="hidden"
            value={hasPreviousParticipation}
          />
          <div className="grid grid-cols-2 gap-3 sm:max-w-xs">
            <ChoiceButton
              active={hasPreviousParticipation === "yes"}
              label="Sì"
              dataField="hasPreviousSantegidioParticipation"
              onClick={() => setHasPreviousParticipation("yes")}
            />
            <ChoiceButton
              active={hasPreviousParticipation === "no"}
              label="No"
              dataField="hasPreviousSantegidioParticipation"
              onClick={() => {
                setHasPreviousParticipation("no");
                setParticipatesWithGroup("");
                setCannotFindLeader(false);
              }}
            />
          </div>
          {!hasPreviousParticipation ? (
            <p className="text-xs text-[#8a3323]">
              Seleziona una risposta per proseguire.
            </p>
          ) : null}
        </div>

        {hasPreviousParticipation === "yes" ? (
          <div className="grid gap-3 text-sm font-medium text-[#38453c]">
            <span>Parteciperai con un gruppo?</span>
            <input
              name="participatesWithGroup"
              type="hidden"
              value={participatesWithGroup}
            />
            <div className="grid grid-cols-2 gap-3 sm:max-w-xs">
              <ChoiceButton
                active={participatesWithGroup === "yes"}
                label="Sì"
                dataField="participatesWithGroup"
                onClick={() => {
                  setParticipatesWithGroup("yes");
                  setCannotFindLeader(false);
                }}
              />
              <ChoiceButton
                active={participatesWithGroup === "no"}
                label="No"
                dataField="participatesWithGroup"
                onClick={() => {
                  setParticipatesWithGroup("no");
                  setCannotFindLeader(false);
                }}
              />
            </div>
            {!participatesWithGroup ? (
              <p className="text-xs text-[#8a3323]">
                Seleziona una risposta per proseguire.
              </p>
            ) : null}
          </div>
        ) : null}

        {hasPreviousParticipation === "yes" && participatesWithGroup === "yes" ? (
          <Field label="Gruppo o referente">
            <input
              name={hasRealGroups ? "groupId" : "groupName"}
              value={selectedGroupValue}
              readOnly
              type="hidden"
            />
            <div className="relative">
              <input
                className="field"
                placeholder={
                  selectedCountryId && birthDate
                    ? "Cerca per gruppo o referente"
                    : "Indica prima paese, città e data di nascita"
                }
                required={!cannotFindLeader}
                disabled={cannotFindLeader || !selectedCountryId || !birthDate}
                value={groupSearch}
                data-field="group"
                onBlur={() => {
                  window.setTimeout(() => setShowGroupOptions(false), 120);
                }}
                onChange={(event) => {
                  setGroupSearch(event.target.value);
                  setSelectedGroupValue("");
                  setShowGroupOptions(true);
                }}
                onFocus={() => {
                  if (!cannotFindLeader && selectedCountryId && birthDate) {
                    setShowGroupOptions(true);
                  }
                }}
              />
              {showGroupOptions && !cannotFindLeader ? (
                <div className="absolute z-10 mt-2 max-h-64 w-full overflow-auto rounded-md border border-[#cbd3c0] bg-white shadow-lg">
                  {(groupOptions.length > 0
                    ? groupOptions
                    : [
                        {
                          value: "",
                          label: selectedCountryId
                            ? "Nessun referente affine trovato"
                            : "Indica prima paese, città e data di nascita",
                        },
                      ]
                  ).map((group) => (
                    <button
                      key={`${group.value}-${group.label}`}
                      type="button"
                      disabled={!group.value}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-[#eef3e8] disabled:cursor-default disabled:text-[#7a867b] disabled:hover:bg-white"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        if (!group.value) {
                          return;
                        }

                        setSelectedGroupValue(group.value);
                        setGroupSearch(group.label);
                        setShowGroupOptions(false);
                      }}
                    >
                      {group.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            {hasRealGroups && groupOptions.length === 0 ? (
              <span className="text-xs font-normal text-[#6a766b]">
                Nessun referente affine trovato con i dati indicati.
              </span>
            ) : null}
            <label className="flex items-start gap-3 text-sm font-normal text-[#38453c]">
              <input
                name="cannotFindLeader"
                type="checkbox"
                checked={cannotFindLeader}
                className="mt-1 h-4 w-4"
                data-field="group"
                onChange={(event) => {
                  const checked = event.target.checked;
                  setCannotFindLeader(checked);
                  if (checked) {
                    setSelectedGroupValue("");
                    setGroupSearch("");
                    setShowGroupOptions(false);
                  }
                }}
              />
              <span>Non trovo il mio referente</span>
            </label>
          </Field>
        ) : null}
      </section>

      <section className="grid gap-4 rounded-lg border border-[#d8dece] bg-white p-5">
        <div>
          <h2 className="text-lg font-semibold">
            In quali giorni pensi di essere presente?
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5e6d63]">
            Puoi selezionare uno o più giorni dell&apos;evento, oppure indicare
            che lo comunicherai più avanti.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {eventDays.map((day) => (
            <label
              key={day.value}
              className={`flex min-h-14 items-center gap-3 rounded-md border p-3 text-sm transition ${
                availabilityUnknown
                  ? "border-[#e1e5da] bg-[#f5f6f1] text-[#7a867b]"
                  : "border-[#d8dece] text-[#38453c]"
              }`}
            >
              <input
                name="availabilityDays"
                type="checkbox"
                value={day.value}
                checked={selectedEventDays.includes(day.value)}
                disabled={availabilityUnknown}
                className="h-4 w-4"
                data-field="availabilityDays"
                onChange={(event) => {
                  setSelectedEventDays((current) =>
                    event.target.checked
                      ? [...current, day.value]
                      : current.filter((value) => value !== day.value)
                  );
                }}
              />
              <span>{day.label}</span>
            </label>
          ))}
        </div>
        <label className="flex min-h-14 items-center gap-3 rounded-md border border-[#d8dece] p-3 text-sm text-[#38453c]">
          <input
            name="availabilityUnknown"
            type="checkbox"
            checked={availabilityUnknown}
            className="h-4 w-4"
            data-field="availabilityDays"
            onChange={(event) => {
              setAvailabilityUnknown(event.target.checked);
              if (event.target.checked) {
                setSelectedEventDays([]);
              }
            }}
          />
          <span>Non lo so ancora, lo comunicherò in seguito</span>
        </label>
        {!availabilityUnknown && selectedEventDays.length === 0 ? (
          <p className="text-xs text-[#8a3323]">
            Seleziona almeno un giorno o indica che lo comunicherai in seguito.
          </p>
        ) : null}
      </section>

      <section className="rounded-lg border border-[#d8dece] bg-white p-5">
        <h2 className="text-lg font-semibold">Privacy e trattamento dati</h2>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-[#4b5a50]">
          Confermo di aver letto l&apos;informativa privacy dell&apos;evento e
          autorizzo il trattamento dei dati inseriti per gestire l&apos;iscrizione,
          l&apos;identificazione del partecipante, le comunicazioni organizzative,
          l&apos;accoglienza, gli eventuali bisogni di accessibilità e gli
          adempimenti di sicurezza e legge collegati all&apos;evento. I dati
          saranno trattati secondo il Regolamento UE 2016/679 (GDPR), con
          misure adeguate di riservatezza, accesso limitato ai soli incaricati e
          conservazione per il tempo necessario alle finalità indicate. So che
          posso esercitare i diritti di accesso, rettifica, cancellazione,
          limitazione, opposizione e revoca del consenso, senza pregiudicare la
          liceità del trattamento già effettuato.
        </p>
        <label className="mt-4 flex items-start gap-3 text-sm text-[#38453c]">
          <input
            name="privacyAccepted"
            type="checkbox"
            required
            className="mt-1 h-4 w-4"
            data-field="consents"
          />
          <span>
            Accetto l&apos;informativa privacy e autorizzo il trattamento dei dati
            necessari alla gestione dell&apos;iscrizione e dell&apos;evento.
          </span>
        </label>
        <label className="mt-3 flex items-start gap-3 text-sm text-[#38453c]">
          <input
            name="dataProcessingAccepted"
            type="checkbox"
            required
            className="mt-1 h-4 w-4"
            data-field="consents"
          />
          <span>
            Acconsento al trattamento delle informazioni su disabilità,
            salute o bisogni di accessibilità eventualmente indicate, per
            predisporre misure di accoglienza e supporto durante l&apos;evento.
          </span>
        </label>
      </section>

      <div className="flex justify-end">
        <button
          type="submit"
          className="min-h-12 rounded-md bg-[#2f5e46] px-6 font-semibold text-white transition hover:bg-[#254b38]"
        >
          Invia iscrizione
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`grid gap-2 text-sm font-medium text-[#38453c] ${className}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function ChoiceButton({
  active,
  label,
  dataField,
  onClick,
}: {
  active: boolean;
  label: string;
  dataField?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      data-field={dataField}
      className={`min-h-12 rounded-md border px-4 text-sm font-semibold transition ${
        active
          ? "border-[#2f5e46] bg-[#2f5e46] text-white"
          : "border-[#cbd3c0] bg-white text-[#1c241f] hover:bg-[#eef3e8]"
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function storageKey(email: string): string {
  return `${FORM_STORAGE_PREFIX}:${email.trim().toLowerCase()}`;
}

function readStoredForm(email: string): StoredRegistrationForm | null {
  try {
    const raw = window.sessionStorage.getItem(storageKey(email));

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as StoredRegistrationForm;

    if (parsed.email !== email || Date.now() - parsed.savedAt > 24 * 60 * 60 * 1000) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writeStoredForm(
  email: string,
  form: HTMLFormElement,
  state: StoredRegistrationForm["state"]
) {
  if (!email) {
    return;
  }

  const formData = new FormData(form);
  const fields: Record<string, string[]> = {};

  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") {
      continue;
    }

    fields[key] = [...(fields[key] ?? []), value];
  }

  const stored: StoredRegistrationForm = {
    email,
    savedAt: Date.now(),
    fields,
    state,
  };

  try {
    window.sessionStorage.setItem(storageKey(email), JSON.stringify(stored));
  } catch {
    // Losing a draft is acceptable; form submission must keep working.
  }
}

function restoreNativeFields(
  form: HTMLFormElement | null,
  stored: StoredRegistrationForm
) {
  if (!form) {
    return;
  }

  for (const element of Array.from(form.elements)) {
    if (
      !(element instanceof HTMLInputElement) &&
      !(element instanceof HTMLTextAreaElement) &&
      !(element instanceof HTMLSelectElement)
    ) {
      continue;
    }

    if (!element.name || element.type === "hidden") {
      continue;
    }

    const values = stored.fields[element.name] ?? [];

    if (element instanceof HTMLInputElement && element.type === "checkbox") {
      const checkboxValue = element.value || "on";
      element.checked = values.includes(checkboxValue);
      continue;
    }

    if (element instanceof HTMLInputElement && element.type === "radio") {
      element.checked = values.includes(element.value);
      continue;
    }

    element.value = values[0] ?? element.value;
  }
}

function focusClientSideMissingField(
  form: HTMLFormElement | null,
  state: {
    hasAccessibilityNeeds: string;
    hasPreviousParticipation: string;
    participatesWithGroup: string;
    availabilityUnknown: boolean;
    selectedEventDays: string[];
    needsGroupChoice: boolean;
  }
) {
  if (!state.hasAccessibilityNeeds) {
    focusField(form, "hasAccessibilityNeeds");
    return;
  }

  if (!state.hasPreviousParticipation) {
    focusField(form, "hasPreviousSantegidioParticipation");
    return;
  }

  if (
    state.hasPreviousParticipation === "yes" &&
    !state.participatesWithGroup
  ) {
    focusField(form, "participatesWithGroup");
    return;
  }

  if (state.needsGroupChoice) {
    focusField(form, "group");
    return;
  }

  if (!state.availabilityUnknown && state.selectedEventDays.length === 0) {
    focusField(form, "availabilityDays");
  }
}

function focusFieldForError(form: HTMLFormElement | null, error: string) {
  const normalized = normalizeSearchText(error);

  if (normalized.includes("email")) {
    focusField(form, "email");
  } else if (normalized.includes("nome")) {
    focusField(form, "firstName");
  } else if (normalized.includes("cognome")) {
    focusField(form, "lastName");
  } else if (normalized.includes("data di nascita")) {
    focusField(form, "birthDate");
  } else if (normalized.includes("luogo di nascita")) {
    focusField(form, "birthPlace");
  } else if (normalized.includes("nazionalita")) {
    focusField(form, "nationality");
  } else if (normalized.includes("paese")) {
    focusField(form, "country");
  } else if (normalized.includes("citta")) {
    focusField(form, "city");
  } else if (normalized.includes("telefono") || normalized.includes("numero")) {
    focusField(form, "phone");
  } else if (normalized.includes("accessibilita")) {
    focusField(form, "hasAccessibilityNeeds");
  } else if (normalized.includes("bisogno") || normalized.includes("difficolta")) {
    focusField(form, "accessibilityAnswers");
  } else if (normalized.includes("sant'egidio")) {
    focusField(form, "hasPreviousSantegidioParticipation");
  } else if (normalized.includes("gruppo") || normalized.includes("referente")) {
    focusField(form, "group");
  } else if (normalized.includes("giorno") || normalized.includes("presenza")) {
    focusField(form, "availabilityDays");
  } else if (normalized.includes("privacy") || normalized.includes("trattamento")) {
    focusField(form, "consents");
  }
}

function focusField(form: HTMLFormElement | null, field: string) {
  const element = form?.querySelector<HTMLElement>(`[data-field="${field}"]`);

  if (!element) {
    return;
  }

  element.focus({ preventScroll: true });
  element.scrollIntoView({ block: "center", behavior: "smooth" });
}

function findCountryId(
  countries: PublicRegistrationOptions["countries"],
  value: string
): string | null {
  const normalized = normalizeMatchText(value);

  if (!normalized) {
    return null;
  }

  return (
    countries.find(
      (country) =>
        normalizeMatchText(country.name_it) === normalized ||
        normalizeMatchText(country.name_en) === normalized
    )?.id ?? null
  );
}

function findCityId(
  cities: PublicRegistrationOptions["cities"],
  countryId: string,
  value: string
): string | null {
  const normalized = normalizeMatchText(value);

  if (!normalized) {
    return null;
  }

  return (
    cities.find(
      (city) =>
        city.country_id === countryId && normalizeMatchText(city.name) === normalized
    )?.id ?? null
  );
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function buildEventDays(
  startsOn: string | null,
  endsOn: string | null
): Array<{ value: string; label: string }> {
  if (!startsOn) {
    return [];
  }

  const start = parseDateOnly(startsOn);
  const end = parseDateOnly(endsOn ?? startsOn);

  if (!start || !end || end.getTime() < start.getTime()) {
    return [];
  }

  const days: Array<{ value: string; label: string }> = [];

  for (
    let cursor = start;
    cursor.getTime() <= end.getTime();
    cursor = new Date(cursor.getTime() + DAY_IN_MS)
  ) {
    days.push({
      value: cursor.toISOString().slice(0, 10),
      label: EVENT_DAY_FORMATTER.format(cursor),
    });
  }

  return days;
}

function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  return new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  );
}
