export type StagingReadinessIssue = {
  name: string;
  message: string;
};

export type StagingReadinessResult = {
  ok: boolean;
  errors: StagingReadinessIssue[];
  warnings: StagingReadinessIssue[];
};

const REQUIRED_ENV = [
  "DEPLOYMENT_ENVIRONMENT",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "QR_TOKEN_ENCRYPTION_SECRET",
  "NEXT_PUBLIC_APP_URL",
  "APP_URL",
  "PUBLIC_SITE_URL",
  "EMAIL_DELIVERY_MODE",
] as const;

const PRODUCTION_SUPABASE_URL =
  "https://iscrizioni-supabase.stefano-orlando.it";
const PRODUCTION_APP_URL = "https://registrationspeace.santegidio.org";

export function validateStagingReadiness(
  env: Record<string, string | undefined>
): StagingReadinessResult {
  const errors: StagingReadinessIssue[] = [];
  const warnings: StagingReadinessIssue[] = [];

  for (const name of REQUIRED_ENV) {
    if (!env[name]?.trim()) {
      errors.push({ name, message: `${name} non e' configurata.` });
    }
  }

  if (env.DEPLOYMENT_ENVIRONMENT !== "staging") {
    errors.push({
      name: "DEPLOYMENT_ENVIRONMENT",
      message: "Lo staging deve dichiarare DEPLOYMENT_ENVIRONMENT=staging.",
    });
  }

  if (env.EMAIL_DELIVERY_MODE !== "log") {
    errors.push({
      name: "EMAIL_DELIVERY_MODE",
      message: "In staging EMAIL_DELIVERY_MODE deve essere log.",
    });
  }

  const publicSupabaseUrl = normalizedUrl(env.NEXT_PUBLIC_SUPABASE_URL);
  const serverSupabaseUrl = normalizedUrl(env.SUPABASE_URL);
  const appUrls = [
    normalizedUrl(env.NEXT_PUBLIC_APP_URL),
    normalizedUrl(env.APP_URL),
    normalizedUrl(env.PUBLIC_SITE_URL),
  ].filter((value): value is string => Boolean(value));

  for (const [name, value] of [
    ["NEXT_PUBLIC_SUPABASE_URL", publicSupabaseUrl],
    ["SUPABASE_URL", serverSupabaseUrl],
    ["NEXT_PUBLIC_APP_URL", normalizedUrl(env.NEXT_PUBLIC_APP_URL)],
    ["APP_URL", normalizedUrl(env.APP_URL)],
    ["PUBLIC_SITE_URL", normalizedUrl(env.PUBLIC_SITE_URL)],
  ] as const) {
    if (value && !isSecureOrLocalUrl(value)) {
      errors.push({
        name,
        message: `${name} deve essere HTTPS oppure localhost per lo sviluppo locale.`,
      });
    }
  }

  if (publicSupabaseUrl && serverSupabaseUrl && publicSupabaseUrl !== serverSupabaseUrl) {
    errors.push({
      name: "SUPABASE_URL",
      message: "Gli URL Supabase pubblico e server devono indicare lo stesso staging.",
    });
  }

  if (
    publicSupabaseUrl === PRODUCTION_SUPABASE_URL ||
    serverSupabaseUrl === PRODUCTION_SUPABASE_URL
  ) {
    errors.push({
      name: "SUPABASE_URL",
      message: "Lo staging non puo' usare il Supabase production.",
    });
  }

  if (appUrls.some((value) => value === PRODUCTION_APP_URL)) {
    errors.push({
      name: "APP_URL",
      message: "Lo staging non puo' dichiarare il dominio applicativo production.",
    });
  }

  if (new Set(appUrls).size > 1) {
    errors.push({
      name: "APP_URL",
      message: "Gli URL applicativi di staging devono coincidere.",
    });
  }

  if (
    env.QR_TOKEN_ENCRYPTION_SECRET &&
    env.QR_TOKEN_ENCRYPTION_SECRET.trim().length < 32
  ) {
    warnings.push({
      name: "QR_TOKEN_ENCRYPTION_SECRET",
      message: "Usare un segreto staging lungo almeno 32 caratteri.",
    });
  }

  return { ok: errors.length === 0, errors, warnings };
}

export function formatStagingReadinessReport(
  result: StagingReadinessResult
): string {
  const lines = [
    result.ok
      ? "Staging readiness: OK"
      : "Staging readiness: attenzione richiesta",
  ];

  for (const issue of result.errors) {
    lines.push(`ERROR ${issue.name}: ${issue.message}`);
  }

  for (const issue of result.warnings) {
    lines.push(`WARN ${issue.name}: ${issue.message}`);
  }

  return lines.join("\n");
}

function normalizedUrl(value: string | undefined): string | null {
  if (!value) return null;
  return value.trim().replace(/\/+$/, "");
}

function isSecureOrLocalUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" ||
      (url.protocol === "http:" &&
        (url.hostname === "localhost" || url.hostname === "127.0.0.1"))
    );
  } catch {
    return false;
  }
}
