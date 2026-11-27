import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

export type SkillTarget = "agents" | "claude" | "omp" | "cursor";

export const BUNDLED_SKILLS = ["brandlinter", "brand-naming"] as const;
export type BundledSkillName = (typeof BUNDLED_SKILLS)[number];

const VALID_TARGETS: Record<SkillTarget, true> = {
  agents: true,
  claude: true,
  omp: true,
  cursor: true,
};

export function resolveBundledSkillsDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(here, "../../skills"),
    path.resolve(here, "../skills"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(path.join(p, "brandlinter", "SKILL.md"))) return p;
  }
  throw new Error("Bundled skills directory not found.");
}

export function resolveBundledSkillPath(skillName: BundledSkillName = "brandlinter"): string {
  const skillPath = path.join(resolveBundledSkillsDir(), skillName, "SKILL.md");
  if (fs.existsSync(skillPath)) return skillPath;
  throw new Error(`Bundled skills/${skillName}/SKILL.md not found.`);
}

function resolveTargetSkillsRoot(target: SkillTarget, cwd: string, home: string): string {
  switch (target) {
    case "agents":
      return path.join(cwd, ".agents", "skills");
    case "cursor":
      return path.join(cwd, ".cursor", "skills");
    case "claude":
      return path.join(home, ".claude", "skills");
    case "omp":
      return path.join(home, ".omp", "agent", "skills");
  }
}

export function installSkills(options?: {
  target?: SkillTarget;
  cwd?: string;
  homeDir?: string;
}): string[] {
  const target = options?.target ?? "agents";
  if (!(target in VALID_TARGETS)) {
    throw new Error(`Invalid skill target "${target}". Valid values: agents, claude, omp, cursor`);
  }

  const cwd = options?.cwd ?? process.cwd();
  const home = options?.homeDir ?? os.homedir();
  const skillsRoot = resolveBundledSkillsDir();
  const destRoot = resolveTargetSkillsRoot(target, cwd, home);

  const installed: string[] = [];
  for (const skillName of BUNDLED_SKILLS) {
    const srcDir = path.join(skillsRoot, skillName);
    if (!fs.existsSync(path.join(srcDir, "SKILL.md"))) {
      throw new Error(`Bundled skills/${skillName}/SKILL.md not found.`);
    }
    const destDir = path.join(destRoot, skillName);
    fs.mkdirSync(destDir, { recursive: true });
    fs.cpSync(srcDir, destDir, { recursive: true });
    installed.push(path.join(destDir, "SKILL.md"));
  }
  return installed;
}

export function installSkill(options?: {
  target?: SkillTarget;
  cwd?: string;
  homeDir?: string;
}): string {
  const [primary] = installSkills(options);
  return primary;
}
