import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const globalStyles = readFileSync(
  join(process.cwd(), "app/globals.css"),
  "utf8"
);

test("dashboard modals keep long content inside a scrollable viewport", () => {
  assert.match(
    globalStyles,
    /\.dashboard-modal\s*{[\s\S]*?overflow:\s*hidden;[\s\S]*?overscroll-behavior:\s*contain;/
  );
  assert.match(
    globalStyles,
    /\.dashboard-modal\s*>\s*\*\s*{[\s\S]*?-webkit-overflow-scrolling:\s*touch;[\s\S]*?max-height:\s*calc\(100dvh - 4rem\);[\s\S]*?overflow-y:\s*auto;[\s\S]*?touch-action:\s*pan-y;/
  );
  assert.match(
    globalStyles,
    /\.dashboard-modal \[class\*="overflow-y-auto"\]\s*{[\s\S]*?overscroll-behavior:\s*auto;[\s\S]*?touch-action:\s*pan-y;/
  );
  assert.match(
    globalStyles,
    /html:has\(body \.dashboard-modal\),\s*body:has\(\.dashboard-modal\)\s*{[\s\S]*?overflow:\s*hidden;/
  );
});
