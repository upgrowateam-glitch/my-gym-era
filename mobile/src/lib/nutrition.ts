// Phase 6: food & nutrition. Types, labels and server calls.
// Food values are for ONE serving. The server checks who may do what.

import { api } from './api';
import type { IconName } from '@/components/ui/UI';

export type Meal = 'breakfast' | 'mid_morning' | 'lunch' | 'pre_workout' | 'post_workout' | 'evening_snack' | 'dinner';
export type FoodDiet = 'vegan' | 'veg' | 'egg' | 'non_veg';

export interface FoodCategory { id: string; name: string; foodCount: number }

export interface Food {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
  servingSize: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  dietType: FoodDiet | null;
  imageUrl: string | null;
}

export interface PlanItem {
  id: string;
  foodId: string | null;
  meal: Meal;
  position: number;
  servings: number;
  note: string;
  name: string;
  servingSize: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface Macros { calories: number; protein: number; carbs: number; fat: number }

export interface NutritionPlan {
  id: string;
  userId: string;
  title: string;
  note: string;
  sentBy: string | null;
  sentByName: string | null;
  createdAt: string;
  items: PlanItem[];
  totals: Macros;
}

export const MEALS: { value: Meal; label: string; icon: IconName }[] = [
  { value: 'breakfast', label: 'Breakfast', icon: 'sunny-outline' },
  { value: 'mid_morning', label: 'Mid-morning', icon: 'cafe-outline' },
  { value: 'lunch', label: 'Lunch', icon: 'restaurant-outline' },
  { value: 'pre_workout', label: 'Pre-workout', icon: 'flash-outline' },
  { value: 'post_workout', label: 'Post-workout', icon: 'barbell-outline' },
  { value: 'evening_snack', label: 'Evening snack', icon: 'nutrition-outline' },
  { value: 'dinner', label: 'Dinner', icon: 'moon-outline' },
];
export const mealOf = (m: Meal) => MEALS.find((x) => x.value === m) ?? MEALS[0];

export const FOOD_DIETS: { value: FoodDiet; label: string; color: string }[] = [
  { value: 'vegan', label: 'Vegan', color: '#4ADE80' },
  { value: 'veg', label: 'Vegetarian', color: '#22C55E' },
  { value: 'egg', label: 'Contains egg', color: '#FBBF24' },
  { value: 'non_veg', label: 'Non-veg', color: '#EF5350' },
];
export const dietOf = (d: FoodDiet | null) => FOOD_DIETS.find((x) => x.value === d) ?? null;

/** Macro colours used everywhere (protein / carbs / fat). */
export const MACRO_COLORS = { protein: '#60A5FA', carbs: '#FBBF24', fat: '#F472B6' };

export const round1 = (n: number) => Math.round(n * 10) / 10;
/** "1.5" / "2" / "0.25" */
export const servingsText = (n: number) => String(round1(n * 100) / 100).replace(/\.0$/, '');

/** Values for `servings` servings of an item/food. */
export function scaled(x: Macros, servings: number): Macros {
  return { calories: Math.round(x.calories * servings), protein: round1(x.protein * servings), carbs: round1(x.carbs * servings), fat: round1(x.fat * servings) };
}

export function totalOf(items: { servings: number; calories: number; protein: number; carbs: number; fat: number }[]): Macros {
  const sum = (k: keyof Macros) => items.reduce((n, i) => n + i[k] * i.servings, 0);
  return { calories: Math.round(sum('calories')), protein: round1(sum('protein')), carbs: round1(sum('carbs')), fat: round1(sum('fat')) };
}

// ── Server calls ────────────────────────────────────────────────────────────

export const foodsApi = {
  categories: () => api.get<{ categories: FoodCategory[] }>('/api/nutrition/categories').then((r) => r.categories),
  addCategory: (name: string) => api.post<{ category: FoodCategory }>('/api/nutrition/categories', { name }),
  renameCategory: (id: string, name: string) => api.patch<{ category: FoodCategory }>(`/api/nutrition/categories/${id}`, { name }),
  deleteCategory: (id: string) => api.delete<{ ok: true }>(`/api/nutrition/categories/${id}`),
  foods: () => api.get<{ foods: Food[] }>('/api/nutrition/foods').then((r) => r.foods),
  food: (id: string) => api.get<{ food: Food }>(`/api/nutrition/foods/${id}`).then((r) => r.food),
  saveFood: (id: string | null, food: object) => (id
    ? api.put<{ food: Food }>(`/api/nutrition/foods/${id}`, { food })
    : api.post<{ food: Food }>('/api/nutrition/foods', { food })).then((r) => r.food),
  deleteFood: (id: string) => api.delete<{ ok: true }>(`/api/nutrition/foods/${id}`),
};

export const plansApi = {
  of: (userId: string) => api.get<{ current: NutritionPlan | null; history: NutritionPlan[] }>('/api/nutrition/plans', { userId }),
  get: (id: string) => api.get<{ plan: NutritionPlan }>(`/api/nutrition/plans/${id}`).then((r) => r.plan),
  send: (body: { userId: string; title: string; note: string; items: { foodId: string; meal: Meal; servings: number; note: string }[] }) =>
    api.post<{ plan: NutritionPlan }>('/api/nutrition/plans', body).then((r) => r.plan),
  remove: (id: string) => api.delete<{ ok: true }>(`/api/nutrition/plans/${id}`),
};
