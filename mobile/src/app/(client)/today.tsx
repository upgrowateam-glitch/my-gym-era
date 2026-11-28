// User → Today: the plan for one day — the workout's exercises (sets, reps,
// rest) and the meals in time order. Tick each exercise and each meal as you
// go; the trainer sees how much was followed. Days of the past week and
// tomorrow can be opened too (ticking: the last 7 days only).

import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ApiError } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { dayLabel, exerciseText, todayApi, todayKey, workouts, type Workout } from '@/lib/workouts';
import { plansApi, scaled, servingsText, timeText, DEFAULT_MEAL_TIMES } from '@/lib/nutrition';
import { FoodPicture, mealsInTimeOrder } from '@/components/nutrition/NutritionUI';
import { Notice, Page } from '@/components/ui/UI';
import { Loading } from '@/components/staff/DashboardUI';
import { USER as p } from '@/theme/palettes';

const GREEN = '#4ADE80';

function shift(date: string, n: number) {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + n);
  return todayKey(d);
}

export default function Today() {
  const today = todayKey();
  const [date, setDate] = useState(today);
  const diet = useApi(() => plansApi.of('me').then((r) => r.current));
  return (
    // key: each date loads on its own (a fresh screen for each day).
    <DayScreen key={date} date={date} setDate={setDate} diet={diet} />
  );
}

