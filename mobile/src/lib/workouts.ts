// Phase 5: workout video library + workouts sent to users.
// Types, labels and server calls. The server checks who may do what.

import { Platform } from 'react-native';
import { api } from './api';
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
  send: (body: { userId: string; title: string; date: string; note: string; items: { videoId: string; note: string }[] }) =>
    api.post<{ workout: Workout }>('/api/workouts', body).then((r) => r.workout),
  cancel: (id: string) => api.delete<{ ok: true }>(`/api/workouts/${id}`),
  setDone: (id: string, itemId: string, done: boolean) =>
    api.patch<{ workout: Workout }>(`/api/workouts/${id}/items/${itemId}`, { done }).then((r) => r.workout),
};

/** Uploads a picked video or picture (workout videos, food photos); returns its web address. */
export async function uploadFile(
  asset: { uri: string; fileName?: string | null; mimeType?: string; file?: File },
  kind: 'workouts' | 'foods' = 'workouts',
): Promise<string> {
  const form = new FormData();
  const name = asset.fileName || `video-${Date.now()}.mp4`;
  if (Platform.OS === 'web') {
    const blob = asset.file ?? await (await fetch(asset.uri)).blob();
    form.append('file', blob, name);
  } else {
    // React Native's FormData takes { uri, name, type } for a file on the phone.
    form.append('file', { uri: asset.uri, name, type: asset.mimeType || 'video/mp4' } as unknown as Blob);
  }
  return (await api.upload<{ url: string }>('/api/uploads/media', form, { kind })).url;
}
