/**
 * HTML templates for the fictional receipts in samples/ and scripts/seed-data/receipts/.
 * scripts/render-samples.ts turns them into images and PDFs with Playwright.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

export type Item = { description: string; quantity: number | null; amount: number };
export type Tax = { label: string; amount: number; included?: boolean };
export type Profile = {
  template: 'thermal' | 'invoice' | 'folio' | 'eticket' | 'email';
  format: 'png' | 'jpg' | 'pdf';
  address: string[];
  phone?: string;
  email?: string;
  footer?: string;
  color?: string;
  locale?: 'pt';
};
export type Receipt = {
  merchant: string;
  date: string;
  time: string;
  currency: string;
  items: Item[];
  tip: number | null;
  tax: Tax | null;
  total: number;
  paymentMethod: string;
  reference: string | null;
  details: Record<string, any> | null;
};

const require = createRequire(import.meta.url);

function fontFace(family: string, file: string, weight = '400', style = 'normal'): string {
  const data = readFileSync(require.resolve(file)).toString('base64');
  return `@font-face{font-family:'${family}';src:url(data:font/woff2;base64,${data}) format('woff2');font-weight:${weight};font-style:${style};}`;
}

export const FONTS = [
  fontFace('Plex Mono', '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2', '400'),
  fontFace('Plex Mono', '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-600-normal.woff2', '600'),
  fontFace('Plex Mono', '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-700-normal.woff2', '700'),
  fontFace('VT323', '@fontsource/vt323/files/vt323-latin-400-normal.woff2'),
  fontFace('Inter', '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2', '100 900'),
  fontFace('Caveat', '@fontsource/caveat/files/caveat-latin-500-normal.woff2', '500'),
  fontFace('Caveat', '@fontsource/caveat/files/caveat-latin-700-normal.woff2', '700'),
  fontFace('Fraunces', '@fontsource-variable/fraunces/files/fraunces-latin-wght-normal.woff2', '100 900'),
].join('\n');

const NOISE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.35 0 0 0 0 0.3 0 0 0 0 0.25 0 0 0 .09 0'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)'/%3E%3C/svg%3E")`;

const esc = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function amount(value: number, currency: string, symbol = false): string {
  const text = value.toFixed(2);
  if (currency === 'EUR') return symbol ? `${text.replace('.', ',')} €` : text.replace('.', ',');
  const grouped = Number(text).toLocaleString('en-US', { minimumFractionDigits: 2 });
  return symbol ? `$${grouped}` : grouped;
}

function usDate(date: string): string {
  const [y, m, d] = date.split('-');
  return `${m}/${d}/${y}`;
}

function ptDate(date: string): string {
  const [y, m, d] = date.split('-');
  return `${d}-${m}-${y}`;
}

function longDate(date: string, locale = 'en-US'): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString(locale, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function twelveHour(time: string): string {
  const [h, m] = time.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

function cardLine(method: string): string {
  const match = method.match(/^(Visa|Mastercard|Amex) ending (\d{4})$/);
  if (!match) return method.toUpperCase();
  return `${match[1].toUpperCase()} ************${match[2]}`;
}

const ICONS: Record<string, string> = {
  cup: '<path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z"/><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M8 3c0 1.5 1 1.5 1 3M12 3c0 1.5 1 1.5 1 3"/>',
  wheat: '<path d="M12 21V8"/><path d="M12 12c-3 0-4-2-4-4 2 0 4 1 4 4zM12 12c3 0 4-2 4-4-2 0-4 1-4 4zM12 17c-3 0-4-2-4-4 2 0 4 1 4 4zM12 17c3 0 4-2 4-4-2 0-4 1-4 4zM12 8c-1-1-1-3 0-5 1 2 1 4 0 5z"/>',
  bowl: '<path d="M3 11h18a9 9 0 0 1-18 0z"/><path d="M8 20h8"/><path d="M14 3l5 5M17 2l3 3"/>',
  fork: '<path d="M7 3v8a2 2 0 0 0 2 2v8M5 3v5M9 3v5M16 3c-2 1-2 6 0 8v10"/>',
  taxi: '<path d="M5 16h14v-4l-2-5H7l-2 5z"/><circle cx="8" cy="17" r="1.6"/><circle cx="16" cy="17" r="1.6"/><path d="M10 4h4v3h-4z"/>',
  parking: '<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M10 17V8h3a2.5 2.5 0 0 1 0 5h-3"/>',
  train: '<rect x="6" y="3" width="12" height="13" rx="3"/><path d="M6 10h12M9 20l-2 2M15 20l2 2M9 13h.01M15 13h.01"/>',
  leaf: '<path d="M12 21c-5-4-7-9-3-15 6 2 8 9 3 15z"/><path d="M12 21V11"/>',
  nib: '<path d="M12 3l5 7-5 11-5-11z"/><circle cx="12" cy="11" r="1.5"/>',
  monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M9 20h6M12 16v4"/>',
  tram: '<rect x="5" y="6" width="14" height="12" rx="3"/><path d="M9 3h6M12 3v3M5 12h14M8 21l1-3M16 21l-1-3"/>',
  diner: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/>',
  ink: '<path d="M8 3h8l-1 5h-6z"/><rect x="6" y="8" width="12" height="12" rx="3"/>',
};

const MERCHANT_ICON: Record<string, string> = {
  'Harbor Light Cafe': 'cup',
  'Juniper & Rye': 'fork',
  'Little Fern Bakery': 'wheat',
  'Kinjo Noodle Bar': 'bowl',
  'Tasca do Bairro': 'fork',
  'Rose City Cab': 'taxi',
  'Pearl Street Parking': 'parking',
  Carris: 'tram',
  'Northline Rail': 'train',
  'Cedar Loop Coworking': 'leaf',
  'Paper & Pine Stationers': 'nib',
  'Northgate Electronics': 'monitor',
  'Birch Street Diner': 'diner',
  'Inkwell Supply Co.': 'ink',
  'Pastelaria Aurora': 'cup',
};

function icon(name: string, size = 30, stroke = 'currentColor'): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] ?? ICONS.cup}</svg>`;
}

// Machines that print with a dot-matrix head instead of a thermal POS font.
const DOT_MATRIX = new Set(['Rose City Cab', 'Pearl Street Parking']);
// Names printed in a display face instead of the POS font.
const DISPLAY_NAME = new Set(['Harbor Light Cafe', 'Juniper & Rye', 'Little Fern Bakery', 'Pastelaria Aurora', 'Tasca do Bairro']);

export type ThermalOptions = {
  faded?: boolean;
  smudgeTotal?: boolean;
  extraFooter?: string;
};

/** A narrow POS receipt or ticket. */
export function thermal(receipt: Receipt, profile: Profile, options: ThermalOptions = {}): string {
  const { merchant, currency } = receipt;
  const portuguese = profile.locale === 'pt';
  const dotMatrix = DOT_MATRIX.has(merchant);
  const subtotal = receipt.items.reduce((sum, item) => sum + item.amount, 0);
  const route = receipt.details?.route as string[] | undefined;
  const serial = (receipt.reference ?? `${merchant.length * 97}${receipt.date.slice(8)}`).replace(/\s+/g, ' ');
  const labels = portuguese
    ? { date: 'Data', time: 'Hora', ref: 'Doc.', subtotal: 'Subtotal', tip: 'Gorjeta', total: 'TOTAL', auth: 'Autorização', approved: 'Aprovado', paid: 'Pago com' }
    : { date: 'Date', time: 'Time', ref: route ? 'Ticket' : 'Order', subtotal: 'Subtotal', tip: 'Tip', total: 'TOTAL', auth: 'Auth', approved: 'Approved', paid: 'Paid with' };

  const itemRows = receipt.items
    .map((item) => {
      const quantity = item.quantity ?? 1;
      return `<div class="item"><span class="qty">${quantity}</span><span class="desc">${esc(item.description)}</span><span class="amt">${amount(item.amount, currency)}</span></div>`;
    })
    .join('');

  const taxRow = receipt.tax
    ? receipt.tax.included
      ? ''
      : `<div class="row"><span>${esc(receipt.tax.label)}</span><span>${amount(receipt.tax.amount, currency)}</span></div>`
    : '';
  const includedTax = receipt.tax?.included
    ? `<div class="rule"></div><div class="row small"><span>${esc(receipt.tax.label)}</span><span>${amount(receipt.tax.amount, currency)}</span></div>`
    : '';
  const totalText = amount(receipt.total, currency, true);
  const total = options.smudgeTotal
    ? `<span class="total-amount smudged">${totalText.slice(0, 2)}<span class="ghost">${totalText.slice(2)}</span><i class="smudge"></i></span>`
    : `<span class="total-amount">${totalText}</span>`;

  const header = DISPLAY_NAME.has(merchant)
    ? `<div class="brand">${icon(MERCHANT_ICON[merchant] ?? 'cup', 34)}<div class="display">${esc(merchant)}</div></div>`
    : `<div class="brand">${icon(MERCHANT_ICON[merchant] ?? 'cup', 30)}<div class="caps">${esc(merchant.toUpperCase())}</div></div>`;

  const routeBlock = route
    ? `<div class="rule"></div>
       <div class="route"><div><small>FROM</small><b>${esc(route[0])}</b></div><div><small>TO</small><b>${esc(route[1])}</b></div></div>
       <div class="meta"><span>Depart ${receipt.details?.departure}</span><span>Coach · Seat ${10 + (receipt.date.charCodeAt(9) % 30)}C</span></div>`
    : '';

  return `<div class="thermal ${dotMatrix ? 'dot' : 'pos'} ${options.faded ? 'faded' : ''}">
  <header>${header}
    ${profile.address.map((line) => `<div class="addr">${esc(line)}</div>`).join('')}
    ${profile.phone ? `<div class="addr">${esc(profile.phone)}</div>` : ''}
  </header>
  <div class="rule"></div>
  <div class="meta"><span>${labels.date} ${portuguese ? ptDate(receipt.date) : usDate(receipt.date)}</span><span>${labels.time} ${portuguese ? receipt.time : twelveHour(receipt.time)}</span></div>
  <div class="meta"><span>${labels.ref} ${esc(serial)}</span><span>${portuguese ? 'Caixa 1' : 'Term 02'}</span></div>
  ${routeBlock}
  <div class="rule"></div>
  ${itemRows}
  <div class="rule"></div>
  ${receipt.tip || (receipt.tax && !receipt.tax.included) ? `<div class="row"><span>${labels.subtotal}</span><span>${amount(subtotal, currency)}</span></div>` : ''}
  ${receipt.tip ? `<div class="row"><span>${labels.tip}</span><span>${amount(receipt.tip, currency)}</span></div>` : ''}
  ${taxRow}
  <div class="row total"><span>${labels.total}</span>${total}</div>
  ${includedTax}
  <div class="rule"></div>
  <div class="pay">${labels.paid} ${receipt.paymentMethod === 'Cash' ? (portuguese ? 'NUMERÁRIO' : 'CASH') : esc(cardLine(receipt.paymentMethod))}</div>
  ${receipt.paymentMethod === 'Cash' ? '' : `<div class="pay">${labels.auth} ${String(Math.round(48213 + receipt.total * 7)).padStart(6, '0')} · ${labels.approved}</div>`}
  <div class="rule"></div>
  ${options.extraFooter ? `<div class="footer strong">${esc(options.extraFooter)}</div>` : ''}
  <div class="footer">${esc(profile.footer ?? 'Thank you')}</div>
  <div class="barcode"></div>
</div>`;
}

