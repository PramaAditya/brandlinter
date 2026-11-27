import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { installSkill, installSkills, resolveBundledSkillPath } from "../src/cli/skill.js";

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
  it("locates the bundled skills/brand-naming/SKILL.md", () => {
    const skillPath = resolveBundledSkillPath("brand-naming");
    expect(fs.existsSync(skillPath)).toBe(true);
    expect(fs.readFileSync(skillPath, "utf8")).toContain("name: brand-naming");
  });

  it("installs SKILL.md into .agents/skills/brandlinter for target=agents", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "brandlinter-skill-"));
    tempDirs.push(tmp);

    const dest = installSkill({ target: "agents", cwd: tmp });
    expect(dest).toBe(path.join(tmp, ".agents", "skills", "brandlinter", "SKILL.md"));
    expect(fs.existsSync(dest)).toBe(true);
  });

  it("installs both brandlinter and brand-naming skills with references", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "brandlinter-suite-"));
    tempDirs.push(tmp);

    const installed = installSkills({ target: "agents", cwd: tmp });
    expect(installed).toEqual([
      path.join(tmp, ".agents", "skills", "brandlinter", "SKILL.md"),
      path.join(tmp, ".agents", "skills", "brand-naming", "SKILL.md"),
    ]);
    for (const file of installed) {
      expect(fs.existsSync(file)).toBe(true);
    }
    const rebrandRef = path.join(tmp, ".agents", "skills", "brand-naming", "references", "oss-rebrand.md");
    expect(fs.existsSync(rebrandRef)).toBe(true);
  });

  it("installs the skill suite into ~/.omp/agent/skills for target=omp", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "brandlinter-omp-"));
    tempDirs.push(tmp);

    const installed = installSkills({ target: "omp", homeDir: tmp });
    expect(installed).toEqual([
      path.join(tmp, ".omp", "agent", "skills", "brandlinter", "SKILL.md"),
      path.join(tmp, ".omp", "agent", "skills", "brand-naming", "SKILL.md"),
    ]);
    expect(fs.existsSync(installed[1])).toBe(true);
  });

  it("throws on unsupported target", () => {
    expect(() => installSkill({ target: "unknown" as "agents", cwd: os.tmpdir() })).toThrow();
  });
});
