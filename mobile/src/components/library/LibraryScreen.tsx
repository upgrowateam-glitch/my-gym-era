// Workout video library (FitZone gold), shared by the Super Admin, Admins and
// Trainers. Everyone here can browse, search and filter by category,
// difficulty and body part, and watch a video. Super Admin and Admins can also
// add / edit / delete videos and manage categories (canEdit). Trainers get
// "Send a workout". The server checks the same rules.

import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ApiError } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { confirm } from '@/lib/confirm';
import { BODY_PARTS, DIFFICULTIES, library, type BodyPart, type Category, type Difficulty } from '@/lib/workouts';
import { Button, Chips, Empty, Field, Notice, type Palette } from '@/components/ui/UI';
import { Kpi, KpiRow, Loading, Panel } from '@/components/staff/DashboardUI';
import { VideoCard } from './VideoCard';

export function LibraryScreen({ p, canEdit, canSend }: { p: Palette; canEdit: boolean; canSend: boolean }) {
  const cats = useApi(library.categories);
  const vids = useApi(library.videos);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [difficulty, setDifficulty] = useState<Difficulty | 'all'>('all');
  const [bodyPart, setBodyPart] = useState<BodyPart | 'all'>('all');
  const [showCats, setShowCats] = useState(false);

  const videos = vids.data ?? [];
  const q = search.trim().toLowerCase();
  const shown = videos.filter((v) => (category === 'all' || v.categoryId === category)
    && (difficulty === 'all' || v.difficulty === difficulty)
    && (bodyPart === 'all' || v.bodyParts.includes(bodyPart))
    && (!q || v.title.toLowerCase().includes(q) || v.description.toLowerCase().includes(q) || v.equipment.toLowerCase().includes(q)
      || v.categoryName.toLowerCase().includes(q)));
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

      {canEdit && showCats && <CategoryManager p={p} categories={cats.data} reload={() => { void cats.reload(); void vids.reload(); }} />}

      {(cats.error || vids.error) && <Notice text={(cats.error ?? vids.error)!} />}

      <Field p={p} label="Search" icon="search-outline" value={search} onChangeText={setSearch}
        placeholder="Exercise, equipment or category" autoCapitalize="none" />
      {(cats.data?.length ?? 0) > 0 && (
        <Group p={p} label="Category">
          <Chips p={p} value={category} onChange={setCategory} options={[
            { value: 'all', label: 'All' },
            ...(cats.data ?? []).map((c) => ({ value: c.id, label: `${c.name} (${c.videoCount})` })),
          ]} />
        </Group>
      )}
      <Group p={p} label="Difficulty">
        <Chips p={p} value={difficulty} onChange={setDifficulty} options={[
          { value: 'all' as const, label: 'All' }, ...DIFFICULTIES.map((d) => ({ value: d.value, label: d.label })),
        ]} />
      </Group>
      <Group p={p} label="Body part">
        <Chips p={p} value={bodyPart} onChange={setBodyPart} options={[
          { value: 'all' as const, label: 'All' }, ...BODY_PARTS.map((b) => ({ value: b.value, label: b.label })),
        ]} />
      </Group>

      {!vids.data && !vids.error && <Loading />}
      {vids.data && (
        <Text style={{ color: p.textSecondary, fontSize: 13 }}>Showing {shown.length} of {videos.length} videos</Text>
      )}
      {vids.data && shown.length === 0 && (
        <Empty p={p} icon="film-outline" text={videos.length === 0
          ? (canEdit ? (cats.data?.length ? 'No videos yet. Tap "Add video".' : 'Start by adding a category, then add videos.') : 'No videos in the library yet.')
          : 'No videos match.'} />
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {shown.map((v) => <VideoCard key={v.id} p={p} video={v} onPress={() => router.push(`/video/${v.id}`)} />)}
      </View>
    </View>
  );
}

function Group({ p, label, children }: { p: Palette; label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: p.textSecondary, fontSize: 12.5, fontWeight: '700', letterSpacing: 0.3 }}>{label}</Text>
      {children}
    </View>
  );
}

/** Add, rename and delete categories (Super Admin / Admins). */
function CategoryManager({ p, categories, reload }: { p: Palette; categories: Category[] | null; reload: () => void }) {
  const [name, setName] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Categories" icon="albums-outline">
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <Field p={p} label="New category" icon="add-circle-outline" value={name} onChangeText={setName} placeholder="e.g. Strength, Cardio, Yoga"
            onSubmitEditing={() => name.trim() && run(async () => { await library.addCategory(name.trim()); setName(''); })} />
        </View>
        <Button p={p} label="Add" icon="add" loading={busy} disabled={!name.trim()}
          onPress={() => run(async () => { await library.addCategory(name.trim()); setName(''); })} />
      </View>
      {error && <Notice text={error} />}
      {categories === null ? <Loading /> : categories.length === 0
        ? <Text style={{ color: p.textSecondary }}>No categories yet.</Text>
        : categories.map((c) => (
          <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}>
            <Ionicons name="albums-outline" size={18} color={p.accent} />
            {editId === c.id ? (
              <TextInput value={editName} onChangeText={setEditName} autoFocus selectionColor={p.accent}
                style={{ flex: 1, color: p.text, fontSize: 15, borderBottomWidth: 1, borderColor: p.accent, paddingVertical: 4, outlineStyle: 'none' } as never}
                onSubmitEditing={() => run(async () => { await library.renameCategory(c.id, editName.trim()); setEditId(null); })} />
            ) : (
              <Text style={{ flex: 1, color: p.text, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>
                {c.name} <Text style={{ color: p.textSecondary, fontWeight: '400', fontSize: 13 }}>· {c.videoCount} {c.videoCount === 1 ? 'video' : 'videos'}</Text>
              </Text>
            )}
            {editId === c.id ? (
              <>
                <IconBtn p={p} icon="checkmark" label="Save" disabled={busy}
                  onPress={() => run(async () => { await library.renameCategory(c.id, editName.trim()); setEditId(null); })} />
                <IconBtn p={p} icon="close" label="Cancel" onPress={() => setEditId(null)} />
              </>
            ) : (
              <>
                <IconBtn p={p} icon="create-outline" label="Rename" onPress={() => { setEditId(c.id); setEditName(c.name); }} />
                <IconBtn p={p} icon="trash-outline" label="Delete" danger disabled={busy}
                  onPress={async () => {
                    if (await confirm(`Delete "${c.name}"?`, c.videoCount ? 'It still has videos: move or delete them first.' : 'This category will be removed.', 'Delete')) {
                      void run(() => library.deleteCategory(c.id));
                    }
                  }} />
              </>
            )}
          </View>
        ))}
    </Panel>
  );
}

function IconBtn({ p, icon, label, onPress, danger, disabled }: {
  p: Palette; icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; danger?: boolean; disabled?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityLabel={label} hitSlop={6}
      style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: p.elevated, opacity: disabled ? 0.5 : 1 }}>
      <Ionicons name={icon} size={18} color={danger ? '#EF5350' : p.accent} />
    </Pressable>
  );
}
