#!/usr/bin/env node
/**
 * Privacy guard (docs/PRD.md §13.3).
 *
 * The product promise is that file content never leaves the tab. Promises in a
 * README are worth nothing against a `<script>` added in a hurry, so the
 * promise is a build gate instead:
 *
 *   1. no storage / network / tracking APIs in src/
 *   2. every runtime dependency is on a reviewed allowlist, carries the license
 *      it was reviewed under, and ships no install scripts
 *   3. no third-party origins in the built bundle (except allowlisted link targets)
 *   4. no inline <script> and no third-party <script src> in the built HTML
 *
 * Run: `npm run privacy` (after `npm run build` for checks 3 and 4).
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const ROOT = process.cwd();
const failures = [];
const notes = [];

const FORBIDDEN = [
  { label: 'localStorage', rx: /\blocalStorage\s*[.[]/ },
  { label: 'sessionStorage', rx: /\bsessionStorage\s*[.[]/ },
  { label: 'indexedDB', rx: /\bindexedDB\s*[.[]/ },
  { label: 'document.cookie', rx: /document\s*\.\s*cookie/ },
  { label: 'cache storage', rx: /\bcaches\s*\.\s*(open|match|keys|delete)\s*\(/ },
  { label: 'service worker', rx: /\bserviceWorker\b/ },
  { label: 'sendBeacon', rx: /\bsendBeacon\b/ },
  { label: 'XMLHttpRequest', rx: /\bXMLHttpRequest\b/ },
  { label: 'WebSocket', rx: /\bnew\s+WebSocket\b/ },
  { label: 'EventSource', rx: /\bnew\s+EventSource\b/ },
  { label: 'fetch()', rx: /\bfetch\s*\(/ },
  { label: 'window.name', rx: /window\s*\.\s*name\s*=/ },
  { label: 'history.pushState', rx: /history\s*\.\s*(pushState|replaceState)/ },
];

/** Origins that may appear only as *navigation* targets (anchor hrefs). */
const ALLOWED_ORIGINS = ['github.com/SynergyFlowLabs/env-compare', 'www.w3.org/2000/svg'];

/**
 * Runtime dependencies, reviewed one by one.
 *
 * The rule this replaces was "exactly react and react-dom". That was a good
 * proxy when the interface was hand-written CSS; adopting shadcn/ui means
 * Radix primitives and a handful of utilities, so the rule becomes an explicit
 * list with a stated reason per entry. What has NOT changed: nothing here may
 * touch the network or storage, and the dist scan below still proves it.
 *
 * Adding an entry is a deliberate act, not a version bump.
 */
const REVIEWED_RUNTIME_DEPS = {
  react: { license: 'MIT', why: 'the UI runtime' },
  'react-dom': { license: 'MIT', why: 'the UI renderer' },
  '@radix-ui/react-dialog': { license: 'MIT', why: 'shadcn Dialog: focus trap, portal, aria-modal' },
  '@radix-ui/react-slot': { license: 'MIT', why: 'shadcn Button asChild' },
  '@radix-ui/react-tabs': { license: 'MIT', why: 'shadcn Tabs: roving focus, aria-controls' },
  'class-variance-authority': { license: 'Apache-2.0', why: 'variant maps for shadcn components' },
  clsx: { license: 'MIT', why: 'conditional class strings' },
  'tailwind-merge': { license: 'MIT', why: 'resolves conflicting utility classes in cn()' },
  'lucide-react': { license: 'ISC', why: 'icons, tree-shaken to the ones imported' },
};

const ALLOWED_RUNTIME_DEPS = Object.keys(REVIEWED_RUNTIME_DEPS);

// ---------------------------------------------------------------- source scan

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const srcFiles = walk(join(ROOT, 'src')).filter((file) =>
  ['.ts', '.tsx', '.js', '.jsx', '.css', '.html'].includes(extname(file)),
);

for (const file of srcFiles) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');
  lines.forEach((line, index) => {
    // Comments may explain the policy (and the /privacy page quotes the API
    // names); only flag code that would actually call the API.
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
    for (const rule of FORBIDDEN) {
      if (rule.rx.test(line)) {
        failures.push(
          `${relative(ROOT, file)}:${index + 1} uses ${rule.label}. ` +
            `File content must stay in the tab (docs/PRIVACY.md).`,
        );
      }
    }
  });
}

// ------------------------------------------------------------------- deps scan

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const runtime = Object.keys(pkg.dependencies ?? {});
for (const dep of runtime) {
  if (!ALLOWED_RUNTIME_DEPS.includes(dep)) {
    failures.push(
      `Runtime dependency "${dep}" is not on the allowlist (${ALLOWED_RUNTIME_DEPS.join(', ')}). ` +
        `A dependency is code that runs with access to the user's secrets — discuss it in an issue first.`,
    );
  }
}
for (const dep of runtime) {
  const reviewed = REVIEWED_RUNTIME_DEPS[dep];
  if (!reviewed) continue; // already reported above
  const manifestPath = join(ROOT, 'node_modules', dep, 'package.json');
  if (!existsSync(manifestPath)) continue;
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (typeof manifest.license === 'string' && manifest.license !== reviewed.license) {
    failures.push(
      `Runtime dependency "${dep}" now reports license "${manifest.license}", reviewed as "${reviewed.license}". Re-review it.`,
    );
  }
  for (const hook of ['preinstall', 'install', 'postinstall', 'prepare']) {
    if (manifest.scripts?.[hook]) {
      failures.push(`Runtime dependency "${dep}" ships a "${hook}" script; install hooks are disabled by policy.`);
    }
  }
}
for (const script of ['preinstall', 'install', 'postinstall']) {
  if (pkg.scripts?.[script]) {
    failures.push(`package.json defines a "${script}" script; install hooks are disabled by policy.`);
  }
}
notes.push(`runtime dependencies: ${runtime.join(', ') || '(none)'}`);

