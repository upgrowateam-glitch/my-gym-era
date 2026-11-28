// One filter panel for the whole app (FitZone gold).
// On a screen: a "Filters" button (with how many are on) and the active
// filters as small chips you can remove. Tapping "Filters" opens a panel with
// sections; in each section you can tick several choices (a "single" section,
// like Sort, has one choice). "Show N results" counts live while you choose.
//
//   <Filters p={p} sections={SECTIONS} value={filters} onChange={setFilters} count={(v) => apply(v).length} />
//
// value: { sectionKey: [chosen values] }. Empty = no filter for that section.
// Rule for lists: inside one section any ticked choice matches (OR); across
// sections all must match (AND). Use matches() below.

import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Palette } from '@/components/ui/UI';

export interface FilterOption { value: string; label: string; color?: string }
export interface FilterSection {
  key: string;
  title: string;
  options: FilterOption[];
  /** One choice only (e.g. Sort). Always has a value; not counted as a filter. */
  single?: boolean;
  /** For single sections: the starting choice. */
  defaultValue?: string;
}
export type FilterValue = Record<string, string[]>;

/** Start value: single sections get their default, others nothing ticked. */
export function initialFilters(sections: FilterSection[]): FilterValue {
  return Object.fromEntries(sections.map((s) => [s.key, s.single ? [s.defaultValue ?? s.options[0]?.value] : []]));
}

/** true if nothing is ticked in this section, or `test` passes for one ticked choice. */
export function matches(value: FilterValue, key: string, test: (choice: string) => boolean) {
  const chosen = value[key] ?? [];
  return chosen.length === 0 || chosen.some(test);
}

const activeCount = (sections: FilterSection[], v: FilterValue) =>
  sections.filter((s) => !s.single).reduce((n, s) => n + (v[s.key]?.length ?? 0), 0);

export function Filters({ p, sections, value, onChange, count, label = 'Filters', startOpen = false }: {
  p: Palette;
  sections: FilterSection[];
  value: FilterValue;
  onChange: (v: FilterValue) => void;
  /** How many results a filter choice would show (for "Show N results"). */
  count: (v: FilterValue) => number;
  label?: string;
  /** Open the panel straight away (used for previews). */
  startOpen?: boolean;
}) {
  const [open, setOpen] = useState(startOpen);
  const n = activeCount(sections, value);
  const sortSection = sections.find((s) => s.single);
  const sortLabel = sortSection?.options.find((o) => o.value === value[sortSection.key]?.[0])?.label;
  const chips = sections.filter((s) => !s.single).flatMap((s) => (value[s.key] ?? []).map((v) => ({
    key: s.key, value: v, label: s.options.find((o) => o.value === v)?.label ?? v, color: s.options.find((o) => o.value === v)?.color,
  })));
  const remove = (key: string, v: string) => onChange({ ...value, [key]: (value[key] ?? []).filter((x) => x !== v) });

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`${label}${n ? `, ${n} on` : ''}`}
          style={({ pressed }) => [st.button, { borderColor: n ? p.accent : p.border, backgroundColor: n ? p.accent + '22' : p.elevated, opacity: pressed ? 0.85 : 1 }]}>
          <Ionicons name="options-outline" size={18} color={n ? p.accent : p.text} />
          <Text style={{ color: n ? p.accent : p.text, fontWeight: '800', fontSize: 14 }}>{label}</Text>
          {n > 0 && (
            <View style={[st.badge, { backgroundColor: p.accent }]}>
              <Text style={{ color: p.onAccent, fontWeight: '800', fontSize: 12 }}>{n}</Text>
            </View>
          )}
        </Pressable>
        {sortLabel && (
          <Pressable onPress={() => setOpen(true)} style={[st.button, { borderColor: p.border, backgroundColor: p.elevated }]}>
            <Ionicons name="swap-vertical" size={16} color={p.textSecondary} />
            <Text style={{ color: p.textSecondary, fontWeight: '700', fontSize: 13.5 }}>{sortLabel}</Text>
          </Pressable>
        )}
        {chips.map((c) => (
          <Pressable key={`${c.key}:${c.value}`} onPress={() => remove(c.key, c.value)} accessibilityLabel={`Remove ${c.label}`}
            style={[st.activeChip, { borderColor: p.accent + '88', backgroundColor: p.accent + '18' }]}>
            {c.color && <View style={[st.dot, { backgroundColor: c.color }]} />}
            <Text style={{ color: p.text, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>{c.label}</Text>
            <Ionicons name="close" size={14} color={p.accent} />
          </Pressable>
        ))}
        {n > 0 && (
          <Pressable onPress={() => onChange({ ...initialFilters(sections), ...Object.fromEntries(sections.filter((s) => s.single).map((s) => [s.key, value[s.key]])) })}
            hitSlop={6}>
            <Text style={{ color: p.accent, fontWeight: '700', fontSize: 13.5 }}>Clear all</Text>
          </Pressable>
        )}
      </View>
      {open && <FilterSheet p={p} sections={sections} value={value} count={count} onClose={() => setOpen(false)}
        onApply={(v) => { onChange(v); setOpen(false); }} />}
    </View>
  );
}