export const THERMAL_CSS = `
.thermal{width:360px;box-sizing:border-box;padding:30px 26px 34px;background:#fbfaf6 ${NOISE};color:#232220;font-size:12.5px;line-height:1.55;position:relative;
  clip-path:polygon(0 0,100% 0,100% calc(100% - 8px),97% 100%,94% calc(100% - 7px),91% 100%,88% calc(100% - 6px),85% 100%,82% calc(100% - 8px),79% 100%,76% calc(100% - 6px),73% 100%,70% calc(100% - 7px),67% 100%,64% calc(100% - 8px),61% 100%,58% calc(100% - 6px),55% 100%,52% calc(100% - 7px),49% 100%,46% calc(100% - 8px),43% 100%,40% calc(100% - 6px),37% 100%,34% calc(100% - 7px),31% 100%,28% calc(100% - 8px),25% 100%,22% calc(100% - 6px),19% 100%,16% calc(100% - 7px),13% 100%,10% calc(100% - 8px),7% 100%,4% calc(100% - 6px),1% 100%,0 calc(100% - 7px))}
.thermal.pos{font-family:'Plex Mono',monospace}
.thermal.dot{font-family:'VT323',monospace;font-size:17px;line-height:1.3;letter-spacing:.02em}
.thermal header{text-align:center;margin-bottom:10px}
.thermal .brand{display:flex;flex-direction:column;align-items:center;gap:6px;margin-bottom:8px}
.thermal .display{font-family:'Fraunces',serif;font-size:25px;font-weight:600;letter-spacing:-.01em;line-height:1.1}
.thermal .caps{font-weight:700;font-size:16px;letter-spacing:.14em}
.thermal.dot .caps{font-size:22px;font-weight:400}
.thermal .addr{font-size:11.5px;color:#4a4845}
.thermal.dot .addr{font-size:16px}
.thermal .rule{border-top:1.5px dashed #6f6b66;margin:9px 0}
.thermal .meta,.thermal .row{display:flex;justify-content:space-between;gap:12px}
.thermal .route{display:flex;flex-direction:column;gap:4px;margin:2px 0 6px}
.thermal .route small{display:block;font-size:10px;letter-spacing:.12em;color:#6b6762}
.thermal .route b{font-size:14px}
.thermal .item{display:grid;grid-template-columns:22px 1fr auto;gap:8px}
.thermal .item .amt,.thermal .row span:last-child{text-align:right;font-variant-numeric:tabular-nums}
.thermal .row.small{font-size:11px;color:#4a4845}
.thermal .row.total{font-weight:700;font-size:17px;margin-top:6px}
.thermal.dot .row.total{font-size:23px}
.thermal .total-amount{position:relative}
.thermal .smudged .ghost{opacity:.18}
.thermal .smudge{position:absolute;left:-14px;right:-18px;top:-9px;bottom:-11px;background:radial-gradient(ellipse at 45% 50%,rgba(92,84,76,.72) 0%,rgba(110,101,92,.55) 38%,rgba(140,131,121,.25) 62%,transparent 78%);filter:blur(3.5px);border-radius:40%;transform:rotate(-6deg)}
.thermal .pay{font-size:11.5px}
.thermal.dot .pay{font-size:16px}
.thermal .footer{text-align:center;font-size:11.5px;margin-top:4px;color:#4a4845}
.thermal .footer.strong{color:#232220;font-weight:600;margin-bottom:6px;text-align:left}
.thermal .barcode{height:38px;margin:14px auto 0;width:78%;background:repeating-linear-gradient(90deg,#232220 0 2px,transparent 2px 4px,#232220 4px 5px,transparent 5px 8px,#232220 8px 11px,transparent 11px 12px)}
.thermal.faded{color:#8b8680}
.thermal.faded .rule{border-color:#b9b3ab}
.thermal.faded .addr,.thermal.faded .footer,.thermal.faded .route small{color:#a39d96}
.thermal.faded .barcode{opacity:.45}
.thermal.faded::after{content:'';position:absolute;inset:0;background:linear-gradient(170deg,rgba(251,250,246,0) 0%,rgba(251,250,246,.35) 45%,rgba(251,250,246,.1) 70%,rgba(240,236,228,.4) 100%);pointer-events:none}
`;

