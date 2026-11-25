// Fitness profile (Phase 2): types, answer options and server calls.
// The server validates every answer and calculates BMI / age / sleep hours;
// the app only calculates BMI itself for the live preview while typing.

import { api } from '@/lib/api';
import type { User } from '@/lib/types';
import type { IconName } from '@/components/ui/UI';

export type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say';
export type Smoking = 'never' | 'quit' | 'current';
export type Goal = 'lose_weight' | 'build_muscle' | 'get_fitter' | 'endurance' | 'flexibility' | 'stay_healthy';
export type Experience = 'beginner' | 'intermediate' | 'advanced';
export type WorkType = 'desk' | 'mixed' | 'physical';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type WorkoutTime = 'early_morning' | 'morning' | 'afternoon' | 'evening' | 'night' | 'flexible';
export type DietType = 'vegetarian' | 'non_vegetarian' | 'eggetarian' | 'vegan' | 'jain';
export type EatingOut = 'rarely' | 'weekly' | 'few_times_week' | 'daily';
export type SleepQuality = 'poor' | 'fair' | 'good' | 'great';
export type BmiCategory = 'underweight' | 'normal' | 'overweight' | 'obese';

export interface FitnessProfile {
  personal: { displayName: string; gender: Gender; dateOfBirth: string; whatsapp: string | null } | null;
  body: { heightCm: number; weightKg: number; targetWeightKg: number | null } | null;
  health: { injuries: string; medicalConditions: string; smoking: Smoking } | null;
  goals: { mainGoal: Goal; extraGoals: Goal[]; experience: Experience } | null;
  routine: { workType: WorkType; activityLevel: ActivityLevel; workoutDays: number; workoutTime: WorkoutTime } | null;
  food: { dietType: DietType; mealsPerDay: number; waterLitres: number; avoidFoods: string; eatingOut: EatingOut } | null;
  sleep: { bedtime: string; wakeTime: string; sleepHours: number; quality: SleepQuality } | null;
  bmi: { value: number; category: BmiCategory } | null;
  age: number | null;
  missing: Section[];
  completedAt: string | null;
  updatedAt: string | null;
}

export type Section = 'personal' | 'body' | 'health' | 'goals' | 'routine' | 'food' | 'sleep';

export interface Option<T extends string> { value: T; label: string; detail?: string; icon?: IconName }

