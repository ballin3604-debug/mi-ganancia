import { describe, expect, it } from 'vitest';
import { buildFixedExpenseAlerts, parseAlertDate } from './expenseAlerts';

describe('buildFixedExpenseAlerts', () => {
  const now = new Date(2026, 9, 30);

  it('incluye avisos vencidos y dentro de los días de anticipación', () => {
    const alerts = buildFixedExpenseAlerts([
      { id: 'vencido', expense_type: 'fixed', description: 'Alquiler', amount: 1200, alert_enabled: true, alert_date: '2026-10-29', alert_days_before: 3 },
      { id: 'hoy', expense_type: 'fixed', description: 'Luz', amount: 300, alert_enabled: true, alert_date: '2026-10-30', alert_days_before: 1 },
      { id: 'pronto', expense_type: 'fixed', description: 'Internet', amount: 250, alert_enabled: true, alert_date: '2026-11-02', alert_days_before: 3 },
      { id: 'lejos', expense_type: 'fixed', description: 'Agua', amount: 150, alert_enabled: true, alert_date: '2026-11-10', alert_days_before: 3 },
    ], now);

    expect(alerts.map((alert) => alert.id)).toEqual(['vencido', 'hoy', 'pronto']);
    expect(alerts[0]).toMatchObject({ daysLeft: -1, daysBefore: 3, amount: 1200 });
    expect(alerts[1]).toMatchObject({ daysLeft: 0 });
    expect(alerts[2]).toMatchObject({ daysLeft: 3 });
  });

  it('ignora egresos diarios, avisos desactivados y sin fecha', () => {
    const alerts = buildFixedExpenseAlerts([
      { id: 'diario', expense_type: 'daily', alert_enabled: true, alert_date: '2026-10-30' },
      { id: 'apagado', expense_type: 'fixed', alert_enabled: false, alert_date: '2026-10-30' },
      { id: 'sin-fecha', expense_type: 'fixed', alert_enabled: true },
    ], now);

    expect(alerts).toEqual([]);
  });

  it('acepta los campos en camelCase del cache local', () => {
    const alerts = buildFixedExpenseAlerts([
      { id: 'local', expenseType: 'fixed', alertEnabled: true, alertDate: '2026-10-31', alertDaysBefore: 2, amount: 80 },
    ], now);

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ id: 'local', daysLeft: 1, daysBefore: 2 });
  });

  it('ordena primero lo más vencido', () => {
    const alerts = buildFixedExpenseAlerts([
      { id: 'b', expense_type: 'fixed', description: 'B', alert_enabled: true, alert_date: '2026-10-30', alert_days_before: 3 },
      { id: 'a', expense_type: 'fixed', description: 'A', alert_enabled: true, alert_date: '2026-10-28', alert_days_before: 3 },
    ], now);

    expect(alerts.map((alert) => alert.id)).toEqual(['a', 'b']);
  });
});

describe('parseAlertDate', () => {
  it('interpreta YYYY-MM-DD sin corrimiento de zona horaria', () => {
    const date = parseAlertDate('2026-10-30');
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(9);
    expect(date.getDate()).toBe(30);
    expect(date.getHours()).toBe(0);
  });

  it('devuelve null para valores inválidos', () => {
    expect(parseAlertDate('')).toBeNull();
    expect(parseAlertDate('no-es-fecha')).toBeNull();
  });
});
