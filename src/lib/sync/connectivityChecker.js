const TARGETS = [
  "https://github.com",
  "https://api.github.com",
  "https://raw.githubusercontent.com",
];

let _isOnline = null;
let _lastCheck = 0;
const CACHE_TTL = 15000;

export async function checkConnectivity() {
  const now = Date.now();
  if (_lastCheck && now - _lastCheck < CACHE_TTL && _isOnline !== null) {
    return _isOnline;
  }

  for (const target of TARGETS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const resp = await fetch(target, {
        method: "HEAD",
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (resp.ok || resp.status === 301 || resp.status === 302) {
        _isOnline = true;
        _lastCheck = now;
        return true;
      }
    } catch {
      continue;
    }
  }

  _isOnline = false;
  _lastCheck = now;
  return false;
}

export function isOnline() {
  return _isOnline;
}

export function resetConnectivity() {
  _isOnline = null;
  _lastCheck = 0;
}
