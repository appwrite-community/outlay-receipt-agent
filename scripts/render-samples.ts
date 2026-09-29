/**
 * Renders the fictional receipts: the six files in samples/ that you can drop into
 * the app, and one receipt for every seeded expense in scripts/seed-data/receipts/.
 * The rendered files are committed, so you only need this after changing the data.
 *
 *   pnpm exec playwright install chromium
 *   pnpm samples
 */
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { type Browser, chromium } from 'playwright';
import data from './seed-data/expenses.json' with { type: 'json' };
import {
  type Profile,
  type Receipt,
  type Scene,
  type ThermalOptions,
  emailReceipt,
  invoice,
  page,
  printPage,
  stickyNote,
  thermal,
} from './receipts/templates.ts';

const ROOT = join(import.meta.dirname, '..');
const SAMPLES = join(ROOT, 'samples');
const SEED_RECEIPTS = join(ROOT, 'scripts/seed-data/receipts');
const merchants = data.merchants as Record<string, Profile>;

type Seeded = Receipt & { owner: string; file: string; template: string; profile: string };

/** Height of a rendered document, used to fit it into a photo frame. */
async function measure(browser: Browser, body: string): Promise<{ width: number; height: number }> {
  const tab = await browser.newPage({ viewport: { width: 900, height: 1200 } });
  await tab.setContent(page(body, 'scan', { width: 900, height: 1200 }), { waitUntil: 'load' });
  await tab.evaluate(() => document.fonts.ready);
  const box = await tab.locator('.stage > *').boundingBox();
  await tab.close();
  if (!box) throw new Error('Nothing rendered');
  return { width: box.width, height: box.height };
}

/** A flat capture with a small margin, like a scanner or a screenshot. */
async function renderScan(browser: Browser, body: string, path: string, scale = 2): Promise<void> {
  const size = await measure(browser, body);
  const width = Math.ceil(size.width + 56);
  const height = Math.ceil(size.height + 56);
  const tab = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale });
  await tab.setContent(page(body, 'scan', { width, height }), { waitUntil: 'load' });
  await tab.evaluate(() => document.fonts.ready);
  await tab.screenshot({ path, ...(path.endsWith('.jpg') ? { type: 'jpeg', quality: 84 } : { type: 'png' }) });
  await tab.close();
}

/** A tilted document on a surface, like a phone photo. */
async function renderPhoto(
  browser: Browser,
  body: string,
  path: string,
  { scene, width, height, scale, fill = 0.86 }: { scene: Scene; width: number; height: number; scale: number; fill?: number },
): Promise<void> {
  const size = await measure(browser, body);
  const fit = Math.min((height * fill) / size.height, (width * fill) / size.width);
  const tab = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale });
  await tab.setContent(page(body, scene, { width, height }, fit), { waitUntil: 'load' });
  await tab.evaluate(() => document.fonts.ready);
  await tab.screenshot({ path, ...(path.endsWith('.jpg') ? { type: 'jpeg', quality: 86 } : { type: 'png' }) });
  await tab.close();
}

async function renderPdf(browser: Browser, body: string, path: string): Promise<void> {
  const tab = await browser.newPage();
  await tab.setContent(printPage(body), { waitUntil: 'load' });
  await tab.evaluate(() => document.fonts.ready);
  await tab.pdf({ path, format: 'Letter', printBackground: true });
  await tab.close();
}

function documentBody(receipt: Seeded | Receipt, profile: Profile, options?: ThermalOptions): string {
  switch (profile.template) {
    case 'thermal':
      return thermal(receipt, profile, options);
    case 'email':
      return emailReceipt(receipt, profile);
    default:
      return invoice(receipt, profile, profile.template);
  }
}

async function renderSeed(browser: Browser, expense: Seeded): Promise<void> {
  const profile = merchants[expense.profile];
  const path = join(SEED_RECEIPTS, expense.file);
  mkdirSync(dirname(path), { recursive: true });
  const body = documentBody(expense, profile);
  if (profile.format === 'pdf') await renderPdf(browser, body, path);
  else await renderScan(browser, body, path, profile.template === 'email' ? 1.5 : 2);
}

const LISBON_CAFE: Profile = {
  template: 'thermal',
  format: 'jpg',
  locale: 'pt',
  address: ['Rua da Madalena 120', '1100-321 Lisboa'],
  phone: 'NIF 509 876 543',
  footer: 'Obrigado e volte sempre',
};