/** A letter-size invoice or payment confirmation (PDF). */
export function invoice(receipt: Receipt, profile: Profile, kind: 'invoice' | 'folio' | 'eticket'): string {
  const { currency } = receipt;
  const portuguese = profile.locale === 'pt';
  const color = profile.color ?? '#333';
  const subtotal = receipt.items.reduce((sum, item) => sum + item.amount, 0);
  const d = receipt.details ?? {};
  const title = kind === 'folio' ? (portuguese ? 'Fatura-Recibo' : 'Guest folio') : kind === 'eticket' ? 'Electronic ticket receipt' : receipt.merchant === 'Ledgerline Bank' ? 'Fee notice' : 'Invoice';
  const L = portuguese
    ? { billed: 'Hóspede', desc: 'Descrição', qty: 'Qtd.', amount: 'Valor', subtotal: 'Subtotal', total: 'Total', paid: 'Pago', number: 'Número', issued: 'Data', method: 'Pago com cartão' }
    : { billed: kind === 'eticket' ? 'Passenger' : 'Billed to', desc: 'Description', qty: 'Qty', amount: 'Amount', subtotal: 'Subtotal', total: 'Total', paid: 'Amount paid', number: kind === 'eticket' ? 'Booking reference' : kind === 'folio' ? 'Folio' : 'Invoice number', issued: kind === 'eticket' ? 'Issued' : 'Date', method: 'Paid with' };

  const rows = receipt.items
    .map((item, index) => {
      const night = kind === 'folio' && d.nights?.[index] ? `${longDate(d.nights[index])} · ` : '';
      return `<tr><td>${night}${esc(item.description)}</td><td class="num">${item.quantity ?? 1}</td><td class="num">${amount(item.amount, currency, true)}</td></tr>`;
    })
    .join('');

  const stay =
    kind === 'folio'
      ? `<div class="facts">
          <div><small>${portuguese ? 'Chegada' : 'Arrival'}</small>${longDate(d.arrival, portuguese ? 'pt-PT' : 'en-US')}</div>
          <div><small>${portuguese ? 'Partida' : 'Departure'}</small>${longDate(d.departure, portuguese ? 'pt-PT' : 'en-US')}</div>
          <div><small>${portuguese ? 'Quarto' : 'Room'}</small>${esc(d.room)}</div>
        </div>`
      : '';
  const flights =
    kind === 'eticket'
      ? `<table class="lines flights"><thead><tr><th>Flight</th><th>From</th><th>To</th><th>Date</th><th class="num">Departs</th><th class="num">Arrives</th></tr></thead><tbody>
          ${(d.flights as string[][]).map((f) => `<tr><td>${f[0]}</td><td>${f[1]}</td><td>${f[2]}</td><td>${longDate(f[3])}</td><td class="num">${f[4]}</td><td class="num">${f[5]}</td></tr>`).join('')}
        </tbody></table>`
      : '';

  const taxRow = receipt.tax
    ? `<div class="sum ${receipt.tax.included ? 'muted' : ''}"><span>${esc(receipt.tax.label)}</span><span>${amount(receipt.tax.amount, currency, true)}</span></div>`
    : '';
  const who = kind === 'eticket' ? `<b>${esc(d.passenger)}</b><br>Ticket 406 2${receipt.date.replace(/-/g, '').slice(2)}4417` : `<b>Nora Lindqvist</b><br>Lindqvist Design Studio<br>1422 NE Alberta St<br>Portland, OR 97211<br>nora@example.com`;
  const paidOn = portuguese ? ptDate(receipt.date) : longDate(receipt.date);

  return `<div class="doc" style="--brand:${color}">
  <div class="bar"></div>
  <div class="top">
    <div class="from"><div class="mark"><span></span>${esc(receipt.merchant)}</div>${profile.address.map((line) => `<div>${esc(line)}</div>`).join('')}<div>${esc(profile.email ?? '')}</div></div>
    <div class="title"><h1>${title}</h1>
      <div class="kv"><small>${L.number}</small><b>${esc(receipt.reference ?? '')}</b></div>
      <div class="kv"><small>${L.issued}</small><b>${portuguese ? ptDate(receipt.date) : longDate(receipt.date)}</b></div>
      <div class="kv"><small>${portuguese ? 'Estado' : 'Status'}</small><b class="paid">${portuguese ? 'Pago' : 'Paid'}</b></div>
    </div>
  </div>
  <div class="billed"><small>${L.billed}</small><div>${portuguese ? '<b>Nora Lindqvist</b><br>1422 NE Alberta St, Portland, OR 97211, EUA' : who}</div></div>
  ${stay}${flights}
  <table class="lines"><thead><tr><th>${L.desc}</th><th class="num">${L.qty}</th><th class="num">${L.amount}</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="sums">
    <div class="sum"><span>${L.subtotal}</span><span>${amount(subtotal, currency, true)}</span></div>
    ${taxRow}
    <div class="sum total"><span>${L.total}</span><span>${amount(receipt.total, currency, true)}</span></div>
    <div class="sum"><span>${L.paid}</span><span>${amount(receipt.total, currency, true)}</span></div>
  </div>
  <p class="payment">${L.method} ${esc(portuguese ? cardLine(receipt.paymentMethod).replace(/\*+/, ' ****') : receipt.paymentMethod)} ${portuguese ? 'em' : 'on'} ${paidOn}.</p>
  <footer>${portuguese ? 'Obrigado pela sua estadia.' : 'Thank you for your business.'} ${portuguese ? 'Questões:' : 'Questions:'} ${esc(profile.email ?? '')}</footer>
</div>`;
}

