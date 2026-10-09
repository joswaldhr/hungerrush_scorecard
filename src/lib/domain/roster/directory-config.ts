import { env } from "@/lib/env";

export function directoryBinding() {
  return env.ENTRA_ROSTER_SOURCE_ID && env.ENTRA_TENANT_ID
    ? { sourceId: env.ENTRA_ROSTER_SOURCE_ID, tenantId: env.ENTRA_TENANT_ID }
    : null;
}

export function directoryConfig() {
  const binding = directoryBinding();
  if (!binding || !env.ENTRA_CLIENT_ID || !env.ENTRA_CLIENT_SECRET) return null;
  return {
    sourceId: binding.sourceId,
    credentials: {
      tenantId: binding.tenantId,
      clientId: env.ENTRA_CLIENT_ID,
      clientSecret: env.ENTRA_CLIENT_SECRET,
    },
  };
}
