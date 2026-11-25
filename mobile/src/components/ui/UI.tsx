// Shared building blocks for the signed-in areas (dashboards, lists, forms).
// Every component takes the area's accent colour so the same pieces serve the
// Super Admin / Admin (purple), Trainer (cyan) and User (lime) areas.

import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, TextInput, View,
  type TextInputProps, type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { danger, staff } from '@/theme/colors';

export type IconName = keyof typeof Ionicons.glyphMap;

export interface Palette {
  bg: string;
  card: string;
  elevated: string;
  border: string;
  text: string;
  textSecondary: string;
  accent: string;
  onAccent: string;
}

export const STAFF: Palette = {
  bg: staff.bg, card: staff.card, elevated: staff.elevated, border: '#2A3448',
  text: staff.text, textSecondary: staff.textSecondary, accent: '#A66CFF', onAccent: '#FFFFFF',
};

/** Scrollable page with a header (kicker + title) and pull-to-refresh. */
export function Page({ p, kicker, title, right, children, onRefresh, refreshing }: {
  p: Palette;
  kicker?: string;
  title: string;
  right?: ReactNode;
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.page}
        keyboardShouldPersistTaps="handled"
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={p.accent} /> : undefined}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            {kicker && <Text style={[styles.kicker, { color: p.accent }]}>{kicker}</Text>}
            <Text style={[styles.title, { color: p.text }]}>{title}</Text>
          </View>
          {right}
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({ p, children, style }: { p: Palette; children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, { backgroundColor: p.card, borderColor: p.border }, style]}>{children}</View>;
}

export function SectionTitle({ p, children, right }: { p: Palette; children: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={[styles.section, { color: p.textSecondary }]}>{children}</Text>
      {right}
    </View>
  );
}

export function StatTile({ p, label, value, icon, onPress }: {
  p: Palette; label: string; value?: number | string | null; icon: IconName; onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress}
      style={({ pressed }) => [styles.stat, { backgroundColor: p.card, borderColor: p.border }, pressed && { opacity: 0.85 }]}>
      <Ionicons name={icon} size={20} color={p.accent} />
      {value === undefined || value === null
        ? <ActivityIndicator color={p.accent} style={{ marginVertical: 6 }} />
        : <Text style={[styles.statValue, { color: p.text }]}>{value}</Text>}
      <Text style={[styles.statLabel, { color: p.textSecondary }]} numberOfLines={2}>{label}</Text>
    </Pressable>
  );
}

