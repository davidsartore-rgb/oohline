// Mock pricing database (persisted in localStorage)
// Swiss APG|SGA formats. Sections: OOH (urban) and MOOH (mobile / transit).

const DB_KEY = "ooh_pricing_db_v8";

const DEFAULT_DB = {
  // Site sections — toggle enabled to hide an entire section from the frontend.
  sections: [
    {
      id: "OOH",
      name_fr: "OOH — Affichage urbain",
      name_en: "OOH — Urban displays",
      desc_fr: "Formats classiques sur mobilier urbain, panneaux, gares et zones piétonnes.",
      desc_en: "Classic formats on street furniture, billboards, stations and pedestrian zones.",
      enabled: true,
    },
    {
      id: "MOOH",
      name_fr: "MOOH — Affichage mobile / Transport",
      name_en: "MOOH — Mobile / Transit",
      desc_fr: "Affichage sur bus, trams et trains : extérieur véhicule et intérieur cabine.",
      desc_en: "Advertising on buses, trams and trains — vehicle exterior and interior.",
      enabled: true,
    },
  ],

  formats: [
    // ───────── OOH ─────────
    {
      code: "F4", section: "OOH",
      name_fr: "F4 — World format",
      name_en: "F4 — World format",
      width_cm: 89.5, height_cm: 128, surface_m2: 1.15, base_price: 22,
      desc_fr: "Format universel pour zones piétonnes, centres commerciaux et abribus.",
      desc_en: "Universal format for pedestrian zones, shopping centres and bus shelters.",
    },
    {
      code: "F12", section: "OOH",
      name_fr: "F12 — Wide format",
      name_en: "F12 — Wide format",
      width_cm: 268.5, height_cm: 128, surface_m2: 3.44, base_price: 48,
      desc_fr: "Format large (3,4 m²) sur axes urbains, parkings et gares.",
      desc_en: "Wide format (3.4 sqm) on urban roads, car parks and stations.",
    },
    {
      code: "F24", section: "OOH",
      name_fr: "F24 — Large format",
      name_en: "F24 — Large format",
      width_cm: 268.5, height_cm: 256, surface_m2: 6.87, base_price: 92,
      desc_fr: "Très grand format (~7 m²) sur emplacements premium à fort trafic.",
      desc_en: "Extra-large format (~7 sqm) at premium high-traffic locations.",
    },
    {
      code: "F200", section: "OOH",
      name_fr: "F200 — Cityformat",
      name_en: "F200 — Cityformat",
      width_cm: 116.5, height_cm: 170, surface_m2: 1.98, base_price: 34,
      desc_fr: "Format city portrait pour mobilier urbain, arrêts et passages.",
      desc_en: "Portrait cityformat for street furniture, stops and walkways.",
    },
    {
      code: "F200L", section: "OOH",
      name_fr: "F200L — Cityformat backlit",
      name_en: "F200L — Cityformat backlit",
      width_cm: 116.5, height_cm: 170, surface_m2: 1.98, base_price: 58,
      desc_fr: "Version rétro-éclairée du F200 pour emplacements backlit 24/7.",
      desc_en: "Backlit version of F200 for 24/7 backlit locations.",
    },
    // ───────── MOOH ─────────
    {
      code: "TB", section: "MOOH",
      name_fr: "TrafficBoard — Côté bus",
      name_en: "TrafficBoard — Bus side",
      width_cm: 300, height_cm: 70, surface_m2: 2.10, base_price: 145,
      desc_fr: "Grand panneau latéral sur bus (gauche ou droite). Visibilité maximale en circulation.",
      desc_en: "Large side panel on bus (left or right). Maximum visibility on the move.",
    },
    {
      code: "RS", section: "MOOH",
      name_fr: "RoofStrip — Bandeau toit",
      name_en: "RoofStrip — Roof band",
      width_cm: 220, height_cm: 35, surface_m2: 0.77, base_price: 88,
      desc_fr: "Bandeau allongé sur le toit du véhicule (bus, tram). Lisible depuis les étages.",
      desc_en: "Long roof band on the vehicle (bus, tram). Readable from upper floors.",
    },
    {
      code: "F12T", section: "MOOH",
      name_fr: "F12 Traffic — Bus/Tram",
      name_en: "F12 Traffic — Bus/Tram",
      width_cm: 268.5, height_cm: 128, surface_m2: 3.44, base_price: 96,
      desc_fr: "Format F12 monté sur véhicule de transport — compatible avec une campagne F12 statique.",
      desc_en: "F12 format mounted on vehicle — compatible with a static F12 campaign.",
    },
    {
      code: "RW", section: "MOOH",
      name_fr: "RearWindow — Lunette arrière",
      name_en: "RearWindow — Rear window",
      width_cm: 170, height_cm: 80, surface_m2: 1.36, base_price: 76,
      desc_fr: "Vinyle micro-perforé sur la lunette arrière du bus.",
      desc_en: "Micro-perforated vinyl on the bus rear window.",
    },
    {
      code: "HD", section: "MOOH",
      name_fr: "HangingDisplay — Intérieur",
      name_en: "HangingDisplay — Interior",
      width_cm: 35, height_cm: 50, surface_m2: 0.18, base_price: 14,
      desc_fr: "Affichette suspendue dans la cabine, captive auprès des passagers.",
      desc_en: "Hanging poster inside the cabin, captive audience.",
    },
  ],

  tiers: [
    { from: 1,   discount: 0 },
    { from: 10,  discount: 5 },
    { from: 25,  discount: 9 },
    { from: 50,  discount: 14 },
    { from: 100, discount: 20 },
    { from: 250, discount: 26 },
    { from: 500, discount: 32 },
  ],

  subjects: [
    { count: 1,  fee_chf: 45 },
    { count: 2,  fee_chf: 90 },
    { count: 3,  fee_chf: 135 },
    { count: 5,  fee_chf: 225 },
    { count: 10, fee_chf: 450 },
  ],

  papers: [
    { id: "p115",    name_fr: "Affichage Blueback 115 g",        name_en: "Blueback poster 115 gsm",         factor: 1.00, formats: ["F4", "F200"] },
    { id: "p135",    name_fr: "Affichage 135 g",                  name_en: "Poster 135 gsm",                  factor: 1.08, formats: ["F12", "F24"] },
    { id: "p150ill", name_fr: "Illustration 150 g (backlit)",     name_en: "Illustration 150 gsm (backlit)",  factor: 1.34, formats: ["F200L"] },
    { id: "pvinyl",  name_fr: "Vinyle adhésif (extérieur véhicule)", name_en: "Adhesive vinyl (vehicle exterior)", factor: 3.20, formats: ["TB", "RS", "F12T"] },
    { id: "pperfo",  name_fr: "Vinyle micro-perforé",             name_en: "Micro-perforated vinyl",          factor: 3.80, formats: ["RW"] },
    { id: "pcarton", name_fr: "Carton 350 g (intérieur cabine)", name_en: "Cardboard 350 gsm (cabin interior)", factor: 1.60, formats: ["HD"] },
  ],

  express_surcharge_pct: 22,

  // Site settings (editable in the admin so the customer doesn't redeploy)
  contact_email: "devis@oohline.ch",
  cookies_banner_enabled: true,

  // Editable page texts — each has a FR + EN version. Empty falls back to i18n.
  page_texts: {
    catalog: {
      title_fr: "Catalogue des formats",
      title_en: "Catalog of formats",
      sub_fr: "Affichage Out-of-Home — sélectionnez un format pour calculer votre devis.",
      sub_en: "Out-of-Home advertising — pick a format to compute your quote.",
    },
    calc: {
      title_fr: "Calculateur de prix",
      title_en: "Price calculator",
      sub_fr: "Devis instantané. Aucun compte requis pour consulter les prix.",
      sub_en: "Instant quote. No account required to view prices.",
    },
  },

  // Legal documents — Markdown content, editable from Admin → Légal.
  legal_pages: {
    legal: {
      title_fr: "Mentions légales",
      title_en: "Legal notice",
      content_fr: `### Éditeur du site

**Alter&Go Digital Sàrl**

Jardinière 75, 2300 La Chaux-de-Fonds, Suisse

Email : devis@oohline.ch · Téléphone : 079 706 86 86

Numéro IDE : CHE-148.137.939 · Numéro TVA : CHE-148.137.939 TVA

### Directeur de la publication

Représentant légal d'Alter&Go Digital Sàrl.

### Hébergement

Le site est hébergé par **Hostinger International Ltd.**, 61 Lordou Vironos Street, 6023 Larnaca, Chypre.

### Propriété intellectuelle

L'ensemble du contenu de ce site (textes, visuels, structure, base de prix) est protégé par le droit suisse de la propriété intellectuelle. Toute reproduction, représentation ou diffusion, totale ou partielle, sans autorisation écrite préalable est interdite.

### Conditions d'utilisation

Les prix affichés par le calculateur en ligne sont indicatifs et n'engagent pas l'éditeur. Un devis officiel n'est valide qu'après réception d'une confirmation écrite de notre part suite à votre demande.

### Droit applicable

Le présent site est régi par le droit suisse. Tout litige relatif à son utilisation relève de la compétence exclusive des tribunaux du canton de Neuchâtel.`,
      content_en: `### Site editor

**Alter&Go Digital Sàrl**

Jardinière 75, 2300 La Chaux-de-Fonds, Switzerland

Email: devis@oohline.ch · Phone: 079 706 86 86

Business ID: CHE-148.137.939 · VAT number: CHE-148.137.939 TVA

### Publication director

Legal representative of Alter&Go Digital Sàrl.

### Hosting

The site is hosted by **Hostinger International Ltd.**, 61 Lordou Vironos Street, 6023 Larnaca, Cyprus.

### Intellectual property

All content on this site (text, images, structure, pricing database) is protected by Swiss intellectual property law. Any reproduction, representation or distribution, in whole or in part, without prior written authorisation is prohibited.

### Terms of use

Prices displayed by the online calculator are indicative and do not bind the publisher. An official quote is only valid after written confirmation following your request.

### Applicable law

This site is governed by Swiss law. Any dispute relating to its use falls under the exclusive jurisdiction of the courts of the canton of Neuchâtel.`,
    },
    privacy: {
      title_fr: "Politique de confidentialité",
      title_en: "Privacy policy",
      content_fr: `> Cette politique décrit comment **Alter&Go Digital Sàrl** traite vos données personnelles conformément à la **nLPD** (Loi fédérale suisse sur la protection des données, en vigueur depuis le 1ᵉʳ septembre 2023) et, le cas échéant, au **RGPD** pour les visiteurs de l'Union européenne.

### 1. Responsable du traitement

Alter&Go Digital Sàrl — Jardinière 75, 2300 La Chaux-de-Fonds

Contact pour toute question relative aux données : [privacy@oohline.ch](mailto:privacy@oohline.ch)

### 2. Données collectées

Nous collectons uniquement les données que vous nous transmettez via le formulaire de demande de devis :

- Nom de l'entreprise
- Nom et prénom du contact
- Adresse email
- Numéro de téléphone (facultatif)
- Message libre (facultatif)
- Détails de la commande envisagée (format, quantité, papier, délai)

Aucune donnée n'est collectée silencieusement. Aucun cookie de tracking ou de publicité n'est utilisé.

### 3. Finalités

Vos données sont utilisées exclusivement pour :

- Vous répondre, vous adresser un devis officiel et exécuter la commande le cas échéant
- Tenir notre comptabilité (obligation légale, articles 957 ss CO)
- Vous joindre en cas de question sur votre demande

### 4. Base légale

Pour la nLPD : intérêt légitime à traiter votre demande commerciale et exécution d'une relation contractuelle pré-existante.

Pour le RGPD (visiteurs UE) : article 6(1)(b) — mesures précontractuelles — et article 6(1)(f) — intérêt légitime.

### 5. Durée de conservation

Les demandes non suivies d'une commande sont conservées **12 mois** puis supprimées. Les pièces comptables liées à une commande sont conservées 10 ans (obligation légale suisse).

### 6. Destinataires

Vos données ne sont pas vendues ni partagées avec des tiers à des fins commerciales. Elles peuvent être traitées par notre prestataire d'envoi d'email et notre hébergeur, situés en Suisse ou dans l'UE, sous accord de confidentialité.

### 7. Vos droits

Vous disposez à tout moment des droits suivants : accès, rectification, suppression, opposition, limitation, portabilité. Pour exercer ces droits, écrivez-nous à [privacy@oohline.ch](mailto:privacy@oohline.ch) en justifiant de votre identité.

Vous pouvez également déposer une plainte auprès du **Préposé fédéral à la protection des données et à la transparence** (PFPDT) en Suisse, ou auprès de l'autorité de contrôle de votre pays de résidence pour les visiteurs UE.

### 8. Sécurité

Les échanges entre votre navigateur et le serveur sont chiffrés (HTTPS/TLS). Les accès administrateur sont protégés par mot de passe haché.`,
      content_en: `> This policy describes how **Alter&Go Digital Sàrl** processes your personal data in accordance with the Swiss **FADP** (Federal Act on Data Protection, in force since 1 September 2023) and, where applicable, the **GDPR** for visitors from the European Union.

### 1. Data controller

Alter&Go Digital Sàrl — Jardinière 75, 2300 La Chaux-de-Fonds, Switzerland

Privacy contact: [privacy@oohline.ch](mailto:privacy@oohline.ch)

### 2. Data collected

We only collect data you provide via the quote request form:

- Company name
- Contact first and last name
- Email address
- Phone number (optional)
- Free-text message (optional)
- Order details (format, quantity, paper, delivery time)

No data is collected silently. No tracking or advertising cookies are used.

### 3. Purposes

Your data is used exclusively to:

- Reply, issue an official quote and fulfil the order if applicable
- Maintain accounting records (legal obligation, articles 957 ff CO)
- Reach you with questions about your request

### 4. Legal basis

For FADP: legitimate interest in processing your commercial request and performance of pre-contractual measures.

For GDPR (EU visitors): Article 6(1)(b) — pre-contractual measures — and Article 6(1)(f) — legitimate interest.

### 5. Retention

Quote requests not followed by an order are kept for **12 months** then deleted. Accounting records linked to an order are kept for 10 years (Swiss legal obligation).

### 6. Recipients

Your data is not sold or shared with third parties for commercial purposes. It may be processed by our email provider and hosting provider, located in Switzerland or the EU, under confidentiality agreements.

### 7. Your rights

You have the following rights at any time: access, rectification, deletion, objection, restriction, portability. To exercise them, write to [privacy@oohline.ch](mailto:privacy@oohline.ch) with proof of identity.

You may also lodge a complaint with the **Federal Data Protection and Information Commissioner** (FDPIC) in Switzerland, or with your local supervisory authority for EU visitors.

### 8. Security

Communications between your browser and the server are encrypted (HTTPS/TLS). Admin access is protected by hashed password.`,
    },
    cookies: {
      title_fr: "Politique cookies",
      title_en: "Cookies policy",
      content_fr: `### Cookies & stockage local utilisés

Ce site n'utilise **aucun cookie de tracking publicitaire**, ni Google Analytics, Meta Pixel ou autre outil de profilage. Seuls les éléments suivants sont stockés dans votre navigateur :

| Clé | Type | Finalité | Durée |
|---|---|---|---|
| ooh_cookies_consent_v1 | localStorage | Mémoriser votre choix sur ce bandeau | Permanent |
| ooh_pricing_db_v* | localStorage | Cache local de la base de prix (admin) | Permanent |
| ooh_admin_creds_v* | localStorage | Identifiants admin (mot de passe haché) | Permanent |
| ooh_admin_session_v1 | sessionStorage | Session admin courante | Onglet |

### Comment les supprimer ?

Vous pouvez vider ces éléments à tout moment via les outils de votre navigateur (Paramètres → Confidentialité → Effacer les données du site).`,
      content_en: `### Cookies & local storage used

This site uses **no advertising tracking cookies**, no Google Analytics, Meta Pixel or other profiling tools. Only the following items are stored in your browser:

| Key | Type | Purpose | Duration |
|---|---|---|---|
| ooh_cookies_consent_v1 | localStorage | Remember your choice on the banner | Permanent |
| ooh_pricing_db_v* | localStorage | Local cache of pricing database (admin) | Permanent |
| ooh_admin_creds_v* | localStorage | Admin credentials (hashed password) | Permanent |
| ooh_admin_session_v1 | sessionStorage | Current admin session | Tab |

### How to delete them?

You can clear these items at any time via your browser tools (Settings → Privacy → Clear site data).`,
    },
  },

  // Header — logo + brand text, editable from Admin → En-tête.
  // logo: null (renders the placeholder square) OR a data: URL (svg/png/jpg/webp).
  header: {
    logo: null,
    logo_alt: "OOH Line",
    brand_name: "OOH Line",
    brand_tag: "",
    show_status: true,
    show_lang: true,
  },

  // Footer — fully editable from Admin → Footer.
  // Magic tokens inside lines: {{legal}}, {{privacy}}, {{cookies}} → modal links;
  // {{email:foo@bar.ch}} → mailto link; {{year}} → current year.
  footer: {
    enabled: true,
    sections: [
      {
        id: "company",
        enabled: true,
        title: "",
        align: "left",
        bold_first: true,
        lines: [
          "Alter&Go Digital Sàrl",
          "Jardinière 75, 2300 La Chaux-de-Fonds",
          "IDE CHE-148.137.939 · TVA CHE-148.137.939 TVA",
        ],
      },
      {
        id: "contact",
        enabled: true,
        title: "Contact",
        align: "left",
        lines: [
          "{{contact_email}}",
          "079 706 86 86",
        ],
      },
      {
        id: "infos",
        enabled: true,
        title: "Informations",
        align: "left",
        lines: [
          "{{legal}}",
          "{{privacy}}",
          "{{cookies}}",
        ],
      },
      {
        id: "rights",
        enabled: true,
        title: "",
        align: "right",
        muted: true,
        lines: [
          "© {{year}} Alter&Go Digital Sàrl",
          "Tous droits réservés",
        ],
      },
    ],
  },
};

function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

window.DB = {
  load() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (!raw) return deepClone(DEFAULT_DB);
      const parsed = JSON.parse(raw);
      return { ...deepClone(DEFAULT_DB), ...parsed };
    } catch {
      return deepClone(DEFAULT_DB);
    }
  },
  save(db) {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  },
  reset() {
    localStorage.removeItem(DB_KEY);
    return deepClone(DEFAULT_DB);
  },
  defaults() { return deepClone(DEFAULT_DB); },
};