function FilterSheet({ p, sections, value, count, onApply, onClose }: {
  p: Palette; sections: FilterSection[]; value: FilterValue; count: (v: FilterValue) => number;
  onApply: (v: FilterValue) => void; onClose: () => void;
}) {
  const [draft, setDraft] = useState<FilterValue>(value);
  const { width } = useWindowDimensions();
  const phone = width < 640;
  const results = count(draft);

  const toggle = (s: FilterSection, v: string) => setDraft((d) => {
    const cur = d[s.key] ?? [];
    if (s.single) return { ...d, [s.key]: [v] };
    return { ...d, [s.key]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] };
  });

  return (
    <Modal transparent visible animationType={phone ? 'slide' : 'fade'} onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={[st.backdrop, phone ? { justifyContent: 'flex-end', padding: 0 } : null]} onPress={onClose}>
        <Pressable onPress={() => {}} style={[st.sheet, { backgroundColor: p.card, borderColor: p.accent + '55' },
          phone ? { maxWidth: undefined, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, maxHeight: '88%' } : null]}>
          <View style={st.head}>
            <Pressable onPress={onClose} accessibilityLabel="Close" style={[st.close, { backgroundColor: p.elevated }]}>
              <Ionicons name="close" size={20} color={p.text} />
            </Pressable>
            <Text style={{ flex: 1, color: p.text, fontSize: 18, fontWeight: '800' }}>Filters</Text>
            <Pressable onPress={() => setDraft(initialFilters(sections))} hitSlop={8}>
              <Text style={{ color: p.accent, fontWeight: '700' }}>Reset</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
            {sections.map((s) => (
              <View key={s.key} style={{ marginBottom: 18 }}>
                <Text style={{ color: p.text, fontSize: 16, fontWeight: '800', marginBottom: 8 }}>{s.title}</Text>
                <View style={{ height: 1, backgroundColor: p.border, marginBottom: 12 }} />
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {s.options.map((o) => {
                    const on = (draft[s.key] ?? []).includes(o.value);
                    return (
                      <Pressable key={o.value} onPress={() => toggle(s, o.value)}
                        accessibilityRole={s.single ? 'radio' : 'checkbox'} accessibilityState={{ checked: on }}
                        style={({ pressed }) => [st.chip, {
                          borderColor: on ? p.accent : p.border, backgroundColor: on ? p.accent + '1F' : 'transparent', opacity: pressed ? 0.85 : 1,
                        }]}>
                        {o.color ? (
                          <View style={[st.colorDot, { backgroundColor: o.color, borderColor: on ? p.accent : 'transparent' }]}>
                            {on && <Ionicons name="checkmark" size={12} color="#fff" />}
                          </View>
                        ) : (
                          <View style={[st.check, s.single && { borderRadius: 10 },
                            { borderColor: on ? p.accent : p.textSecondary + '88', backgroundColor: on ? p.accent : 'transparent' }]}>
                            {on && <Ionicons name="checkmark" size={13} color={p.onAccent} />}
                          </View>
                        )}
                        <Text style={{ color: on ? p.text : p.textSecondary, fontSize: 14, fontWeight: on ? '700' : '500' }}>{o.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={{ height: 1, backgroundColor: p.border }} />
          <Pressable onPress={() => onApply(draft)} accessibilityRole="button"
            style={({ pressed }) => [st.apply, { backgroundColor: results ? p.accent : p.elevated, opacity: pressed ? 0.85 : 1 }]}>
            <Text style={{ color: results ? p.onAccent : p.textSecondary, fontWeight: '800', fontSize: 15.5 }}>
              {results ? `Show ${results} ${results === 1 ? 'result' : 'results'}` : 'No results — change the filters'}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const st = StyleSheet.create({
  button: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 40, borderRadius: 999, borderWidth: 1 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  activeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 32, borderRadius: 999, borderWidth: 1, maxWidth: 220 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  sheet: { width: '100%', maxWidth: 640, maxHeight: '86%', borderRadius: 24, borderWidth: 1, padding: 20, gap: 14 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  close: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 8, paddingRight: 14, height: 38, borderRadius: 999, borderWidth: 1 },
  check: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  colorDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  apply: { height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
});
