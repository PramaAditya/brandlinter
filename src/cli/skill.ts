import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

export type SkillTarget = "agents" | "claude" | "omp" | "cursor";

const VALID_TARGETS: Record<SkillTarget, true> = {
  agents: true,
  claude: true,
  omp: true,
  cursor: true,
};

export function resolveBundledSkillPath(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(here, "../../skills/brandlinter/SKILL.md"),
    path.resolve(here, "../skills/brandlinter/SKILL.md"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error("Bundled skills/brandlinter/SKILL.md not found.");
}

export function installSkill(options?: {
  target?: SkillTarget;
  cwd?: string;
  homeDir?: string;
}): string {
  const target = options?.target ?? "agents";
  if (!(target in VALID_TARGETS)) {
    throw new Error(`Invalid skill target "${target}". Valid values: agents, claude, omp, cursor`);
  }

  const cwd = options?.cwd ?? process.cwd();
  const home = options?.homeDir ?? os.homedir();

  let destDir: string;
  switch (target) {
    case "agents":
      destDir = path.join(cwd, ".agents", "skills", "brandlinter");
      break;
    case "cursor":
      destDir = path.join(cwd, ".cursor", "skills", "brandlinter");
      break;
    case "claude":
      destDir = path.join(home, ".claude", "skills", "brandlinter");
      break;
    case "omp":
      destDir = path.join(home, ".omp", "agent", "skills", "brandlinter");
      break;
  }

  const src = resolveBundledSkillPath();
  fs.mkdirSync(destDir, { recursive: true });
  const dest = path.join(destDir, "SKILL.md");
  fs.copyFileSync(src, dest);
  return dest;
}
