const BOLIVIA_COUNTRY_CODE = '591';

export function normalizeBolivianPhone(value) {
  const raw = String(value || '').trim();
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';

  let national = '';
  if (digits.startsWith(BOLIVIA_COUNTRY_CODE) && digits.length === 11) {
    national = digits.slice(3);
  } else if (digits.startsWith('0') && digits.length === 9) {
    national = digits.slice(1);
  } else if (digits.length === 8) {
    national = digits;
  } else {
    return '';
  }

  if (!/^[67]\d{7}$/.test(national)) return '';
  return `+${BOLIVIA_COUNTRY_CODE}${national}`;
}

export function formatPhoneDisplay(phone) {
  const normalized = normalizeBolivianPhone(phone);
  if (!normalized) return String(phone || '').trim();
  return `+591 ${normalized.slice(4)}`;
}
