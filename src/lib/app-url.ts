export function getAppOrigin(request?: Request) {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");

  if (configuredUrl && process.env.NODE_ENV !== "development") {
    return configuredUrl;
  }

  if (!request) {
    return configuredUrl || "http://localhost:3000";
  }

  const requestUrl = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";

  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  return requestUrl.origin;
}

export function safeNextPath(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/";
  }

  return next;
}
