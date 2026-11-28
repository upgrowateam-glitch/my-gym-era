// Send a nutrition plan (Trainer → their assigned users; Super Admin / Admins
// with "View all users" → any user). /nutrition-plan?userId=<user>
// If the user already has a plan, it starts as a copy of it (edit and send =
// the new current plan; the old one stays in their history).
// Foods per meal with servings; totals update as you go.

import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import type { User } from '@/lib/types';
import { getFitnessOf, labelOf, DIET_TYPES } from '@/lib/fitness';
import { MEALS, foodsApi, plansApi, scaled, servingsText, totalOf, type Food, type Meal } from '@/lib/nutrition';
import { RequireRole } from '@/components/RequireRole';
import { BackPage } from '@/components/staff/BackPage';
import { FoodPicker } from '@/components/nutrition/FoodPicker';
import { DietDot, MacroChips, TotalsCard } from '@/components/nutrition/NutritionUI';
import { Avatar, Button, Card, Empty, Field, Notice } from '@/components/ui/UI';
import { Loading } from '@/components/staff/DashboardUI';
import { SUPER as p } from '@/theme/palettes';

export default function NutritionPlanRoute() {
  return (
    <RequireRole roles={['super_admin', 'admin', 'trainer']}>
      <NutritionPlanPage />
    </RequireRole>
  );
}

