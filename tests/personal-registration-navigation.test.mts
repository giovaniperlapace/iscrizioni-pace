import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

// Evaluate the actual JSX link expressions so the regression covers the URLs
// emitted by the UI, including emails containing query-string delimiters.
function hrefExpression(path: string, label: string) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression: string | undefined;
  function visit(node: ts.Node) {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(ast) === "Link" && node.getText(ast).includes(label)) {
      const href = node.openingElement.attributes.properties.find((p) => ts.isJsxAttribute(p) && p.name.getText(ast) === "href");
      if (href && ts.isJsxAttribute(href) && href.initializer && ts.isJsxExpression(href.initializer)) expression = href.initializer.expression?.getText(ast);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(expression, `Missing link: ${label}`);
  return expression;
}

for (const email of ["leader@example.org", "leader+test&name@example.org", undefined]) {
  test(`personal registration opens the public form with email ${email}`, () => {
    const expression = hrefExpression("../app/dashboard/partecipante/page.tsx", "copy.startRegistration");
    const href = new Function("auth", `return (${expression})`)({ user: { email } });
    const destination = new URL(href, "https://example.test");
    assert.equal(destination.pathname, "/registrazione");
    assert.equal(destination.searchParams.get("email"), email ?? null);
    assert.equal([...destination.searchParams.keys()].length, email ? 1 : 0);
    // Home/login redirect authenticated users; registration is outside the proxy.
    const proxy = readFileSync(new URL("../proxy.ts", import.meta.url), "utf8");
    assert.match(proxy, /matcher: \["\/", "\/login", "\/dashboard\/:path\*"\]/);
    const page = readFileSync(new URL("../app/registrazione/page.tsx", import.meta.url), "utf8");
    assert.match(page, /<RegistrationPageContent\s+searchParams=\{params\}/);
  });
}

test("operational registration card opens form only when registration is missing", () => {
  const expression = hrefExpression("../app/dashboard/personal-registration-card.tsx", "Completa iscrizione");
  const target = new Function("summary", `return (${expression})`);
  assert.equal(target({ hasRegistration: false }), "/registrazione");
  assert.equal(target({ hasRegistration: true }), "/dashboard/partecipante");
});
