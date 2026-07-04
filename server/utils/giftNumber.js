const GIFT_NUMBER_WIDTH = 6;

function formatGiftNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return null;
  const num = Number.parseInt(digits, 10);
  if (!Number.isFinite(num) || num < 0) return null;
  return String(num).padStart(GIFT_NUMBER_WIDTH, '0');
}

function formatGiftNumberLabel(value) {
  const formatted = formatGiftNumber(value);
  return formatted ? `No.${formatted}` : '';
}

module.exports = {
  GIFT_NUMBER_WIDTH,
  formatGiftNumber,
  formatGiftNumberLabel,
};
