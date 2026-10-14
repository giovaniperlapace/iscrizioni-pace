import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import * as React from "react";
import * as runtime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";

const compiled = ts.transpileModule(readFileSync(new URL("../app/dashboard/operations-participants-navigation.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

test("children and schools each have exactly one active participant tab and clear stale filters", () => {
  for (const view of ["all", "children", "schools", "duplicates", "without-group"]) {
    for (const dashboard of ["admin", "manager"]) {
      const api: { OperationsParticipantsNavigation?: React.ComponentType<Record<string, unknown>> } = {};
      const params = new URLSearchParams({view, edit: "old-person", schoolId: "old-school", schoolPanel: "old-panel", childrenGroup: "old-group", columns: "name,nationality"});
      new Function("require", "exports", compiled)((name: string) => {
        if (name === "react/jsx-runtime") return runtime;
        if (name === "next/navigation") return { useSearchParams: () => params };
        if (name === "lucide-react") return { Baby: "svg", Copy: "svg", School: "svg", UserRoundSearch: "svg", Users: "svg" };
        if (name.endsWith("pending-link")) return { default: ({prefetch, ...props}: Record<string, unknown>) => { assert.equal(prefetch, false); return React.createElement("a", props); } };
        throw new Error(name);
      }, api);
      const html = renderToStaticMarkup(React.createElement(api.OperationsParticipantsNavigation!, {dashboard, navMode: "mini"}));
      const links = [...html.matchAll(/<a\b([^>]+)>/g)];
      assert.equal(links.length, 5);
      assert.equal(links.filter(link => link[1].includes('aria-current="page"')).length, 1);
      for (const [, attributes] of links) {
        const url = new URL(attributes.match(/href="([^"]+)"/)![1].replaceAll("&amp;", "&"), "https://example.invalid");
        assert.equal(url.pathname, `/dashboard/${dashboard}`);
        assert.equal(url.searchParams.get("columns"), "name,nationality");
        for (const key of ["edit", "schoolId", "schoolPanel", "childrenGroup"]) assert.equal(url.searchParams.has(key), false);
        if (attributes.includes('aria-current="page"')) assert.equal(url.searchParams.get("view") ?? "all", view);
      }
    }
  }
});