function DayScreen({ date, setDate, diet }: {
  date: string; setDate: (d: string) => void;
  diet: ReturnType<typeof useApi<Awaited<ReturnType<typeof plansApi.of>>['current']>>;
}) {
  const today = todayKey();
  const day = useApi(() => todayApi.day('me', date));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const future = date > today;
  const canTick = !future && date >= shift(today, -6);

  const d = day.data?.date === date ? day.data : null;
  const plan = diet.data ?? null;
  const meals = plan ? mealsInTimeOrder(plan).filter((m) => plan.items.some((i) => i.meal === m.value)) : [];
  const doneMeals = new Set(d?.mealsDone.map((m) => m.meal) ?? []);
  const exercises = d?.workouts.flatMap((w) => w.items) ?? [];
  const exDone = exercises.filter((i) => i.completedAt).length;
  const total = exercises.length + meals.length;
  const done = exDone + meals.filter((m) => doneMeals.has(m.value)).length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  async function tickExercise(w: Workout, itemId: string, on: boolean) {
    setBusy(itemId); setError(null);
    try {
      const updated = await workouts.setDone(w.id, itemId, on);
      day.setData((cur) => (cur ? { ...cur, workouts: cur.workouts.map((x) => (x.id === w.id ? updated : x)) } : cur));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save. Please try again.');
    } finally { setBusy(null); }
  }

  async function tickMeal(meal: string, on: boolean) {
    setBusy(meal); setError(null);
    try {
      const r = await todayApi.tickMeal(date, meal, on);
      day.setData((cur) => (cur ? { ...cur, mealsDone: r.mealsDone } : cur));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save. Please try again.');
    } finally { setBusy(null); }
  }

  return (
    <Page p={p} kicker="FITZONE" title="Today" onRefresh={() => { void day.reload(); void diet.reload(); }} refreshing={day.loading && !!d}>
      {/* Day strip: last 6 days, today, tomorrow */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {Array.from({ length: 8 }, (_, i) => shift(today, i - 6)).map((x) => {
          const on = x === date;
          const dt = new Date(`${x}T00:00:00`);
          return (
            <Pressable key={x} onPress={() => setDate(x)} accessibilityRole="tab" accessibilityState={{ selected: on }}
              style={{ width: 54, alignItems: 'center', paddingVertical: 8, borderRadius: 16, borderWidth: 1,
                borderColor: on ? p.accent : p.border, backgroundColor: on ? p.accent : p.card }}>
              <Text style={{ color: on ? p.onAccent : p.textSecondary, fontSize: 11.5, fontWeight: '700' }}>
                {x === today ? 'Today' : dt.toLocaleDateString('en-GB', { weekday: 'short' })}
              </Text>
              <Text style={{ color: on ? p.onAccent : p.text, fontSize: 17, fontWeight: '800' }}>{dt.getDate()}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {(day.error || diet.error) && <Notice text={(day.error ?? diet.error)!} />}
      {error && <Notice text={error} />}
      {!d && !day.error && <Loading />}

      {d && (
        <>
          {/* Progress */}
          <View style={{ padding: 16, borderRadius: 18, borderWidth: 1, borderColor: p.border, backgroundColor: p.card, gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 58, height: 58, borderRadius: 29, borderWidth: 5, borderColor: pct === 100 ? GREEN : p.accent,
                alignItems: 'center', justifyContent: 'center', opacity: total ? 1 : 0.4 }}>
                <Text style={{ color: p.text, fontWeight: '800', fontSize: 15 }}>{pct}%</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: p.text, fontSize: 17, fontWeight: '800' }}>{dayLabel(date)}</Text>
                <Text style={{ color: p.textSecondary, fontSize: 13 }}>
                  {total === 0 ? 'Nothing planned for this day.'
                    : `${exDone}/${exercises.length} exercises · ${meals.filter((m) => doneMeals.has(m.value)).length}/${meals.length} meals`}
                </Text>
                {pct === 100 && total > 0 && <Text style={{ color: GREEN, fontWeight: '800', fontSize: 13 }}>All done — great job! 💪</Text>}
              </View>
            </View>
            {future && <Text style={{ color: p.textSecondary, fontSize: 12.5 }}>This is a future day — you can tick it on the day.</Text>}
            {!future && !canTick && <Text style={{ color: p.textSecondary, fontSize: 12.5 }}>Older than a week — shown for reference.</Text>}
          </View>

          {/* Workout */}
          <Text style={st.section}>WORKOUT</Text>
          {d.workouts.length === 0 ? (
            <View style={st.card}>
              <Text style={{ color: p.textSecondary }}>No workout this day — rest and recover. 😴</Text>
            </View>
          ) : d.workouts.map((w) => (
            <View key={w.id} style={[st.card, { gap: 4 }]}>
              <Pressable onPress={() => router.push(`/workout/${w.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Ionicons name="barbell-outline" size={20} color={p.accent} />
                <Text style={{ flex: 1, color: p.text, fontSize: 16.5, fontWeight: '800' }}>{w.title}</Text>
                <Text style={{ color: p.accent, fontSize: 13, fontWeight: '700' }}>Videos ›</Text>
              </Pressable>
              {w.note ? <Text style={{ color: p.textSecondary, fontSize: 13, marginBottom: 4 }}>{w.note}</Text> : null}
              {w.items.map((item) => {
                const ok = !!item.completedAt;
                return (
                  <Pressable key={item.id} disabled={!canTick || busy === item.id} onPress={() => tickExercise(w, item.id, !ok)}
                    accessibilityRole="checkbox" accessibilityState={{ checked: ok }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, opacity: busy === item.id ? 0.5 : 1 }}>
                    <Ionicons name={ok ? 'checkmark-circle' : 'ellipse-outline'} size={26} color={ok ? GREEN : canTick ? p.accent : p.textSecondary} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: p.text, fontSize: 15, fontWeight: '700', textDecorationLine: ok ? 'line-through' : 'none' }}>{item.title}</Text>
                      {exerciseText(item) ? <Text style={{ color: p.accent, fontSize: 13, fontWeight: '700' }}>{exerciseText(item)}</Text> : null}
                      {item.note ? <Text style={{ color: p.textSecondary, fontSize: 12.5 }}>{item.note}</Text> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}

          {/* Meals */}
          <Text style={st.section}>MEALS</Text>
          {!plan ? (
            <View style={st.card}><Text style={{ color: p.textSecondary }}>No diet plan yet. Your trainer will send it.</Text></View>
          ) : meals.map((m) => {
            const items = plan.items.filter((i) => i.meal === m.value);
            const kcal = Math.round(items.reduce((n, i) => n + i.calories * i.servings, 0));
            const ok = doneMeals.has(m.value);
            return (
              <Pressable key={m.value} disabled={!canTick || busy === m.value} onPress={() => tickMeal(m.value, !ok)}
                accessibilityRole="checkbox" accessibilityState={{ checked: ok }}
                style={[st.card, { gap: 8, borderColor: ok ? GREEN + '77' : p.border, opacity: busy === m.value ? 0.5 : 1 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Ionicons name={ok ? 'checkmark-circle' : 'ellipse-outline'} size={26} color={ok ? GREEN : canTick ? p.accent : p.textSecondary} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: p.text, fontSize: 16, fontWeight: '800' }}>{m.label}</Text>
                    <Text style={{ color: p.accent, fontSize: 12.5, fontWeight: '700' }}>
                      {timeText(plan.mealTimes[m.value] ?? DEFAULT_MEAL_TIMES[m.value])} · {kcal} kcal
                    </Text>
                  </View>
                  {ok && <Text style={{ color: GREEN, fontWeight: '800', fontSize: 12.5 }}>Eaten</Text>}
                </View>
                {items.map((i) => (
                  <View key={i.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 36 }}>
                    <FoodPicture p={p} name={i.name} imageUrl={i.imageUrl} size={30} />
                    <Text style={{ flex: 1, color: p.textSecondary, fontSize: 13.5 }} numberOfLines={1}>
                      {servingsText(i.servings)} × {i.name} ({i.servingSize})
                    </Text>
                    <Text style={{ color: p.textSecondary, fontSize: 12.5 }}>{scaled(i, i.servings).calories}</Text>
                  </View>
                ))}
              </Pressable>
            );
          })}
        </>
      )}
    </Page>
  );
}

const st = {
  section: { color: p.textSecondary, fontSize: 12.5, fontWeight: '800' as const, letterSpacing: 1.2, marginTop: 4 },
  card: { padding: 14, borderRadius: 18, borderWidth: 1, borderColor: p.border, backgroundColor: p.card },
};
