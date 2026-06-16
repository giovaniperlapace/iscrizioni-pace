import {
  formatOpeningReadinessReport,
  validateOpeningReadiness,
} from "../lib/deployment/opening-readiness.ts";

const production = process.argv.includes("--production");
const result = validateOpeningReadiness(process.env, { production });

console.log(formatOpeningReadinessReport(result));

if (!result.ok) {
  process.exit(1);
}
