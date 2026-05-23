import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const checks = [
  {
    path: 'apps/web/app/imprint/page.tsx',
    label: 'Impressum',
    blockers: [
      ['operator placeholders', /\[(Firmierung|Straße Hausnummer|PLZ Ort|Vor- und Nachname|HRB-Nummer|Amtsgericht|DE X+)/],
      ['go-live TODO comments', /TODO:\s*(Vollständige Anschrift|Geschäftsführung|Handelsregister|Redaktionell)/],
      ['placeholder warning block', /PLACEHOLDER/],
    ],
  },
  {
    path: 'apps/web/app/privacy/page.tsx',
    label: 'Datenschutzerklärung',
    blockers: [
      ['boilerplate disclaimer', /Boilerplate-Starter|anwaltlich \+ DPO prüfen/],
    ],
  },
  {
    path: 'apps/web/app/terms/page.tsx',
    label: 'AGB',
    blockers: [
      ['boilerplate disclaimer', /Boilerplate-Starting-Point|MUSS dieser von einem Anwalt/],
    ],
  },
];

const failures = [];

console.log('Legal readiness check');
console.log('No secret values are printed.');
console.log(`Root: ${repoRoot}`);

for (const check of checks) {
  const absolutePath = path.join(repoRoot, check.path);
  if (!fs.existsSync(absolutePath)) {
    failures.push(`[${check.label}] Missing required public legal page: ${check.path}`);
    continue;
  }

  const text = fs.readFileSync(absolutePath, 'utf8');
  const matched = check.blockers
    .filter(([, pattern]) => pattern.test(text))
    .map(([label]) => label);

  if (matched.length > 0) {
    failures.push(`[${check.label}] Not launch-ready: ${matched.join(', ')} in ${check.path}`);
  } else {
    console.log(`  - ${check.label}: OK`);
  }
}

if (failures.length > 0) {
  console.log('');
  console.error('Legal readiness check failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  console.error('');
  console.error('Fill real operator/legal details and get legal review before inviting broader public users.');
  process.exit(1);
}

console.log('');
console.log('Legal readiness check passed.');
