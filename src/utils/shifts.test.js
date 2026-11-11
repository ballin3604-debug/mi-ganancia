import { describe, expect, it } from 'vitest';
import {
  describeShiftStatus,
  formatShiftDays,
  getShiftStatus,
  isShiftActive,
  normalizeShift,
  normalizeTime,
  validateShift,
} from './shifts';

const MORNING = { label: 'Mañana', start: '08:00', end: '14:00', days: [1, 2, 3, 4, 5, 6] };
const NIGHT_MONDAY = { label: 'Noche', start: '20:00', end: '02:00', days: [1] };

// Noviembre 2026: lunes 9, martes 10, miércoles 11, domingo 15.
const mondayAt = (hour, minute = 0) => new Date(2026, 10, 9, hour, minute, 0, 0);
const tuesdayAt = (hour, minute = 0) => new Date(2026, 10, 10, hour, minute, 0, 0);
const sundayAt = (hour, minute = 0) => new Date(2026, 10, 15, hour, minute, 0, 0);

describe('turnos del personal', () => {
  it('normaliza horas con segundos y descarta valores inválidos', () => {
    expect(normalizeTime('08:00:00')).toBe('08:00');
    expect(normalizeTime('8:5')).toBe('');
    expect(normalizeTime('25:00')).toBe('');
    expect(normalizeTime('')).toBe('');
  });

  it('valida que el turno tenga entrada, salida y al menos un día', () => {
    expect(validateShift(MORNING)).toBe('');
    expect(validateShift({ start: '', end: '14:00', days: [1] })).toContain('entrada');
    expect(validateShift({ start: '08:00', end: '', days: [1] })).toContain('salida');
    expect(validateShift({ start: '08:00', end: '08:00', days: [1] })).toContain('misma hora');
    expect(validateShift({ start: '08:00', end: '14:00', days: [] })).toContain('al menos un día');
  });

  it('marca en turno dentro de la mañana y fuera antes o después', () => {
    expect(isShiftActive(MORNING, mondayAt(8, 0))).toBe(true);
    expect(isShiftActive(MORNING, mondayAt(13, 59))).toBe(true);
    expect(isShiftActive(MORNING, mondayAt(7, 59))).toBe(false);
    expect(isShiftActive(MORNING, mondayAt(14, 0))).toBe(false);
  });

  it('respeta los días laborables', () => {
    const mondayOnly = { ...MORNING, days: [1] };
    expect(isShiftActive(mondayOnly, mondayAt(10))).toBe(true);
    expect(isShiftActive(mondayOnly, tuesdayAt(10))).toBe(false);

    const status = getShiftStatus(mondayOnly, tuesdayAt(10));
    expect(status.active).toBe(false);
    expect(status.nextStart).toEqual(new Date(2026, 10, 16, 8, 0, 0, 0));
  });

  it('un turno nocturno sigue activo después de medianoche', () => {
    expect(isShiftActive(NIGHT_MONDAY, mondayAt(21))).toBe(true);
    expect(isShiftActive(NIGHT_MONDAY, tuesdayAt(1, 30))).toBe(true);
    expect(isShiftActive(NIGHT_MONDAY, tuesdayAt(2, 0))).toBe(false);
    expect(isShiftActive(NIGHT_MONDAY, tuesdayAt(21))).toBe(false);
  });

  it('no activa un turno nocturno cuya madrugada no pertenece a un día laborable', () => {
    const sundayNight = { ...NIGHT_MONDAY, days: [1] };
    expect(isShiftActive(sundayNight, mondayAt(1))).toBe(false);
  });

  it('calcula el próximo turno cuando está fuera de horario', () => {
    const status = getShiftStatus(MORNING, mondayAt(15));
    expect(status.active).toBe(false);
    expect(status.nextStart).toEqual(new Date(2026, 10, 10, 8, 0, 0, 0));
    expect(describeShiftStatus(status, mondayAt(15))).toContain('vuelve');

    const active = getShiftStatus(MORNING, mondayAt(10));
    expect(active.active).toBe(true);
    expect(describeShiftStatus(active, mondayAt(10))).toContain('En turno');
    expect(describeShiftStatus(getShiftStatus(null, mondayAt(10)))).toBe('Sin turno asignado');
  });

  it('desactiva y avisa cuando no hay turno configurado', () => {
    const status = getShiftStatus(null, mondayAt(10));
    expect(status.configured).toBe(false);
    expect(status.active).toBe(false);
    expect(isShiftActive({ start: '', end: '', days: [] }, mondayAt(10))).toBe(false);
  });

  it('muestra los días en formato corto y compacto', () => {
    expect(formatShiftDays([1, 2, 3, 4, 5, 6])).toBe('Lun a Sáb');
    expect(formatShiftDays([1, 2, 3, 4, 5])).toBe('Lun a Vie');
    expect(formatShiftDays([1, 2, 3, 4, 5, 6, 7])).toBe('Todos los días');
    expect(formatShiftDays([1, 3, 7])).toBe('Lun, Mié, Dom');
    expect(formatShiftDays([])).toBe('Sin días');
  });

  it('normaliza la etiqueta y los días del turno', () => {
    expect(normalizeShift({ start: '08:00', end: '14:00', days: [1, 1, 8, '2'] })).toEqual({
      label: 'Mañana',
      start: '08:00',
      end: '14:00',
      days: [1, 2],
    });
    expect(normalizeShift({ start: '09:00', end: '17:30', days: [1] }).label).toBe('Personalizado');
    expect(normalizeShift({ label: 'Oficina', start: '09:00', end: '17:30', days: [1] }).label).toBe('Oficina');
  });

  it('un turno nocturno de domingo se activa el domingo por la noche', () => {
    const sundayNight = { ...NIGHT_MONDAY, days: [7] };
    expect(isShiftActive(sundayNight, sundayAt(21))).toBe(true);
    expect(isShiftActive(sundayNight, mondayAt(1))).toBe(true);
    expect(isShiftActive(sundayNight, mondayAt(3))).toBe(false);
  });
});
