const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(value) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

// Las fechas de Supabase llegan como YYYY-MM-DD. Se interpretan en hora local
// para que el aviso no se adelante ni se atrase por la zona horaria.
export function parseAlertDate(value) {
  if (!value) return null;
  if (value instanceof Date) return startOfDay(value);
  const raw = String(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  return startOfDay(raw);
}

export function buildFixedExpenseAlerts(expenses = [], now = new Date()) {
  const today = startOfDay(now);
  if (!today) return [];

  return (expenses || [])
    .filter((expense) => {
      const type = expense.expense_type || expense.expenseType;
      const enabled = expense.alert_enabled ?? expense.alertEnabled;
      const date = expense.alert_date || expense.alertDate;
      return type === 'fixed' && !!enabled && !!date;
    })
    .map((expense) => {
      const dueDate = parseAlertDate(expense.alert_date || expense.alertDate);
      if (!dueDate) return null;
      const daysBeforeRaw = Number(expense.alert_days_before ?? expense.alertDaysBefore ?? 3);
      const daysBefore = Number.isFinite(daysBeforeRaw) ? Math.max(0, Math.round(daysBeforeRaw)) : 3;
      const daysLeft = Math.round((dueDate - today) / DAY_MS);
      if (daysLeft > daysBefore) return null;
      return {
        id: expense.id,
        description: expense.description || 'Pago fijo',
        category: expense.category || 'Otros',
        supplier: expense.supplier || '',
        amount: Number(expense.amount || 0),
        dueDate,
        daysLeft,
        daysBefore,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.daysLeft - b.daysLeft || a.description.localeCompare(b.description));
}
