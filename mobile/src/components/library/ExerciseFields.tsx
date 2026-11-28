// Sets, reps (or a time, for moves like a plank) and rest for one exercise,
// with − / + buttons. Used in "Send a workout" and the weekly plan builder.

import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { secondsText, type ExerciseDetails } from '@/lib/workouts';
import type { Palette } from '@/components/ui/UI';

export const DEFAULT_DETAILS: ExerciseDetails = { sets: 3, reps: 12, durationSeconds: null, restSeconds: 60 };
const REST_CHOICES = [0, 30, 45, 60, 90, 120, 180];

export function ExerciseFields({ p, value, onChange }: { p: Palette; value: ExerciseDetails; onChange: (v: ExerciseDetails) => void }) {
  const timed = value.durationSeconds !== null;
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <Stepper p={p} label="Sets" value={value.sets ?? 1} min={1} max={20} step={1} onChange={(sets) => onChange({ ...value, sets })} />
        <View style={{ flexDirection: 'row', borderRadius: 999, borderWidth: 1, borderColor: p.border, overflow: 'hidden' }}>
          {(['reps', 'time'] as const).map((m) => {
            const on = (m === 'time') === timed;
            return (
              <Pressable key={m} accessibilityRole="radio" accessibilityState={{ checked: on }}
                onPress={() => onChange(m === 'time'
                  ? { ...value, reps: null, durationSeconds: value.durationSeconds ?? 30 }
                  : { ...value, durationSeconds: null, reps: value.reps ?? 12 })}
                style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: on ? p.accent : 'transparent' }}>
                <Text style={{ color: on ? p.onAccent : p.textSecondary, fontWeight: '700', fontSize: 12.5 }}>{m === 'reps' ? 'Reps' : 'Time'}</Text>
              </Pressable>
            );
          })}
        </View>
        {timed ? (
          <Stepper p={p} label="Seconds" value={value.durationSeconds ?? 30} min={5} max={600} step={5}
            format={secondsText} onChange={(durationSeconds) => onChange({ ...value, durationSeconds })} />
        ) : (
          <Stepper p={p} label="Reps" value={value.reps ?? 12} min={1} max={200} step={1} onChange={(reps) => onChange({ ...value, reps })} />
        )}
      </View>
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <Text style={{ color: p.textSecondary, fontSize: 12.5, marginRight: 2 }}>Rest</Text>
        {REST_CHOICES.map((r) => {
          const on = (value.restSeconds ?? 0) === r;
          return (
            <Pressable key={r} onPress={() => onChange({ ...value, restSeconds: r })} accessibilityRole="radio" accessibilityState={{ checked: on }}
              style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1,
                borderColor: on ? p.accent : p.border, backgroundColor: on ? p.accent + '22' : 'transparent' }}>
              <Text style={{ color: on ? p.accent : p.text, fontSize: 12.5, fontWeight: '700' }}>{r === 0 ? 'None' : secondsText(r)}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Stepper({ p, label, value, min, max, step, onChange, format = String }: {
  p: Palette; label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format?: (v: number) => string;
}) {
  const btn = (icon: 'remove' | 'add', by: number, disabled: boolean) => (
    <Pressable onPress={() => onChange(Math.min(max, Math.max(min, value + by)))} disabled={disabled} hitSlop={6}
      accessibilityLabel={`${icon === 'add' ? 'More' : 'Fewer'} ${label.toLowerCase()}`}
      style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: p.card, opacity: disabled ? 0.4 : 1 }}>
      <Ionicons name={icon} size={16} color={p.accent} />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {btn('remove', -step, value <= min)}
      <View style={{ alignItems: 'center', minWidth: 46 }}>
        <Text style={{ color: p.text, fontSize: 15.5, fontWeight: '800' }}>{format(value)}</Text>
        <Text style={{ color: p.textSecondary, fontSize: 11 }}>{label}</Text>
      </View>
      {btn('add', step, value >= max)}
    </View>
  );
}
