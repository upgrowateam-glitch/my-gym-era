// A User's fitness profile, read-only, for staff (FitZone gold).
// Super Admin and Admins (with "View all users") can open any User; a Trainer
// only the Users assigned to them. The server enforces this — anyone else gets
// "not allowed". Real answers only; nothing is filled in for missing steps.
// Super Admin / Admins also get the actions: assign or change the trainer and
// activate / deactivate the account.

import { useState, type ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View, type LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { homeRouteFor, useAuth } from '@/lib/auth';
import { api, ApiError } from '@/lib/api';
import { assignTrainer, setAccountActive } from '@/lib/userActions';
import { useApi } from '@/lib/useApi';
import type { TrainerSummary, User } from '@/lib/types';
import {
  ACTIVITY_LEVELS, BMI_INFO, DIET_TYPES, EATING_OUT, EXPERIENCE, GENDERS, GOALS, SLEEP_QUALITY, SMOKING, WORK_TYPES,
  WORKOUT_TIMES, getFitnessOf, labelOf, pastTrainingText, type FitnessProfile, type Section,
} from '@/lib/fitness';
import { RequireRole } from '@/components/RequireRole';
import { Avatar, Badge, Notice, ToggleRow } from '@/components/ui/UI';
import { TrainerAssign } from '@/components/TrainerAssign';
import { WorkoutRow } from '@/components/library/WorkoutList';
import { workouts } from '@/lib/workouts';
import { plansApi } from '@/lib/nutrition';
import { dashboardStyles, Grid, Loading, Mini, MiniRow, Muted, Panel, shortDate, TWO_COLUMNS_MIN, AMBER } from '@/components/staff/DashboardUI';
import { SUPER as p } from '@/theme/palettes';

export default function MemberRoute() {
  return (
    <RequireRole roles={['super_admin', 'admin', 'trainer']}>
      <MemberProfile />
    </RequireRole>
  );
}

function MemberProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user: me } = useAuth();
  const data = useApi(async () => {
    const [account, profile] = await Promise.all([
      api.get<{ user: User }>(`/api/users/${id}`).then((r) => r.user),
      getFitnessOf(id),
    ]);
    return { account, fitness: profile.fitness };
  });
  const d = data.data;
  const [width, setWidth] = useState(0);
  const twoCols = width >= TWO_COLUMNS_MIN;

  const back = () => {
    if (router.canGoBack()) router.back();
    else if (me) router.replace(homeRouteFor(me));
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={dashboardStyles.page}
        refreshControl={<RefreshControl refreshing={data.loading && !!d} onRefresh={data.reload} tintColor={p.accent} />}>
        <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)} style={{ gap: 16 }}>
          <Pressable onPress={back} hitSlop={10} accessibilityRole="button"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
            <Ionicons name="chevron-back" size={20} color={p.accent} />
            <Text style={{ color: p.accent, fontWeight: '700', fontSize: 14.5 }}>Back</Text>
          </Pressable>

          {data.error && <Notice text={data.error} />}
          {!d && !data.error && <Loading />}
          {d && (
            <Profile account={d.account} f={d.fitness} twoCols={twoCols}
              manage={me?.role === 'super_admin' || me?.role === 'admin'
                ? <ManagePanel account={d.account} onChange={(u) => data.setData((cur) => (cur ? { ...cur, account: u } : cur))} />
                : null} />
          )}
          {d && <WorkoutsPanel userId={d.account.uid} active={!d.account.isArchived} />}
          {d && <NutritionPanel userId={d.account.uid} active={!d.account.isArchived} />}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Profile({ account: u, f, twoCols, manage }: { account: User; f: FitnessProfile; twoCols: boolean; manage: ReactNode }) {
  const name = u.displayName || u.email;
  const notAnswered = (s: Section) => f.missing.includes(s);

  return (
    <>
      {/* Header */}
      <View style={{
        backgroundColor: p.card, borderColor: p.border, borderWidth: 1, borderRadius: 20, padding: 18,
        flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap',
      }}>
        <Avatar p={p} name={name} size={56} />
        <View style={{ flex: 1, minWidth: 200, gap: 3 }}>
          <Text style={{ color: p.text, fontSize: 22, fontWeight: '800' }} numberOfLines={1}>{name}</Text>
          <Text style={{ color: p.textSecondary, fontSize: 13.5 }} numberOfLines={1}>
            {u.email}{u.whatsapp ? ` · ${u.whatsapp}` : ''}
          </Text>
          <Text style={{ color: p.textSecondary, fontSize: 13.5 }} numberOfLines={1}>
            Joined {shortDate(u.createdAt)} · {u.trainerName ? `Trainer: ${u.trainerName}` : 'No trainer yet'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
            <Badge label={u.isArchived ? 'Inactive' : 'Active'} tone={u.isArchived ? 'inactive' : 'active'} />
            <Badge label={f.completedAt ? 'Profile done' : 'Profile not finished'} tone={f.completedAt ? 'active' : 'pending'} />
          </View>
        </View>
      </View>

      {manage}

      {!f.completedAt && (
        <Notice kind="info" text={f.missing.length === 7
          ? 'This user has not started the fitness profile yet. They will fill it in when they next sign in.'
          : `This user has not finished the fitness profile yet (${7 - f.missing.length} of 7 steps answered).`} />
      )}

      <Grid twoCols={twoCols}>
        <View style={{ gap: 16 }}>
          <Panel title="Body & BMI" icon="resize-outline">
            {notAnswered('body') || !f.body ? <NotYet /> : (
              <>
                <MiniRow>
                  <Mini label="Height" value={`${f.body.heightCm} cm`} />
                  <Mini label="Weight" value={`${f.body.weightKg} kg`} />
                  <Mini label="Target" value={f.body.targetWeightKg ? `${f.body.targetWeightKg} kg` : '—'} />
                </MiniRow>
                {f.bmi && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <Text style={{ color: p.text, fontSize: 28, fontWeight: '800' }}>{f.bmi.value.toFixed(1)}</Text>
                    <Text style={{ color: p.textSecondary, fontSize: 13 }}>BMI</Text>
                    <View style={{
                      borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3,
                      borderColor: BMI_INFO[f.bmi.category].color + '88', backgroundColor: BMI_INFO[f.bmi.category].color + '1F',
                    }}>
                      <Text style={{ color: BMI_INFO[f.bmi.category].color, fontWeight: '700', fontSize: 12.5 }}>
                        {BMI_INFO[f.bmi.category].label}
                      </Text>
                    </View>
                  </View>
                )}
                <Muted>BMI is calculated automatically and is only a general screening guide: it does not tell muscle from fat.</Muted>
              </>
            )}
          </Panel>

          <Panel title="Health" icon="medkit-outline">
            {notAnswered('health') || !f.health ? <NotYet /> : (
              <>
                <Line label="Injuries / pain" value={f.health.injuries || 'None'} warn={!!f.health.injuries} />
                <Line label="Medical conditions" value={f.health.medicalConditions || 'None'} warn={!!f.health.medicalConditions} />
                <Line label="Smoking" value={labelOf(SMOKING, f.health.smoking)} />
              </>
            )}
          </Panel>

          <Panel title="About" icon="person-outline">
            {notAnswered('personal') || !f.personal ? <NotYet /> : (
              <>
                <Line label="Gender" value={labelOf(GENDERS, f.personal.gender)} />
                <Line label="Age" value={f.age !== null ? `${f.age} years` : '—'} />
                <Line label="Phone / WhatsApp" value={f.personal.whatsapp || '—'} />
              </>
            )}
          </Panel>
        </View>

        <View style={{ gap: 16 }}>
          <Panel title="Goals & experience" icon="trophy-outline">
            {notAnswered('goals') || !f.goals ? <NotYet /> : (
              <>
                <Line label="Main goal" value={labelOf(GOALS, f.goals.mainGoal)} />
                {f.goals.extraGoals.length > 0 && (
                  <Line label="Also" value={f.goals.extraGoals.map((g) => labelOf(GOALS, g)).join(', ')} />
                )}
                <Line label="Experience level" value={labelOf(EXPERIENCE, f.goals.experience)} />
                <Line label="Previous training" value={pastTrainingText(f.goals).replace(/^Before: /, '')} />
                {f.goals.experienceNotes ? <Line label="Note" value={f.goals.experienceNotes} /> : null}
              </>
            )}
          </Panel>

          <Panel title="Daily routine & activity" icon="time-outline">
            {notAnswered('routine') || !f.routine ? <NotYet /> : (
              <>
                <Line label="Type of work" value={labelOf(WORK_TYPES, f.routine.workType)} />
                <Line label="Activity level" value={labelOf(ACTIVITY_LEVELS, f.routine.activityLevel)} />
                <Line label="Workout days" value={`${f.routine.workoutDays} a week`} />
                <Line label="Preferred time" value={labelOf(WORKOUT_TIMES, f.routine.workoutTime)} />
              </>
            )}
          </Panel>

          <Panel title="Food habits" icon="restaurant-outline">
            {notAnswered('food') || !f.food ? <NotYet /> : (
              <>
                <Line label="Diet" value={labelOf(DIET_TYPES, f.food.dietType)} />
                <Line label="Meals" value={`${f.food.mealsPerDay} a day`} />
                <Line label="Water" value={`${f.food.waterLitres} L a day`} />
                <Line label="Eating out" value={labelOf(EATING_OUT, f.food.eatingOut)} />
                <Line label="Foods to avoid" value={f.food.avoidFoods || 'None'} warn={!!f.food.avoidFoods} />
              </>
            )}
          </Panel>

          <Panel title="Sleep" icon="moon-outline">
            {notAnswered('sleep') || !f.sleep ? <NotYet /> : (
              <>
                <Line label="Schedule" value={`${f.sleep.bedtime} → ${f.sleep.wakeTime}`} />
                <Line label="Hours" value={`${f.sleep.sleepHours} h`} />
                <Line label="Quality" value={labelOf(SLEEP_QUALITY, f.sleep.quality)} />
              </>
            )}
          </Panel>
        </View>
      </Grid>
      {f.updatedAt && <Muted>Last updated {shortDate(f.updatedAt)}.</Muted>}
    </>
  );
}

