export const DEFAULT_EXPIRY_WARNING_DAYS = 30;

export function getExpiryWarningDays(sectorConfig) {
  const days = Number(sectorConfig?.expiryWarningDays);
  return Number.isFinite(days) && days > 0 ? days : DEFAULT_EXPIRY_WARNING_DAYS;
}
