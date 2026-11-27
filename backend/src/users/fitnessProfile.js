// Fitness profile (Phase 2): the questions a User answers after signing up.
//
// Stored in client_profiles.data under the key "fitness":
//   { personal, body, health, goals, routine, food, sleep, completedAt, updatedAt }
// Each step is validated strictly here (unknown fields are rejected), so only
// clean data reaches the database. BMI and sleep hours are always calculated
// by the server, never taken from the app.

import { badRequest } from '../errors.js';
import * as v from '../validate.js';
import { normaliseWhatsapp } from './userModel.js';

export const SECTIONS = ['personal', 'body', 'health', 'goals', 'routine', 'food', 'sleep'];

export const CHOICES = {
  gender: ['male', 'female', 'other', 'prefer_not_to_say'],
  smoking: ['never', 'quit', 'current'],
  goal: ['lose_weight', 'build_muscle', 'get_fitter', 'endurance', 'flexibility', 'stay_healthy'],
  experience: ['beginner', 'intermediate', 'advanced'],
  pastTraining: ['gym', 'home', 'running', 'yoga', 'sports', 'swimming', 'none'],
  trainingDuration: ['under_6_months', '6_to_12_months', '1_to_3_years', 'over_3_years'],
  workType: ['desk', 'mixed', 'physical'],
  activityLevel: ['sedentary', 'light', 'moderate', 'active', 'very_active'],
  workoutTime: ['early_morning', 'morning', 'afternoon', 'evening', 'night', 'flexible'],
  dietType: ['vegetarian', 'non_vegetarian', 'eggetarian', 'vegan', 'jain'],
  eatingOut: ['rarely', 'weekly', 'few_times_week', 'daily'],
  sleepQuality: ['poor', 'fair', 'good', 'great'],
};

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const MIN_AGE = 13;
const MAX_AGE = 100;

function only(data, allowed, section) {
  v.jsonObject(data, section);
  for (const key of Object.keys(data)) {
    if (!allowed.includes(key)) throw badRequest(`Unknown field in ${section}: ${key}`, 'unknown_field');
  }
}

const optionalText = (x, field, max) => (x === undefined || x === null ? '' : v.string(x, field, { max }));
const round1 = (n) => Math.round(n * 10) / 10;

function time(value, field) {
  if (typeof value !== 'string' || !TIME_RE.test(value)) {
    throw badRequest(`${field} must be a time in HH:MM (24-hour) format.`, 'invalid_time');
  }
  return value;
}

function ageOn(dob, today = new Date()) {
  const [y, m, d] = dob.split('-').map(Number);
  let age = today.getUTCFullYear() - y;
  const beforeBirthday = today.getUTCMonth() + 1 < m || (today.getUTCMonth() + 1 === m && today.getUTCDate() < d);
  if (beforeBirthday) age -= 1;
  return age;
}

/** BMI = kg / m², with the WHO adult category. */
export function bmiFor(heightCm, weightKg) {
  if (!heightCm || !weightKg) return null;
  const value = round1(weightKg / (heightCm / 100) ** 2);
  const category = value < 18.5 ? 'underweight' : value < 25 ? 'normal' : value < 30 ? 'overweight' : 'obese';
  return { value, category };
}

/** Hours between bedtime and wake-up time (crossing midnight is fine). */
export function sleepHoursFor(bedtime, wakeTime) {
  const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  let diff = toMin(wakeTime) - toMin(bedtime);
  if (diff <= 0) diff += 24 * 60;
  return round1(diff / 60);
}

/**
 * Validates one step. Returns { data } to store and, for the personal step,
 * { account } with the columns that live on the users table (name, WhatsApp).
 */
