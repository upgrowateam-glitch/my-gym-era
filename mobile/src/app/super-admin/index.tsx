// Super Admin dashboard (gold). Everything comes from GET /api/admin/overview
// (Super Admin only) — real numbers only, nothing made up.
// Wide screens: two-column grid next to the sidebar. Phones: one column.

import { useState, type ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import type { Invitation, SuperOverview } from '@/lib/types';
import { Avatar, Badge, Button, Notice, type IconName } from '@/components/ui/UI';
import { SUPER as p } from '@/theme/palettes';

const HERO = require('../../../assets/auth/signin-bg.jpg');
const GREEN = '#4ADE80';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const go = (href: Href) => router.push(href);
const usersTab = (tab: 'admins' | 'trainers' | 'users') => go({ pathname: '/super-admin/users', params: { tab } });
const fmt = (n: number) => n.toLocaleString('en-IN');
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

export default function SuperAdminDashboard() {
  const { user } = useAuth();
  const overview = useApi(() => api.get<SuperOverview>('/api/admin/overview'));
  const d = overview.data;
  const [width, setWidth] = useState(0);
  const twoCols = width >= 780;
  const first = user?.displayName?.split(' ')[0] || 'Super Admin';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.page}
        refreshControl={<RefreshControl refreshing={overview.loading && !!d} onRefresh={overview.reload} tintColor={p.accent} />}
      >
        <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)} style={{ gap: 16 }}>
          <Hero name={first} wide={twoCols} d={d} />
          {overview.error && <Notice text={overview.error} />}

          <View style={styles.kpis}>
            <Kpi icon="shield-checkmark-outline" label="Admins" value={d?.totals.admins} added={d?.totals.newThisMonth.admins}
              onPress={() => usersTab('admins')} />
            <Kpi icon="barbell-outline" label="Trainers" value={d?.totals.trainers} added={d?.totals.newThisMonth.trainers}
              onPress={() => usersTab('trainers')} />
            <Kpi icon="people-outline" label="Users" value={d?.totals.users} added={d?.totals.newThisMonth.users}
              onPress={() => usersTab('users')} />
          </View>

          <Grid twoCols={twoCols}>
            <UserOverview d={d} />
            <Invitations d={d} />
          </Grid>
          <Grid twoCols={twoCols}>
            <TrainerAssignments d={d} />
            <View style={{ gap: 16 }}>
              <Library d={d} />
              <Settings />
            </View>
          </Grid>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Layout pieces ───────────────────────────────────────────────────────────

function Grid({ twoCols, children }: { twoCols: boolean; children: ReactNode }) {
  return <View style={twoCols ? styles.gridRow : { gap: 16 }}>{
    Array.isArray(children) ? children.map((c, i) => <View key={i} style={twoCols ? { flex: 1, minWidth: 0 } : undefined}>{c}</View>) : children
  }</View>;
}