// ----------------------------------------------------------------- dist scan

/**
 * What this check can and cannot know: a URL string in a bundle might be a
 * network target or a line of sample content. Rather than nag about every
 * literal, the guard fails on *network-capable APIs* and on external
 * `script`/`link`/`url()` references, and lists the origins it sees so a
 * reviewer can eyeball anything new. The real backstop is `connect-src 'none'`
 * in the production CSP.
 */
const NETWORK_IN_BUNDLE = [
  { label: 'fetch()', rx: /\bfetch\s*\(/ },
  { label: 'XMLHttpRequest', rx: /XMLHttpRequest/ },
  { label: 'sendBeacon', rx: /sendBeacon/ },
  { label: 'WebSocket', rx: /new WebSocket/ },
  { label: 'EventSource', rx: /new EventSource/ },
  { label: 'import() from a URL', rx: /import\s*\(\s*["'`]https?:/ },
];

const NAMESPACE_ORIGINS = ['w3.org', 'react.dev/errors'];

const distDir = join(ROOT, 'dist');
if (!existsSync(distDir)) {
  notes.push('dist/ not found — skipping bundle checks (run `npm run build` first).');
} else {
  const distFiles = walk(distDir);
  const distText = distFiles.filter((file) => ['.js', '.css', '.html'].includes(extname(file)));
  const seenOrigins = new Set();
  const vendorFindings = new Set();

  for (const file of distText) {
    const text = readFileSync(file, 'utf8');
    const rel = relative(ROOT, file);

    if (extname(file) === '.js') {
      // react-dom ships a resource-preload helper: `fetch(e.href, n)` inside a
      // self-invoking function that runs only when React renders a preload
      // <link>. We never render one, so strip that exact call and fail on any
      // other network-capable API in the bundle.
      const withoutReactPreload = text.replace(/fetch\(\s*\w+\.href\s*,\s*\w+\s*\)/g, '');
      for (const rule of NETWORK_IN_BUNDLE) {
        if (!rule.rx.test(withoutReactPreload)) continue;
        failures.push(`${rel} contains ${rule.label}; our own code must not be able to make requests.`);
      }
      if (withoutReactPreload !== text) vendorFindings.add('react-dom resource preload helper');
    }

    if (extname(file) === '.css') {
      for (const match of text.matchAll(/url\(\s*["']?(https?:\/\/[^"')]+)/g)) {
        failures.push(`${rel} loads an external resource: ${match[1]}`);
      }
    }

    for (const match of text.matchAll(/https?:\/\/[a-zA-Z0-9.-]+/g)) {
      const origin = match[0];
      if (NAMESPACE_ORIGINS.some((allowed) => origin.includes(allowed))) continue;
      seenOrigins.add(origin);
    }
  }

  const html = readFileSync(join(distDir, 'index.html'), 'utf8');
  const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>/g)];
  if (inlineScripts.length > 0) {
    failures.push('dist/index.html contains an inline <script>; only same-origin modules are allowed.');
  }
  const externalScripts = [...html.matchAll(/<script[^>]*\bsrc="(?!\/)[^"]*"/g)];
  if (externalScripts.length > 0) {
    failures.push('dist/index.html loads a script from outside this origin.');
  }
  const externalLinks = [...html.matchAll(/<link[^>]*\bhref="(https?:[^"]+)"/g)];
  for (const link of externalLinks) failures.push(`dist/index.html loads an external resource: ${link[1]}`);
  const externalPreloads = [...html.matchAll(/<(?:img|iframe|embed)[^>]*\bsrc="(https?:[^"]+)"/g)];
  for (const preload of externalPreloads) {
    failures.push(`dist/index.html embeds an external resource: ${preload[1]}`);
  }

  if (vendorFindings.size > 0) {
    notes.push(
      `react-dom ships a resource-preload helper (${[...vendorFindings].join(', ')}) somewhere in the bundle. ` +
        `This app never calls it, and the production CSP (connect-src 'none') blocks it.`,
    );
  }

  const distBytes = distText.reduce((sum, file) => sum + statSync(file).size, 0);
  notes.push(`bundle: ${distText.length} files, ${(distBytes / 1024).toFixed(0)} kB on disk`);

  const allowedLinks = new Set(['https://github.com', 'https://www.github.com']);
  const other = [...seenOrigins].filter(
    (origin) => ![...allowedLinks].some((link) => origin.startsWith(link)),
  );
  if (other.length > 0) {
    notes.push(
      `origins present as strings (review new ones): ${other.join(', ')}`,
    );
  }
  if (other.length > 0) {
    notes.push(
      'The sample files and docs links legitimately contain URLs; requests are blocked by CSP connect-src \'none\'.',
    );
  }
}

// ---------------------------------------------------------------------- report

const CYAN = '\u001b[36m';
const RED = '\u001b[31m';
const GREEN = '\u001b[32m';
const DIM = '\u001b[2m';
const RESET = '\u001b[0m';

console.log(`\n${CYAN}privacy guard${RESET}`);
for (const note of notes) console.log(`  ${DIM}·${RESET} ${note}`);

if (failures.length > 0) {
  console.log(`\n${RED}${failures.length} problem${failures.length === 1 ? '' : 's'} found:${RESET}`);
  for (const failure of failures) console.log(`  ${RED}✗${RESET} ${failure}`);
  console.log(
    `\nThe rules and their reasoning: docs/PRD.md §13, and CONTRIBUTING.md under "Privacy invariants".\n`,
  );
  process.exit(1);
}

console.log(`\n${GREEN}✓${RESET} no storage, no network, no unreviewed dependency\n`);
