import { assertEquals, assertExists, assert } from "jsr:@std/assert";
import { PROVIDERS, PRIORITY, selectProvider } from "./lib.ts";

// ── PROVIDERS ────────────────────────────────────────────────────────────────

Deno.test("PROVIDERS contient exactement 4 fournisseurs", () => {
  assertEquals(Object.keys(PROVIDERS).length, 4);
});

Deno.test("PROVIDERS — chaque entrée a les champs requis", () => {
  for (const [key, p] of Object.entries(PROVIDERS)) {
    assertExists(p.url,    `${key}: url manquante`);
    assertExists(p.model,  `${key}: model manquant`);
    assertExists(p.keyEnv, `${key}: keyEnv manquant`);
    assert(["openai", "anthropic"].includes(p.format), `${key}: format invalide`);
  }
});

Deno.test("PROVIDERS — Groq est format openai", () => {
  assertEquals(PROVIDERS.groq.format, "openai");
});

Deno.test("PROVIDERS — Anthropic est format anthropic", () => {
  assertEquals(PROVIDERS.anthropic.format, "anthropic");
});

Deno.test("PROVIDERS — URLs sont des HTTPS valides", () => {
  for (const [key, p] of Object.entries(PROVIDERS)) {
    assert(p.url.startsWith("https://"), `${key}: URL doit être HTTPS`);
  }
});

// ── PRIORITY ─────────────────────────────────────────────────────────────────

Deno.test("PRIORITY contient les 4 fournisseurs dans le bon ordre", () => {
  assertEquals(PRIORITY[0], "groq");
  assertEquals(PRIORITY[1], "grok");
  assertEquals(PRIORITY[2], "anthropic");
  assertEquals(PRIORITY[3], "mistral");
  assertEquals(PRIORITY.length, 4);
});

Deno.test("PRIORITY — tous les fournisseurs existent dans PROVIDERS", () => {
  for (const key of PRIORITY) {
    assertExists(PROVIDERS[key], `Fournisseur "${key}" dans PRIORITY mais absent de PROVIDERS`);
  }
});

// ── selectProvider ───────────────────────────────────────────────────────────

Deno.test("selectProvider — retourne groq si groq est le seul actif", () => {
  const rows = [{ service_key: "groq" }];
  assertEquals(selectProvider(rows), "groq");
});

Deno.test("selectProvider — respecte l'ordre de priorité", () => {
  // groq + mistral actifs → doit choisir groq (priorité 1)
  const rows = [{ service_key: "mistral" }, { service_key: "groq" }];
  assertEquals(selectProvider(rows), "groq");
});

Deno.test("selectProvider — saute un fournisseur inactif", () => {
  // groq absent, grok présent → doit choisir grok
  const rows = [{ service_key: "grok" }, { service_key: "mistral" }];
  assertEquals(selectProvider(rows), "grok");
});

Deno.test("selectProvider — retourne undefined si aucun fournisseur actif", () => {
  assertEquals(selectProvider([]), undefined);
});

Deno.test("selectProvider — requestedKey trouvé dans les actifs", () => {
  const rows = [{ service_key: "anthropic" }, { service_key: "mistral" }];
  assertEquals(selectProvider(rows, "anthropic"), "anthropic");
});

Deno.test("selectProvider — requestedKey absent des actifs retourne undefined", () => {
  const rows = [{ service_key: "mistral" }];
  assertEquals(selectProvider(rows, "groq"), undefined);
});

Deno.test("selectProvider — requestedKey inactif ne contourne pas la vérification", () => {
  const rows: Array<{ service_key: string }> = [];
  assertEquals(selectProvider(rows, "groq"), undefined);
});
