export function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error('Destination URL is required.');

  // A hostname with a port is not a URL scheme.
  const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(trimmed) && !/^(?:localhost|[^/:\s]+\.[^/:\s]+|\[[^\]]+\]):\d+(?:[/?#]|$)/i.test(trimmed);
  const candidate = hasScheme ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error('Enter a valid destination URL.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only HTTP and HTTPS destinations are supported.');
  }
  return url.toString();
}

export function parseClickLimit(value: string): number | null {
  if (!value.trim()) return null;
  const limit = Number(value);
  if (!Number.isSafeInteger(limit) || limit < 1) {
    throw new Error('Click limit must be a whole number greater than zero.');
  }
  return limit;
}
