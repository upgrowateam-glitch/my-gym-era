// Send a workout (Trainer → their assigned users; Super Admin / Admins with
// "View all users" → any user). /send-workout?userId=<user>&videoId=<video>
// Choose the user, a title and day, then the videos in order, each with a note
// such as "3 sets × 12 reps". The server checks who may send to whom.

import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import type { User } from '@/lib/types';
import { dayLabel, library, todayKey, workouts, type ExerciseDetails, type WorkoutVideo } from '@/lib/workouts';
import { DEFAULT_DETAILS, ExerciseFields } from '@/components/library/ExerciseFields';
import { Filters, initialFilters, type FilterValue } from '@/components/filters/Filters';
import { applyVideoFilters, videoFilterSections } from '@/components/library/videoFilters';
import { RequireRole } from '@/components/RequireRole';
import { BackPage } from '@/components/staff/BackPage';
import { VideoCard } from '@/components/library/VideoCard';
import { Avatar, Button, Card, Chips, Empty, Field, Notice } from '@/components/ui/UI';
import { Loading } from '@/components/staff/DashboardUI';
import { SUPER as p } from '@/theme/palettes';

export default function SendWorkoutRoute() {
  return (
    <RequireRole roles={['super_admin', 'admin', 'trainer']}>
      <SendWorkoutPage />
    </RequireRole>
  );
}

interface Picked extends ExerciseDetails { video: WorkoutVideo; note: string }

function SendWorkoutPage() {
  const params = useLocalSearchParams<{ userId?: string; videoId?: string }>();
  const { user: me } = useAuth();
  const data = useApi(async () => {
    const [users, videos] = await Promise.all([
      me?.role === 'trainer'
        ? api.get<{ users: User[] }>('/api/trainer/users').then((r) => r.users)
        : api.get<{ users: User[] }>('/api/users', { role: 'client', archived: 'false' }).then((r) => r.users),
      library.videos(),
    ]);
    return { users: users.filter((u) => !u.isArchived), videos };
  });

  return (
    <BackPage p={p} kicker="WORKOUTS" title="Send a workout" maxWidth={900}>
      {data.error && <Notice text={data.error} />}
      {!data.data && !data.error && <Loading />}
      {data.data && <SendForm users={data.data.users} videos={data.data.videos} userId={params.userId} videoId={params.videoId} />}
    </BackPage>
  );
}

function nextDays(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return todayKey(d);
  });
}

