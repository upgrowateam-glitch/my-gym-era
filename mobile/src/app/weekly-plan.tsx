// Weekly plan builder (Trainer → their assigned users; Super Admin / Admins
// with "View all users" → any user). /weekly-plan?userId=<user>
// The trainer sets up one week — each day a workout (exercises with sets,
// reps or time, rest) or a rest day — picks a start date and how many weeks,
// and the app creates every day's workout. The daily diet (same every day,
// with meal times) is the user's nutrition plan, edited from here too.
// If the user already has a weekly plan, the builder starts from it.

import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import type { User } from '@/lib/types';
import {
  WEEKDAYS, WEEKDAYS_SHORT, dayLabel, library, todayKey, weeklyApi, weekdayOf,
  type ExerciseDetails, type WeeklyPlan, type WorkoutVideo,
} from '@/lib/workouts';
import { plansApi, timeText, type NutritionPlan } from '@/lib/nutrition';
import { RequireRole } from '@/components/RequireRole';
import { BackPage } from '@/components/staff/BackPage';
import { DEFAULT_DETAILS, ExerciseFields } from '@/components/library/ExerciseFields';
import { VideoBrowser } from '@/components/library/VideoBrowser';
import { mealsInTimeOrder } from '@/components/nutrition/NutritionUI';
import { Avatar, Button, Card, Chips, Empty, Field, Notice } from '@/components/ui/UI';
import { Loading } from '@/components/staff/DashboardUI';
import { SUPER as p } from '@/theme/palettes';

export default function WeeklyPlanRoute() {
  return (
    <RequireRole roles={['super_admin', 'admin', 'trainer']}>
      <WeeklyPlanPage />
    </RequireRole>
  );
}

function WeeklyPlanPage() {
  const params = useLocalSearchParams<{ userId?: string }>();
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
  const [userId, setUserId] = useState<string | null>(params.userId ?? null);
  const users = data.data?.users ?? [];
  const chosen = users.find((u) => u.uid === userId) ?? (users.length === 1 ? users[0] : null);

  return (
    <BackPage p={p} kicker="PLANS" title="Weekly plan" maxWidth={960}>
      {data.error && <Notice text={data.error} />}
      {!data.data && !data.error && <Loading />}
      {data.data && users.length === 0 && <Empty p={p} icon="people-outline" text="You have no users to plan for yet." />}
      {data.data && data.data.videos.length === 0 && <Empty p={p} icon="film-outline" text="The video library is empty. An admin needs to add videos first." />}
      {data.data && data.data.videos.length > 0 && users.length > 0 && !chosen && <UserPicker users={users} onPick={setUserId} />}
      {data.data && data.data.videos.length > 0 && chosen && (
        <Loader key={chosen.uid} user={chosen} videos={data.data.videos} onChangeUser={users.length > 1 ? () => setUserId(null) : undefined} />
      )}
    </BackPage>
  );
}

function UserPicker({ users, onPick }: { users: User[]; onPick: (id: string) => void }) {
  const [q, setQ] = useState('');
  const s = q.trim().toLowerCase();
  return (
    <Card p={p} style={{ gap: 10 }}>
      <Text style={{ color: p.text, fontSize: 16, fontWeight: '800' }}>Who is this plan for?</Text>
      {users.length > 6 && <Field p={p} label="Search" icon="search-outline" value={q} onChangeText={setQ} placeholder="Name or email" />}
      {users.filter((u) => !s || (u.displayName || '').toLowerCase().includes(s) || u.email.toLowerCase().includes(s)).slice(0, 40).map((u) => (
        <Pressable key={u.uid} onPress={() => onPick(u.uid)} accessibilityRole="button"
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, borderRadius: 12, backgroundColor: pressed ? p.elevated : 'transparent' })}>
          <Avatar p={p} name={u.displayName || u.email} size={34} />
          <Text style={{ flex: 1, color: p.text, fontSize: 14.5, fontWeight: '700' }} numberOfLines={1}>{u.displayName || u.email}</Text>
          <Ionicons name="chevron-forward" size={18} color={p.textSecondary} />
        </Pressable>
      ))}
    </Card>
  );
}

/** Loads the user's current weekly plan and diet, then shows the builder. */
function Loader({ user, videos, onChangeUser }: { user: User; videos: WorkoutVideo[]; onChangeUser?: () => void }) {
  const info = useApi(async () => {
    const [weekly, diet] = await Promise.all([weeklyApi.of(user.uid), plansApi.of(user.uid)]);
    return { current: weekly.current, diet: diet.current };
  });
  if (info.error) return <Notice text={info.error} />;
  if (!info.data) return <Loading />;
  return <Builder user={user} videos={videos} current={info.data.current} diet={info.data.diet} onChangeUser={onChangeUser} />;
}