/** Staff actions: trainer and account status (same rules and popups as the Users list). */
function ManagePanel({ account: u, onChange }: { account: User; onChange: (u: User) => void }) {
  const trainers = useApi(() => api.get<{ trainers: TrainerSummary[] }>('/api/admin/trainers', { scope: 'all' }).then((r) => r.trainers));
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function run(action: () => Promise<void>, fallback: string) {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : fallback);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Manage" icon="settings-outline">
      <TrainerAssign p={p} user={u} trainers={trainers.data} open={open} busy={busy} onToggle={() => setOpen(!open)}
        onAssign={(id) => run(async () => {
          const updated = await assignTrainer(u, id);
          if (updated) { onChange(updated); setOpen(false); void trainers.reload(); }
        }, 'Could not change the trainer.')} />
      <ToggleRow p={p} title="Account active" detail={u.isArchived ? 'Deactivated: cannot sign in' : 'Can sign in'}
        value={!u.isArchived} disabled={busy}
        onChange={(v) => run(async () => {
          const r = await setAccountActive(u, v);
          if (r) { onChange(r.user); if (r.info) setInfo(r.info); }
        }, 'Could not update the account.')} />
      {(error || trainers.error) && <Notice text={(error ?? trainers.error)!} />}
      {info && <Notice kind="info" text={info} />}
    </Panel>
  );
}

