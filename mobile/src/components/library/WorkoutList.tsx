// A list of workouts (title, day, progress). Tap one to open it.
// Used on the User's Workouts tab, the User's Home and staff views of a user.

import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { dayLabel, todayKey, type Workout } from '@/lib/workouts';
import type { Palette } from '@/components/ui/UI';

export function WorkoutRow({ p, w }: { p: Palette; w: Workout }) {
  const pct = w.items.length ? (w.doneCount / w.items.length) * 100 : 0;
  const today = w.date === todayKey();
  const late = !w.completed && w.date < todayKey();
  return (
    <Pressable onPress={() => router.push(`/workout/${w.id}`)} accessibilityRole="button"
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1,
        borderColor: today && !w.completed ? p.accent + '99' : p.border, backgroundColor: pressed ? p.elevated : p.card,
      })}>
      <View style={{
        width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
        backgroundColor: w.completed ? '#4ADE8022' : p.accent + '22',
      }}>
        <Ionicons name={w.completed ? 'checkmark' : 'barbell-outline'} size={22} color={w.completed ? '#4ADE80' : p.accent} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Text style={{ color: p.text, fontSize: 15.5, fontWeight: '800' }} numberOfLines={1}>{w.title}</Text>
        <Text style={{ color: late ? '#FBBF24' : p.textSecondary, fontSize: 12.5 }} numberOfLines={1}>
          {dayLabel(w.date)} · {w.items.length} {w.items.length === 1 ? 'video' : 'videos'}
          {w.completed ? ' · Completed' : ` · ${w.doneCount}/${w.items.length} done`}{late ? ' · Missed' : ''}
        </Text>
        <View style={{ height: 5, borderRadius: 3, backgroundColor: p.elevated, overflow: 'hidden' }}>
          <View style={{ height: 5, width: `${pct}%`, backgroundColor: w.completed ? '#4ADE80' : p.accent }} />
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={p.textSecondary} />
    </Pressable>
  );
}

/** Today / Upcoming / Earlier sections. */
export function WorkoutSections({ p, list, emptyText }: { p: Palette; list: Workout[]; emptyText: string }) {
  const today = todayKey();
  const groups: [string, Workout[]][] = [
    ['Today', list.filter((w) => w.date === today)],
    ['Upcoming', list.filter((w) => w.date > today).sort((a, b) => a.date.localeCompare(b.date))],
    ['Earlier', list.filter((w) => w.date < today)],
  ];
  if (list.length === 0) {
    return (
      <View style={{ alignItems: 'center', gap: 10, paddingVertical: 30 }}>
        <Ionicons name="barbell-outline" size={32} color={p.textSecondary} />
        <Text style={{ color: p.textSecondary, textAlign: 'center' }}>{emptyText}</Text>
      </View>
    );
  }
  return (
    <View style={{ gap: 18 }}>
      {groups.filter(([, g]) => g.length > 0).map(([label, g]) => (
        <View key={label} style={{ gap: 10 }}>
          <Text style={{ color: p.textSecondary, fontSize: 12.5, fontWeight: '800', letterSpacing: 1.2 }}>{label.toUpperCase()}</Text>
          {g.map((w) => <WorkoutRow key={w.id} p={p} w={w} />)}
        </View>
      ))}
    </View>
  );
}
