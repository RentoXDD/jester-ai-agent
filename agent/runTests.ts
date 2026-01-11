import { spawn } from "child_process";

export type TestResult = {
  ok: boolean;
  code: number | null;
  stdout: string;
  stderr: string;
};

export async function runTests(): Promise<TestResult> {
  return new Promise((resolve) => {
    const cmd = process.platform === "win32" ? "npm.cmd" : "npm";
    const args = ["test"];

    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));

    child.on("close", (code) => {
      resolve({
        ok: code === 0,
        code,
        stdout,
        stderr,
      });
    });
  });
}
