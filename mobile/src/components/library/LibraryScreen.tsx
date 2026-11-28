// Workout video library (FitZone gold), shared by the Super Admin, Admins and
// Trainers. Everyone here can browse, search and filter by category,
// difficulty and body part, and watch a video. Super Admin and Admins can also
// add / edit / delete videos and manage categories (canEdit). Trainers get
// "Send a workout". The server checks the same rules.

import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { useApi } from '@/lib/useApi';
import { library } from '@/lib/workouts';
import { Filters, initialFilters, type FilterValue } from '@/components/filters/Filters';
import { applyVideoFilters, videoFilterSections } from './videoFilters';
import { Button, Empty, Field, Notice, type Palette } from '@/components/ui/UI';
import { Kpi, KpiRow, Loading } from '@/components/staff/DashboardUI';
import { VideoCard } from './VideoCard';
import { CategoryManager } from './CategoryManager';

export function LibraryScreen({ p, canEdit, canSend }: { p: Palette; canEdit: boolean; canSend: boolean }) {
  const cats = useApi(library.categories);
  const vids = useApi(library.videos);
  const [search, setSearch] = useState('');
  const [showCats, setShowCats] = useState(false);

  const videos = vids.data ?? [];
  const sections = videoFilterSections(cats.data);
  const [filters, setFilters] = useState<FilterValue>(() => initialFilters(sections));
  const shown = applyVideoFilters(videos, filters, search);
  const totalMinutes = videos.reduce((n, v) => n + v.durationMinutes, 0);

  return (
    <View style={{ gap: 14 }}>
      <KpiRow>
        <Kpi minWidth={140} icon="film-outline" label="Videos" value={vids.data ? videos.length : undefined}
          note={vids.data ? `${Math.round(totalMinutes / 60 * 10) / 10} hours in total` : undefined} />
        <Kpi minWidth={140} icon="albums-outline" label="Categories" value={cats.data?.length}
          onPress={canEdit ? () => setShowCats(!showCats) : undefined} note={canEdit ? 'Tap to manage' : undefined} />
        <Kpi minWidth={140} icon="logo-youtube" label="YouTube / uploaded" value={vids.data ? videos.filter((v) => v.source === 'youtube').length : undefined}
          note={vids.data ? `${videos.filter((v) => v.source === 'upload').length} uploaded` : undefined} />
      </KpiRow>

      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
        {canEdit && <Button p={p} label="Add video" icon="add" onPress={() => router.push('/video-form')} />}
        {canEdit && <Button p={p} kind="outline" label={showCats ? 'Hide categories' : 'Manage categories'} icon="albums-outline"
          onPress={() => setShowCats(!showCats)} />}
        {canSend && <Button p={p} label="Send a workout" icon="paper-plane-outline" onPress={() => router.push('/send-workout')} />}
      </View>

      {canEdit && showCats && (
        <CategoryManager p={p} word="video" placeholder="e.g. Strength, Cardio, Yoga"
          categories={cats.data?.map((c) => ({ id: c.id, name: c.name, count: c.videoCount })) ?? null}
          actions={{ add: library.addCategory, rename: library.renameCategory, remove: library.deleteCategory }}
          reload={() => { void cats.reload(); void vids.reload(); }} />
      )}

      {(cats.error || vids.error) && <Notice text={(cats.error ?? vids.error)!} />}

      <Field p={p} label="Search" icon="search-outline" value={search} onChangeText={setSearch}
        placeholder="Exercise, equipment or category" autoCapitalize="none" />
      <Filters p={p} sections={sections} value={filters} onChange={setFilters} count={(v) => applyVideoFilters(videos, v, search).length} />

      {!vids.data && !vids.error && <Loading />}
      {vids.data && (
        <Text style={{ color: p.textSecondary, fontSize: 13 }}>Showing {shown.length} of {videos.length} videos</Text>
      )}
      {vids.data && shown.length === 0 && (
        <Empty p={p} icon="film-outline" text={videos.length === 0
          ? (canEdit ? (cats.data?.length ? 'No videos yet. Tap "Add video".' : 'Start by adding a category, then add videos.') : 'No videos in the library yet.')
          : 'No videos match these filters.'} />
      )}
      {vids.data && videos.length > 0 && shown.length === 0 && (
        <View style={{ alignItems: 'center' }}>
          <Button p={p} small kind="outline" label="Clear filters" icon="close" onPress={() => { setFilters(initialFilters(sections)); setSearch(''); }} />
        </View>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {shown.map((v) => <VideoCard key={v.id} p={p} video={v} onPress={() => router.push(`/video/${v.id}`)} />)}
      </View>
    </View>
  );
}

