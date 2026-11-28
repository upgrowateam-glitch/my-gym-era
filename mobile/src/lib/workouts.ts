// Phase 5: workout video library + workouts sent to users.
// Types, labels and server calls. The server checks who may do what.

import { api } from './api';
import { uploadInPieces, type PickedFile } from './upload';
import type { IconName } from '@/components/ui/UI';

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';
export type BodyPart = 'full_body' | 'chest' | 'back' | 'shoulders' | 'arms' | 'core' | 'legs' | 'glutes' | 'cardio' | 'mobility';
export type VideoSource = 'upload' | 'youtube';

export interface Category { id: string; name: string; videoCount: number }

export interface WorkoutVideo {
  id: string;
  categoryId: string;
  categoryName: string;
  title: string;
  description: string;
  source: VideoSource;
  videoUrl: string;
  thumbnailUrl: string | null;
  difficulty: Difficulty;
  durationMinutes: number;
  bodyParts: BodyPart[];
  equipment: string;
  createdAt: string;
}

export interface WorkoutItem {
  id: string;
  videoId: string | null;
  title: string;
  note: string;
  position: number;
  completedAt: string | null;
  sets: number | null;
  reps: number | null;
  /** For timed moves (e.g. a plank), instead of reps. */
  durationSeconds: number | null;
  restSeconds: number | null;
  /** null when the video was deleted from the library. */
  video: Pick<WorkoutVideo, 'id' | 'source' | 'videoUrl' | 'thumbnailUrl' | 'difficulty' | 'durationMinutes' | 'bodyParts' | 'equipment' | 'description'> | null;
}

export interface Workout {
  id: string;
  userId: string;
  title: string;
  date: string;
  note: string;
  sentBy: string | null;
  sentByName: string | null;
  sentByRole: string | null;
  weeklyPlanId: string | null;
  createdAt: string;
  items: WorkoutItem[];
  doneCount: number;
  completed: boolean;
}

export const DIFFICULTIES: { value: Difficulty; label: string; color: string }[] = [
  { value: 'beginner', label: 'Beginner', color: '#4ADE80' },
  { value: 'intermediate', label: 'Intermediate', color: '#FBBF24' },
  { value: 'advanced', label: 'Advanced', color: '#EF5350' },
];

export const BODY_PARTS: { value: BodyPart; label: string; icon: IconName }[] = [
  { value: 'full_body', label: 'Full body', icon: 'body-outline' },
  { value: 'chest', label: 'Chest', icon: 'shield-outline' },
  { value: 'back', label: 'Back', icon: 'git-merge-outline' },
  { value: 'shoulders', label: 'Shoulders', icon: 'triangle-outline' },
  { value: 'arms', label: 'Arms', icon: 'barbell-outline' },
  { value: 'core', label: 'Core / abs', icon: 'grid-outline' },
  { value: 'legs', label: 'Legs', icon: 'walk-outline' },
  { value: 'glutes', label: 'Glutes', icon: 'ellipse-outline' },
  { value: 'cardio', label: 'Cardio', icon: 'heart-outline' },
  { value: 'mobility', label: 'Mobility', icon: 'sync-outline' },
];

/** What the trainer sets for one exercise. */
export interface ExerciseDetails { sets: number | null; reps: number | null; durationSeconds: number | null; restSeconds: number | null }
export interface ExerciseInput extends ExerciseDetails { videoId: string; note: string }