export const INVOICE_CSS = `
.doc{width:816px;min-height:1056px;box-sizing:border-box;padding:64px 72px;background:#fff;color:#1f2328;font-family:'Inter',sans-serif;font-size:13px;line-height:1.55;position:relative}
.doc .bar{position:absolute;left:0;right:0;top:0;height:8px;background:var(--brand)}
.doc .top{display:flex;justify-content:space-between;gap:40px;margin-bottom:40px}
.doc .from{color:#57606a}
.doc .mark{display:flex;align-items:center;gap:10px;font-size:19px;font-weight:650;color:#1f2328;letter-spacing:-.01em;margin-bottom:8px}
.doc .mark span{width:22px;height:22px;border-radius:6px;background:var(--brand);display:inline-block}
.doc h1{font-size:26px;font-weight:650;letter-spacing:-.02em;margin:0 0 14px;text-align:right}
.doc .kv{display:flex;justify-content:space-between;gap:28px;min-width:260px}
.doc .kv small,.doc .billed small,.doc .facts small{color:#6e7781;font-size:11px;text-transform:uppercase;letter-spacing:.06em}
.doc .paid{color:#1a7f37}
.doc .billed{margin-bottom:28px}
.doc .billed small{display:block;margin-bottom:4px}
.doc .facts{display:flex;gap:48px;margin-bottom:24px}
.doc .facts small{display:block}
.doc table.lines{width:100%;border-collapse:collapse;margin-bottom:22px}
.doc table.lines th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#6e7781;border-bottom:1px solid #d0d7de;padding:8px 0}
.doc table.lines td{padding:11px 0;border-bottom:1px solid #eaeef2}
.doc .num,.doc table.lines th.num{text-align:right;font-variant-numeric:tabular-nums}
.doc .sums{margin-left:auto;width:300px}
.doc .sum{display:flex;justify-content:space-between;padding:5px 0;font-variant-numeric:tabular-nums}
.doc .sum.muted{color:#6e7781}
.doc .sum.total{font-weight:650;font-size:16px;border-top:1px solid #d0d7de;margin-top:6px;padding-top:10px}
.doc .payment{margin-top:36px;color:#57606a}
.doc footer{position:absolute;left:72px;right:72px;bottom:48px;color:#8c959f;font-size:12px;border-top:1px solid #eaeef2;padding-top:14px}
`;

