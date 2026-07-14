import fs from "fs";
import path from "path";

const QUEUE_FILE = path.resolve(process.cwd(), ".sync-queue.json");

function getQueueFilePath() {
  return QUEUE_FILE;
}

function readQueue() {
  try {
    const filePath = getQueueFilePath();
    if (!fs.existsSync(filePath)) {
      return { entries: [], createdAt: Date.now(), updatedAt: Date.now() };
    }
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { entries: [], createdAt: Date.now(), updatedAt: Date.now() };
  }
}

function writeQueue(queue) {
  try {
    queue.updatedAt = Date.now();
    fs.writeFileSync(getQueueFilePath(), JSON.stringify(queue, null, 2), "utf-8");
  } catch (err) {
    console.error("[SyncQueue] Failed to write queue file:", err);
  }
}

export function enqueue(entry) {
  const queue = readQueue();
  const existing = queue.entries.find(
    (e) => e.relativePath === entry.relativePath && e.action === entry.action && e.attempts < e.maxAttempts
  );
  if (existing) {
    existing.timestamp = Date.now();
    writeQueue(queue);
    return;
  }
  queue.entries.push({
    ...entry,
    id: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    attempts: 0,
    maxAttempts: 5,
  });
  writeQueue(queue);
}

export function dequeue() {
  const queue = readQueue();
  if (queue.entries.length === 0) return null;
  const entry = queue.entries[0];
  queue.entries.shift();
  writeQueue(queue);
  return entry;
}

export function peek() {
  const queue = readQueue();
  return queue.entries.length > 0 ? queue.entries[0] : null;
}

export function markFailed(entry) {
  const queue = readQueue();
  entry.attempts += 1;
  if (entry.attempts >= entry.maxAttempts) {
    entry.error = `Exhausted after ${entry.maxAttempts} attempts`;
    queue.entries.push(entry);
  } else {
    queue.entries.push(entry);
  }
  writeQueue(queue);
}

export function getQueueLength() {
  return readQueue().entries.length;
}

export function getAllEntries() {
  return readQueue().entries;
}

export function clearQueue() {
  writeQueue({ entries: [], createdAt: Date.now(), updatedAt: Date.now() });
}

export function removeByRelativePath(relativePath) {
  const queue = readQueue();
  queue.entries = queue.entries.filter((e) => e.relativePath !== relativePath);
  writeQueue(queue);
}
