import { mkdir, writeFile, readFile, access, readdir } from "node:fs/promises";
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

/** Reads every parseable *.json in a directory (skipping index.json). */
export async function readJsonDir<T>(dir: string): Promise<T[]> {
  if (!(await exists(dir))) return [];
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json") && f !== "index.json").sort();
  const items: T[] = [];
  for (const file of files) {
    try {
      items.push(await readJson<T>(path.join(dir, file)));
    } catch {
      // unreadable artifact — skip rather than fail the caller
    }
  }
  return items;
}
