// FitZone form controls for the fitness profile (gold on near-black).
// Built from plain views so they look and work the same on Android, iPhone and web
// (no native date/time pickers needed).

import { useRef, useState, type ReactNode, type Ref } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputInstance, type TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Option } from '@/lib/fitness';
import { fitzone as c, font } from '@/theme/colors';

const MINT = (a: number) => `rgba(201,166,107,${a})`;

export function Label({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={s.label}>{children}</Text>
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  );
}

/** Text / number input with an optional unit on the right. */
export function FZInput({ suffix, icon, inputRef, ...props }: TextInputProps & {
  suffix?: string; icon?: keyof typeof Ionicons.glyphMap; inputRef?: Ref<TextInputInstance>;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[s.field, focused && { borderColor: c.mint }, props.multiline && { alignItems: 'flex-start', paddingVertical: 6 }]}>
      {icon && <Ionicons name={icon} size={19} color={c.mint} style={{ marginRight: 10, marginTop: props.multiline ? 10 : 0 }} />}
      <TextInput
        placeholderTextColor={c.muted}
        selectionColor={c.mint}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...props}
        ref={inputRef}
        style={[s.input, props.multiline && { minHeight: 70, textAlignVertical: 'top' }, props.editable === false && { color: c.textSecondary }]}
      />
      {suffix ? <Text style={s.suffix}>{suffix}</Text> : null}
    </View>
  );
}

/** Big tappable cards (single choice). */
export function OptionCards<T extends string>({ options, value, onChange, columns = 1 }: {
  options: Option<T>[]; value: T | null; onChange: (v: T) => void; columns?: 1 | 2;
}) {
  return (
    <View style={[s.cards, columns === 2 && { flexDirection: 'row', flexWrap: 'wrap' }]}>
      {options.map((o) => (
        <ChoiceCard key={o.value} option={o} selected={o.value === value} onPress={() => onChange(o.value)} half={columns === 2} />
      ))}
    </View>
  );
}

/** Big tappable cards (several choices). */
export function MultiOptionCards<T extends string>({ options, values, onChange, max }: {
  options: Option<T>[]; values: T[]; onChange: (v: T[]) => void; max?: number;
}) {
  return (
    <View style={s.cards}>
      {options.map((o) => {
        const sel = values.includes(o.value);
        return (
          <ChoiceCard key={o.value} option={o} selected={sel} multi
            onPress={() => onChange(sel ? values.filter((x) => x !== o.value) : max && values.length >= max ? values : [...values, o.value])} />
        );
      })}
    </View>
  );
}

