type EventIdentityProps = {
  align?: "left" | "center";
  className?: string;
  compact?: boolean;
  inverted?: boolean;
};

export function EventIdentity({
  align = "left",
  className = "",
  compact = false,
  inverted = false,
}: EventIdentityProps) {
  const alignment = align === "center" ? "items-center text-center" : "items-start";
  const titleSize = compact
    ? "text-[2rem] sm:text-4xl"
    : "text-[2.35rem] sm:text-5xl lg:text-6xl";
  const italianSize = compact ? "text-2xl sm:text-3xl" : "text-[1.7rem] sm:text-4xl";
  const titleTone = inverted ? "text-white" : "event-title-en";
  const italianTone = inverted ? "text-white/78" : "event-title-it";
  const kickerTone = inverted ? "text-white/82" : "event-kicker";

  return (
    <div className={`flex flex-col ${alignment} ${className}`}>
      <h1 className={`${titleSize} ${titleTone} max-w-4xl`}>
        UNHARMED AND
        <br />
        DISARMING PEACE
      </h1>
      <p className={`${italianSize} ${italianTone} mt-3 max-w-3xl`}>
        PACE DISARMATA
        <br />
        E DISARMANTE
      </p>
      <p className={`${kickerTone} mt-8 max-w-3xl`}>
        International Meeting for Peace
        <br />
        Assisi, 25–26–27 ottobre 2026
      </p>
    </div>
  );
}

export function PeaceLineMark({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={`event-line ${className}`}
      fill="none"
      viewBox="0 0 760 260"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M10 142C76 177 128 184 177 151C226 118 250 65 324 77C374 85 405 119 425 153C442 182 461 203 498 196C540 188 558 150 555 111C552 69 519 45 481 58C445 70 431 107 442 142C454 181 487 204 528 199C587 192 620 138 649 96C675 58 710 41 750 49"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="8"
      />
      <path
        d="M224 73C202 65 171 68 136 84C170 96 207 94 238 83"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="8"
      />
      <path
        d="M565 65C584 48 603 42 623 47C612 61 594 74 571 78"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="8"
      />
    </svg>
  );
}