/** A web or email receipt, rendered as a PNG like a screenshot. */
export function emailReceipt(receipt: Receipt, profile: Profile): string {
  const { currency } = receipt;
  const color = profile.color ?? '#333';
  const heading = receipt.merchant === 'City of Portland' ? 'Payment received' : `Receipt from ${receipt.merchant}`;
  const rows = receipt.items
    .map((item) => `<div class="line"><span>${esc(item.description)}</span><span>${amount(item.amount, currency, true)}</span></div>`)
    .join('');
  return `<div class="mail" style="--brand:${color}">
  <div class="head"><span class="dot"></span>${esc(receipt.merchant)}</div>
  <h2>${heading}</h2>
  <div class="big">${amount(receipt.total, currency, true)}</div>
  <div class="sub">Paid ${longDate(receipt.date)}</div>
  <div class="grid">
    <div><small>Receipt number</small>${esc(receipt.reference ?? '')}</div>
    <div><small>Payment method</small>${esc(receipt.paymentMethod)}</div>
  </div>
  <div class="box">${rows}<div class="line total"><span>Amount paid</span><span>${amount(receipt.total, currency, true)}</span></div></div>
  <p class="foot">${profile.address.map(esc).join(' · ')}<br>Questions? ${esc(profile.email ?? '')}</p>
</div>`;
}

