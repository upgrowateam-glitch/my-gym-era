// Find and pick videos from the library (search + the filter panel), shown
// inside a page. Tapping a card adds or removes it.

import { useState } from 'react';
import { Text, View } from 'react-native';
import type { WorkoutVideo } from '@/lib/workouts';
import { Field, type Palette } from '@/components/ui/UI';
import { Filters, initialFilters, type FilterValue } from '@/components/filters/Filters';
import { VideoCard } from './VideoCard';
import { applyVideoFilters, videoFilterSections } from './videoFilters';

export function VideoBrowser({ p, videos, selectedIds, onToggle }: {
  p: Palette; videos: WorkoutVideo[]; selectedIds: string[]; onToggle: (v: WorkoutVideo) => void;
}) {
  const [search, setSearch] = useState('');
  const categories = [...new Map(videos.map((v) => [v.categoryId, v.categoryName])).entries()]
    .map(([id, name]) => ({ id, name, videoCount: videos.filter((v) => v.categoryId === id).length }));
  const sections = videoFilterSections(categories, false);
  const [filters, setFilters] = useState<FilterValue>(() => initialFilters(sections));
  const shown = applyVideoFilters(videos, filters, search);
  return (
    <View style={{ gap: 10 }}>
      <Field p={p} label="Find exercises" icon="search-outline" value={search} onChangeText={setSearch} placeholder="Exercise, category, equipment" />
      <Filters p={p} sections={sections} value={filters} onChange={setFilters} count={(v) => applyVideoFilters(videos, v, search).length} />
      {shown.length === 0 && <Text style={{ color: p.textSecondary }}>No videos match.</Text>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {shown.map((v) => <VideoCard key={v.id} p={p} video={v} compact selected={selectedIds.includes(v.id)} onPress={() => onToggle(v)} />)}
      </View>
    </View>
  );
}
