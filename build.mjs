import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

const OUT = 'dist';

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

const CSS_FILES = [
  'assets/style.css',
  'assets/pipeline.css',
];

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = `${src}/${entry.name}`, d = `${dest}/${entry.name}`;
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function copyStatic() {
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
  for (const dir of ['icons', 'legal', 'assets/supabase']) {
    if (fs.existsSync(dir)) copyDir(dir, `${OUT}/${dir}`);
  }
  for (const ext of ['png', 'svg', 'webp', 'ico']) {
    for (const f of fs.readdirSync('assets').filter(n => n.endsWith(`.${ext}`))) {
      fs.mkdirSync(`${OUT}/assets`, { recursive: true });
      fs.copyFileSync(`assets/${f}`, `${OUT}/assets/${f}`);
    }
  }
}

async function build() {
  fs.rmSync(OUT, { recursive: true, force: true });

  await esbuild.build({
    entryPoints: JS_FILES,
    outbase: '.',
    outdir: OUT,
    minify: true,
    sourcemap: false,
    target: ['es2020'],
    logLevel: 'info',
  });

  await esbuild.build({
    entryPoints: CSS_FILES,
    outbase: '.',
    outdir: OUT,
    minify: true,
    logLevel: 'info',
  });

  copyStatic();
  console.log(`\n✓ Build terminé → ${OUT}/`);
}

build().catch(e => { console.error(e); process.exit(1); });