async function renderSamples(browser: Browser): Promise<void> {
  mkdirSync(SAMPLES, { recursive: true });
  const expenses = data.expenses as Seeded[];
  const seeded = (merchant: string, date: string) => {
    const match = expenses.find((expense) => expense.owner === 'nora' && expense.merchant === merchant && expense.date === date);
    if (!match) throw new Error(`No seeded ${merchant} on ${date}`);
    return match;
  };

  // A phone photo at full 12 MP resolution: four lines, no flags expected.
  await renderPhoto(
    browser,
    thermal(
      {
        merchant: 'Cedar Loop Coworking',
        date: '2026-09-28',
        time: '16:12',
        currency: 'USD',
        items: [
          { description: 'Meeting room B, 2 h', quantity: 2, amount: 40 },
          { description: 'Guest day pass', quantity: 1, amount: 28 },
          { description: 'Printing, 12 pages', quantity: 12, amount: 3.6 },
          { description: 'Cold brew', quantity: 1, amount: 6.7 },
        ],
        tip: null,
        tax: null,
        total: 78.3,
        paymentMethod: 'Visa ending 4417',
        reference: '5521',
        details: null,
      },
      merchants['Cedar Loop Coworking POS'],
    ),
    join(SAMPLES, 'cedar-loop-coworking.jpg'),
    { scene: 'desk', width: 1008, height: 1344, scale: 3 },
  );

  // September's hosting invoice (the seed data stops in August).
  await renderPdf(
    browser,
    invoice({ ...seeded('Cobalt Hosting Co.', '2026-08-01'), date: '2026-09-01', reference: 'CH-2026-0901' }, merchants['Cobalt Hosting Co.'], 'invoice'),
    join(SAMPLES, 'cobalt-hosting-invoice.pdf'),
  );

  // A faded thermal ticket with a smudged total. The fare lines are still readable.
  await renderPhoto(
    browser,
    thermal(
      {
        ...seeded('Northline Rail', '2026-08-11'),
        date: '2026-09-22',
        time: '07:18',
        reference: 'NLR 4417-0922',
        details: { route: ['Portland Union Station', 'Seattle King Street'], departure: '07:45' },
      },
      merchants['Northline Rail'],
      { faded: true, smudgeTotal: true },
    ),
    join(SAMPLES, 'northline-rail-faded.jpg'),
    { scene: 'counter', width: 900, height: 1200, scale: 2 },
  );

  // The same receipt as the seeded Harbor Light Cafe expense on September 18: a duplicate.
  copyFileSync(join(SEED_RECEIPTS, seeded('Harbor Light Cafe', '2026-09-18').file), join(SAMPLES, 'harbor-light-cafe.png'));

  // A Lisbon cafe receipt in euros, with VAT included in the prices.
  await renderPhoto(
    browser,
    thermal(
      {
        merchant: 'Pastelaria Aurora',
        date: '2026-09-14',
        time: '10:42',
        currency: 'EUR',
        items: [
          { description: 'Pastel de nata', quantity: 2, amount: 2.6 },
          { description: 'Galão', quantity: 1, amount: 1.8 },
          { description: 'Tosta mista', quantity: 1, amount: 4.2 },
          { description: 'Sumo de laranja natural', quantity: 1, amount: 4.3 },
        ],
        tip: null,
        tax: { label: 'IVA 23% incluído', amount: 2.41, included: true },
        total: 12.9,
        paymentMethod: 'Visa ending 4417',
        reference: 'FS 2026/4417',
        details: null,
      },
      LISBON_CAFE,
    ),
    join(SAMPLES, 'pastelaria-aurora-lisbon.jpg'),
    { scene: 'counter', width: 900, height: 1200, scale: 2 },
  );

  // Not a receipt: the agent should reject it.
  await renderPhoto(browser, stickyNote(), join(SAMPLES, 'studio-todo-note.png'), {
    scene: 'desk',
    width: 900,
    height: 900,
    scale: 1,
    fill: 0.8,
  });
}

const browser = await chromium.launch({ channel: 'chromium' });
try {
  for (const expense of data.expenses as Seeded[]) await renderSeed(browser, expense);
  await renderSamples(browser);
  console.log(`Rendered ${data.expenses.length} seed receipts and 6 samples.`);
} finally {
  await browser.close();
}
