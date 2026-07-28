"use client";

import { useState } from "react";

import { updateParticipantDashboard } from "@/app/actions";
import { PendingSubmitButton } from "@/components/pending-submit-button";

type ChildValue = {
  firstName: string;
  lastName: string;
  birthDate: string;
};

type ParticipantChildrenEditorProps = {
  registrationId: string;
  initialChildren: ChildValue[];
  phone: string | null;
  availabilityUnknown: boolean;
  selectedAttendanceSlots: string[];
  momentChoices: Array<{ momentId: string; choice: string }>;
  editable: boolean;
  copy: {
    question: string;
    count: string;
    child: string;
    firstName: string;
    lastName: string;
    birthDate: string;
    yes: string;
    no: string;
    save: string;
  };
};

const EMPTY_CHILD: ChildValue = {
  firstName: "",
  lastName: "",
  birthDate: "",
};

export function ParticipantChildrenEditor({
  registrationId,
  initialChildren,
  phone,
  availabilityUnknown,
  selectedAttendanceSlots,
  momentChoices,
  editable,
  copy,
}: ParticipantChildrenEditorProps) {
  const [participatesWithChildren, setParticipatesWithChildren] = useState(
    initialChildren.length > 0
  );
  const [children, setChildren] = useState<ChildValue[]>(
    initialChildren.length > 0 ? initialChildren : [{ ...EMPTY_CHILD }]
  );

  function resizeChildren(count: number) {
    setChildren((current) =>
      Array.from({ length: count }, (_, index) => ({
        ...(current[index] ?? EMPTY_CHILD),
      }))
    );
  }

  function updateChild(index: number, update: Partial<ChildValue>) {
    setChildren((current) =>
      current.map((child, childIndex) =>
        childIndex === index ? { ...child, ...update } : child
      )
    );
  }

  return (
    <form action={updateParticipantDashboard} className="grid gap-4">
      <input type="hidden" name="registrationId" value={registrationId} />
      <input type="hidden" name="updatesChildren" value="on" />
      <input
        type="hidden"
        name="participatesWithChildren"
        value={participatesWithChildren ? "yes" : "no"}
      />
      {phone ? <input type="hidden" name="phone" value={phone} /> : null}
      {availabilityUnknown ? (
        <input type="hidden" name="availabilityUnknown" value="on" />
      ) : (
        selectedAttendanceSlots.map((slot) => (
          <input
            key={slot}
            type="hidden"
            name="availabilitySlots"
            value={slot}
          />
        ))
      )}
      {momentChoices.map((moment) => (
        <input
          key={moment.momentId}
          type="hidden"
          name={`moment_${moment.momentId}`}
          value={moment.choice}
        />
      ))}

      <fieldset disabled={!editable} className="grid gap-4 disabled:opacity-70">
        <legend className="sr-only">{copy.question}</legend>
        <div className="grid grid-cols-2 gap-3 sm:max-w-xs">
          <button
            type="button"
            aria-pressed={participatesWithChildren}
            className={choiceClassName(participatesWithChildren)}
            onClick={() => setParticipatesWithChildren(true)}
          >
            {copy.yes}
          </button>
          <button
            type="button"
            aria-pressed={!participatesWithChildren}
            className={choiceClassName(!participatesWithChildren)}
            onClick={() => setParticipatesWithChildren(false)}
          >
            {copy.no}
          </button>
        </div>

        {participatesWithChildren ? (
          <>
            <label className="grid gap-2 text-sm font-medium text-[var(--peace-ink)]">
              {copy.count}
              <select
                name="childrenCount"
                className="field"
                value={children.length}
                onChange={(event) => resizeChildren(Number(event.target.value))}
              >
                {Array.from({ length: 10 }, (_, index) => index + 1).map(
                  (count) => (
                    <option key={count} value={count}>
                      {count}
                    </option>
                  )
                )}
              </select>
            </label>

            <div className="grid gap-4">
              {children.map((child, index) => (
                <fieldset
                  key={index}
                  className="grid gap-3 rounded-md border border-[var(--peace-border)] bg-[#f7fbfe] p-4 sm:grid-cols-2"
                >
                  <legend className="px-2 text-sm font-semibold text-[var(--peace-blue-900)]">
                    {copy.child} {index + 1}
                  </legend>
                  <label className="grid gap-2 text-sm font-medium">
                    {copy.firstName}
                    <input
                      name={`child_${index}_firstName`}
                      required
                      className="field bg-white"
                      value={child.firstName}
                      autoComplete="off"
                      onChange={(event) =>
                        updateChild(index, { firstName: event.target.value })
                      }
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium">
                    {copy.lastName}
                    <input
                      name={`child_${index}_lastName`}
                      required
                      className="field bg-white"
                      value={child.lastName}
                      autoComplete="off"
                      onChange={(event) =>
                        updateChild(index, { lastName: event.target.value })
                      }
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium sm:col-span-2">
                    {copy.birthDate}
                    <input
                      name={`child_${index}_birthDate`}
                      type="date"
                      required
                      className="field bg-white"
                      value={child.birthDate}
                      autoComplete="off"
                      onChange={(event) =>
                        updateChild(index, { birthDate: event.target.value })
                      }
                    />
                  </label>
                </fieldset>
              ))}
            </div>
          </>
        ) : null}
      </fieldset>

      <PendingSubmitButton
        disabled={!editable}
        className="min-h-11 w-fit rounded-md bg-[var(--peace-blue-800)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {copy.save}
      </PendingSubmitButton>
    </form>
  );
}

function choiceClassName(active: boolean): string {
  return `min-h-11 rounded-md border px-4 text-sm font-semibold transition ${
    active
      ? "border-[var(--peace-blue-800)] bg-[var(--peace-blue-800)] text-white"
      : "border-[var(--peace-border-strong)] bg-white text-[var(--peace-ink)]"
  }`;
}
