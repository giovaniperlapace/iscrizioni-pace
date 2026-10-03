import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
for (const dashboard of ["admin", "manager"]) test(`${dashboard} keeps same-email accounts separate when targeting role removal`, () => {
  const file = readFileSync(new URL(`../app/dashboard/${dashboard}/page.tsx`, import.meta.url), "utf8");
  const ast = ts.createSourceFile("page.tsx", file, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names = new Set(["aggregateOperationalUserRows", "deduplicateOperationalAssignments"]);
  const source = ast.statements.filter(node => ts.isFunctionDeclaration(node) && node.name && names.has(node.name.text)).map(node => node.getText(ast)).join("\n");
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const aggregate = new Function(`${js};return aggregateOperationalUserRows;`)();
  const assignment = { role: "capogruppo", eventId: "event", groupId: "group", isPrimaryGroupLeader: false };
  const rows = aggregate([
    { userId: "first", email: "same@example.test", fullName: "First", assignment },
    { userId: "second", email: "same@example.test", fullName: "Second", assignment },
    { userId: "first", email: "same@example.test", fullName: "First", assignment: { ...assignment, role: "accoglienza", groupId: null } },
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows.find((row: {userId:string}) => row.userId === "first").assignments.length, 2);
  assert.equal(rows.find((row: {userId:string}) => row.userId === "second").assignments.length, 1);
});
