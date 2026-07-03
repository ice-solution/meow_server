const DailyJobLog = require('../models/DailyJobLog');
const { buildEmailUsersCsv } = require('./emailExport');
const { sendMail, getMailConfig } = require('./mailer');
const { getDateKey } = require('./giftInventory');
const { createLogger } = require('../utils/logger');

const log = createLogger('ClientEmailReport');

const JOB_NAME = 'clientEmailReport';
const HK_TZ = 'Asia/Hong_Kong';

function getHkTimeParts(now = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: HK_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    dateKey: `${map.year}-${map.month}-${map.day}`,
    hour: Number(map.hour),
    minute: Number(map.minute),
  };
}

async function sendClientEmailReport({ trigger = 'manual' } = {}) {
  const { clientEmail } = getMailConfig();
  if (!clientEmail) {
    throw new Error('未配置 CLIENT_EMAIL');
  }

  const dateKey = getDateKey();
  const { csv, rowCount } = await buildEmailUsersCsv();
  const filename = `weow-email-users-${dateKey}.csv`;

  await sendMail({
    to: clientEmail,
    subject: `Hunger Run 2026 Email 用戶列表 ${dateKey}`,
    text: `附件為 WeOW 全部 Email 用戶列表（共 ${rowCount} 筆）。\n觸發方式：${trigger === 'scheduled' ? '每日自動' : '人手發送'}\n香港日期：${dateKey}`,
    html: `<p>附件為 WeOW 全部 Email 用戶列表（共 <strong>${rowCount}</strong> 筆）。</p><p>觸發方式：${trigger === 'scheduled' ? '每日自動' : '人手發送'}</p><p>香港日期：${dateKey}</p>`,
    attachments: [
      {
        filename,
        content: csv,
        contentType: 'text/csv; charset=utf-8',
      },
    ],
  });

  log.ok('client email report sent', { trigger, rowCount, dateKey, to: clientEmail });
  return { ok: true, rowCount, dateKey, to: clientEmail, trigger };
}

async function trySendScheduledReport() {
  const now = new Date();
  const { dateKey, hour, minute } = getHkTimeParts(now);

  if (hour !== 0 || minute !== 0) {
    return { skipped: true, reason: 'not_midnight' };
  }

  try {
    await DailyJobLog.create({ job: JOB_NAME, dateKey });
  } catch (err) {
    if (err?.code === 11000) {
      return { skipped: true, reason: 'already_sent', dateKey };
    }
    throw err;
  }

  try {
    const result = await sendClientEmailReport({ trigger: 'scheduled' });
    return { ...result, skipped: false };
  } catch (err) {
    await DailyJobLog.deleteOne({ job: JOB_NAME, dateKey }).catch(() => {});
    throw err;
  }
}

function startClientEmailScheduler() {
  const tick = async () => {
    try {
      await trySendScheduledReport();
    } catch (err) {
      log.error('scheduled client email failed', err);
    }
  };

  setInterval(tick, 60 * 1000);
  log.ok('client email scheduler started', { timezone: HK_TZ, schedule: '00:00 daily' });
}

module.exports = {
  sendClientEmailReport,
  trySendScheduledReport,
  startClientEmailScheduler,
};
