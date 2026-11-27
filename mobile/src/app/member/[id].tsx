// A User's fitness profile, read-only, for staff (FitZone gold).
// Super Admin and Admins (with "View all users") can open any User; a Trainer
// only the Users assigned to them. The server enforces this — anyone else gets
// "not allowed". Real answers only; nothing is filled in for missing steps.

import { useState, type ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View, type LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { homeRouteFor, useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import type { User } from '@/lib/types';
import {
  ACTIVITY_LEVELS, BMI_INFO, DIET_TYPES, EATING_OUT, EXPERIENCE, GENDERS, GOALS, SLEEP_QUALITY, SMOKING, WORK_TYPES,
  WORKOUT_TIMES, getFitnessOf, labelOf, pastTrainingText, type FitnessProfile, type Section,
} from '@/lib/fitness';
import { RequireRole } from '@/components/RequireRole';
import { Avatar, Badge, Notice } from '@/components/ui/UI';
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
          {d && <Profile account={d.account} f={d.fitness} twoCols={twoCols} />}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Profile({ account: u, f, twoCols }: { account: User; f: FitnessProfile; twoCols: boolean }) {
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
