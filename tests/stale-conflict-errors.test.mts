import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

test("quality API presents terminal and legacy stale conflicts as a refresh request", () => {
  const path = "../app/dashboard/participants/data-quality/api/route.ts";
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  const fn = ast.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "rpcError");
  assert.ok(fn);
  const code = ts.transpileModule(fn.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const rpcError = new Function(`${code}; return rpcError;`)();
  for (const code of ["PT409", "40001"]) {
    assert.match(rpcError(code).message, /I dati sono cambiati.*Ricarica/);
  }
  assert.match(rpcError("42501").message, /permessi/);
  assert.match(rpcError("XX000").message, /annullata integralmente/);
});
