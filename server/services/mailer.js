const nodemailer = require('nodemailer');
const { createLogger } = require('../utils/logger');

const log = createLogger('Mailer');

let transporter = null;

function getMailConfig() {
  return {
    user: process.env.gmail_ac || process.env.GMAIL_AC || '',
    pass: process.env.gmail_pw || process.env.GMAIL_PW || '',
    clientEmail: process.env.CLIENT_EMAIL || '',
  };
}

function getTransporter() {
  if (transporter) return transporter;

  const { user, pass } = getMailConfig();
  if (!user || !pass) {
    throw new Error('未配置 gmail_ac / gmail_pw');
  }

  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });

  return transporter;
}

async function sendMail({ to, subject, text, html, attachments = [] }) {
  const { user, clientEmail } = getMailConfig();
  const recipient = to || clientEmail;

  if (!recipient) {
    throw new Error('未配置 CLIENT_EMAIL');
  }

  const transport = getTransporter();
  const info = await transport.sendMail({
    from: `"WeOW Hunger Run" <${user}>`,
    to: recipient,
    subject,
    text,
    html,
    attachments,
  });

  log.ok('email sent', { to: recipient, messageId: info.messageId, subject });
  return info;
}

module.exports = {
  sendMail,
  getMailConfig,
};