function Panel({ title, icon, action, children }: {
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

function Loading() {
  return <Text style={{ color: p.textSecondary }}>Loading…</Text>;
}

// ── Welcome banner ──────────────────────────────────────────────────────────

function Hero({ name, wide, d }: { name: string; wide: boolean; d: SuperOverview | null }) {
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
        <Text style={styles.heroHello}>Welcome back, {name}</Text>
        <Text style={styles.heroTitle}>Your gym at a glance</Text>
        <Text style={styles.heroSub}>
          {d ? `${fmt(d.totals.users)} users · ${fmt(d.totals.trainers)} trainers · ${fmt(d.totals.admins)} admins` : ' '}
        </Text>
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
          <Button p={p} small label="Invite Admin" icon="person-add-outline" onPress={() => go('/super-admin/invitations')} />
          <Button p={p} small kind="outline" label="Manage users" icon="people-outline" onPress={() => usersTab('users')} />
        </View>
      </View>
    </View>
  );
}

// ── Totals ──────────────────────────────────────────────────────────────────

function Kpi({ icon, label, value, added, onPress }: {
  icon: IconName; label: string; value?: number; added?: number; onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${value ?? ''}`}
      style={({ pressed }) => [styles.kpi, pressed && { opacity: 0.85 }]}>
      <View style={styles.kpiHead}>
        <Text style={styles.kpiLabel}>{label}</Text>
        <Ionicons name={icon} size={22} color={p.accent} />
      </View>
      <Text style={styles.kpiValue}>{value === undefined ? '–' : fmt(value)}</Text>
      <Text style={{ color: added ? GREEN : p.textSecondary, fontSize: 13 }}>
        {added === undefined ? ' ' : added ? `+${fmt(added)} this month` : 'None new this month'}
      </Text>
    </Pressable>
  );
}

// ── User overview ───────────────────────────────────────────────────────────

function UserOverview({ d }: { d: SuperOverview | null }) {
  const u = d?.users;
  const pct = u && u.active ? Math.round((u.profilesCompleted / u.active) * 100) : 0;
  return (
    <Panel title="User overview" icon="people-outline" action={{ label: 'All users', onPress: () => usersTab('users') }}>
      {!u ? <Loading /> : (
        <>
          <View style={styles.miniRow}>
            <Mini label="Active" value={fmt(u.active)} />
            <Mini label="Deactivated" value={fmt(u.inactive)} />
            <Mini label="Profile done" value={`${pct}%`} />
            <Mini label="No trainer" value={fmt(u.unassigned)} warn={u.unassigned > 0} />
          </View>
          <Text style={styles.subHead}>New users per month</Text>
          <Bars data={u.signupsByMonth} />
          <Text style={styles.subHead}>Newest users</Text>
          {u.recent.length === 0 ? <Text style={styles.muted}>No users yet. Users sign up in the app.</Text>
            : u.recent.map((r) => (
              <View key={r.uid} style={styles.row}>
                <Avatar p={p} name={r.displayName || r.email} size={34} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{r.displayName || r.email}</Text>
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {r.trainerName ? `Trainer: ${r.trainerName}` : 'No trainer yet'}{r.isArchived ? ' · Deactivated' : ''}
                  </Text>
                </View>
                <Text style={styles.rowSub}>{shortDate(r.createdAt)}</Text>
              </View>
            ))}
        </>
      )}
    </Panel>
  );
}

function Mini({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <View style={styles.mini}>
      <Text style={[styles.miniValue, warn && { color: '#FBBF24' }]}>{value}</Text>
      <Text style={styles.miniLabel}>{label}</Text>
    </View>
  );
}

/** Simple bar chart (no chart library needed). */
function Bars({ data }: { data: { month: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((x) => x.count));
  const H = 110;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, height: H + 36 }}
      accessibilityLabel={data.map((x) => `${MONTHS[Number(x.month.slice(5)) - 1]}: ${x.count}`).join(', ')}>
      {data.map((x, i) => {
        const last = i === data.length - 1;
        return (
          <View key={x.month} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
            <Text style={{ color: last ? p.accent : p.textSecondary, fontSize: 12, fontWeight: '700' }}>{x.count}</Text>
            <View style={{
              width: '70%', maxWidth: 34, height: Math.max(4, (x.count / max) * H), borderRadius: 8,
              backgroundColor: last ? p.accent : p.accent + '55',
            }} />
            <Text style={{ color: last ? p.text : p.textSecondary, fontSize: 12 }}>{MONTHS[Number(x.month.slice(5)) - 1]}</Text>
          </View>
        );
      })}
    </View>
  );
}

// ── Invitations ─────────────────────────────────────────────────────────────

function Invitations({ d }: { d: SuperOverview | null }) {
  const inv = d?.invitations;
  return (
    <Panel title="Invitations" icon="mail-outline" action={{ label: 'Manage', onPress: () => go('/super-admin/invitations') }}>
      {!inv ? <Loading /> : (
        <>
          <View style={styles.miniRow}>
            <Mini label="Pending" value={fmt(inv.pending)} />
            <Mini label="Used" value={fmt(inv.used)} />
            <Mini label="Expired" value={fmt(inv.expired)} />
            <Mini label="Revoked" value={fmt(inv.revoked)} />
          </View>
          <Text style={styles.subHead}>Latest invitations</Text>
          {inv.latest.length === 0 ? <Text style={styles.muted}>No invitations yet.</Text>
            : inv.latest.map((i: Invitation) => (
              <View key={i.id} style={styles.row}>
                <View style={[styles.roleDot, { backgroundColor: i.role === 'admin' ? p.accent + '33' : '#38BDF833' }]}>
                  <Ionicons name={i.role === 'admin' ? 'shield-checkmark-outline' : 'barbell-outline'} size={16}
                    color={i.role === 'admin' ? p.accent : '#38BDF8'} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{i.name}</Text>
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {i.role === 'admin' ? 'Admin' : 'Trainer'} · {shortDate(i.createdAt)}{i.invitedByName ? ` · by ${i.invitedByName}` : ''}
                  </Text>
                </View>
                <Badge label={i.status} tone={i.status} />
              </View>
            ))}
          <Button p={p} label="Invite an Admin or Trainer" icon="person-add-outline" onPress={() => go('/super-admin/invitations')} />
        </>
      )}
    </Panel>
  );
}

// ── Trainer assignments ─────────────────────────────────────────────────────

function TrainerAssignments({ d }: { d: SuperOverview | null }) {
  const max = Math.max(1, ...(d?.trainers ?? []).map((t) => t.clientCount));
  return (
    <Panel title="Trainer assignments" icon="git-network-outline" action={{ label: 'Assign', onPress: () => usersTab('users') }}>
      {!d ? <Loading /> : (
        <>
          {d.users.unassigned > 0 && (
            <Pressable onPress={() => usersTab('users')} style={styles.warnBox} accessibilityRole="button">
              <Ionicons name="alert-circle-outline" size={20} color="#FBBF24" />
              <Text style={{ color: '#FDE68A', flex: 1 }}>
                {d.users.unassigned === 1 ? '1 user has' : `${fmt(d.users.unassigned)} users have`} no trainer yet.
              </Text>
              <Text style={styles.link}>Assign</Text>
            </Pressable>
          )}
          {d.trainers.length === 0 ? <Text style={styles.muted}>No trainers yet. Invite one from Invitations.</Text>
            : d.trainers.map((t) => (
              <View key={t.uid} style={{ gap: 6 }}>
                <View style={styles.row}>
                  <Avatar p={p} name={t.displayName || t.email} size={34} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{t.displayName || t.email}</Text>
                    <Text style={styles.rowSub} numberOfLines={1}>{t.managerName ? `Invited by ${t.managerName}` : t.email}</Text>
                  </View>
                  <Text style={styles.count}>{t.clientCount} <Text style={styles.rowSub}>{t.clientCount === 1 ? 'user' : 'users'}</Text></Text>
                </View>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${(t.clientCount / max) * 100}%` }]} />
                </View>
              </View>
            ))}
        </>
      )}
    </Panel>
  );
}