/** "45 s" / "1 min" / "1 min 30 s" */
export function secondsText(s: number) {
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m} min ${r} s` : `${m} min`;
}

/** "3 sets × 12 reps · rest 60 s" (empty if nothing was set). */
export function exerciseText(x: Partial<ExerciseDetails>): string {
  const parts: string[] = [];
  const what = x.reps ? `${x.reps} reps` : x.durationSeconds ? secondsText(x.durationSeconds) : '';
  if (x.sets && what) parts.push(`${x.sets} ${x.sets === 1 ? 'set' : 'sets'} × ${what}`);
  else if (x.sets) parts.push(`${x.sets} ${x.sets === 1 ? 'set' : 'sets'}`);
  else if (what) parts.push(what);
  if (x.restSeconds) parts.push(`rest ${secondsText(x.restSeconds)}`);
  return parts.join(' · ');
}

export const difficultyOf = (d: Difficulty) => DIFFICULTIES.find((x) => x.value === d) ?? DIFFICULTIES[0];
export const bodyPartLabel = (b: BodyPart) => BODY_PARTS.find((x) => x.value === b)?.label ?? b;
export const bodyPartsText = (list: BodyPart[]) => list.map(bodyPartLabel).join(', ');

/** YouTube video id from a link, or null (same rules as the server). */
export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\.|^m\./, '');
    let id: string | null = null;
    if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
    else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      if (u.pathname === '/watch') id = u.searchParams.get('v');
      else {
        const m = /^\/(embed|shorts|live|v)\/([^/?#]+)/.exec(u.pathname);
        if (m) id = m[2];
      }
    }
    return id && /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

/** Today as YYYY-MM-DD in the phone's own time zone. */
export function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "Today", "Tomorrow", "Yesterday" or "Mon, 1 Dec". */
export function dayLabel(date: string) {
  const today = todayKey();
  const t = new Date(`${today}T00:00:00`);
  const d = new Date(`${date}T00:00:00`);
  const diff = Math.round((d.getTime() - t.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

// ── Server calls ────────────────────────────────────────────────────────────

export const library = {
  categories: () => api.get<{ categories: Category[] }>('/api/library/categories').then((r) => r.categories),
  addCategory: (name: string) => api.post<{ category: Category }>('/api/library/categories', { name }),
  renameCategory: (id: string, name: string) => api.patch<{ category: Category }>(`/api/library/categories/${id}`, { name }),
  deleteCategory: (id: string) => api.delete<{ ok: true }>(`/api/library/categories/${id}`),
  videos: () => api.get<{ videos: WorkoutVideo[] }>('/api/library/videos').then((r) => r.videos),
  video: (id: string) => api.get<{ video: WorkoutVideo }>(`/api/library/videos/${id}`).then((r) => r.video),
  saveVideo: (id: string | null, video: object) => (id
    ? api.put<{ video: WorkoutVideo }>(`/api/library/videos/${id}`, { video })
    : api.post<{ video: WorkoutVideo }>('/api/library/videos', { video })).then((r) => r.video),
  deleteVideo: (id: string) => api.delete<{ ok: true }>(`/api/library/videos/${id}`),
};

export const workouts = {
  of: (userId: string) => api.get<{ workouts: Workout[] }>('/api/workouts', { userId }).then((r) => r.workouts),
  get: (id: string) => api.get<{ workout: Workout }>(`/api/workouts/${id}`).then((r) => r.workout),
  send: (body: { userId: string; title: string; date: string; note: string; items: ExerciseInput[] }) =>
    api.post<{ workout: Workout }>('/api/workouts', body).then((r) => r.workout),
  cancel: (id: string) => api.delete<{ ok: true }>(`/api/workouts/${id}`),
  setDone: (id: string, itemId: string, done: boolean) =>
    api.patch<{ workout: Workout }>(`/api/workouts/${id}/items/${itemId}`, { done }).then((r) => r.workout),
};

// ── Weekly plans and the daily follow-up (Phase 7) ─────────────────────────

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const WEEKDAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
/** 0 = Monday … 6 = Sunday, for a YYYY-MM-DD date. */
export const weekdayOf = (date: string) => (new Date(`${date}T00:00:00`).getDay() + 6) % 7;

export interface PlanDay { weekday: number; rest: boolean; title: string; items: (ExerciseInput & { title: string })[] }
export interface WeeklyPlan {
  id: string; userId: string; sentBy: string | null; sentByName: string | null; title: string;
  startDate: string; weeks: number; endDate: string; note: string; days: PlanDay[]; createdAt: string;
}
export interface DaySummary { date: string; exercisesPlanned: number; exercisesDone: number; mealsPlanned: number; mealsDone: number }

export const weeklyApi = {
  of: (userId: string) => api.get<{ current: WeeklyPlan | null; history: WeeklyPlan[] }>('/api/weekly-plans', { userId }),
  get: (id: string) => api.get<{ plan: WeeklyPlan }>(`/api/weekly-plans/${id}`).then((r) => r.plan),
  send: (body: { userId: string; title: string; startDate: string; weeks: number; note: string;
    days: { weekday: number; rest: boolean; title: string; items: ExerciseInput[] }[] }) =>
    api.post<{ plan: WeeklyPlan; workoutsCreated: number }>('/api/weekly-plans', body),
  remove: (id: string) => api.delete<{ ok: true }>(`/api/weekly-plans/${id}`),
};

export const todayApi = {
  day: (userId: string, date: string) =>
    api.get<{ date: string; workouts: Workout[]; mealsDone: { meal: string; doneAt: string }[] }>('/api/today', { userId, date }),
  tickMeal: (date: string, meal: string, done: boolean) =>
    api.put<{ date: string; mealsDone: { meal: string; doneAt: string }[] }>('/api/today/meals', { date, meal, done }),
  summary: (userId: string, days = 7) => api.get<{ days: DaySummary[] }>('/api/today/summary', { userId, days }).then((r) => r.days),
};

/** Uploads a picked video or picture (workout videos, food photos); returns its web address. */
export function uploadFile(
  asset: PickedFile,
  kind: 'workouts' | 'foods' = 'workouts',
  onProgress?: (share: number) => void,
): Promise<string> {
  // Sent in small pieces with retries, so big videos survive slow phone connections.
  return uploadInPieces(asset, kind, onProgress);
}