function ChoiceCard<T extends string>({ option, selected, onPress, multi, half }: {
  option: Option<T>; selected: boolean; onPress: () => void; multi?: boolean; half?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityState={{ checked: selected }}
      style={({ pressed }) => [s.card, half && s.cardHalf, selected && s.cardOn, pressed && { opacity: 0.85 }]}
    >
      {option.icon && (
        <View style={[s.cardIcon, selected && { backgroundColor: MINT(0.18) }]}>
          <Ionicons name={option.icon} size={20} color={selected ? c.mint : c.textSecondary} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={[s.cardTitle, selected && { color: c.text }]}>{option.label}</Text>
        {option.detail ? <Text style={s.cardDetail}>{option.detail}</Text> : null}
      </View>
      <Ionicons
        name={multi ? (selected ? 'checkbox' : 'square-outline') : (selected ? 'radio-button-on' : 'radio-button-off')}
        size={20}
        color={selected ? c.mint : c.muted}
      />
    </Pressable>
  );
}

/** Compact pill choices (single choice). */
export function Pills<T extends string | number>({ options, value, onChange }: {
  options: { value: T; label: string }[]; value: T | null; onChange: (v: T) => void;
}) {
  return (
    <View style={s.pills}>
      {options.map((o) => {
        const sel = o.value === value;
        return (
          <Pressable key={String(o.value)} onPress={() => onChange(o.value)} accessibilityRole="radio" accessibilityState={{ checked: sel }}
            style={({ pressed }) => [s.pill, sel && s.pillOn, pressed && { opacity: 0.85 }]}>
            <Text style={[s.pillText, sel && { color: c.onMint }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** − value + control. */
export function Stepper({ value, onChange, min, max, step = 1, format = String, unit }: {
  value: number; onChange: (v: number) => void; min: number; max: number; step?: number; format?: (v: number) => string; unit?: string;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v * 100) / 100));
  return (
    <View style={s.stepper}>
      <RoundBtn icon="remove" disabled={value <= min} onPress={() => onChange(clamp(value - step))} label="Less" />
      <View style={{ alignItems: 'center', minWidth: 90 }}>
        <Text style={s.stepValue}>{format(value)}</Text>
        {unit ? <Text style={s.hint}>{unit}</Text> : null}
      </View>
      <RoundBtn icon="add" disabled={value >= max} onPress={() => onChange(clamp(value + step))} label="More" />
    </View>
  );
}

function RoundBtn({ icon, onPress, disabled, label }: { icon: 'add' | 'remove' | 'chevron-up' | 'chevron-down'; onPress: () => void; disabled?: boolean; label: string }) {
  return (
    <Pressable onPress={disabled ? undefined : onPress} accessibilityLabel={label} hitSlop={6}
      style={({ pressed }) => [s.round, disabled && { opacity: 0.35 }, pressed && { backgroundColor: MINT(0.2) }]}>
      <Ionicons name={icon} size={20} color={c.mint} />
    </Pressable>
  );
}

const pad = (n: number) => String(n).padStart(2, '0');

/** HH:MM picker with up/down buttons (hours by 1, minutes by 15). */
export function TimePicker({ value, onChange, label, icon }: {
  value: string; onChange: (v: string) => void; label: string; icon: keyof typeof Ionicons.glyphMap;
}) {
  const h = Number(value.slice(0, 2));
  const m = Number(value.slice(3, 5));
  const set = (hh: number, mm: number) => onChange(`${pad((hh + 24) % 24)}:${pad((mm + 60) % 60)}`);
  const ampm = `${((h + 11) % 12) + 1}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`;
  return (
    <View style={s.timeBox}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name={icon} size={18} color={c.mint} />
        <Text style={s.label}>{label}</Text>
      </View>
      <View style={s.timeRow}>
        <View style={s.timeCol}>
          <RoundBtn icon="chevron-up" onPress={() => set(h + 1, m)} label={`${label} hour later`} />
          <Text style={s.timeDigits}>{pad(h)}</Text>
          <RoundBtn icon="chevron-down" onPress={() => set(h - 1, m)} label={`${label} hour earlier`} />
        </View>
        <Text style={s.timeDigits}>:</Text>
        <View style={s.timeCol}>
          <RoundBtn icon="chevron-up" onPress={() => (m === 45 ? set(h + 1, 0) : set(h, m + 15 - (m % 15)))} label={`${label} minutes later`} />
          <Text style={s.timeDigits}>{pad(m)}</Text>
          <RoundBtn icon="chevron-down" onPress={() => (m === 0 ? set(h - 1, 45) : set(h, m % 15 ? m - (m % 15) : m - 15))} label={`${label} minutes earlier`} />
        </View>
      </View>
      <Text style={[s.hint, { textAlign: 'center' }]}>{ampm}</Text>
    </View>
  );
}

/** Date of birth as three boxes: DD / MM / YYYY. */
export function DateInput({ day, month, year, onChange }: {
  day: string; month: string; year: string; onChange: (p: { day: string; month: string; year: string }) => void;
}) {
  const monthRef = useRef<TextInputInstance>(null);
  const yearRef = useRef<TextInputInstance>(null);
  const digits = (t: string, n: number) => t.replace(/\D/g, '').slice(0, n);
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <View style={{ flex: 1 }}>
        <FZInput placeholder="DD" keyboardType="number-pad" maxLength={2} value={day} accessibilityLabel="Day of birth"
          onChangeText={(t) => { const d = digits(t, 2); onChange({ day: d, month, year }); if (d.length === 2) monthRef.current?.focus(); }} />
      </View>
      <View style={{ flex: 1 }}>
        <FZInput inputRef={monthRef} placeholder="MM" keyboardType="number-pad" maxLength={2} value={month} accessibilityLabel="Month of birth"
          onChangeText={(t) => { const m = digits(t, 2); onChange({ day, month: m, year }); if (m.length === 2) yearRef.current?.focus(); }} />
      </View>
      <View style={{ flex: 1.5 }}>
        <FZInput inputRef={yearRef} placeholder="YYYY" keyboardType="number-pad" maxLength={4} value={year} accessibilityLabel="Year of birth"
          onChangeText={(t) => onChange({ day, month, year: digits(t, 4) })} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  label: { color: c.text, fontFamily: font.semibold, fontSize: 15 },
  hint: { color: c.muted, fontFamily: font.regular, fontSize: 12.5 },
  field: {
    flexDirection: 'row', alignItems: 'center', minHeight: 54, borderRadius: 16, borderWidth: 1,
    borderColor: c.border, backgroundColor: 'rgba(24,29,33,0.9)', paddingHorizontal: 14,
  },
  input: { flex: 1, color: c.text, fontFamily: font.regular, fontSize: 16, paddingVertical: 12, outlineStyle: 'none' } as never,
  suffix: { color: c.textSecondary, fontFamily: font.medium, fontSize: 14, marginLeft: 8 },
  cards: { gap: 10 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16,
    borderWidth: 1, borderColor: c.border, backgroundColor: 'rgba(17,21,24,0.9)',
  },
  cardHalf: { flexBasis: '47%', flexGrow: 1 },
  cardOn: { borderColor: c.mint, backgroundColor: MINT(0.08) },
  cardIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)' },
  cardTitle: { color: '#DCE1E5', fontFamily: font.semibold, fontSize: 15 },
  cardDetail: { color: c.muted, fontFamily: font.regular, fontSize: 12.5, marginTop: 2 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, borderWidth: 1,
    borderColor: c.border, backgroundColor: 'rgba(17,21,24,0.9)',
  },
  pillOn: { backgroundColor: c.mint, borderColor: c.mint },
  pillText: { color: '#DCE1E5', fontFamily: font.semibold, fontSize: 14 },
  stepper: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10, borderRadius: 16,
    borderWidth: 1, borderColor: c.border, backgroundColor: 'rgba(17,21,24,0.9)',
  },
  stepValue: { color: c.text, fontFamily: font.bold, fontSize: 24 },
  round: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: MINT(0.4), backgroundColor: MINT(0.06),
  },
  timeBox: {
    flex: 1, gap: 10, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: c.border, backgroundColor: 'rgba(17,21,24,0.9)',
  },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  timeCol: { alignItems: 'center', gap: 6 },
  timeDigits: { color: c.text, fontFamily: font.bold, fontSize: 28, minWidth: 40, textAlign: 'center' },
});