/** The user's current nutrition plan (totals) and earlier plans. */
function NutritionPanel({ userId, active }: { userId: string; active: boolean }) {
  const data = useApi(() => plansApi.of(userId));
  const current = data.data?.current ?? null;
  return (
    <Panel title="Nutrition plan" icon="nutrition-outline"
      action={active ? { label: current ? 'Edit plan' : 'Create plan', onPress: () => router.push({ pathname: '/nutrition-plan', params: { userId } }) } : undefined}>
      {data.error && <Notice text={data.error} />}
      {!data.data && !data.error ? <Loading /> : !current ? <Muted>No nutrition plan yet.</Muted> : (
        <Pressable onPress={() => router.push(`/nutrition/${current.id}`)} accessibilityRole="button" style={{ gap: 6 }}>
          <Text style={{ color: p.text, fontSize: 15.5, fontWeight: '800' }}>{current.title}</Text>
          <Text style={{ color: p.textSecondary, fontSize: 13 }}>
            {current.totals.calories} kcal · protein {current.totals.protein} g · carbs {current.totals.carbs} g · fat {current.totals.fat} g
          </Text>
          <Text style={{ color: p.accent, fontSize: 13, fontWeight: '700' }}>
            Open plan{(data.data?.history.length ?? 0) > 0 ? ` · ${data.data!.history.length} earlier` : ''} ›
          </Text>
        </Pressable>
      )}
    </Panel>
  );
}

/** Workouts sent to this user, with how many are done, and "Send workout". */
function WorkoutsPanel({ userId, active }: { userId: string; active: boolean }) {
  const list = useApi(() => workouts.of(userId));
  const all = list.data ?? [];
  const done = all.filter((w) => w.completed).length;
  return (
    <Panel title={`Workouts${list.data ? ` (${done}/${all.length} completed)` : ''}`} icon="barbell-outline"
      action={active ? { label: 'Send workout', onPress: () => router.push({ pathname: '/send-workout', params: { userId } }) } : undefined}>
      {list.error && <Notice text={list.error} />}
      {!list.data && !list.error ? <Loading /> : all.length === 0
        ? <Muted>No workouts sent yet.</Muted>
        : all.slice(0, 8).map((w) => <WorkoutRow key={w.id} p={p} w={w} />)}
      {all.length > 8 && <Muted>Showing the latest 8 of {all.length}.</Muted>}
    </Panel>
  );
}

function NotYet() {
  return <Muted>Not answered yet.</Muted>;
}

/** "Label ........ value" (wraps on narrow screens). Warn = shown in amber (e.g. injuries). */
function Line({ label, value, warn }: { label: string; value: ReactNode; warn?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
      <Text style={{ color: p.textSecondary, fontSize: 13.5, width: 140 }}>{label}</Text>
      <Text style={{ color: warn ? AMBER : p.text, fontSize: 14.5, fontWeight: '600', flex: 1, minWidth: 140 }}>{value}</Text>
    </View>
  );
}
