import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import path from "node:path";

export const workspacePath = (root: string) => path.join(root, ".fde");

export async function ensureWorkspace(root: string): Promise<string> {
  const base = workspacePath(root);
  const dirs = [
    base,
    path.join(base, "environment"),
    path.join(base, "architecture", "decisions"),
    path.join(base, "policies"),
    path.join(base, "evals"),
    path.join(base, "evidence"),
    path.join(base, "handoff"),
    path.join(base, "learnings")
  ];
  await Promise.all(dirs.map((dir) => mkdir(dir, { recursive: true })));
  return base;
}

export async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

export async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
