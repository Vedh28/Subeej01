function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

export function getApiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

  if (!baseUrl) {
    return normalizedPath;
  }

  return `${normalizeBaseUrl(baseUrl)}${normalizedPath}`;
}
