import fs from "fs";
import path from "path";

/**
 * A very simple unified-diff patcher.
 * Supports only whole-file replacement (not line-by-line) when the model returns full content.
 *
 * Format:
 * --- a/path/to/file.ts
 * +++ b/path/to/file.ts
 * @@
 * <full new file content>
 *
 * ✅ This is more reliable than trying to do a line-by-line patch.
 */

export type PatchFile = {
  filePath: string;
  content: string;
};

export function parsePatchToFiles(patch: string): PatchFile[] {
  const blocks = patch.split(/^--- /m).filter(Boolean);

  const files: PatchFile[] = [];

  for (const block of blocks) {
    // block starts with "a/file"
    const lines = block.split("\n");
    const first = lines[0].trim(); // "a/xxx"
    const filePath = first.replace(/^a\//, "").trim();

    // find the "+++"
    const plusIndex = lines.findIndex((l) => l.startsWith("+++ "));
    if (plusIndex === -1) continue;

    // full content goes after @@
    const atIndex = lines.findIndex((l) => l.startsWith("@@"));
    if (atIndex === -1) continue;

    const newContent = lines.slice(atIndex + 1).join("\n").trimStart();

    files.push({
      filePath,
      content: newContent,
    });
  }

  return files;
}

export function applyPatchFiles(projectRoot: string, patchFiles: PatchFile[]) {
  for (const pf of patchFiles) {
    const fullPath = path.join(projectRoot, pf.filePath);
    const dir = path.dirname(fullPath);

    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fullPath, pf.content, "utf8");

    console.log(`[PATCH] Updated: ${pf.filePath}`);
  }
}
