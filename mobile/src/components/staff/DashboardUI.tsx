// Building blocks shared by the staff dashboards (Super Admin, Admin, later
// Trainer): welcome banner, total cards, panels, mini stats, bar chart, rows.
// FitZone gold on dark charcoal.

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, type IconName } from '@/components/ui/UI';
import { SUPER as p } from '@/theme/palettes';

const HERO = require('../../../assets/auth/signin-bg.jpg');
export const GREEN = '#4ADE80';
export const AMBER = '#FBBF24';
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const fmt = (n: number) => n.toLocaleString('en-IN');
/** "1 admin" / "3 admins" */
export const plural = (n: number, word: string) => `${fmt(n)} ${word}${n === 1 ? '' : 's'}`;
export const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
export const dashboardPalette = p;

/** Width (px) from which the dashboard shows two columns. */
export const TWO_COLUMNS_MIN = 780;

/** Two panels side by side on wide screens, stacked on phones. */
export function Grid({ twoCols, children }: { twoCols: boolean; children: ReactNode[] }) {
  return (
    <View style={twoCols ? styles.gridRow : { gap: 16 }}>
      {children.filter(Boolean).map((c, i) => <View key={i} style={twoCols ? { flex: 1, minWidth: 0, gap: 16 } : { gap: 16 }}>{c}</View>)}
    </View>
  );
}

/** Welcome banner with the gym photo (right half on wide screens, background on phones). */
export function Hero({ wide, hello, title, subtitle, children }: {
  wide: boolean; hello: string; title: string; subtitle: string; children?: ReactNode;
}) {
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <View style={[styles.hero, { minHeight: wide ? 230 : 250 }]}>
      <Image source={HERO} contentFit="cover" contentPosition="top"
        style={wide ? styles.heroImageWide : StyleSheet.absoluteFill} accessibilityIgnoresInvertColors />
      <LinearGradient pointerEvents="none"
        colors={wide ? [p.card, p.card, 'rgba(30,31,35,0.55)', 'rgba(30,31,35,0)'] : ['rgba(20,21,24,0.55)', 'rgba(20,21,24,0.92)']}
        locations={wide ? [0, 0.42, 0.62, 1] : [0, 0.7]}
        start={wide ? { x: 0, y: 0.5 } : { x: 0.5, y: 0 }} end={wide ? { x: 1, y: 0.5 } : { x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill} />
      <View style={[styles.heroText, wide && { maxWidth: '58%' }]}>
        <Text style={styles.heroDate}>{today}</Text>
        <Text style={styles.heroHello}>{hello}</Text>
        <Text style={styles.heroTitle}>{title}</Text>
        <Text style={styles.heroSub}>{subtitle || ' '}</Text>
        {children && <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>{children}</View>}
      </View>
    </View>
  );
}

