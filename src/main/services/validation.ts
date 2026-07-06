import type { VisitFrequency } from '../../shared/types/app-api.js';

export function normalizeFacilityName(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error('FACILITY_NAME_INVALID');
  }

  const name = value.trim();
  if (name.length < 1 || name.length > 40) {
    throw new Error('FACILITY_NAME_INVALID');
  }

  return name;
}

export function assertPositiveId(value: unknown): number {
  if (!Number.isInteger(value) || Number(value) <= 0) {
    throw new Error('ID_INVALID');
  }

  return Number(value);
}

export function assertVisitFrequency(value: unknown): VisitFrequency {
  if (value !== 1 && value !== 2 && value !== 3) {
    throw new Error('VISIT_FREQUENCY_INVALID');
  }

  return value;
}

export function assertMonth(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-01$/.test(value)) {
    throw new Error('MONTH_INVALID');
  }

  return value;
}

export function assertIsoDate(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('DATE_INVALID');
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error('DATE_INVALID');
  }

  return value;
}

export function assertNonNegativeInteger(value: unknown): number {
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw new Error('NON_NEGATIVE_INTEGER_INVALID');
  }

  return Number(value);
}

export function parseThousandYenToYen(value: string | number): number {
  const text = String(value).replaceAll(',', '').trim();
  if (!/^\d+(\.\d)?$/.test(text)) {
    throw new Error('AMOUNT_INVALID');
  }

  const [wholeText, decimalText = ''] = text.split('.');
  const whole = Number.parseInt(wholeText, 10);
  const decimal = decimalText ? Number.parseInt(decimalText, 10) : 0;

  return whole * 1000 + decimal * 100;
}
