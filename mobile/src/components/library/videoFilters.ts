// Filters for workout videos (Library and the video picker in "Send a workout").

import { BODY_PARTS, DIFFICULTIES, type Category, type WorkoutVideo } from '@/lib/workouts';
import { matches, type FilterSection, type FilterValue } from '@/components/filters/Filters';

const DURATION = [
  { value: 'short', label: 'Up to 5 min', test: (m: number) => m <= 5 },
  { value: 'medium', label: '6–15 min', test: (m: number) => m > 5 && m <= 15 },
  { value: 'long', label: 'Over 15 min', test: (m: number) => m > 15 },
];

export function videoFilterSections(categories: Category[] | null, withSort = true): FilterSection[] {
  return [
    ...(categories?.length ? [{ key: 'category', title: 'Category', options: categories.map((c) => ({ value: c.id, label: `${c.name} (${c.videoCount})` })) }] : []),
    { key: 'difficulty', title: 'Difficulty', options: DIFFICULTIES.map((d) => ({ value: d.value, label: d.label, color: d.color })) },
    { key: 'bodyPart', title: 'Body part', options: BODY_PARTS.map((b) => ({ value: b.value, label: b.label })) },
    { key: 'duration', title: 'Duration', options: DURATION.map(({ value, label }) => ({ value, label })) },
    { key: 'source', title: 'Video type', options: [{ value: 'youtube', label: 'YouTube' }, { value: 'upload', label: 'Uploaded' }] },
    ...(withSort ? [{ key: 'sort', title: 'Sort by', single: true, defaultValue: 'newest', options: [
      { value: 'newest', label: 'Newest first' }, { value: 'name', label: 'Name A–Z' }, { value: 'shortest', label: 'Shortest first' },
    ] }] : []),
  ];
}

export function applyVideoFilters(videos: WorkoutVideo[], v: FilterValue, search: string): WorkoutVideo[] {
  const q = search.trim().toLowerCase();
  const sort = v.sort?.[0] ?? 'newest';
  return videos
    .filter((x) => matches(v, 'category', (c) => x.categoryId === c) && matches(v, 'difficulty', (d) => x.difficulty === d)
      && matches(v, 'bodyPart', (b) => x.bodyParts.includes(b as WorkoutVideo['bodyParts'][number]))
      && matches(v, 'duration', (d) => DURATION.find((o) => o.value === d)!.test(x.durationMinutes))
      && matches(v, 'source', (s) => x.source === s)
      && (!q || x.title.toLowerCase().includes(q) || x.description.toLowerCase().includes(q) || x.equipment.toLowerCase().includes(q)
        || x.categoryName.toLowerCase().includes(q)))
    .sort((a, b) => (sort === 'name' ? a.title.localeCompare(b.title)
      : sort === 'shortest' ? a.durationMinutes - b.durationMinutes : b.createdAt.localeCompare(a.createdAt)));
}
