// Staff view of a user's plans (on the user's page):
//  - WeeklyPlanPanel: the current weekly plan (dates, which days are workouts)
//    with "Create / Edit weekly plan"
//  - FollowUpPanel: the last 7 days — exercises and meals done vs planned

import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { useApi } from '@/lib/useApi';
import { WEEKDAYS_SHORT, dayLabel, todayApi, weeklyApi } from '@/lib/workouts';
import { Notice, type Palette } from '@/components/ui/UI';
import { Loading, Muted, Panel } from '@/components/staff/DashboardUI';

const GREEN = '#4ADE80';
const AMBER = '#FBBF24';

export function WeeklyPlanPanel({ p, userId, active }: { p: Palette; userId: string; active: boolean }) {
  const data = useApi(() => weeklyApi.of(userId));
  const plan = data.data?.current ?? null;
  const ended = plan ? plan.endDate < new Date().toISOString().slice(0, 10) : false;
  return (
    <Panel title="Weekly plan" icon="calendar-outline"
      action={active ? { label: plan ? 'Edit plan' : 'Create plan', onPress: () => router.push({ pathname: '/weekly-plan', params: { userId } }) } : undefined}>
      {data.error && <Notice text={data.error} />}
      {!data.data && !data.error ? <Loading /> : !plan ? <Muted>No weekly plan yet.</Muted> : (
        <View style={{ gap: 10 }}>
          <View>
            <Text style={{ color: p.text, fontSize: 15.5, fontWeight: '800' }}>{plan.title}</Text>
            <Text style={{ color: ended ? AMBER : p.textSecondary, fontSize: 13 }}>
              {dayLabel(plan.startDate)} → {dayLabel(plan.endDate)} · {plan.weeks} {plan.weeks === 1 ? 'week' : 'weeks'}{ended ? ' · ended — time for a new plan' : ''}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {plan.days.map((d) => (
              <View key={d.weekday} style={{ minWidth: 70, padding: 8, borderRadius: 12, backgroundColor: d.rest ? p.elevated : p.accent + '1F', gap: 2 }}>
                <Text style={{ color: d.rest ? p.textSecondary : p.accent, fontWeight: '800', fontSize: 12.5 }}>{WEEKDAYS_SHORT[d.weekday]}</Text>
                <Text style={{ color: d.rest ? p.textSecondary : p.text, fontSize: 12 }} numberOfLines={2}>
                  {d.rest ? 'Rest' : `${d.title} · ${d.items.length} ex.`}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </Panel>
  );
}

export function FollowUpPanel({ p, userId }: { p: Palette; userId: string }) {
  const data = useApi(() => todayApi.summary(userId, 7));
  const days = data.data ?? [];
  const ex = days.reduce((n, d) => n + d.exercisesDone, 0);
  const exPlanned = days.reduce((n, d) => n + d.exercisesPlanned, 0);
  const meals = days.reduce((n, d) => n + d.mealsDone, 0);
  const mealsPlanned = days.reduce((n, d) => n + d.mealsPlanned, 0);
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null);
  const bar = (share: number | null, color: string) => (
    <View style={{ width: 14, height: 54, borderRadius: 7, backgroundColor: p.elevated, justifyContent: 'flex-end', overflow: 'hidden' }}>
      {share !== null && <View style={{ height: `${Math.max(4, share)}%`, backgroundColor: color, borderRadius: 7 }} />}
    </View>
  );
  return (
    <Panel title="Following the plan (last 7 days)" icon="pulse-outline">
      {data.error && <Notice text={data.error} />}
      {!data.data && !data.error ? <Loading /> : (
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
            <Stat p={p} label="Exercises done" value={exPlanned ? `${ex}/${exPlanned}` : '—'} pct={pct(ex, exPlanned)} color={p.accent} />
            <Stat p={p} label="Meals eaten" value={mealsPlanned ? `${meals}/${mealsPlanned}` : '—'} pct={pct(meals, mealsPlanned)} color={GREEN} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 4 }}>
            {days.map((d) => (
              <View key={d.date} style={{ alignItems: 'center', gap: 4, flex: 1 }}>
                <View style={{ flexDirection: 'row', gap: 3 }}>
                  {bar(d.exercisesPlanned ? (d.exercisesDone / d.exercisesPlanned) * 100 : null, p.accent)}
                  {bar(d.mealsPlanned ? (d.mealsDone / d.mealsPlanned) * 100 : null, GREEN)}
                </View>
                <Text style={{ color: p.textSecondary, fontSize: 11 }}>
                  {new Date(`${d.date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short' })}
                </Text>
              </View>
            ))}
          </View>
          <Muted>Gold = exercises ticked · green = meals ticked. Empty = nothing planned that day.</Muted>
        </View>
      )}
    </Panel>
  );
}

function Stat({ p, label, value, pct, color }: { p: Palette; label: string; value: string; pct: number | null; color: string }) {
  return (
    <View style={{ minWidth: 130 }}>
      <Text style={{ color: p.textSecondary, fontSize: 12.5 }}>{label}</Text>
      <Text style={{ color: p.text, fontSize: 20, fontWeight: '800' }}>{value}{pct !== null ? <Text style={{ color, fontSize: 14 }}>  {pct}%</Text> : null}</Text>
    </View>
  );
}