export function Button({ p, label, onPress, icon, kind = 'primary', loading, disabled, small }: {
  p: Palette;
  label: string;
  onPress: () => void;
  icon?: IconName;
  kind?: 'primary' | 'outline' | 'danger' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
}) {
  const bg = kind === 'primary' ? p.accent : 'transparent';
  const fg = kind === 'primary' ? p.onAccent : kind === 'danger' ? danger : kind === 'ghost' ? p.accent : p.text;
  const border = kind === 'outline' ? p.border : kind === 'danger' ? danger + '88' : 'transparent';
  return (
    <Pressable
      onPress={loading || disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.btn, small && styles.btnSmall,
        { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : (
        <>
          {icon && <Ionicons name={icon} size={small ? 16 : 19} color={fg} />}
          <Text style={[styles.btnText, small && { fontSize: 13 }, { color: fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Field({ p, label, icon, error, ...props }: TextInputProps & { p: Palette; label: string; icon?: IconName; error?: string | null }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text style={[styles.label, { color: p.textSecondary }]}>{label}</Text>
      <View style={[styles.field, { backgroundColor: p.elevated, borderColor: focused ? p.accent : p.border }]}>
        {icon && <Ionicons name={icon} size={19} color={p.accent} style={{ marginRight: 10 }} />}
        <TextInput
          placeholderTextColor={p.textSecondary + '99'}
          selectionColor={p.accent}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.input, { color: props.editable === false ? p.textSecondary : p.text }]}
          {...props}
        />
      </View>
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

export function ToggleRow({ p, title, detail, value, onChange, disabled }: {
  p: Palette; title: string; detail?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.toggleTitle, { color: p.text }]}>{title}</Text>
        {detail && <Text style={[styles.toggleDetail, { color: p.textSecondary }]}>{detail}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: p.accent, false: p.border }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

/** Horizontal choice chips (filters, expiry days…). */
export function Chips<T extends string | number>({ p, options, value, onChange }: {
  p: Palette; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const sel = o.value === value;
        return (
          <Pressable key={String(o.value)} onPress={() => onChange(o.value)}
            style={[styles.chip, { borderColor: sel ? p.accent : p.border, backgroundColor: sel ? p.accent + '22' : p.elevated }]}>
            <Text style={[styles.chipText, { color: sel ? p.accent : p.text }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const BADGE_COLORS: Record<string, string> = {
  active: '#4CAF50', pending: '#FFB300', used: '#4CAF50', expired: '#9E9E9E', revoked: '#EF5350', inactive: '#EF5350',
};
export function Badge({ label, tone }: { label: string; tone?: string }) {
  const c = BADGE_COLORS[tone ?? label.toLowerCase()] ?? '#90A4AE';
  return (
    <View style={[styles.badge, { backgroundColor: c + '22', borderColor: c + '66' }]}>
      <Text style={[styles.badgeText, { color: c }]}>{label}</Text>
    </View>
  );
}

export function Empty({ p, icon, text }: { p: Palette; icon: IconName; text: string }) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={30} color={p.textSecondary} />
      <Text style={[styles.emptyText, { color: p.textSecondary }]}>{text}</Text>
    </View>
  );
}

export function Notice({ text, kind = 'error' }: { text: string; kind?: 'error' | 'success' | 'info' }) {
  const c = kind === 'error' ? danger : kind === 'success' ? '#4CAF50' : '#64B5F6';
  return (
    <View style={[styles.notice, { borderColor: c + '66', backgroundColor: c + '1A' }]}>
      <Ionicons name={kind === 'error' ? 'alert-circle' : kind === 'success' ? 'checkmark-circle' : 'information-circle'} size={18} color={c} />
      <Text style={[styles.noticeText, { color: '#E6E9EF' }]}>{text}</Text>
    </View>
  );
}

/** Round initials avatar. */
export function Avatar({ p, name, size = 40 }: { p: Palette; name: string; size?: number }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? '').join('') || '?';
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: p.accent + '26', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: p.accent, fontWeight: '800', fontSize: size * 0.38 }}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: 18, paddingBottom: 40, gap: 14, width: '100%', maxWidth: 720, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4, marginBottom: 2 },
  kicker: { fontSize: 12, fontWeight: '800', letterSpacing: 2.5 },
  title: { fontSize: 26, fontWeight: '800', marginTop: 2 },
  card: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 12 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  section: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' },
  stat: { flex: 1, minWidth: 140, borderRadius: 18, borderWidth: 1, padding: 14, gap: 4 },
  statValue: { fontSize: 26, fontWeight: '800' },
  statLabel: { fontSize: 12.5 },
  btn: {
    minHeight: 50, borderRadius: 16, borderWidth: 1, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  btnSmall: { minHeight: 38, borderRadius: 12, paddingHorizontal: 12 },
  btnText: { fontSize: 15.5, fontWeight: '700' },
  label: { fontSize: 12.5, fontWeight: '700', letterSpacing: 0.3 },
  field: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, minHeight: 50 },
  input: { flex: 1, fontSize: 15.5, paddingVertical: 12, outlineStyle: 'none' } as never,
  fieldError: { color: '#EF9A9A', fontSize: 12.5 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  toggleTitle: { fontSize: 15, fontWeight: '600' },
  toggleDetail: { fontSize: 12.5, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontSize: 13.5, fontWeight: '700' },
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  emptyText: { fontSize: 14, textAlign: 'center' },
  notice: { flexDirection: 'row', gap: 8, alignItems: 'center', borderWidth: 1, borderRadius: 14, padding: 12 },
  noticeText: { flex: 1, fontSize: 13.5 },
});
