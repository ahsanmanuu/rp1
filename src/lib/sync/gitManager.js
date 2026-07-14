import { execSync } from "child_process";

function runGit(args, cwd) {
  try {
    return execSync(`git ${args}`, {
      cwd: cwd || process.cwd(),
      encoding: "utf-8",
      timeout: 30000,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (err) {
    if (err.stderr) {
      const stderr = err.stderr.toString().trim();
      if (stderr) throw new Error(stderr);
    }
    throw err;
  }
}

export function getCurrentBranch() {
  try {
    return runGit("rev-parse --abbrev-ref HEAD");
  } catch {
    return "unknown";
  }
}

export function getStatus() {
  try {
    const branch = getCurrentBranch();
    const raw = runGit("status --porcelain");
    const files = raw
      .split("\n")
      .filter(Boolean)
      .map((line) => ({
        status: line.substring(0, 2).trim(),
        path: line.substring(3).trim(),
      }));
    const hasChanges = files.length > 0;

    let ahead = 0;
    let behind = 0;
    try {
      const branchStatus = runGit(`rev-list --left-right --count origin/${branch}...HEAD`);
      const parts = branchStatus.split("\t");
      if (parts.length === 2) {
        behind = parseInt(parts[0], 10) || 0;
        ahead = parseInt(parts[1], 10) || 0;
      }
    } catch {
    }

    return { hasChanges, files, branch, ahead, behind };
  } catch (err) {
    return { hasChanges: false, files: [], branch: "unknown", ahead: 0, behind: 0 };
  }
}

export function stageAll() {
  try {
    runGit("add -A");
    return true;
  } catch (err) {
    console.error("[GitManager] Failed to stage files:", err.message);
    return false;
  }
}

export function commit(message) {
  try {
    runGit(`commit -m "${message.replace(/"/g, '\\"')}"`);
    return true;
  } catch (err) {
    if (err.message?.includes("nothing to commit") || err.message?.includes("no changes")) {
      return true;
    }
    console.error("[GitManager] Failed to commit:", err.message);
    return false;
  }
}

export function pull(branch) {
  try {
    const targetBranch = branch || getCurrentBranch();
    runGit(`pull origin ${targetBranch} --no-rebase --autostash`);
    return true;
  } catch (err) {
    console.error("[GitManager] Failed to pull:", err.message);
    return false;
  }
}

export function push(branch) {
  try {
    const targetBranch = branch || getCurrentBranch();
    runGit(`push origin ${targetBranch}`);
    return true;
  } catch (err) {
    console.error("[GitManager] Failed to push:", err.message);
    return false;
  }
}

export function getLastCommitMessage() {
  try {
    return runGit("log -1 --pretty=%B");
  } catch {
    return "";
  }
}

export function getLastCommitTimestamp() {
  try {
    return runGit("log -1 --pretty=%cI");
  } catch {
    return "";
  }
}

export function hasRemoteOrigin() {
  try {
    runGit("remote get-url origin");
    return true;
  } catch {
    return false;
  }
}

export function getDiffSummary() {
  try {
    return runGit("diff --stat HEAD");
  } catch {
    return "";
  }
}

export function getPendingCommitCount() {
  try {
    const branch = getCurrentBranch();
    const raw = runGit(`rev-list --count HEAD ^origin/${branch}`);
    return parseInt(raw, 10) || 0;
  } catch {
    return 0;
  }
}
