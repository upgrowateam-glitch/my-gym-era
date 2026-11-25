import { badRequest } from './errors.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 'YYYY-MM-DD' calendar date (validated, e.g. rejects 2026-02-30). */
export function dateKey(value, field = 'date') {
  if (typeof value !== 'string' || !DATE_RE.test(value)) {
    throw badRequest(`${field} must be a date in YYYY-MM-DD format.`, 'invalid_date');
  }
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) {
    throw badRequest(`${field} is not a valid date.`, 'invalid_date');
  }
  return value;
}

/** ISO 8601 timestamp → Date. */
export function timestamp(value, field) {
  const d = typeof value === 'string' ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) throw badRequest(`${field} must be an ISO date-time.`, 'invalid_timestamp');
  return d;
}

/** A plain JSON object (not an array / null). */
export function jsonObject(value, field) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw badRequest(`${field} must be a JSON object.`, 'invalid_body');
  }
  return value;
}

export function string(value, field, { max = 500, allowEmpty = true } = {}) {
  if (typeof value !== 'string') throw badRequest(`${field} must be text.`, 'invalid_body');
  const v = value.trim();
  if (!allowEmpty && v === '') throw badRequest(`${field} is required.`, 'invalid_body');
  if (v.length > max) throw badRequest(`${field} is too long (max ${max}).`, 'invalid_body');
  return v;
}

export function stringArray(value, field, { maxItems = 100, maxLength = 1000 } = {}) {
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
    throw badRequest(`${field} must be a list of text values.`, 'invalid_body');
  }
  if (value.length > maxItems) throw badRequest(`${field} has too many items.`, 'invalid_body');
  if (value.some((v) => v.length > maxLength)) throw badRequest(`${field} has an item that is too long.`, 'invalid_body');
  return value;
}

export function number(value, field, { min = -Infinity, max = Infinity, integer = false } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max ||
      (integer && !Number.isInteger(value))) {
    throw badRequest(`${field} must be ${integer ? 'a whole number' : 'a number'} between ${min} and ${max}.`, 'invalid_body');
  }
  return value;
}

export function boolean(value, field) {
  if (typeof value !== 'boolean') throw badRequest(`${field} must be true or false.`, 'invalid_body');
  return value;
}

export function oneOf(value, field, allowed) {
  if (!allowed.includes(value)) throw badRequest(`${field} must be one of: ${allowed.join(', ')}.`, 'invalid_body');
  return value;
}

/** Body weight in kg, as accepted by the app. */
export const weightKg = (value) => number(value, 'weight', { min: 1, max: 700 });