/** Big total card, e.g. "Users 120 · +8 this month". */
export function Kpi({ icon, label, value, note, noteColor, onPress, minWidth = 100 }: {
  icon: IconName; label: string; value?: number | string; note?: string; noteColor?: string; onPress?: () => void;
  /** Smallest card width; 150 puts 4 cards in 2 rows on phones. */
  minWidth?: number;
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${label}: ${value ?? ''}`}
      style={({ pressed }) => [styles.kpi, { minWidth }, pressed && { opacity: 0.85 }]}>
      <View style={styles.kpiHead}>
        <Text style={styles.kpiLabel}>{label}</Text>
        <Ionicons name={icon} size={22} color={p.accent} />
      </View>
      <Text style={styles.kpiValue}>{value === undefined ? '–' : typeof value === 'number' ? fmt(value) : value}</Text>
      <Text style={{ color: noteColor ?? p.textSecondary, fontSize: 13 }}>{note ?? ' '}</Text>
    </Pressable>
  );
}

export function KpiRow({ children }: { children: ReactNode }) {
  return <View style={styles.kpis}>{children}</View>;
}

/** Card with an icon, a title and an optional link on the right. */
export function Panel({ title, icon, action, children }: {
  title: string; icon: IconName; action?: { label: string; onPress: () => void }; children: ReactNode;
}) {
  return (
    <View style={styles.panel}>
      <View style={styles.panelHead}>
        <View style={styles.panelIcon}><Ionicons name={icon} size={18} color={p.accent} /></View>
        <Text style={styles.panelTitle}>{title}</Text>
        {action && (
          <Pressable onPress={action.onPress} hitSlop={8} accessibilityRole="link">
            <Text style={styles.link}>{action.label}</Text>
          </Pressable>
        )}
      </View>
      {children}
    </View>
  );
}

export function Loading() {
  return <Text style={{ color: p.textSecondary }}>Loading…</Text>;
}

export function Muted({ children }: { children: ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function SubHead({ children }: { children: ReactNode }) {
  return <Text style={styles.subHead}>{children}</Text>;
}

export function MiniRow({ children }: { children: ReactNode }) {
  return <View style={styles.miniRow}>{children}</View>;
}

/** Small number tile inside a panel. */
export function Mini({ label, value, warn, small }: { label: string; value: string; warn?: boolean; small?: boolean }) {
  return (
    <View style={styles.mini}>
      <Text style={[styles.miniValue, warn && { color: AMBER }, small && { fontSize: 14, color: p.textSecondary }]}>{value}</Text>
      <Text style={styles.miniLabel}>{label}</Text>
    </View>
  );
}

/** Simple bar chart (no chart library needed); the last bar is highlighted. */
export function Bars({ data }: { data: { month: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((x) => x.count));
  const H = 110;
  const label = (m: string) => MONTHS[Number(m.slice(5)) - 1];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, height: H + 36 }}
      accessibilityLabel={data.map((x) => `${label(x.month)}: ${x.count}`).join(', ')}>
      {data.map((x, i) => {
        const last = i === data.length - 1;
        return (
          <View key={x.month} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
            <Text style={{ color: last ? p.accent : p.textSecondary, fontSize: 12, fontWeight: '700' }}>{x.count}</Text>
            <View style={{
              width: '70%', maxWidth: 34, height: Math.max(4, (x.count / max) * H), borderRadius: 8,
              backgroundColor: last ? p.accent : p.accent + '55',
            }} />
            <Text style={{ color: last ? p.text : p.textSecondary, fontSize: 12 }}>{label(x.month)}</Text>
          </View>
        );
      })}
    </View>
  );
}

/** A person (avatar, name, detail line, something on the right). */
export function PersonRow({ name, detail, right, onPress }: {
  name: string; detail: string; right?: ReactNode; onPress?: () => void;
}) {
  const Row = onPress ? Pressable : View;
  return (
    <Row style={styles.row} {...(onPress ? { onPress, accessibilityRole: 'button' as const } : {})}>
      <Avatar p={p} name={name} size={34} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>{name}</Text>
        <Text style={styles.rowSub} numberOfLines={1}>{detail}</Text>
      </View>
      {typeof right === 'string' ? <Text style={styles.rowSub}>{right}</Text> : right}
    </Row>
  );
}

/** Trainer with their number of users and a bar relative to the busiest trainer. */
export function TrainerLoadRow({ name, detail, count, max, onPress }: {
  name: string; detail: string; count: number; max: number; onPress?: () => void;
}) {
  return (
    <View style={{ gap: 6 }}>
      <PersonRow name={name} detail={detail} onPress={onPress}
        right={<Text style={styles.count}>{count} <Text style={styles.rowSub}>{count === 1 ? 'user' : 'users'}</Text></Text>} />
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${(count / Math.max(1, max)) * 100}%` }]} />
      </View>
    </View>
  );
}

/** Amber notice with an action, e.g. "3 users have no trainer yet · Assign". */
export function WarnBox({ text, action, onPress }: { text: string; action: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.warnBox} accessibilityRole="button">
      <Ionicons name="alert-circle-outline" size={20} color={AMBER} />
      <Text style={{ color: '#FDE68A', flex: 1 }}>{text}</Text>
      <Text style={styles.link}>{action}</Text>
    </Pressable>
  );
}