// ── Library ─────────────────────────────────────────────────────────────────

function Library({ d }: { d: SuperOverview | null }) {
  const l = d?.library;
  return (
    <Panel title="Workout & nutrition library" icon="library-outline">
      {!l ? <Loading /> : (
        <View style={styles.miniRow}>
          <Mini label="Exercises" value={fmt(l.exercises)} />
          <Mini label="Videos" value={fmt(l.videos)} />
          <Mini label="Folders" value={fmt(l.folders)} />
          <View style={styles.mini}>
            <Text style={[styles.miniValue, { fontSize: 14, color: p.textSecondary }]}>Not set up</Text>
            <Text style={styles.miniLabel}>Food items</Text>
          </View>
        </View>
      )}
      <Text style={styles.muted}>The library screens arrive in the workout & nutrition phase.</Text>
    </Panel>
  );
}

// ── Settings ────────────────────────────────────────────────────────────────

function Settings() {
  const items: { icon: IconName; label: string; href: Href }[] = [
    { icon: 'people-circle-outline', label: 'User management', href: '/super-admin/users' },
    { icon: 'mail-outline', label: 'Invitations', href: '/super-admin/invitations' },
    { icon: 'person-outline', label: 'My profile', href: '/super-admin/settings/profile' },
    { icon: 'settings-outline', label: 'All settings', href: '/super-admin/settings' },
  ];
  return (
    <Panel title="Application settings" icon="settings-outline">
      <View style={styles.settingsGrid}>
        {items.map((it) => (
          <Pressable key={it.label} onPress={() => go(it.href)} accessibilityRole="button"
            style={({ pressed }) => [styles.setting, pressed && { backgroundColor: p.elevated }]}>
            <Ionicons name={it.icon} size={19} color={p.accent} />
            <Text style={{ color: p.text, fontWeight: '600', flex: 1 }} numberOfLines={1}>{it.label}</Text>
            <Ionicons name="chevron-forward" size={16} color={p.textSecondary} />
          </Pressable>
        ))}
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  page: { padding: 18, paddingBottom: 40, width: '100%', maxWidth: 1240, alignSelf: 'center' },
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
  roleDot: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  count: { color: p.text, fontSize: 16, fontWeight: '800' },
  track: { height: 6, borderRadius: 3, backgroundColor: p.elevated, overflow: 'hidden', marginLeft: 46 },
  fill: { height: 6, borderRadius: 3, backgroundColor: p.accent },
  warnBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14,
    backgroundColor: 'rgba(251,191,36,0.10)', borderWidth: 1, borderColor: 'rgba(251,191,36,0.35)',
  },
  settingsGrid: { gap: 6 },
  setting: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, backgroundColor: p.bg },
});
