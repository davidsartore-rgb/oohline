'use strict';
const nodemailer = require('nodemailer');
const { fmtCHF } = require('./pricing');

let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;
  const provider = process.env.SMTP_PROVIDER || 'smtp';
  if (provider === 'postmark') {
    _transporter = nodemailer.createTransport({
      host: 'smtp.postmarkapp.com',
      port: 587,
      auth: { user: process.env.POSTMARK_API_KEY, pass: process.env.POSTMARK_API_KEY },
    });
  } else {
    _transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.hostinger.com',
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return _transporter;
}

function buildQuoteBreakdown(result, lang) {
  const fr = lang !== 'en';
  const lines = [];
  lines.push(`${fr ? 'Format' : 'Format'}: ${result.fmt.code} — ${fr ? result.fmt.name_fr : result.fmt.name_en}`);
  lines.push(`${fr ? 'Quantité' : 'Quantity'}: ${result.qty} ${fr ? 'exemplaires' : 'copies'}`);
  lines.push(`${fr ? 'Sujets' : 'Subjects'}: ${result.subj}`);
  if (result.paper) lines.push(`${fr ? 'Papier' : 'Paper'}: ${fr ? result.paper.name_fr : result.paper.name_en}`);
  lines.push(`${fr ? 'Délai' : 'Lead time'}: ${result.expressPct > 0 ? (fr ? 'Express (48h)' : 'Express (48h)') : (fr ? 'Standard (5 jours)' : 'Standard (5 days)')}`);
  lines.push('');
  lines.push(`${fr ? 'Sous-total HT' : 'Subtotal (excl. VAT)'}: ${fmtCHF(result.subtotal)}`);
  if (result.discountAmount > 0) {
    lines.push(`${fr ? 'Remise volume' : 'Volume discount'} (${Math.round(result.discountPct * 100)}%): -${fmtCHF(result.discountAmount)}`);
  }
  if (result.subjectFee > 0) {
    lines.push(`${fr ? 'Traitement fichiers' : 'File processing'} (${result.subj} ${fr ? 'sujet(s)' : 'subject(s)'}): +${fmtCHF(result.subjectFee)}`);
  }
  if (result.expressAmount > 0) {
    lines.push(`${fr ? 'Majoration express' : 'Express surcharge'} (${Math.round(result.expressPct * 100)}%): +${fmtCHF(result.expressAmount)}`);
  }
  lines.push(`${fr ? 'Total HT' : 'Total (excl. VAT)'}: ${fmtCHF(result.totalHT)}`);
  lines.push(`TVA 8.1%: ${fmtCHF(result.vat)}`);
  lines.push(`${fr ? 'Total TTC' : 'Total (incl. VAT)'}: ${fmtCHF(result.totalTTC)}`);
  return lines.join('\n');
}

async function sendQuoteInternal({ quote, result, adminUrl }) {
  const subject = `[OOH Line] Nouvelle demande de devis #${quote.reference} — ${quote.company}`;
  const text = `
Nouvelle demande de devis reçue.

Référence : ${quote.reference}
Entreprise : ${quote.company}
Contact : ${quote.contact_name}
Email : ${quote.email}${quote.phone ? `\nTéléphone : ${quote.phone}` : ''}
${quote.message ? `\nMessage :\n${quote.message}\n` : ''}
──────────────────────────────
${buildQuoteBreakdown(result, 'fr')}
──────────────────────────────

Consentement enregistré le ${new Date(quote.consent_at).toLocaleString('fr-CH')}
IP : ${quote.consent_ip || 'inconnue'}

${adminUrl ? `Voir dans l'admin : ${adminUrl}/quote/${quote.id}` : ''}
  `.trim();

  await getTransporter().sendMail({
    from: process.env.SMTP_FROM,
    to: process.env.CONTACT_EMAIL,
    subject,
    text,
  });
}

async function sendQuoteConfirmation({ quote, result }) {
  const fr = quote.lang !== 'en';
  const subject = fr
    ? `[OOH Line] Confirmation de votre demande de devis #${quote.reference}`
    : `[OOH Line] Quote request confirmation #${quote.reference}`;

  const text = fr ? `
Bonjour ${quote.contact_name},

Nous avons bien reçu votre demande de devis et vous répondrons sous 24 heures ouvrées.

Référence de votre demande : ${quote.reference}

──────────────────────────────
${buildQuoteBreakdown(result, 'fr')}
──────────────────────────────

Cette confirmation ne constitue pas un devis officiel. Un devis signé vous sera transmis après validation de votre demande.

Pour toute question : ${process.env.CONTACT_EMAIL}

Cordialement,
L'équipe OOH Line

---
Vos données personnelles sont traitées conformément à notre politique de confidentialité (nLPD / RGPD).
Elles seront conservées 12 mois. Pour exercer vos droits : privacy@oohline.ch
  `.trim() : `
Dear ${quote.contact_name},

We have received your quote request and will get back to you within 24 business hours.

Your reference: ${quote.reference}

──────────────────────────────
${buildQuoteBreakdown(result, 'en')}
──────────────────────────────

This is not an official quote. A signed quote will be sent after review of your request.

For any questions: ${process.env.CONTACT_EMAIL}

Best regards,
The OOH Line team

---
Your personal data is processed in accordance with our privacy policy (FADP / GDPR).
Retained for 12 months. To exercise your rights: privacy@oohline.ch
  `.trim();

  await getTransporter().sendMail({
    from: process.env.SMTP_FROM,
    to: quote.email,
    subject,
    text,
  });
}

async function sendRecoveryLink({ to, token, appUrl }) {
  const url = `${appUrl}/#recover=${token}`;
  await getTransporter().sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: '[OOH Line Admin] Lien de récupération de compte',
    text: `
Vous avez demandé une réinitialisation de votre accès administrateur OOH Line.

Cliquez sur le lien ci-dessous (valable 24 heures, usage unique) :

${url}

Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.
    `.trim(),
  });
}

async function send2FABackupCodes({ to, codes }) {
  await getTransporter().sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: '[OOH Line Admin] Codes de secours 2FA',
    text: `
Vos codes de secours pour la double authentification (2FA) OOH Line.
Chaque code est à usage unique. Conservez-les en lieu sûr.

${codes.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Ces codes ne peuvent être régénérés qu'en désactivant puis réactivant la 2FA.
    `.trim(),
  });
}

module.exports = {
  sendQuoteInternal,
  sendQuoteConfirmation,
  sendRecoveryLink,
  send2FABackupCodes,
};
