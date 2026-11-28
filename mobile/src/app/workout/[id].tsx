// One workout. The User watches each video and marks it done (and can undo).
// Their trainer / admins see the same page with the progress, and can cancel it.

import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { confirm } from '@/lib/confirm';
import { bodyPartsText, dayLabel, exerciseText, workouts, type Workout, type WorkoutItem } from '@/lib/workouts';
import { RequireRole } from '@/components/RequireRole';
import { VideoPlayer } from '@/components/VideoPlayer';
import { DifficultyBadge, VideoThumb } from '@/components/library/VideoCard';
import { BackPage } from '@/components/staff/BackPage';
import { Button, Card, Notice } from '@/components/ui/UI';
import { Loading } from '@/components/staff/DashboardUI';
import { SUPER as p } from '@/theme/palettes';

export default function WorkoutRoute() {
  return (
    <RequireRole roles={['client', 'trainer', 'admin', 'super_admin']}>
      <WorkoutPage />
    </RequireRole>
  );
}

function WorkoutPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const data = useApi(() => workouts.get(id));
  const w = data.data;
  const isUser = !!w && w.userId === user?.uid;
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function setDone(item: WorkoutItem, done: boolean) {
    if (!w) return;
    setBusy(item.id);
    setError(null);
    try {
      const updated = await workouts.setDone(w.id, item.id, done);
      data.setData(updated);
      // Finished this one: open the next video that is not done yet.
      if (done) setOpen(updated.items.find((i) => !i.completedAt && i.video)?.id ?? null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save. Please try again.');
    } finally {
      setBusy(null);
    }
  }

  async function cancel() {
    if (!w || !(await confirm(`Delete "${w.title}"?`, 'The user will no longer see this workout.', 'Delete'))) return;
    try {
      await workouts.cancel(w.id);
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not delete the workout.');
    }
  }

  return (
    <BackPage p={p} onRefresh={data.reload} refreshing={data.loading && !!w} maxWidth={820} fallback={user?.role === 'client' ? '/workouts' : undefined}>
      {data.error && <Notice text={data.error} />}
      {!w && !data.error && <Loading />}
      {w && (
        <>
          <Header w={w} />
          {w.note ? (
            <Card p={p} style={{ flexDirection: 'row', gap: 10 }}>
              <Ionicons name="chatbubble-ellipses-outline" size={20} color={p.accent} />
              <Text style={{ flex: 1, color: p.text, fontSize: 14.5, lineHeight: 21 }}>{w.note}</Text>
            </Card>
          ) : null}
          {error && <Notice text={error} />}
          {w.completed && (
            <Notice kind="success" text={isUser ? 'Workout complete. Great job! 💪' : 'The user has completed this workout.'} />
          )}

          {w.items.map((item, i) => {
            const done = !!item.completedAt;
            const expanded = open === item.id && !!item.video;
            return (
              <Card key={item.id} p={p} style={{ gap: 12, padding: 0, overflow: 'hidden', borderColor: done ? '#4ADE8066' : p.border }}>
                <Pressable onPress={() => setOpen(expanded ? null : item.id)} disabled={!item.video}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
                  <View style={{ width: 92, borderRadius: 10, overflow: 'hidden' }}>
                    {item.video ? <VideoThumb p={p} video={item.video} height={56} /> : (
                      <View style={{ height: 56, backgroundColor: p.elevated, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="film-outline" size={20} color={p.textSecondary} />
                      </View>
                    )}
                  </View>
                  <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                    <Text style={{ color: p.text, fontSize: 15.5, fontWeight: '800', textDecorationLine: done ? 'line-through' : 'none' }} numberOfLines={2}>
                      {i + 1}. {item.title}
                    </Text>
                    {exerciseText(item) ? <Text style={{ color: p.accent, fontSize: 14, fontWeight: '800' }}>{exerciseText(item)}</Text> : null}
                    {item.note ? <Text style={{ color: p.text, fontSize: 13 }}>{item.note}</Text> : null}
                    <Text style={{ color: p.textSecondary, fontSize: 12.5 }} numberOfLines={1}>
                      {item.video ? `${item.video.durationMinutes} min · ${bodyPartsText(item.video.bodyParts)}` : 'This video was removed from the library'}
                    </Text>
                  </View>
                  {done
                    ? <Ionicons name="checkmark-circle" size={26} color="#4ADE80" />
                    : item.video && <Ionicons name={expanded ? 'chevron-up' : 'play-circle-outline'} size={26} color={p.accent} />}
                </Pressable>

                {expanded && item.video && (
                  <View style={{ paddingHorizontal: 14, gap: 10 }}>
                    <VideoPlayer source={item.video.source} url={item.video.videoUrl} />
                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <DifficultyBadge value={item.video.difficulty} />
                      {item.video.equipment ? <Text style={{ color: p.textSecondary, fontSize: 13 }}>Equipment: {item.video.equipment}</Text> : null}
                    </View>
                    {item.video.description ? <Text style={{ color: p.text, fontSize: 14.5, lineHeight: 21 }}>{item.video.description}</Text> : null}
                  </View>
                )}

                <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
                  {isUser ? (
                    <Button p={p} small={!expanded} kind={done ? 'outline' : 'primary'} loading={busy === item.id}
                      label={done ? 'Done ✓ · tap to undo' : 'Mark as done'} icon={done ? undefined : 'checkmark'}
                      onPress={() => setDone(item, !done)} />
                  ) : (
                    <Text style={{ color: done ? '#4ADE80' : p.textSecondary, fontSize: 13, fontWeight: '700' }}>
                      {done ? `Done · ${new Date(item.completedAt!).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : 'Not done yet'}
                    </Text>
                  )}
                </View>
              </Card>
            );
          })}

          {!isUser && <Button p={p} kind="danger" label="Delete this workout" icon="trash-outline" onPress={cancel} />}
        </>
      )}
    </BackPage>
  );
}

function Header({ w }: { w: Workout }) {
  const pct = w.items.length ? Math.round((w.doneCount / w.items.length) * 100) : 0;
  const minutes = w.items.reduce((n, i) => n + (i.video?.durationMinutes ?? 0), 0);
  return (
    <Card p={p} style={{ gap: 10 }}>
      <Text style={{ color: p.accent, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 }}>{dayLabel(w.date).toUpperCase()} · WORKOUT</Text>
      <Text style={{ color: p.text, fontSize: 24, fontWeight: '800' }}>{w.title}</Text>
      <Text style={{ color: p.textSecondary, fontSize: 13.5 }}>
        {w.items.length} {w.items.length === 1 ? 'video' : 'videos'} · about {minutes} min{w.sentByName ? ` · from ${w.sentByName}` : ''}
      </Text>
      <View style={{ gap: 6 }}>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: p.elevated, overflow: 'hidden' }}>
          <View style={{ height: 8, borderRadius: 4, width: `${pct}%`, backgroundColor: w.completed ? '#4ADE80' : p.accent }} />
        </View>
        <Text style={{ color: p.text, fontSize: 13, fontWeight: '700' }}>{w.doneCount} of {w.items.length} done</Text>
      </View>
    </Card>
  );
}
