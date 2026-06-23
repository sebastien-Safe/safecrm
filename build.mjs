/**
 * S@FE CRM — Script de build (minification esbuild)
 * Usage : npm run build
 *         node build.mjs --watch
 *
 * Sortie : dist/ (même arborescence que la racine)
 * GitHub Pages : déployer depuis dist/ via GitHub Actions
 */

import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

const WATCH = process.argv.includes('--watch');
const OUT   = 'dist';

// ── Fichiers JS à minifier ──────────────────────────────────
const JS_FILES = [
  'assets/app.js',
  'assets/app-init.js',
  'assets/config.js',
  'assets/pipeline.js',
  'assets/app/authentification.js',
  'assets/app/chargement-des-donnees.js',
  'assets/app/contacts.js',
  'assets/app/contrats.js',
  'assets/app/helpers.js',
  'assets/app/navgation.js',
  'assets/contacts/contacts-address.js',
  'assets/contacts/contacts-interactions.js',
  'assets/contacts/contacts-transfer.js',
  'assets/contacts/contacts-ui.js',
  'assets/contacts/contacts.js',
  'assets/contacts/contacts.service.js',
  'assets/contacts/index.js',
  'assets/contracts/contracts-formulas.js',
  'assets/contracts/contracts-notifications.js',
  'assets/contracts/contracts-pdf.js',
  'assets/contracts/contracts-stripe.js',
  'assets/contracts/contracts-ui.js',
  'assets/contracts/contracts.js',
  'assets/contracts/contracts.service.js',
  'assets/contracts/index.js',
  'assets/tasks/tasks.js',
  'assets/totp/totp.js',
  'assets/dpo/connectors-guard.js',
  'assets/dpo/dpo-client-crm.js',
  'assets/help/help-content.js',
  'assets/help/help.js',
  'assets/rgpd/rgpd-journal.js',
];

// ── Fichiers CSS à minifier ─────────────────────────────────
const CSS_FILES = [
  'assets/style.css',
  'assets/pipeline.css',
];

// ── Fichiers/dossiers statiques à copier tels quels ─────────
const STATIC_GLOBS = [
  'index.html',
  'clause.html',
  'clause-public.html',
  'mandat.html',
  'order.html',
  'sw.js',
  'manifest.json',
  'CNAME',
  'favicon.png',
  'assets/*.png',
  'assets/*.svg',
  'assets/*.webp',
  'assets/supabase/**/*',
  'legal/**/*',
  'icons/**/*',
];

async function copyStatic() {
  const { glob } = await import('fs/promises').then(() => ({ glob: null }));
  // fallback manuel : copie les fichiers statiques connus
  const staticFiles = [
    'index.html', 'clause.html', 'clause-public.html', 'mandat.html',
    'order.html', 'sw.js', 'manifest.json', 'CNAME', 'favicon.png',
  ];
  for (const f of staticFiles) {
    if (fs.existsSync(f)) {
      fs.mkdirSync(path.dirname(`${OUT}/${f}`), { recursive: true });
      fs.copyFileSync(f, `${OUT}/${f}`);
    }
  }
  // Copier dossiers complets
  for (const dir of ['icons', 'legal', 'assets/supabase']) {
    if (fs.existsSync(dir)) copyDir(dir, `${OUT}/${dir}`);
  }
  // Copier images dans assets/
  for (const ext of ['png', 'svg', 'webp', 'ico']) {
    for (const f of fs.readdirSync('assets').filter(n => n.endsWith(`.${ext}`))) {
      fs.mkdirSync(`${OUT}/assets`, { recursive: true });
      fs.copyFileSync(`assets/${f}`, `${OUT}/assets/${f}`);
    }
  }
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = `${src}/${entry.name}`, d = `${dest}/${entry.name}`;
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

async function build() {
  fs.rmSync(OUT, { recursive: true, force: true });

  const jsCtx = await esbuild.context({
    entryPoints: JS_FILES,
    outbase: '.',
    outdir: OUT,
    minify: true,
    sourcemap: false,
    target: ['es2020'],
    logLevel: 'info',
  });

  const cssCtx = await esbuild.context({
    entryPoints: CSS_FILES,
    outbase: '.',
    outdir: OUT,
    minify: true,
    logLevel: 'info',
  });

  if (WATCH) {
    await jsCtx.watch();
    await cssCtx.watch();
    console.log('[watch] En attente de modifications…');
  } else {
    await jsCtx.rebuild();
    await cssCtx.rebuild();
    await jsCtx.dispose();
    await cssCtx.dispose();
    await copyStatic();
    console.log(`\n✓ Build terminé → ${OUT}/`);
  }
}

build().catch(e => { console.error(e); process.exit(1); });
