import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { installSkill, resolveBundledSkillPath } from "../src/cli/skill.js";

describe("installSkill", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it("locates the bundled skills/brandlinter/SKILL.md", () => {
    const skillPath = resolveBundledSkillPath();
    expect(fs.existsSync(skillPath)).toBe(true);
    expect(fs.readFileSync(skillPath, "utf8")).toContain("name: brandlinter");
  });

  it("installs SKILL.md into .agents/skills/brandlinter for target=agents", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "brandlinter-skill-"));
    tempDirs.push(tmp);

    const dest = installSkill({ target: "agents", cwd: tmp });
    expect(dest).toBe(path.join(tmp, ".agents", "skills", "brandlinter", "SKILL.md"));
    expect(fs.existsSync(dest)).toBe(true);
  });

  it("throws on unsupported target", () => {
    expect(() => installSkill({ target: "unknown" as "agents", cwd: os.tmpdir() })).toThrow();
  });
});