function SendForm({ users, videos, userId: initialUser, videoId }: { users: User[]; videos: WorkoutVideo[]; userId?: string; videoId?: string }) {
  const [userId, setUserId] = useState<string | null>(users.some((u) => u.uid === initialUser) ? initialUser! : users.length === 1 ? users[0].uid : null);
  const [userSearch, setUserSearch] = useState('');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(todayKey());
  const [note, setNote] = useState('');
  const [picked, setPicked] = useState<Picked[]>(() => {
    const v = videos.find((x) => x.id === videoId);
    return v ? [{ video: v, note: '', ...DEFAULT_DETAILS }] : [];
  });
  const [browsing, setBrowsing] = useState(picked.length === 0);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<FilterValue>(() => initialFilters(videoFilterSections(null, false)));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chosenUser = users.find((u) => u.uid === userId) ?? null;
  const uq = userSearch.trim().toLowerCase();
  const userList = users.filter((u) => !uq || (u.displayName || '').toLowerCase().includes(uq) || u.email.toLowerCase().includes(uq));
  // Categories for the filter come from the videos themselves.
  const categories = [...new Map(videos.map((v) => [v.categoryId, { id: v.categoryId, name: v.categoryName, videoCount: 0 }])).values()]
    .map((c) => ({ ...c, videoCount: videos.filter((v) => v.categoryId === c.id).length }));
  const sections = videoFilterSections(categories, false);
  const matches = applyVideoFilters(videos, filters, search);
  const isPicked = (id: string) => picked.some((x) => x.video.id === id);
  const minutes = picked.reduce((n, x) => n + x.video.durationMinutes, 0);

  const toggle = (v: WorkoutVideo) =>
    setPicked((cur) => (cur.some((x) => x.video.id === v.id) ? cur.filter((x) => x.video.id !== v.id) : [...cur, { video: v, note: '', ...DEFAULT_DETAILS }]));
  const move = (i: number, by: number) => setPicked((cur) => {
    const next = [...cur];
    const j = i + by;
    if (j < 0 || j >= next.length) return cur;
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });

  async function send() {
    setError(null);
    if (!userId) return setError('Choose who to send the workout to.');
    if (picked.length === 0) return setError('Add at least one video.');
    const name = title.trim() || `${dayLabel(date)} workout`;
    setSending(true);
    try {
      const w = await workouts.send({
        userId, title: name, date, note: note.trim(), items: picked.map((x) => ({
          videoId: x.video.id, note: x.note.trim(), sets: x.sets, reps: x.reps, durationSeconds: x.durationSeconds, restSeconds: x.restSeconds,
        })),
      });
      router.replace(`/workout/${w.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not send. Please try again.');
    } finally {
      setSending(false);
    }
  }

  if (users.length === 0) {
    return <Empty p={p} icon="people-outline" text="You have no users to send workouts to yet." />;
  }
  if (videos.length === 0) {
    return <Empty p={p} icon="film-outline" text="The video library is empty. An admin needs to add videos first." />;
  }

  return (
    <View style={{ gap: 16 }}>
      {/* 1. Who */}
      <Card p={p} style={{ gap: 12 }}>
        <Step n={1} text="Send to" />
        {chosenUser ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Avatar p={p} name={chosenUser.displayName || chosenUser.email} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: p.text, fontSize: 15.5, fontWeight: '800' }}>{chosenUser.displayName || chosenUser.email}</Text>
              <Text style={{ color: p.textSecondary, fontSize: 12.5 }}>{chosenUser.email}</Text>
            </View>
            {users.length > 1 && <Button p={p} small kind="outline" label="Change" onPress={() => setUserId(null)} />}
          </View>
        ) : (
          <>
            {users.length > 6 && <Field p={p} label="Search" icon="search-outline" value={userSearch} onChangeText={setUserSearch} placeholder="Name or email" />}
            {userList.slice(0, 30).map((u) => (
              <Pressable key={u.uid} onPress={() => setUserId(u.uid)} accessibilityRole="radio"
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, borderRadius: 12, backgroundColor: pressed ? p.elevated : 'transparent' })}>
                <Avatar p={p} name={u.displayName || u.email} size={34} />
                <Text style={{ flex: 1, color: p.text, fontSize: 14.5, fontWeight: '700' }} numberOfLines={1}>{u.displayName || u.email}</Text>
                <Ionicons name="ellipse-outline" size={20} color={p.textSecondary} />
              </Pressable>
            ))}
          </>
        )}
      </Card>

      {/* 2. When + title */}
      <Card p={p} style={{ gap: 12 }}>
        <Step n={2} text="Day and title" />
        <Chips p={p} value={date} onChange={setDate} options={nextDays(7).map((d) => ({ value: d, label: dayLabel(d) }))} />
        <Field p={p} label="Title (optional)" icon="text-outline" value={title} onChangeText={setTitle}
          placeholder={`e.g. Chest day · default "${dayLabel(date)} workout"`} maxLength={120} />
      </Card>

      {/* 3. Videos */}
      <Card p={p} style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}><Step n={3} text={`Videos${picked.length ? ` (${picked.length} · about ${minutes} min)` : ''}`} /></View>
          {picked.length > 0 && <Button p={p} small kind="outline" label={browsing ? 'Done adding' : 'Add videos'} icon={browsing ? 'checkmark' : 'add'}
            onPress={() => setBrowsing(!browsing)} />}
        </View>
        {picked.map((x, i) => (
          <View key={x.video.id} style={{ gap: 8, padding: 12, borderRadius: 14, backgroundColor: p.elevated }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ color: p.accent, fontWeight: '800', fontSize: 15, width: 22 }}>{i + 1}.</Text>
              <Text style={{ flex: 1, color: p.text, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>{x.video.title}</Text>
              <Text style={{ color: p.textSecondary, fontSize: 12.5 }}>{x.video.durationMinutes} min</Text>
              <Small icon="arrow-up" onPress={() => move(i, -1)} disabled={i === 0} />
              <Small icon="arrow-down" onPress={() => move(i, 1)} disabled={i === picked.length - 1} />
              <Small icon="close" onPress={() => toggle(x.video)} danger />
            </View>
            <ExerciseFields p={p} value={x} onChange={(d) => setPicked((cur) => cur.map((y, j) => (j === i ? { ...y, ...d } : y)))} />
            <TextInput value={x.note} onChangeText={(t) => setPicked((cur) => cur.map((y, j) => (j === i ? { ...y, note: t } : y)))}
              placeholder="Note (optional), e.g. keep your back straight" placeholderTextColor={p.textSecondary + '99'} maxLength={300}
              selectionColor={p.accent}
              style={{ color: p.text, fontSize: 14, borderWidth: 1, borderColor: p.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, outlineStyle: 'none' } as never} />
          </View>
        ))}
        {browsing && (
          <View style={{ gap: 10 }}>
            <Field p={p} label="Find videos" icon="search-outline" value={search} onChangeText={setSearch} placeholder="Exercise, category, equipment" />
            <Filters p={p} sections={sections} value={filters} onChange={setFilters} count={(v) => applyVideoFilters(videos, v, search).length} />
            {matches.length === 0 && <Text style={{ color: p.textSecondary }}>No videos match.</Text>}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {matches.map((v) => <VideoCard key={v.id} p={p} video={v} compact selected={isPicked(v.id)} onPress={() => toggle(v)} />)}
            </View>
          </View>
        )}
      </Card>

      {/* 4. Note */}
      <Card p={p} style={{ gap: 12 }}>
        <Step n={4} text="Message (optional)" />
        <Field p={p} label="For the whole workout" icon="chatbubble-ellipses-outline" value={note} onChangeText={setNote}
          placeholder="e.g. Warm up for 5 minutes first. Drink water!" multiline maxLength={1000}
          style={{ flex: 1, color: p.text, fontSize: 15.5, paddingVertical: 12, minHeight: 70, textAlignVertical: 'top', outlineStyle: 'none' } as never} />
      </Card>

      {error && <Notice text={error} />}
      <Button p={p} label={chosenUser ? `Send to ${chosenUser.displayName?.split(' ')[0] || 'user'}` : 'Send workout'}
        icon="paper-plane-outline" loading={sending} onPress={send} />
    </View>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: p.accent, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: p.onAccent, fontWeight: '800', fontSize: 13 }}>{n}</Text>
      </View>
      <Text style={{ color: p.text, fontSize: 16, fontWeight: '800' }}>{text}</Text>
    </View>
  );
}

function Small({ icon, onPress, disabled, danger }: { icon: 'arrow-up' | 'arrow-down' | 'close'; onPress: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={6} accessibilityLabel={icon}
      style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: p.card, opacity: disabled ? 0.35 : 1 }}>
      <Ionicons name={icon} size={16} color={danger ? '#EF5350' : p.accent} />
    </Pressable>
  );
}
