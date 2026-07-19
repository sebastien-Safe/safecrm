import { assertEquals, assertExists, assert } from "@std/assert";
import { PROVIDERS, PRIORITY, selectProvider } from "./lib.ts";

// ── PROVIDERS ────────────────────────────────────────────────────────────────

Deno.test("PROVIDERS contient exactement 2 fournisseurs", () => {
  assertEquals(Object.keys(PROVIDERS).length, 2);
});

Deno.test("PROVIDERS — chaque entrée a les champs requis", () => {
  for (const [key, p] of Object.entries(PROVIDERS)) {
    assertExists(p.url,    `${key}: url manquante`);
    assertExists(p.model,  `${key}: model manquant`);
    assertExists(p.keyEnv, `${key}: keyEnv manquant`);
    assert(["openai", "anthropic"].includes(p.format), `${key}: format invalide`);
  }
});

Deno.test("PROVIDERS — Grok est format openai", () => {
  assertEquals(PROVIDERS.grok.format, "openai");
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

Deno.test("PRIORITY contient les 2 fournisseurs dans le bon ordre", () => {
  assertEquals(PRIORITY[0], "anthropic");
  assertEquals(PRIORITY[1], "grok");
  assertEquals(PRIORITY.length, 2);
});

Deno.test("PRIORITY — tous les fournisseurs existent dans PROVIDERS", () => {
  for (const key of PRIORITY) {
    assertExists(PROVIDERS[key], `Fournisseur "${key}" dans PRIORITY mais absent de PROVIDERS`);
  }
});

// ── selectProvider ───────────────────────────────────────────────────────────

Deno.test("selectProvider — retourne anthropic si anthropic est le seul actif", () => {
  const rows = [{ service_key: "anthropic" }];
  assertEquals(selectProvider(rows), "anthropic");
});

Deno.test("selectProvider — respecte l'ordre de priorité", () => {
  // anthropic + grok actifs → doit choisir anthropic (priorité 1)
  const rows = [{ service_key: "grok" }, { service_key: "anthropic" }];
  assertEquals(selectProvider(rows), "anthropic");
});

Deno.test("selectProvider — saute un fournisseur inactif", () => {
  // anthropic absent, grok présent → doit choisir grok
  const rows = [{ service_key: "grok" }];
  assertEquals(selectProvider(rows), "grok");
});

Deno.test("selectProvider — retourne undefined si aucun fournisseur actif", () => {
  assertEquals(selectProvider([]), undefined);
});

Deno.test("selectProvider — requestedKey trouvé dans les actifs", () => {
  const rows = [{ service_key: "anthropic" }, { service_key: "grok" }];
  assertEquals(selectProvider(rows, "anthropic"), "anthropic");
});

Deno.test("selectProvider — requestedKey absent des actifs retourne undefined", () => {
  const rows = [{ service_key: "grok" }];
  assertEquals(selectProvider(rows, "anthropic"), undefined);
});

Deno.test("selectProvider — requestedKey inactif ne contourne pas la vérification", () => {
  const rows: Array<{ service_key: string }> = [];
  assertEquals(selectProvider(rows, "grok"), undefined);
});
