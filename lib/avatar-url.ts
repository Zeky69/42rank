export function avatarUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith("https://cdn.intra.42.fr/users/")
    ? `/api/avatar?u=${encodeURIComponent(url)}`
    : url;
}
