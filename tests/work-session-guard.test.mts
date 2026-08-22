import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const scriptPath = resolve("scripts/work-session.sh");

function git(cwd: string, args: string[]) {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

test("work:guard blocks the primary checkout and accepts a linked worktree", () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "iscrizioni-worktree-guard-"));
  const repository = join(tempRoot, "repository");
  const worktree = join(tempRoot, "worktree");

  try {
    git(tempRoot, ["init", "repository"]);
    writeFileSync(join(repository, "README.md"), "test\n");
    git(repository, ["add", "README.md"]);
    git(repository, [
      "-c",
      "user.name=Codex Test",
      "-c",
      "user.email=codex@example.invalid",
      "commit",
      "-m",
      "initial",
    ]);

    const localResult = spawnSync("bash", [scriptPath, "guard"], {
      cwd: repository,
      encoding: "utf8",
    });
    assert.equal(localResult.status, 1);
    assert.match(localResult.stderr, /checkout Local/);
    assert.match(localResult.stderr, /Hand off > Worktree/);

    git(repository, ["worktree", "add", "--detach", worktree]);
    const worktreeResult = spawnSync("bash", [scriptPath, "guard"], {
      cwd: worktree,
      encoding: "utf8",
    });
    assert.equal(worktreeResult.status, 0);
    assert.match(worktreeResult.stdout, /worktree Git separato/);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
