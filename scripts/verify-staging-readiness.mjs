import {
  formatStagingReadinessReport,
  validateStagingReadiness,
} from "../lib/deployment/staging-readiness.ts";

const result = validateStagingReadiness(process.env);

console.log(formatStagingReadinessReport(result));

if (!result.ok) {
  process.exit(1);
}
