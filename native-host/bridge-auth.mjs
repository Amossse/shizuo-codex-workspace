import { timingSafeEqual } from "node:crypto";

export function normalizedRemoteAddress(value) {
  const address = String(value || "").toLowerCase();
  return address.startsWith("::ffff:") ? address.slice(7) : address;
}

export function isLoopbackAddress(value) {
  const address = normalizedRemoteAddress(value);
  return address === "127.0.0.1" || address === "::1";
}

export function tokenMatches(received, expected) {
  const left = Buffer.from(String(received || ""));
  const right = Buffer.from(String(expected || ""));
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
}

export function authorizeBridgeClient(token, config, remoteAddress) {
  if (tokenMatches(token, config?.token)) {
    // 主令牌拥有全部白板权限，只能留在本机回环地址。
    return isLoopbackAddress(remoteAddress)
      ? { id: "owner-local", boardId: "", lan: false }
      : null;
  }
  const client = (Array.isArray(config?.clients) ? config.clients : [])
    .find(entry => tokenMatches(token, entry?.token));
  return client
    ? { id: String(client.id), boardId: String(client.boardId), lan: !isLoopbackAddress(remoteAddress) }
    : null;
}