export const GENDERS: Option<Gender>[] = [
  { value: 'male', label: 'Male', icon: 'male' },
  { value: 'female', label: 'Female', icon: 'female' },
  { value: 'other', label: 'Other', icon: 'person' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say', icon: 'remove-circle-outline' },
];

export const SMOKING: Option<Smoking>[] = [
  { value: 'never', label: 'Never smoked' },
  { value: 'quit', label: 'Quit' },
  { value: 'current', label: 'I smoke' },
];

export const GOALS: Option<Goal>[] = [
  { value: 'lose_weight', label: 'Lose weight', detail: 'Burn fat and get leaner', icon: 'flame-outline' },
  { value: 'build_muscle', label: 'Build muscle', detail: 'Get stronger and add muscle', icon: 'barbell-outline' },
  { value: 'get_fitter', label: 'Get fitter', detail: 'Feel fitter in daily life', icon: 'fitness-outline' },
  { value: 'endurance', label: 'Improve endurance', detail: 'Run, cycle or play longer', icon: 'bicycle-outline' },
  { value: 'flexibility', label: 'Flexibility & mobility', detail: 'Move freely, less stiffness', icon: 'body-outline' },
  { value: 'stay_healthy', label: 'Stay healthy', detail: 'Keep a healthy routine', icon: 'heart-outline' },
];

export const EXPERIENCE: Option<Experience>[] = [
  { value: 'beginner', label: 'Beginner', detail: 'New to training or restarting' },
  { value: 'intermediate', label: 'Intermediate', detail: 'Training regularly for 6+ months' },
  { value: 'advanced', label: 'Advanced', detail: 'Training seriously for years' },
];

export const WORK_TYPES: Option<WorkType>[] = [
  { value: 'desk', label: 'Desk job', detail: 'Mostly sitting', icon: 'laptop-outline' },
  { value: 'mixed', label: 'Mixed', detail: 'Some walking and standing', icon: 'walk-outline' },
  { value: 'physical', label: 'Physical work', detail: 'On my feet, lifting', icon: 'construct-outline' },
];

export const ACTIVITY_LEVELS: Option<ActivityLevel>[] = [
  { value: 'sedentary', label: 'Sedentary', detail: 'Little or no exercise' },
  { value: 'light', label: 'Lightly active', detail: 'Exercise 1–3 days a week' },
  { value: 'moderate', label: 'Moderately active', detail: 'Exercise 3–5 days a week' },
  { value: 'active', label: 'Very active', detail: 'Hard exercise 6–7 days a week' },
  { value: 'very_active', label: 'Extremely active', detail: 'Hard daily training or a physical job' },
];

export const WORKOUT_TIMES: Option<WorkoutTime>[] = [
  { value: 'early_morning', label: 'Early morning', detail: '5–7 am' },
  { value: 'morning', label: 'Morning', detail: '7–11 am' },
  { value: 'afternoon', label: 'Afternoon', detail: '12–4 pm' },
  { value: 'evening', label: 'Evening', detail: '4–8 pm' },
  { value: 'night', label: 'Night', detail: 'After 8 pm' },
  { value: 'flexible', label: 'Flexible', detail: 'Any time' },
];

export const DIET_TYPES: Option<DietType>[] = [
  { value: 'vegetarian', label: 'Vegetarian', detail: 'No meat, fish or eggs', icon: 'leaf-outline' },
  { value: 'non_vegetarian', label: 'Non-vegetarian', detail: 'Meat, fish and eggs', icon: 'fish-outline' },
  { value: 'eggetarian', label: 'Eggetarian', detail: 'Vegetarian + eggs', icon: 'egg-outline' },
  { value: 'vegan', label: 'Vegan', detail: 'No animal products, no dairy', icon: 'nutrition-outline' },
  { value: 'jain', label: 'Jain', detail: 'No root vegetables, onion or garlic', icon: 'flower-outline' },
];

export const EATING_OUT: Option<EatingOut>[] = [
  { value: 'rarely', label: 'Rarely' },
  { value: 'weekly', label: 'Once a week' },
  { value: 'few_times_week', label: 'A few times a week' },
  { value: 'daily', label: 'Almost daily' },
];

export const SLEEP_QUALITY: Option<SleepQuality>[] = [
  { value: 'poor', label: 'Poor' },
  { value: 'fair', label: 'Fair' },
  { value: 'good', label: 'Good' },
  { value: 'great', label: 'Great' },
];

export const BMI_INFO: Record<BmiCategory, { label: string; color: string; range: string; note: string }> = {
  underweight: { label: 'Underweight', color: '#64B5F6', range: 'below 18.5', note: 'Your trainer can help you gain healthy weight and strength.' },
  normal: { label: 'Healthy weight', color: '#6FE0A0', range: '18.5 – 24.9', note: 'You are in the healthy range. Great place to build from.' },
  overweight: { label: 'Overweight', color: '#F2C14E', range: '25 – 29.9', note: 'Small, steady changes in training and food make a big difference.' },
  obese: { label: 'Obese', color: '#EF7A6A', range: '30 and above', note: 'Your trainer will start gently and build up safely with you.' },
};

export const labelOf = <T extends string>(opts: Option<T>[], v: T | null | undefined) =>
  opts.find((o) => o.value === v)?.label ?? '—';

/** Same formula as the server (kg / m²), for the live preview. */
export function bmiFor(heightCm: number, weightKg: number): { value: number; category: BmiCategory } | null {
  if (!(heightCm >= 100 && heightCm <= 250 && weightKg >= 25 && weightKg <= 300)) return null;
  const value = Math.round((weightKg / (heightCm / 100) ** 2) * 10) / 10;
  const category: BmiCategory = value < 18.5 ? 'underweight' : value < 25 ? 'normal' : value < 30 ? 'overweight' : 'obese';
  return { value, category };
}

export function sleepHoursFor(bedtime: string, wakeTime: string): number {
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  let diff = toMin(wakeTime) - toMin(bedtime);
  if (diff <= 0) diff += 24 * 60;
  return Math.round((diff / 60) * 10) / 10;
}

export function ageFrom(dob: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  if (!m) return null;
  const now = new Date();
  let age = now.getFullYear() - Number(m[1]);
  if (now.getMonth() + 1 < Number(m[2]) || (now.getMonth() + 1 === Number(m[2]) && now.getDate() < Number(m[3]))) age -= 1;
  return age;
}

export const getFitness = () =>
  api.get<{ fitness: FitnessProfile; profileCompleted: boolean }>('/api/users/me/fitness-profile');

export const saveSection = <S extends Section>(section: S, data: object) =>
  api.put<{ fitness: FitnessProfile; user?: User }>(`/api/users/me/fitness-profile/${section}`, { data });

export const completeFitness = () =>
  api.post<{ fitness: FitnessProfile; user: User }>('/api/users/me/fitness-profile/complete');