export const EMAIL_CSS = `
.mail{width:600px;box-sizing:border-box;padding:40px 44px 32px;background:#fff;font-family:'Inter',sans-serif;color:#1f2328;font-size:14px;line-height:1.5;border-top:6px solid var(--brand)}
.mail .head{display:flex;align-items:center;gap:10px;font-weight:650;font-size:16px;margin-bottom:26px}
.mail .dot{width:18px;height:18px;border-radius:50%;background:var(--brand)}
.mail h2{font-size:15px;font-weight:500;color:#57606a;margin:0 0 6px}
.mail .big{font-size:36px;font-weight:650;letter-spacing:-.02em}
.mail .sub{color:#57606a;margin-bottom:22px}
.mail .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:22px}
.mail small{display:block;color:#6e7781;font-size:11px;text-transform:uppercase;letter-spacing:.06em}
.mail .box{background:#f6f8fa;border-radius:10px;padding:14px 18px}
.mail .line{display:flex;justify-content:space-between;padding:6px 0;font-variant-numeric:tabular-nums}
.mail .line.total{border-top:1px solid #d0d7de;margin-top:6px;padding-top:10px;font-weight:650}
.mail .foot{color:#8c959f;font-size:12px;margin-top:24px}
`;

/** A handwritten sticky note: not a receipt. */
export function stickyNote(): string {
  return `<div class="note">
  <h3>Studio, this week</h3>
  <ul>
    <li><s>Send Juniper &amp; Rye menu mockups</s></li>
    <li>Invoice Harborview for the logo work</li>
    <li>Book Lisbon flights (window seat)</li>
    <li>Renew the portfolio domain</li>
    <li>Buy printer paper + binder clips</li>
    <li>Call Theo about the copy deck</li>
  </ul>
</div>`;
}

