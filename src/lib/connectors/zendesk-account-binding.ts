/** Non-secret, explicit account identity; never infer it from a source display name. */
export function zendeskAccountReference(subdomain: string): string {
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain))
    throw new Error("Invalid Zendesk account subdomain");
  return `zendesk-account:${subdomain}`;
}

export function assertZendeskAccountBinding(reference: string | null, subdomain: string): string {
  const expected = zendeskAccountReference(subdomain);
  if (reference !== expected) throw new Error("Zendesk source account binding does not match");
  return expected;
}

export function isZendeskAccountReference(reference: unknown): reference is string {
  return (
    typeof reference === "string" &&
    /^zendesk-account:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(reference)
  );
}
