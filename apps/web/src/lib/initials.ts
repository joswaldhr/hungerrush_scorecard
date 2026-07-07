// The one initials computation (D4) — first + last name letters, e.g. "James Oswald" → "JO".
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0];
  const last = parts.length >= 2 ? parts[parts.length - 1] : undefined;
  if (first && last) return (first.charAt(0) + last.charAt(0)).toUpperCase();
  return first ? first.charAt(0).toUpperCase() : '?';
}
