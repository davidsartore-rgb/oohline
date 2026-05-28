'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');

const prisma = new PrismaClient();

const ARGON2_OPTIONS = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };

async function main() {
  console.log('🌱 Seeding database…');

  // ── Admin user ─────────────────────────────────────────────────────────────
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'S?3Wq9Z$:8hmf6';
  const passwordHash = await argon2.hash(password, ARGON2_OPTIONS);

  await prisma.adminUser.upsert({
    where: { username },
    update: {},
    create: { username, password_hash: passwordHash, recovery_email: process.env.CONTACT_EMAIL || 'devis@oohline.ch' },
  });
  console.log(`  ✓ Admin user "${username}" created`);

  // ── Sections ───────────────────────────────────────────────────────────────
  const sections = [
    { id: 'OOH', name_fr: 'OOH — Affichage urbain', name_en: 'OOH — Urban displays', desc_fr: 'Formats classiques sur mobilier urbain, panneaux, gares et zones piétonnes.', desc_en: 'Classic formats on street furniture, billboards, stations and pedestrian zones.', enabled: true, display_order: 0 },
    { id: 'MOOH', name_fr: 'MOOH — Affichage mobile / Transport', name_en: 'MOOH — Mobile / Transit', desc_fr: 'Affichage sur bus, trams et trains : extérieur véhicule et intérieur cabine.', desc_en: 'Advertising on buses, trams and trains — vehicle exterior and interior.', enabled: true, display_order: 1 },
  ];
  for (const s of sections) {
    await prisma.section.upsert({ where: { id: s.id }, update: s, create: s });
  }
  console.log('  ✓ Sections seeded');

  // ── Formats ────────────────────────────────────────────────────────────────
  const formats = [
    { code: 'F4',   section_id: 'OOH',  name_fr: 'F4 — World format',          name_en: 'F4 — World format',          width_cm: 89.5,  height_cm: 128,  surface_m2: 1.15, base_price: 22,  display_order: 0, desc_fr: 'Format universel pour zones piétonnes, centres commerciaux et abribus.',  desc_en: 'Universal format for pedestrian zones, shopping centres and bus shelters.' },
    { code: 'F12',  section_id: 'OOH',  name_fr: 'F12 — Wide format',           name_en: 'F12 — Wide format',          width_cm: 268.5, height_cm: 128,  surface_m2: 3.44, base_price: 48,  display_order: 1, desc_fr: 'Format large (3,4 m²) sur axes urbains, parkings et gares.',               desc_en: 'Wide format (3.4 sqm) on urban roads, car parks and stations.' },
    { code: 'F24',  section_id: 'OOH',  name_fr: 'F24 — Large format',          name_en: 'F24 — Large format',         width_cm: 268.5, height_cm: 256,  surface_m2: 6.87, base_price: 92,  display_order: 2, desc_fr: 'Très grand format (~7 m²) sur emplacements premium à fort trafic.',       desc_en: 'Extra-large format (~7 sqm) at premium high-traffic locations.' },
    { code: 'F200', section_id: 'OOH',  name_fr: 'F200 — Cityformat',           name_en: 'F200 — Cityformat',          width_cm: 116.5, height_cm: 170,  surface_m2: 1.98, base_price: 34,  display_order: 3, desc_fr: 'Format city portrait pour mobilier urbain, arrêts et passages.',         desc_en: 'Portrait cityformat for street furniture, stops and walkways.' },
    { code: 'F200L',section_id: 'OOH',  name_fr: 'F200L — Cityformat backlit',  name_en: 'F200L — Cityformat backlit', width_cm: 116.5, height_cm: 170,  surface_m2: 1.98, base_price: 58,  display_order: 4, desc_fr: 'Version rétro-éclairée du F200 pour emplacements backlit 24/7.',         desc_en: 'Backlit version of F200 for 24/7 backlit locations.' },
    { code: 'TB',   section_id: 'MOOH', name_fr: 'TrafficBoard — Côté bus',     name_en: 'TrafficBoard — Bus side',    width_cm: 300,   height_cm: 70,   surface_m2: 2.10, base_price: 145, display_order: 5, desc_fr: 'Grand panneau latéral sur bus. Visibilité maximale en circulation.',    desc_en: 'Large side panel on bus. Maximum visibility on the move.' },
    { code: 'RS',   section_id: 'MOOH', name_fr: 'RoofStrip — Bandeau toit',    name_en: 'RoofStrip — Roof band',      width_cm: 220,   height_cm: 35,   surface_m2: 0.77, base_price: 88,  display_order: 6, desc_fr: 'Bandeau allongé sur le toit du véhicule (bus, tram).',                desc_en: 'Long roof band on the vehicle (bus, tram). Readable from upper floors.' },
    { code: 'F12T', section_id: 'MOOH', name_fr: 'F12 Traffic — Bus/Tram',      name_en: 'F12 Traffic — Bus/Tram',     width_cm: 268.5, height_cm: 128,  surface_m2: 3.44, base_price: 96,  display_order: 7, desc_fr: 'Format F12 monté sur véhicule de transport.',                         desc_en: 'F12 format mounted on vehicle — compatible with a static F12 campaign.' },
    { code: 'RW',   section_id: 'MOOH', name_fr: 'RearWindow — Lunette arrière',name_en: 'RearWindow — Rear window',   width_cm: 170,   height_cm: 80,   surface_m2: 1.36, base_price: 76,  display_order: 8, desc_fr: 'Vinyle micro-perforé sur la lunette arrière du bus.',                  desc_en: 'Micro-perforated vinyl on the bus rear window.' },
    { code: 'HD',   section_id: 'MOOH', name_fr: 'HangingDisplay — Intérieur',  name_en: 'HangingDisplay — Interior',  width_cm: 35,    height_cm: 50,   surface_m2: 0.18, base_price: 14,  display_order: 9, desc_fr: 'Affichette suspendue dans la cabine, captive auprès des passagers.',  desc_en: 'Hanging poster inside the cabin, captive audience.' },
  ];
  for (const f of formats) {
    await prisma.format.upsert({ where: { code: f.code }, update: f, create: f });
  }
  console.log('  ✓ Formats seeded');

  // ── Papers ─────────────────────────────────────────────────────────────────
  const papers = [
    { id: 'p115',    name_fr: 'Affichage Blueback 115 g',           name_en: 'Blueback poster 115 gsm',          factor: 1.00, display_order: 0, formats: ['F4', 'F200'] },
    { id: 'p135',    name_fr: 'Affichage 135 g',                    name_en: 'Poster 135 gsm',                   factor: 1.08, display_order: 1, formats: ['F12', 'F24'] },
    { id: 'p150ill', name_fr: 'Illustration 150 g (backlit)',        name_en: 'Illustration 150 gsm (backlit)',   factor: 1.34, display_order: 2, formats: ['F200L'] },
    { id: 'pvinyl',  name_fr: 'Vinyle adhésif (extérieur véhicule)',name_en: 'Adhesive vinyl (vehicle exterior)',factor: 3.20, display_order: 3, formats: ['TB', 'RS', 'F12T'] },
    { id: 'pperfo',  name_fr: 'Vinyle micro-perforé',               name_en: 'Micro-perforated vinyl',           factor: 3.80, display_order: 4, formats: ['RW'] },
    { id: 'pcarton', name_fr: 'Carton 350 g (intérieur cabine)',    name_en: 'Cardboard 350 gsm (cabin interior)',factor: 1.60, display_order: 5, formats: ['HD'] },
  ];
  await prisma.formatPaper.deleteMany();
  await prisma.paper.deleteMany();
  for (const p of papers) {
    await prisma.paper.create({ data: { id: p.id, name_fr: p.name_fr, name_en: p.name_en, factor: p.factor, display_order: p.display_order } });
    for (const fCode of p.formats) {
      await prisma.formatPaper.create({ data: { format_code: fCode, paper_id: p.id, priority: 0 } }).catch(() => {});
    }
  }
  console.log('  ✓ Papers seeded');

  // ── Volume tiers ───────────────────────────────────────────────────────────
  await prisma.volumeTier.deleteMany();
  const tiers = [
    { from_quantity: 1,   discount_pct: 0 },
    { from_quantity: 10,  discount_pct: 5 },
    { from_quantity: 25,  discount_pct: 9 },
    { from_quantity: 50,  discount_pct: 14 },
    { from_quantity: 100, discount_pct: 20 },
    { from_quantity: 250, discount_pct: 26 },
    { from_quantity: 500, discount_pct: 32 },
  ];
  await prisma.volumeTier.createMany({ data: tiers });
  console.log('  ✓ Volume tiers seeded');

  // ── Subject fees ───────────────────────────────────────────────────────────
  await prisma.subjectFee.deleteMany();
  await prisma.subjectFee.createMany({
    data: [
      { count: 1,  fee_chf: 45 },
      { count: 2,  fee_chf: 90 },
      { count: 3,  fee_chf: 135 },
      { count: 5,  fee_chf: 225 },
      { count: 10, fee_chf: 450 },
    ],
  });
  console.log('  ✓ Subject fees seeded');

  // ── Settings ───────────────────────────────────────────────────────────────
  const defaults = [
    { key: 'express_surcharge_pct', value: 22 },
    { key: 'vat_rate', value: 0.081 },
    { key: 'contact_email', value: process.env.CONTACT_EMAIL || 'devis@oohline.ch' },
    { key: 'cookies_banner_enabled', value: true },
    { key: 'shipping', value: {
      default_chf: 25,
      overrides: [
        { id: 's1', label_fr: "Petite quantité (jusqu'à 49 ex.)",  label_en: 'Small qty (up to 49)',   from_qty: 1,   formats: [], fee_chf: 25 },
        { id: 's2', label_fr: 'Quantité moyenne (50–99 ex.)',      label_en: 'Medium qty (50–99)',     from_qty: 50,  formats: [], fee_chf: 45 },
        { id: 's3', label_fr: 'Grande quantité (100–249 ex.)',     label_en: 'Large qty (100–249)',    from_qty: 100, formats: [], fee_chf: 75 },
        { id: 's4', label_fr: 'Très grande quantité (≥ 250 ex.)', label_en: 'Very large qty (≥ 250)', from_qty: 250, formats: [], fee_chf: 120 },
        { id: 's5', label_fr: 'Grands formats (F24, MOOH)',        label_en: 'Large formats (F24, MOOH)', from_qty: 1, formats: ['F24', 'TB', 'F12T'], fee_chf: 55 },
      ],
    }},
  ];
  for (const s of defaults) {
    await prisma.setting.upsert({ where: { key: s.key }, update: {}, create: s });
  }
  console.log('  ✓ Settings seeded');

  // ── Page texts ─────────────────────────────────────────────────────────────
  await prisma.pageText.upsert({
    where: { page: 'catalog' },
    update: {},
    create: { page: 'catalog', title_fr: 'Catalogue des formats', title_en: 'Catalog of formats', sub_fr: 'Affichage Out-of-Home — sélectionnez un format pour calculer votre devis.', sub_en: 'Out-of-Home advertising — pick a format to compute your quote.' },
  });
  await prisma.pageText.upsert({
    where: { page: 'calc' },
    update: {},
    create: { page: 'calc', title_fr: 'Calculateur de prix', title_en: 'Price calculator', sub_fr: 'Devis instantané. Aucun compte requis pour consulter les prix.', sub_en: 'Instant quote. No account required to view prices.' },
  });
  console.log('  ✓ Page texts seeded');

  // ── Header config ──────────────────────────────────────────────────────────
  await prisma.headerConfig.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, logo: null, logo_alt: 'OOH Line', brand_name: 'OOH Line', brand_tag: '', show_status: true, show_lang: true },
  });
  console.log('  ✓ Header config seeded');

  // ── Footer config ──────────────────────────────────────────────────────────
  await prisma.footerConfig.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1, enabled: true,
      sections: [
        { id: 'company', enabled: true, title: '', align: 'left', bold_first: true, lines: ['Alter&Go Digital Sàrl', 'Jardinière 75, 2300 La Chaux-de-Fonds', 'IDE CHE-148.137.939 · TVA CHE-148.137.939 TVA'] },
        { id: 'contact', enabled: true, title: 'Contact', align: 'left', lines: ['{{contact_email}}', '079 706 86 86'] },
        { id: 'infos',   enabled: true, title: 'Informations', align: 'left', lines: ['{{legal}}', '{{privacy}}', '{{cookies}}'] },
        { id: 'rights',  enabled: true, title: '', align: 'right', muted: true, lines: ['© {{year}} Alter&Go Digital Sàrl', 'Tous droits réservés'] },
      ],
    },
  });
  console.log('  ✓ Footer config seeded');

  console.log('\n✅ Seed complete! Admin credentials:');
  console.log(`   Username: ${username}`);
  console.log('   Password: (from ADMIN_PASSWORD env var)');
  console.log('   ⚠ Change immediately via Admin → Compte!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