interface Ex extends ExerciseDetails { key: string; video: WorkoutVideo; note: string }
interface Day { rest: boolean; title: string; items: Ex[] }
let nextKey = 1;

function nextDays(n: number) {
  return Array.from({ length: n }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return todayKey(d); });
}

function Builder({ user, videos, current, diet, onChangeUser }: {
  user: User; videos: WorkoutVideo[]; current: WeeklyPlan | null; diet: NutritionPlan | null; onChangeUser?: () => void;
}) {
  const byId = new Map(videos.map((v) => [v.id, v]));
  const [days, setDays] = useState<Day[]>(() => WEEKDAYS.map((name, weekday) => {
    const d = current?.days.find((x) => x.weekday === weekday);
    if (!d) return { rest: weekday >= 5, title: '', items: [] };
    return {
      rest: d.rest,
      title: d.rest ? '' : d.title,
      items: d.items.filter((i) => byId.has(i.videoId)).map((i) => ({
        key: `e${nextKey++}`, video: byId.get(i.videoId)!, note: i.note ?? '',
        sets: i.sets, reps: i.reps, durationSeconds: i.durationSeconds, restSeconds: i.restSeconds,
      })),
    };
  }));
  const [day, setDay] = useState(weekdayOf(todayKey()));
  const [title, setTitle] = useState(current?.title ?? 'Weekly plan');
  const [startDate, setStartDate] = useState(todayKey());
  const [weeks, setWeeks] = useState(current?.weeks ?? 4);
  const [note, setNote] = useState(current?.note ?? '');
  const [browsing, setBrowsing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const d = days[day];
  const setD = (patch: Partial<Day>) => setDays((cur) => cur.map((x, i) => (i === day ? { ...x, ...patch } : x)));
  const setItem = (key: string, patch: Partial<Ex>) => setD({ items: d.items.map((x) => (x.key === key ? { ...x, ...patch } : x)) });
  const move = (i: number, by: number) => {
    const next = [...d.items]; const j = i + by;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setD({ items: next });
  };
  const toggleVideo = (v: WorkoutVideo) => setD({
    items: d.items.some((x) => x.video.id === v.id) ? d.items.filter((x) => x.video.id !== v.id)
      : [...d.items, { key: `e${nextKey++}`, video: v, note: '', ...DEFAULT_DETAILS }],
  });
  const copyTo = (target: number) => setDays((cur) => cur.map((x, i) => (i === target
    ? { rest: d.rest, title: d.title, items: d.items.map((it) => ({ ...it, key: `e${nextKey++}` })) } : x)));

  const workoutDays = days.filter((x) => !x.rest && x.items.length > 0).length;
  const startWeekday = weekdayOf(startDate);
  // How many workouts the plan will create (days in range that are workout days).
  const created = Array.from({ length: weeks * 7 }, (_, n) => days[(startWeekday + n) % 7]).filter((x) => !x.rest && x.items.length > 0).length;

  async function send() {
    setError(null);
    const empty = days.findIndex((x) => !x.rest && x.items.length === 0);
    if (empty >= 0) { setDay(empty); return setError(`${WEEKDAYS[empty]} is a workout day without exercises. Add exercises or make it a rest day.`); }
    if (workoutDays === 0) return setError('Add a workout to at least one day.');
    if (!title.trim()) return setError('Please enter a title.');
    setSending(true);
    try {
      const r = await weeklyApi.send({
        userId: user.uid, title: title.trim(), startDate, weeks, note: note.trim(),
        days: days.map((x, weekday) => ({
          weekday, rest: x.rest, title: x.title.trim(),
          items: x.rest ? [] : x.items.map((it) => ({
            videoId: it.video.id, note: it.note.trim(), sets: it.sets, reps: it.reps, durationSeconds: it.durationSeconds, restSeconds: it.restSeconds,
          })),
        })),
      });
      setDone(`Sent! ${r.workoutsCreated} workouts were added to ${user.displayName?.split(' ')[0] || 'the user'}'s calendar.`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not send. Please try again.');
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <Card p={p} style={{ gap: 12, alignItems: 'center', paddingVertical: 28 }}>
        <Ionicons name="checkmark-circle" size={48} color="#4ADE80" />
        <Text style={{ color: p.text, fontSize: 17, fontWeight: '800', textAlign: 'center' }}>{done}</Text>
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Button p={p} label="Open user" icon="person-outline" onPress={() => router.replace(`/member/${user.uid}`)} />
          <Button p={p} kind="outline" label={diet ? 'Edit daily diet' : 'Create daily diet'} icon="nutrition-outline"
            onPress={() => router.push({ pathname: '/nutrition-plan', params: { userId: user.uid } })} />
        </View>
      </Card>
    );
  }

  return (
    <View style={{ gap: 16 }}>
      {/* Who */}
      <Card p={p} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Avatar p={p} name={user.displayName || user.email} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: p.text, fontSize: 15.5, fontWeight: '800' }}>{user.displayName || user.email}</Text>
          <Text style={{ color: p.textSecondary, fontSize: 12.5 }}>
            {current ? `Current plan: "${current.title}" until ${dayLabel(current.endDate)} — edit it below and send` : 'No weekly plan yet'}
          </Text>
        </View>
        {onChangeUser && <Button p={p} small kind="outline" label="Change" onPress={onChangeUser} />}
      </Card>

      {/* When */}
      <Card p={p} style={{ gap: 12 }}>
        <Field p={p} label="Plan title" icon="text-outline" value={title} onChangeText={setTitle} placeholder="e.g. Strength block – month 1" maxLength={120} />
        <Text style={st.label}>Start date</Text>
        <Chips p={p} value={startDate} onChange={setStartDate} options={nextDays(14).map((x) => ({ value: x, label: dayLabel(x) }))} />
        <Text style={st.label}>Repeat for</Text>
        <Chips p={p} value={weeks} onChange={setWeeks} options={[1, 2, 4, 6, 8, 12].map((w) => ({ value: w, label: `${w} ${w === 1 ? 'week' : 'weeks'}` }))} />
        <Text style={{ color: p.textSecondary, fontSize: 13 }}>
          {workoutDays} workout {workoutDays === 1 ? 'day' : 'days'} a week · {created} workouts from {dayLabel(startDate)} to {dayLabel(nextDateAfter(startDate, weeks * 7 - 1))}
        </Text>
      </Card>

      {/* The week */}
      <Card p={p} style={{ gap: 12 }}>
        <Text style={{ color: p.text, fontSize: 16, fontWeight: '800' }}>The week</Text>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {WEEKDAYS_SHORT.map((name, i) => {
            const x = days[i]; const on = i === day;
            return (
              <Pressable key={name} onPress={() => { setDay(i); setBrowsing(false); }} accessibilityRole="tab" accessibilityState={{ selected: on }}
                style={{ minWidth: 64, alignItems: 'center', paddingVertical: 8, paddingHorizontal: 8, borderRadius: 14, borderWidth: 1,
                  borderColor: on ? p.accent : p.border, backgroundColor: on ? p.accent + '22' : p.elevated }}>
                <Text style={{ color: on ? p.accent : p.text, fontWeight: '800' }}>{name}</Text>
                <Text style={{ color: x.rest ? p.textSecondary : x.items.length ? '#4ADE80' : '#FBBF24', fontSize: 11.5, fontWeight: '700' }}>
                  {x.rest ? 'Rest' : `${x.items.length} ex.`}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ gap: 12, padding: 12, borderRadius: 16, backgroundColor: p.elevated }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Text style={{ flex: 1, color: p.text, fontSize: 17, fontWeight: '800' }}>{WEEKDAYS[day]}</Text>
            <Chips p={p} value={d.rest ? 'rest' : 'workout'} onChange={(v) => setD({ rest: v === 'rest' })}
              options={[{ value: 'workout', label: 'Workout' }, { value: 'rest', label: 'Rest day' }]} />
          </View>
          {d.rest ? (
            <Text style={{ color: p.textSecondary }}>Rest day — no workout. 😴</Text>
          ) : (
            <>
              <Field p={p} label="Day title" icon="barbell-outline" value={d.title} onChangeText={(t) => setD({ title: t })}
                placeholder={`e.g. Chest & arms (default "${WEEKDAYS[day]} workout")`} maxLength={80} />
              {d.items.length === 0 && <Text style={{ color: '#FBBF24', fontSize: 13 }}>No exercises yet — tap “Add exercises”.</Text>}
              {d.items.map((x, i) => (
                <View key={x.key} style={{ gap: 8, padding: 10, borderRadius: 14, backgroundColor: p.card }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ color: p.accent, fontWeight: '800', width: 22 }}>{i + 1}.</Text>
                    <Text style={{ flex: 1, color: p.text, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>{x.video.title}</Text>
                    <Small icon="arrow-up" onPress={() => move(i, -1)} disabled={i === 0} />
                    <Small icon="arrow-down" onPress={() => move(i, 1)} disabled={i === d.items.length - 1} />
                    <Small icon="close" onPress={() => toggleVideo(x.video)} danger />
                  </View>
                  <ExerciseFields p={p} value={x} onChange={(v) => setItem(x.key, v)} />
                  <TextInput value={x.note} onChangeText={(t) => setItem(x.key, { note: t })} maxLength={300} selectionColor={p.accent}
                    placeholder="Note (optional), e.g. slow on the way down" placeholderTextColor={p.textSecondary + '99'}
                    style={{ color: p.text, fontSize: 13.5, borderWidth: 1, borderColor: p.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, outlineStyle: 'none' } as never} />
                </View>
              ))}
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                <Button p={p} small label={browsing ? 'Done adding' : 'Add exercises'} icon={browsing ? 'checkmark' : 'add'} onPress={() => setBrowsing(!browsing)} />
              </View>
              {browsing && <VideoBrowser p={p} videos={videos} selectedIds={d.items.map((x) => x.video.id)} onToggle={toggleVideo} />}
            </>
          )}
          {/* Copy this day to other days */}
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <Text style={{ color: p.textSecondary, fontSize: 12.5 }}>Copy this day to:</Text>
            {WEEKDAYS_SHORT.map((name, i) => (i === day ? null : (
              <Pressable key={name} onPress={() => copyTo(i)} accessibilityRole="button"
                style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: p.border }}>
                <Text style={{ color: p.text, fontSize: 12.5, fontWeight: '700' }}>{name}</Text>
              </Pressable>
            )))}
          </View>
        </View>
      </Card>

      {/* Daily diet */}
      <Card p={p} style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Ionicons name="nutrition-outline" size={20} color={p.accent} />
          <Text style={{ flex: 1, color: p.text, fontSize: 16, fontWeight: '800' }}>Daily diet (same every day)</Text>
        </View>
        {diet ? (
          <>
            <Text style={{ color: p.text }}>{diet.title} · {diet.totals.calories} kcal · protein {diet.totals.protein} g</Text>
            <Text style={{ color: p.textSecondary, fontSize: 13 }}>
              {mealsInTimeOrder(diet).filter((m) => diet.items.some((i) => i.meal === m.value))
                .map((m) => `${m.label}${diet.mealTimes[m.value] ? ` ${timeText(diet.mealTimes[m.value])}` : ''}`).join(' · ')}
            </Text>
          </>
        ) : <Text style={{ color: p.textSecondary }}>No diet yet.</Text>}
        <View style={{ alignSelf: 'flex-start' }}>
          <Button p={p} small kind="outline" label={diet ? 'Edit diet & meal times' : 'Create the daily diet'} icon="create-outline"
            onPress={() => router.push({ pathname: '/nutrition-plan', params: { userId: user.uid } })} />
        </View>
      </Card>

      <Card p={p} style={{ gap: 12 }}>
        <Field p={p} label="Message (optional)" icon="chatbubble-ellipses-outline" value={note} onChangeText={setNote} multiline maxLength={1000}
          placeholder="e.g. Warm up 5 minutes before every workout. Sleep 7+ hours."
          style={{ flex: 1, color: p.text, fontSize: 15.5, paddingVertical: 12, minHeight: 70, textAlignVertical: 'top', outlineStyle: 'none' } as never} />
      </Card>

      {error && <Notice text={error} />}
      <Button p={p} label={`Send plan to ${user.displayName?.split(' ')[0] || 'user'} (${created} workouts)`} icon="paper-plane-outline" loading={sending} onPress={send} />
      {current && (
        <Text style={{ color: p.textSecondary, fontSize: 12.5, textAlign: 'center' }}>
          This replaces the current plan from {dayLabel(startDate)}. Days they already worked on stay.
        </Text>
      )}
    </View>
  );
}

function nextDateAfter(date: string, n: number) {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + n);
  return todayKey(d);
}

function Small({ icon, onPress, disabled, danger }: { icon: 'arrow-up' | 'arrow-down' | 'close'; onPress: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={6} accessibilityLabel={icon}
      style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: p.elevated, opacity: disabled ? 0.35 : 1 }}>
      <Ionicons name={icon} size={16} color={danger ? '#EF5350' : p.accent} />
    </Pressable>
  );
}

const st = { label: { color: p.textSecondary, fontSize: 12.5, fontWeight: '700' as const, letterSpacing: 0.3 } };


