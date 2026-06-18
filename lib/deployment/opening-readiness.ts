export type OpeningReadinessIssue = {
  name: string;
  message: string;
};

export type OpeningReadinessResult = {
  ok: boolean;
  errors: OpeningReadinessIssue[];
  warnings: OpeningReadinessIssue[];
};

type OpeningReadinessOptions = {
  production?: boolean;
  expectedAppUrl?: string;
};

const REQUIRED_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "QR_TOKEN_ENCRYPTION_SECRET",
  "NEXT_PUBLIC_APP_URL",
  "APP_URL",
  "PUBLIC_SITE_URL",
  "EMAIL_FROM",
  "EMAIL_USER",
  "EMAIL_PASSWORD",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "EMAIL_DELIVERY_MODE",
] as const;

const URL_ENV = ["NEXT_PUBLIC_APP_URL", "APP_URL", "PUBLIC_SITE_URL"] as const;

export function validateOpeningReadiness(
  env: Record<string, string | undefined>,
  options: OpeningReadinessOptions = {}
): OpeningReadinessResult {
  const errors: OpeningReadinessIssue[] = [];
  const warnings: OpeningReadinessIssue[] = [];
  const expectedAppUrl =
    options.expectedAppUrl ?? "https://registrationspeace.santegidio.org";

  for (const name of REQUIRED_ENV) {
    if (!hasValue(env[name])) {
      errors.push({
        name,
        message: `${name} non e' configurata.`,
      });
    }
  }

  if (options.production) {
    for (const name of URL_ENV) {
      const value = normalizedUrl(env[name]);

      if (value && value !== expectedAppUrl) {
        errors.push({
          name,
          message: `${name} deve puntare a ${expectedAppUrl} in produzione.`,
        });
      }
    }

    if (env.EMAIL_DELIVERY_MODE !== "smtp") {
      errors.push({
        name: "EMAIL_DELIVERY_MODE",
        message: "EMAIL_DELIVERY_MODE deve essere smtp prima dell'apertura.",
      });
    }
  }

  if (env.SMTP_SECURE && env.SMTP_SECURE !== "true") {
    warnings.push({
      name: "SMTP_SECURE",
      message: "SMTP_SECURE diverso da true richiede una verifica esplicita.",
    });
  }

  if (
    env.QR_TOKEN_ENCRYPTION_SECRET &&
    env.QR_TOKEN_ENCRYPTION_SECRET.trim().length < 32
  ) {
    warnings.push({
      name: "QR_TOKEN_ENCRYPTION_SECRET",
      message: "Usare un segreto stabile e lungo almeno 32 caratteri.",
    });
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

export function formatOpeningReadinessReport(
  result: OpeningReadinessResult
): string {
  const lines = [
    result.ok
      ? "Opening readiness: OK"
      : "Opening readiness: attenzione richiesta",
  ];

  for (const issue of result.errors) {
    lines.push(`ERROR ${issue.name}: ${issue.message}`);
  }

  for (const issue of result.warnings) {
    lines.push(`WARN ${issue.name}: ${issue.message}`);
  }

  return lines.join("\n");
}

function hasValue(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function normalizedUrl(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  return value.trim().replace(/\/+$/, "");
}
