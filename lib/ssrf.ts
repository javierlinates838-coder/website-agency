const BLOCKED_HOSTS = new Set(["localhost", "0.0.0.0", "::1", "ip6-localhost"]);

function isPrivateIPv4(host: string): boolean {
  const parts = host.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return false;
  }
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

export function assertPublicHttpUrl(raw: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("That website URL is not valid.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http(s) websites can be scanned.");
  }

  const host = parsed.hostname.toLowerCase().replace(/\[|\]/g, "").replace(/\.+$/, "");
  if (BLOCKED_HOSTS.has(host) || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("Private hosts cannot be scanned.");
  }
  if (isPrivateIPv4(host)) {
    throw new Error("Private hosts cannot be scanned.");
  }
  if (host.includes(":")) {
    if (host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80")) {
      throw new Error("Private hosts cannot be scanned.");
    }
  }

  return parsed;
}