export const NOTE_CSS = `
.note{width:560px;height:560px;box-sizing:border-box;padding:44px 48px;background:linear-gradient(160deg,#fff3a6,#fbe77f 60%,#f3da66);font-family:'Caveat',cursive;color:#27315c;font-size:34px;line-height:1.25;box-shadow:0 26px 40px -18px rgba(0,0,0,.55),0 2px 6px rgba(0,0,0,.25)}
.note h3{font-size:44px;font-weight:700;margin:0 0 12px;text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:6px}
.note ul{margin:0;padding-left:28px}
.note li{margin:2px 0}
`;

export type Scene = 'desk' | 'counter' | 'scan';

/**
 * Places a document on a surface like a phone photo: a slight tilt, a shadow,
 * and uneven light. The "scan" scene is a flat, straight capture.
 */
export function page(body: string, scene: Scene, size: { width: number; height: number }, scale = 1): string {
  const surfaces: Record<Scene, string> = {
    desk: `background:#4b3a2c;background-image:${NOISE},repeating-linear-gradient(94deg,rgba(0,0,0,.07) 0 3px,rgba(255,255,255,.02) 3px 7px,rgba(0,0,0,.04) 7px 15px),radial-gradient(ellipse at 38% 30%,#7a624b 0%,#553f2f 55%,#2d2119 100%)`,
    counter: `background:#8d8a84;background-image:${NOISE},${NOISE},radial-gradient(ellipse at 60% 35%,#b9b4ab 0%,#8f8a82 55%,#5e5a54 100%)`,
    scan: `background:#f4f3ef`,
  };
  const tilt = scene === 'scan' ? '' : 'perspective(1800px) rotateX(6deg) rotateZ(-1.8deg)';
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${FONTS}
*{-webkit-font-smoothing:antialiased}
html,body{margin:0;width:${size.width}px;height:${size.height}px;overflow:hidden}
body{${surfaces[scene]};display:flex;align-items:center;justify-content:center}
.stage{transform:${tilt} scale(${scale});filter:${scene === 'scan' ? 'none' : 'drop-shadow(0 28px 34px rgba(0,0,0,.45)) drop-shadow(0 3px 6px rgba(0,0,0,.3))'}}
.light{position:fixed;inset:0;pointer-events:none;background:${scene === 'scan' ? 'none' : 'linear-gradient(118deg,rgba(255,248,230,.16) 0%,rgba(255,255,255,0) 42%,rgba(0,0,0,.18) 100%)'}}
${THERMAL_CSS}${INVOICE_CSS}${EMAIL_CSS}${NOTE_CSS}
${scene === 'scan' ? '.thermal{background-image:none}' : ''}
</style></head><body><div class="stage">${body}</div><div class="light"></div></body></html>`;
}

/** A standalone page for printing a document to PDF. */
export function printPage(body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${FONTS}
@page{size:Letter;margin:0}
html,body{margin:0}
${INVOICE_CSS}
</style></head><body>${body}</body></html>`;
}