/** "Not available yet" box with an icon (for parts of a later phase). */
export function Locked({ icon = 'lock-closed-outline', text }: { icon?: IconName; text: string }) {
  return (
    <View style={styles.locked}>
      <Ionicons name={icon} size={18} color={p.textSecondary} />
      <Text style={[styles.muted, { flex: 1 }]}>{text}</Text>
    </View>
  );
}

/** List of shortcut buttons (icon, label, chevron). */
export function LinkList({ items }: { items: { icon: IconName; label: string; onPress: () => void }[] }) {
  return (
    <View style={{ gap: 6 }}>
      {items.map((it) => (
        <Pressable key={it.label} onPress={it.onPress} accessibilityRole="button"
          style={({ pressed }) => [styles.setting, pressed && { backgroundColor: p.elevated }]}>
          <Ionicons name={it.icon} size={19} color={p.accent} />
          <Text style={{ color: p.text, fontWeight: '600', flex: 1 }} numberOfLines={1}>{it.label}</Text>
          <Ionicons name="chevron-forward" size={16} color={p.textSecondary} />
        </Pressable>
      ))}
    </View>
  );
}

export const dashboardStyles = StyleSheet.create({
  page: { padding: 18, paddingBottom: 40, width: '100%', maxWidth: 1240, alignSelf: 'center' },
});

const styles = StyleSheet.create({
  gridRow: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  hero: { borderRadius: 22, overflow: 'hidden', backgroundColor: p.card, borderWidth: 1, borderColor: p.border, justifyContent: 'flex-end' },
  heroImageWide: { position: 'absolute', top: 0, bottom: 0, right: 0, width: '55%' },
  heroText: { padding: 22, gap: 4 },
  heroDate: { color: p.textSecondary, fontSize: 13 },
  heroHello: { color: p.text, fontSize: 16, fontWeight: '700', marginTop: 4 },
  heroTitle: { color: p.accent, fontSize: 30, fontWeight: '800', letterSpacing: -0.3 },
  heroSub: { color: p.textSecondary, fontSize: 14 },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  kpi: { flex: 1, minWidth: 100, backgroundColor: p.card, borderColor: p.border, borderWidth: 1, borderRadius: 20, padding: 16, gap: 6 },
  kpiHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kpiLabel: { color: p.text, fontSize: 16, fontWeight: '600' },
  kpiValue: { color: p.text, fontSize: 30, fontWeight: '800' },
  panel: { backgroundColor: p.card, borderColor: p.border, borderWidth: 1, borderRadius: 20, padding: 18, gap: 14 },
  panelHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  panelIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: p.accent + '22', alignItems: 'center', justifyContent: 'center' },
  panelTitle: { color: p.text, fontSize: 17, fontWeight: '700', flex: 1 },
  link: { color: p.accent, fontWeight: '700', fontSize: 14 },
  subHead: { color: p.textSecondary, fontSize: 12, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 4 },
  muted: { color: p.textSecondary, fontSize: 13.5 },
  miniRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  mini: { flex: 1, minWidth: 90, backgroundColor: p.elevated, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 12, gap: 2 },
  miniValue: { color: p.text, fontSize: 20, fontWeight: '800' },
  miniLabel: { color: p.textSecondary, fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowTitle: { color: p.text, fontSize: 14.5, fontWeight: '700' },
  rowSub: { color: p.textSecondary, fontSize: 12.5 },
  count: { color: p.text, fontSize: 16, fontWeight: '800' },
  track: { height: 6, borderRadius: 3, backgroundColor: p.elevated, overflow: 'hidden', marginLeft: 46 },
  fill: { height: 6, borderRadius: 3, backgroundColor: p.accent },
  warnBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14,
    backgroundColor: 'rgba(251,191,36,0.10)', borderWidth: 1, borderColor: 'rgba(251,191,36,0.35)',
  },
  locked: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14,
    backgroundColor: p.bg, borderWidth: 1, borderColor: p.border, borderStyle: 'dashed',
  },
  setting: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, backgroundColor: p.bg },
});