function NutritionPlanPage() {
  const params = useLocalSearchParams<{ userId?: string }>();
  const { user: me } = useAuth();
  const data = useApi(async () => {
    const [users, foods] = await Promise.all([
      me?.role === 'trainer'
        ? api.get<{ users: User[] }>('/api/trainer/users').then((r) => r.users)
        : api.get<{ users: User[] }>('/api/users', { role: 'client', archived: 'false' }).then((r) => r.users),
      foodsApi.foods(),
    ]);
    return { users: users.filter((u) => !u.isArchived), foods };
  });
  const [userId, setUserId] = useState<string | null>(params.userId ?? null);
  const users = data.data?.users ?? [];
  const chosen = users.find((u) => u.uid === userId) ?? (users.length === 1 ? users[0] : null);

  return (
    <BackPage p={p} kicker="NUTRITION" title="Nutrition plan" maxWidth={900}>
      {data.error && <Notice text={data.error} />}
      {!data.data && !data.error && <Loading />}
      {data.data && users.length === 0 && <Empty p={p} icon="people-outline" text="You have no users to send a plan to yet." />}
      {data.data && users.length > 0 && !chosen && <UserPicker users={users} onPick={setUserId} />}
      {/* key: start fresh (and load their current plan) for each user */}
      {data.data && chosen && (
        <Builder key={chosen.uid} user={chosen} foods={data.data.foods} onChangeUser={users.length > 1 ? () => setUserId(null) : undefined} />
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

interface Line { key: string; food: Food; meal: Meal; servings: number; note: string }
let nextKey = 1;
const MAIN_MEALS: Meal[] = ['breakfast', 'mid_morning', 'lunch', 'evening_snack', 'dinner'];

function Builder({ user, foods, onChangeUser }: { user: User; foods: Food[]; onChangeUser?: () => void }) {
  // Their current plan (to start from) and their food habits from the fitness profile.
  const info = useApi(async () => {
    const [plans, fitness] = await Promise.all([plansApi.of(user.uid), getFitnessOf(user.uid).then((r) => r.fitness).catch(() => null)]);
    return { current: plans.current, fitness };
  });
  return !info.data ? (info.error ? <Notice text={info.error} /> : <Loading />) : (
    <BuilderForm user={user} foods={foods} current={info.data.current} fitness={info.data.fitness} onChangeUser={onChangeUser} />
  );
}

function BuilderForm({ user, foods, current, fitness, onChangeUser }: {
  user: User; foods: Food[];
  current: Awaited<ReturnType<typeof plansApi.of>>['current'];
  fitness: Awaited<ReturnType<typeof getFitnessOf>>['fitness'] | null;
  onChangeUser?: () => void;
}) {
  const byId = new Map(foods.map((f) => [f.id, f]));
  const [lines, setLines] = useState<Line[]>(() => (current?.items ?? [])
    .filter((i) => i.foodId && byId.has(i.foodId))
    .map((i) => ({ key: `k${nextKey++}`, food: byId.get(i.foodId!)!, meal: i.meal, servings: i.servings, note: i.note })));
  const skipped = (current?.items.length ?? 0) - lines.length;
  const [extraMeals, setExtraMeals] = useState<Meal[]>(() => [...new Set((current?.items ?? []).map((i) => i.meal))].filter((m) => !MAIN_MEALS.includes(m)));
  const [title, setTitle] = useState(current?.title ?? 'Nutrition plan');
  const [note, setNote] = useState(current?.note ?? '');
  const [picking, setPicking] = useState<Meal | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meals = MEALS.filter((m) => MAIN_MEALS.includes(m.value) || extraMeals.includes(m.value));
  const totals = totalOf(lines.map((l) => ({ ...l.food, servings: l.servings })));
  const update = (key: string, patch: Partial<Line>) => setLines((cur) => cur.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const remove = (key: string) => setLines((cur) => cur.filter((l) => l.key !== key));

  async function send() {
    setError(null);
    if (lines.length === 0) return setError('Add at least one food.');
    if (!title.trim()) return setError('Please enter a title.');
    setSending(true);
    try {
      const plan = await plansApi.send({
        userId: user.uid, title: title.trim(), note: note.trim(),
        items: lines.map((l) => ({ foodId: l.food.id, meal: l.meal, servings: l.servings, note: l.note.trim() })),
      });
      router.replace(`/nutrition/${plan.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not send. Please try again.');
    } finally {
      setSending(false);
    }
  }

  const habits = fitness?.food;
  return (
    <View style={{ gap: 16 }}>
      {/* Who + their food habits */}
      <Card p={p} style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Avatar p={p} name={user.displayName || user.email} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: p.text, fontSize: 15.5, fontWeight: '800' }}>{user.displayName || user.email}</Text>
            <Text style={{ color: p.textSecondary, fontSize: 12.5 }}>
              {current ? `Current plan: "${current.title}" (${current.totals.calories} kcal) — edit it below and send` : 'No plan yet'}
            </Text>
          </View>
          {onChangeUser && <Button p={p} small kind="outline" label="Change" onPress={onChangeUser} />}
        </View>
        {habits ? (
          <View style={{ gap: 4, padding: 10, borderRadius: 12, backgroundColor: p.elevated }}>
            <Text style={{ color: p.textSecondary, fontSize: 12, fontWeight: '800', letterSpacing: 1 }}>FROM THEIR FITNESS PROFILE</Text>
            <Text style={{ color: p.text, fontSize: 13.5 }}>
              {labelOf(DIET_TYPES, habits.dietType)} · {habits.mealsPerDay} meals a day · {habits.waterLitres} L water
            </Text>
            {habits.avoidFoods ? <Text style={{ color: '#FBBF24', fontSize: 13.5, fontWeight: '700' }}>Avoid: {habits.avoidFoods}</Text> : null}
            {fitness?.goals ? <Text style={{ color: p.textSecondary, fontSize: 13 }}>Goal: {fitness.goals.mainGoal.replace(/_/g, ' ')}</Text> : null}
          </View>
        ) : null}
        {skipped > 0 && <Notice kind="info" text={`${skipped} food${skipped === 1 ? ' was' : 's were'} removed from the food list and left out.`} />}
      </Card>

      <TotalsCard p={p} totals={totals} title="Daily total" />

      {meals.map((meal) => {
        const mine = lines.filter((l) => l.meal === meal.value);
        const kcal = mine.reduce((n, l) => n + l.food.calories * l.servings, 0);
        return (
          <Card key={meal.value} p={p} style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name={meal.icon} size={20} color={p.accent} />
              <Text style={{ flex: 1, color: p.text, fontSize: 16.5, fontWeight: '800' }}>{meal.label}</Text>
              {mine.length > 0 && <Text style={{ color: p.textSecondary, fontSize: 13 }}>{Math.round(kcal)} kcal</Text>}
              <Button p={p} small label="Add food" icon="add" onPress={() => setPicking(meal.value)} />
            </View>
            {mine.length === 0 && <Text style={{ color: p.textSecondary, fontSize: 13 }}>Nothing yet.</Text>}
            {mine.map((l) => {
              const m = scaled(l.food, l.servings);
              return (
                <View key={l.key} style={{ gap: 8, padding: 10, borderRadius: 14, backgroundColor: p.elevated }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <DietDot diet={l.food.dietType} />
                    <Text style={{ flex: 1, color: p.text, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>{l.food.name}</Text>
                    <Text style={{ color: p.text, fontWeight: '800' }}>{m.calories} kcal</Text>
                    <Pressable onPress={() => remove(l.key)} hitSlop={8} accessibilityLabel={`Remove ${l.food.name}`}>
                      <Ionicons name="close-circle" size={22} color="#EF5350" />
                    </Pressable>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <Stepper value={l.servings} onChange={(v) => update(l.key, { servings: v })} />
                    <Text style={{ color: p.textSecondary, fontSize: 12.5, flex: 1, minWidth: 120 }}>× {l.food.servingSize}</Text>
                  </View>
                  <MacroChips m={m} small />
                  <TextInput value={l.note} onChangeText={(t) => update(l.key, { note: t })} maxLength={200} selectionColor={p.accent}
                    placeholder="Note (optional), e.g. without sugar" placeholderTextColor={p.textSecondary + '99'}
                    style={{ color: p.text, fontSize: 13.5, borderWidth: 1, borderColor: p.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, outlineStyle: 'none' } as never} />
                </View>
              );
            })}
          </Card>
        );
      })}

      {MEALS.some((m) => !meals.includes(m)) && (
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {MEALS.filter((m) => !meals.includes(m)).map((m) => (
            <Button key={m.value} p={p} small kind="outline" label={`+ ${m.label}`} onPress={() => setExtraMeals((cur) => [...cur, m.value])} />
          ))}
        </View>
      )}

      <Card p={p} style={{ gap: 12 }}>
        <Field p={p} label="Plan title" icon="text-outline" value={title} onChangeText={setTitle} placeholder="e.g. Fat loss – week 1" maxLength={120} />
        <Field p={p} label="Message (optional)" icon="chatbubble-ellipses-outline" value={note} onChangeText={setNote} multiline maxLength={1000}
          placeholder="e.g. Drink 3 litres of water. No sugar in tea."
          style={{ flex: 1, color: p.text, fontSize: 15.5, paddingVertical: 12, minHeight: 70, textAlignVertical: 'top', outlineStyle: 'none' } as never} />
      </Card>

      {error && <Notice text={error} />}
      <Button p={p} label={`Send to ${user.displayName?.split(' ')[0] || 'user'}`} icon="paper-plane-outline" loading={sending} onPress={send} />
      {current && <Text style={{ color: p.textSecondary, fontSize: 12.5, textAlign: 'center' }}>This becomes their current plan. The old one stays in their history.</Text>}

      <FoodPicker p={p} visible={!!picking} foods={foods}
        title={`Add to ${MEALS.find((m) => m.value === picking)?.label ?? ''}`}
        addedIds={lines.filter((l) => l.meal === picking).map((l) => l.food.id)}
        onAdd={(f) => picking && setLines((cur) => [...cur, { key: `k${nextKey++}`, food: f, meal: picking, servings: 1, note: '' }])}
        onClose={() => setPicking(null)} />
    </View>
  );
}

function Stepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const set = (v: number) => onChange(Math.min(20, Math.max(0.25, Math.round(v * 4) / 4)));
  const btn = (icon: 'remove' | 'add', by: number, disabled: boolean) => (
    <Pressable onPress={() => set(value + by)} disabled={disabled} accessibilityLabel={icon === 'add' ? 'More' : 'Less'} hitSlop={6}
      style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: p.card, opacity: disabled ? 0.4 : 1 }}>
      <Ionicons name={icon} size={18} color={p.accent} />
    </Pressable>
  );
  // Small steps below 1 serving (¼), half servings above.
  const step = value <= 1 ? 0.25 : 0.5;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {btn('remove', -step, value <= 0.25)}
      <Text style={{ color: p.text, fontSize: 16, fontWeight: '800', minWidth: 44, textAlign: 'center' }}>{servingsText(value)}</Text>
      {btn('add', step, value >= 20)}
      <Text style={{ color: p.textSecondary, fontSize: 12.5 }}>{value === 1 ? 'serving' : 'servings'}</Text>
    </View>
  );
}
