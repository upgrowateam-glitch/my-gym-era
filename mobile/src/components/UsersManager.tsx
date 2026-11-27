// Users (gym members) management for the Super Admin and Admins:
// totals at the top, search, filters, sorting, and per user: fitness profile,
// trainer assignment (any active trainer) and active / deactivated status.
// Computer / tablet: a table (tap a row for the full profile and actions).
// Phone: cards with the actions on each card. The server checks every action.

import { useState, type ReactNode } from 'react';
import { Pressable, Switch, Text, View, type LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { assignTrainer, setAccountActive } from '@/lib/userActions';
import type { TrainerSummary, User } from '@/lib/types';
import { TrainerAssign } from './TrainerAssign';
import { Avatar, Badge, Card, Chips, Empty, Field, Notice, ToggleRow, type Palette } from './ui/UI';
import { Kpi, KpiRow, shortDate } from './staff/DashboardUI';

type Filter = 'all' | 'active' | 'inactive' | 'unassigned' | 'incomplete' | 'new';
type Sort = 'newest' | 'oldest' | 'name';
const TABLE_MIN = 860;

const thisMonth = () => new Date().toISOString().slice(0, 7);
const isNew = (u: User) => u.createdAt.slice(0, 7) === thisMonth();

const FILTERS: Record<Filter, (u: User) => boolean> = {
  all: () => true,
  active: (u) => !u.isArchived,
  inactive: (u) => u.isArchived,
  unassigned: (u) => !u.isArchived && !u.trainerId,
  incomplete: (u) => !u.profileCompleted,
  new: isNew,
};

export function UsersManager({ p, canToggle }: { p: Palette; canToggle: boolean }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [trainerId, setTrainerId] = useState<string>('any');
  const [sort, setSort] = useState<Sort>('newest');
  const [width, setWidth] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [assignOpenId, setAssignOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const list = useApi(() => api.get<{ users: User[] }>('/api/users', { role: 'client' }).then((r) => r.users));
  const trainers = useApi(() => api.get<{ trainers: TrainerSummary[] }>('/api/admin/trainers', { scope: 'all' }).then((r) => r.trainers));

  const users = list.data ?? [];
  const count = (f: Filter) => users.filter(FILTERS[f]).length;
  const q = search.trim().toLowerCase();
  const shown = users
    .filter(FILTERS[filter])
    .filter((u) => trainerId === 'any' || (trainerId === 'none' ? !u.trainerId : u.trainerId === trainerId))
    .filter((u) => !q || u.displayName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      || (u.whatsapp ?? '').replace(/\s/g, '').includes(q.replace(/\s/g, '')))
    .sort((a, b) => (sort === 'name'
      ? (a.displayName || a.email).localeCompare(b.displayName || b.email)
      : sort === 'oldest' ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt)));
  const wide = width >= TABLE_MIN;

  const replace = (u: User) => list.setData((cur) => (cur ?? []).map((x) => (x.uid === u.uid ? u : x)));

  async function run(u: User, action: () => Promise<void>, fallback: string) {
    setBusyId(u.uid);
    setError(null);
    setInfo(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : fallback);
    } finally {
      setBusyId(null);
    }
  }
  const changeTrainer = (u: User, id: string | null) => run(u, async () => {
    const updated = await assignTrainer(u, id);
    if (!updated) return;
    replace(updated);
    setAssignOpenId(null);
    void trainers.reload();
  }, 'Could not change the trainer.');
  const setActive = (u: User, active: boolean) => run(u, async () => {
    const r = await setAccountActive(u, active);
    if (!r) return;
    replace(r.user);
    if (r.info) setInfo(r.info);
  }, 'Could not update the account.');

  const pick = (f: Filter) => { setFilter(f); setTrainerId('any'); };

  return (
    <View style={{ gap: 14 }} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      <KpiRow>
        <Kpi minWidth={140} icon="people-outline" label="Total users" value={list.data ? users.length : undefined}
          onPress={() => pick('all')} note={list.data ? `${count('inactive')} deactivated` : undefined} />
        <Kpi minWidth={140} icon="pulse-outline" label="Active" value={list.data ? count('active') : undefined}
          onPress={() => pick('active')} note="Can sign in" />
        <Kpi minWidth={140} icon="sparkles-outline" label="New this month" value={list.data ? count('new') : undefined}
          onPress={() => pick('new')} note="New registrations" />
        <Kpi minWidth={140} icon="hourglass-outline" label="Waiting for trainer" value={list.data ? count('unassigned') : undefined}
          onPress={() => pick('unassigned')} note={count('unassigned') ? 'Need a trainer' : 'Everyone assigned'}
          noteColor={count('unassigned') ? '#FBBF24' : undefined} />
      </KpiRow>

      <Field p={p} label="Search" icon="search-outline" value={search} onChangeText={setSearch}
        placeholder="Name, email or phone" autoCapitalize="none" />

      <Group p={p} label="Show">
        <Chips p={p} value={filter} onChange={setFilter} options={[
          { value: 'all', label: `All (${users.length})` },
          { value: 'active', label: `Active (${count('active')})` },
          { value: 'inactive', label: `Deactivated (${count('inactive')})` },
          { value: 'unassigned', label: `Waiting for trainer (${count('unassigned')})` },
          { value: 'incomplete', label: `Profile not finished (${count('incomplete')})` },
          { value: 'new', label: `New this month (${count('new')})` },
        ]} />
      </Group>
      {(trainers.data?.length ?? 0) > 0 && (
        <Group p={p} label="Trainer">
          <Chips p={p} value={trainerId} onChange={setTrainerId} options={[
            { value: 'any', label: 'Any trainer' },
            { value: 'none', label: 'No trainer' },
            ...(trainers.data ?? []).map((t) => ({ value: t.uid, label: `${t.displayName || t.email} (${t.clientCount})` })),
          ]} />
        </Group>
      )}
      <Group p={p} label="Sort">
        <Chips p={p} value={sort} onChange={setSort} options={[
          { value: 'newest', label: 'Newest first' }, { value: 'oldest', label: 'Oldest first' }, { value: 'name', label: 'Name A–Z' },
        ]} />
      </Group>

      {(error || list.error || trainers.error) && <Notice text={(error ?? list.error ?? trainers.error)!} />}
      {info && <Notice kind="info" text={info} />}
      {list.data && (
        <Text style={{ color: p.textSecondary, fontSize: 13 }}>
          Showing {shown.length} of {users.length} {users.length === 1 ? 'user' : 'users'}
        </Text>
      )}
      {list.data && shown.length === 0 && (
        <Empty p={p} icon="people-outline" text={users.length === 0 ? 'No users yet. Users sign up in the app.' : 'No users match.'} />
      )}

      {wide ? (
        <UsersTable p={p} users={shown} busyId={busyId} canToggle={canToggle} onActive={setActive} />
      ) : shown.map((u) => (
        <Card key={u.uid} p={p} style={{ gap: 10, opacity: busyId === u.uid ? 0.6 : 1 }}>
          <Pressable onPress={() => router.push(`/member/${u.uid}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Avatar p={p} name={u.displayName || u.email} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: p.text, fontSize: 15.5, fontWeight: '800' }} numberOfLines={1}>{u.displayName || '—'}</Text>
              <Text style={{ color: p.textSecondary, fontSize: 12.5 }} numberOfLines={1}>
                {u.email}{u.whatsapp ? ` · ${u.whatsapp}` : ''}
              </Text>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                <Badge label={u.isArchived ? 'Inactive' : 'Active'} tone={u.isArchived ? 'inactive' : 'active'} />
                <Badge label={u.profileCompleted ? 'Profile done' : 'Profile not finished'} tone={u.profileCompleted ? 'active' : 'pending'} />
                {isNew(u) && <Badge label="New" tone="pending" />}
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={p.textSecondary} />
          </Pressable>
          <TrainerAssign p={p} user={u} trainers={trainers.data} open={assignOpenId === u.uid} busy={busyId === u.uid}
            onToggle={() => setAssignOpenId(assignOpenId === u.uid ? null : u.uid)}
            onAssign={(id) => changeTrainer(u, id)} />
          {canToggle && (
            <ToggleRow p={p} title="Account active" value={!u.isArchived} onChange={(v) => setActive(u, v)} disabled={busyId === u.uid} />
          )}
        </Card>
      ))}
    </View>
  );
}

function Group({ p, label, children }: { p: Palette; label: string; children: ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: p.textSecondary, fontSize: 12.5, fontWeight: '700', letterSpacing: 0.3 }}>{label}</Text>
      {children}
    </View>
  );
}

/** Computer layout: one row per user. Tap a row for the profile, trainer and status actions. */
function UsersTable({ p, users, busyId, canToggle, onActive }: {
  p: Palette; users: User[]; busyId: string | null; canToggle: boolean; onActive: (u: User, active: boolean) => void;
}) {
  if (users.length === 0) return null;
  const head = { color: p.textSecondary, fontSize: 12, fontWeight: '700' as const, letterSpacing: 0.4 };
  const cell = { color: p.text, fontSize: 13.5 };
  return (
    <View style={{ borderWidth: 1, borderColor: p.border, borderRadius: 18, backgroundColor: p.card, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: p.elevated }}>
        <Text style={[head, { flex: 3 }]}>USER</Text>
        <Text style={[head, { flex: 1.6 }]}>PHONE</Text>
        <Text style={[head, { flex: 1.8 }]}>TRAINER</Text>
        <Text style={[head, { flex: 1.4 }]}>PROFILE</Text>
        <Text style={[head, { flex: 1 }]}>JOINED</Text>
        <Text style={[head, { width: 110 }]}>STATUS</Text>
      </View>
      {users.map((u, i) => (
        <View key={u.uid} style={{
          flexDirection: 'row', alignItems: 'center', gap: 12, paddingRight: 16,
          borderTopWidth: i === 0 ? 0 : 1, borderTopColor: p.border, opacity: busyId === u.uid ? 0.6 : 1,
        }}>
        <Pressable onPress={() => router.push(`/member/${u.uid}`)} accessibilityRole="button"
          style={({ pressed }) => ({
            flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 16, paddingVertical: 12,
            backgroundColor: pressed ? p.elevated : 'transparent',
          })}>
          <View style={{ flex: 3, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <Avatar p={p} name={u.displayName || u.email} size={34} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[cell, { fontWeight: '700' }]} numberOfLines={1}>
                {u.displayName || '—'}{isNew(u) ? <Text style={{ color: p.accent, fontSize: 11.5 }}>  NEW</Text> : null}
              </Text>
              <Text style={{ color: p.textSecondary, fontSize: 12.5 }} numberOfLines={1}>{u.email}</Text>
            </View>
          </View>
          <Text style={[cell, { flex: 1.6 }]} numberOfLines={1}>{u.whatsapp || '—'}</Text>
          <Text style={[cell, { flex: 1.8, color: u.trainerName ? p.text : '#FBBF24' }]} numberOfLines={1}>
            {u.trainerName || (u.isArchived ? '—' : 'Waiting')}
          </Text>
          <View style={{ flex: 1.4, alignItems: 'flex-start' }}>
            <Badge label={u.profileCompleted ? 'Done' : 'Not finished'} tone={u.profileCompleted ? 'active' : 'pending'} />
          </View>
          <Text style={[cell, { flex: 1, color: p.textSecondary }]}>{shortDate(u.createdAt)}</Text>
        </Pressable>
          <View style={{ width: 110, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {canToggle ? (
              <Switch value={!u.isArchived} onValueChange={(v) => onActive(u, v)} disabled={busyId === u.uid}
                trackColor={{ true: p.accent, false: p.border }} thumbColor="#fff"
                accessibilityLabel={`${u.displayName || u.email} active`} />
            ) : null}
            <Text style={{ color: u.isArchived ? '#EF5350' : '#4CAF50', fontSize: 12.5, fontWeight: '700' }}>
              {u.isArchived ? 'Inactive' : 'Active'}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}