export function validateSection(section, data) {
  switch (section) {
    case 'personal': {
      only(data, ['displayName', 'gender', 'dateOfBirth', 'whatsapp'], section);
      const displayName = v.string(data.displayName, 'Name', { max: 100, allowEmpty: false });
      const gender = v.oneOf(data.gender, 'gender', CHOICES.gender);
      const dateOfBirth = v.dateKey(data.dateOfBirth, 'Date of birth');
      const age = ageOn(dateOfBirth);
      if (age < MIN_AGE || age > MAX_AGE) {
        throw badRequest(`Age must be between ${MIN_AGE} and ${MAX_AGE} years.`, 'invalid_age');
      }
      const whatsapp = normaliseWhatsapp(data.whatsapp);
      if (whatsapp === undefined) throw badRequest('Enter a valid phone / WhatsApp number (digits, optional +).', 'invalid_whatsapp');
      return { data: { gender, dateOfBirth }, account: { displayName, whatsapp } };
    }
    case 'body': {
      only(data, ['heightCm', 'weightKg', 'targetWeightKg'], section);
      const heightCm = round1(v.number(data.heightCm, 'Height (cm)', { min: 100, max: 250 }));
      const weightKg = round1(v.number(data.weightKg, 'Weight (kg)', { min: 25, max: 300 }));
      const targetWeightKg = data.targetWeightKg === undefined || data.targetWeightKg === null
        ? null
        : round1(v.number(data.targetWeightKg, 'Target weight (kg)', { min: 25, max: 300 }));
      return { data: { heightCm, weightKg, targetWeightKg } };
    }
    case 'health': {
      only(data, ['injuries', 'medicalConditions', 'smoking'], section);
      return {
        data: {
          injuries: optionalText(data.injuries, 'Injuries', 500),
          medicalConditions: optionalText(data.medicalConditions, 'Medical conditions', 500),
          smoking: v.oneOf(data.smoking, 'smoking', CHOICES.smoking),
        },
      };
    }
    case 'goals': {
      only(data, ['mainGoal', 'extraGoals', 'experience', 'pastTraining', 'trainingDuration', 'experienceNotes'], section);
      const mainGoal = v.oneOf(data.mainGoal, 'mainGoal', CHOICES.goal);
      const extra = data.extraGoals === undefined ? [] : v.stringArray(data.extraGoals, 'extraGoals', { maxItems: 5 });
      for (const g of extra) v.oneOf(g, 'extraGoals', CHOICES.goal);
      const extraGoals = [...new Set(extra)].filter((g) => g !== mainGoal);
      const experience = v.oneOf(data.experience, 'experience', CHOICES.experience);

      // Previous workout experience: what they did before and for how long.
      const past = [...new Set(v.stringArray(data.pastTraining ?? [], 'pastTraining', { maxItems: 7 }))];
      for (const t of past) v.oneOf(t, 'pastTraining', CHOICES.pastTraining);
      if (past.length === 0) throw badRequest('Please choose the training you have done before (or "None").', 'invalid_past_training');
      if (past.includes('none') && past.length > 1) {
        throw badRequest('"None" cannot be combined with other training types.', 'invalid_past_training');
      }
      const none = past[0] === 'none';
      const trainingDuration = none ? null : v.oneOf(data.trainingDuration, 'trainingDuration', CHOICES.trainingDuration);
      const experienceNotes = optionalText(data.experienceNotes, 'Experience notes', 300);
      return { data: { mainGoal, extraGoals, experience, pastTraining: past, trainingDuration, experienceNotes } };
    }
    case 'routine': {
      only(data, ['workType', 'activityLevel', 'workoutDays', 'workoutTime'], section);
      return {
        data: {
          workType: v.oneOf(data.workType, 'workType', CHOICES.workType),
          activityLevel: v.oneOf(data.activityLevel, 'activityLevel', CHOICES.activityLevel),
          workoutDays: v.number(data.workoutDays, 'Workout days per week', { min: 1, max: 7, integer: true }),
          workoutTime: v.oneOf(data.workoutTime, 'workoutTime', CHOICES.workoutTime),
        },
      };
    }
    case 'food': {
      only(data, ['dietType', 'mealsPerDay', 'waterLitres', 'avoidFoods', 'eatingOut'], section);
      return {
        data: {
          dietType: v.oneOf(data.dietType, 'dietType', CHOICES.dietType),
          mealsPerDay: v.number(data.mealsPerDay, 'Meals per day', { min: 1, max: 8, integer: true }),
          waterLitres: round1(v.number(data.waterLitres, 'Water per day (litres)', { min: 0.5, max: 8 })),
          avoidFoods: optionalText(data.avoidFoods, 'Foods to avoid', 300),
          eatingOut: v.oneOf(data.eatingOut, 'eatingOut', CHOICES.eatingOut),
        },
      };
    }
    case 'sleep': {
      only(data, ['bedtime', 'wakeTime', 'quality'], section);
      const bedtime = time(data.bedtime, 'Bedtime');
      const wakeTime = time(data.wakeTime, 'Wake-up time');
      if (bedtime === wakeTime) throw badRequest('Bedtime and wake-up time cannot be the same.', 'invalid_time');
      return {
        data: {
          bedtime, wakeTime,
          sleepHours: sleepHoursFor(bedtime, wakeTime),
          quality: v.oneOf(data.quality, 'quality', CHOICES.sleepQuality),
        },
      };
    }
    default:
      throw badRequest(`Unknown profile step: ${section}`, 'unknown_section');
  }
}

/** The stored fitness object plus calculated values, as sent to the app. */
export function toPublicFitness(fitness, user) {
  const f = fitness ?? {};
  const out = {};
  for (const s of SECTIONS) out[s] = f[s] ?? null;
  // Name / WhatsApp live on the account, so they are always current.
  if (out.personal && user) out.personal = { ...out.personal, displayName: user.display_name, whatsapp: user.whatsapp };
  out.bmi = out.body ? bmiFor(out.body.heightCm, out.body.weightKg) : null;
  out.age = out.personal?.dateOfBirth ? ageOn(out.personal.dateOfBirth) : null;
  out.missing = SECTIONS.filter((s) => !out[s]);
  out.completedAt = f.completedAt ?? null;
  out.updatedAt = f.updatedAt ?? null;
  return out;
}
