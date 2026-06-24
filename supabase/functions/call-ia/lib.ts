// Logique pure de call-ia — importable depuis index.ts et testable avec Deno.test.

export type ProviderFormat = "openai" | "anthropic";

export interface Provider {
  url: string;
  model: string;
  keyEnv: string;
  format: ProviderFormat;
}

export const PROVIDERS: Record<string, Provider> = {
  groq:      { url: "https://api.groq.com/openai/v1/chat/completions", model: "llama-3.3-70b-versatile",   keyEnv: "GROQ_API_KEY",      format: "openai"    },
  grok:      { url: "https://api.x.ai/v1/chat/completions",            model: "grok-3-mini",               keyEnv: "GROK_API_KEY",      format: "openai"    },
  anthropic: { url: "https://api.anthropic.com/v1/messages",           model: "claude-haiku-4-5-20251001", keyEnv: "ANTHROPIC_API_KEY", format: "anthropic" },
  mistral:   { url: "https://api.mistral.ai/v1/chat/completions",      model: "mistral-small-latest",      keyEnv: "MISTRAL_API_KEY",   format: "openai"    },
};

export const PRIORITY = ["groq", "grok", "anthropic", "mistral"] as const;

/** Retourne la clé du premier fournisseur actif selon l'ordre de priorité. */
export function selectProvider(
  activeRows: Array<{ service_key: string }>,
  requestedKey?: string,
): string | undefined {
  if (requestedKey) {
    return activeRows.find(r => r.service_key === requestedKey) ? requestedKey : undefined;
  }
  for (const key of PRIORITY) {
    if (activeRows.find(r => r.service_key === key)) return key;
  }
  return undefined;
}
