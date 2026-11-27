// Trainers screen for the Super Admin and Admins (FitZone gold): totals,
// search, filters and one card per trainer with how many users they coach.
// Tap a trainer for their page (assigned users, move users, add users).
// Admins with "View all users" see every trainer; otherwise only the ones
// they invited. Switching a trainer on / off: Super Admin for all, an Admin
// only for trainers they invited (with "Manage trainers").

import { useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { can, useAuth } from '@/lib/auth';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { setTrainerActive } from '@/lib/userActions';
import type { TrainerSummary } from '@/lib/types';
import { Avatar, Badge, Button, Chips, Empty, Field, Notice, type Palette } from './ui/UI';
import { Kpi, KpiRow, shortDate } from './staff/DashboardUI';

type Filter = 'all' | 'active' | 'inactive' | 'mine';

export function TrainersManager({ p, inviteHref }: { p: Palette; inviteHref?: Href }) {
  const { user: me } = useAuth();
  const seeAll = me?.role === 'super_admin' || can(me, 'view_users');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const list = useApi(() => api.get<{ trainers: TrainerSummary[] }>('/api/admin/trainers',
    seeAll ? { scope: 'all', archived: 'any' } : { archived: 'any' }).then((r) => r.trainers));
  const trainers = list.data ?? [];
  const isMine = (t: TrainerSummary) => t.managedBy === me?.uid;
  const mayToggle = (t: TrainerSummary) => me?.role === 'super_admin' || (can(me, 'manage_trainers') && isMine(t));

  const q = search.trim().toLowerCase();
  const shown = trainers
    .filter((t) => filter === 'all' || (filter === 'active' ? !t.isArchived : filter === 'inactive' ? t.isArchived : isMine(t)))
    .filter((t) => !q || (t.displayName || '').toLowerCase().includes(q) || t.email.toLowerCase().includes(q)
      || (t.whatsapp ?? '').includes(q.replace(/\s/g, '')));
  const active = trainers.filter((t) => !t.isArchived);
  const coached = active.reduce((n, t) => n + t.clientCount, 0);
  const maxLoad = Math.max(1, ...trainers.map((t) => t.clientCount));

  async function toggle(t: TrainerSummary, on: boolean) {
    setBusyId(t.uid);
    setError(null);
    setInfo(null);
    try {
      const r = await setTrainerActive(t, on, t.clientCount);
      if (!r) return;
      if ('moveFirst' in r) { router.push(`/coach/${t.uid}?move=1`); return; }
      if (r.info) setInfo(r.info);
      await list.reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not update the trainer.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <View style={{ gap: 14 }}>
      <KpiRow>
        <Kpi minWidth={140} icon="barbell-outline" label="Trainers" value={list.data ? trainers.length : undefined}
          onPress={() => setFilter('all')} note={list.data ? `${trainers.length - active.length} deactivated` : undefined} />
        <Kpi minWidth={140} icon="pulse-outline" label="Active trainers" value={list.data ? active.length : undefined}
          onPress={() => setFilter('active')} note="Can sign in" />
        <Kpi minWidth={140} icon="people-outline" label="Users coached" value={list.data ? coached : undefined}
          note={active.length ? `About ${Math.round(coached / active.length)} per trainer` : 'No active trainers'} />
      </KpiRow>

      {inviteHref && (
        <View style={{ alignSelf: 'flex-start' }}>
          <Button p={p} label="Invite a trainer" icon="person-add-outline" onPress={() => router.push(inviteHref)} />
        </View>
      )}

      <Field p={p} label="Search" icon="search-outline" value={search} onChangeText={setSearch}
        placeholder="Name, email or phone" autoCapitalize="none" />
      <Chips p={p} value={filter} onChange={setFilter} options={[
        { value: 'all', label: `All (${trainers.length})` },
        { value: 'active', label: `Active (${active.length})` },
        { value: 'inactive', label: `Deactivated (${trainers.length - active.length})` },
        ...(me?.role === 'admin' && seeAll ? [{ value: 'mine' as const, label: `Invited by me (${trainers.filter(isMine).length})` }] : []),
      ]} />
      {!seeAll && <Notice kind="info" text={'You see the trainers you invited. "View all users" access shows every trainer.'} />}

      {(error || list.error) && <Notice text={(error ?? list.error)!} />}
      {info && <Notice kind="info" text={info} />}
      {list.data && shown.length === 0 && (
        <Empty p={p} icon="barbell-outline" text={trainers.length === 0 ? 'No trainers yet. Invite one to get started.' : 'No trainers match.'} />
      )}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {shown.map((t) => (
          <View key={t.uid} style={{
            flexGrow: 1, flexBasis: 320, gap: 12, padding: 16, borderRadius: 18, borderWidth: 1,
            borderColor: p.border, backgroundColor: p.card, opacity: busyId === t.uid ? 0.6 : 1,
          }}>
            <Pressable onPress={() => router.push(`/coach/${t.uid}`)} accessibilityRole="button"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Avatar p={p} name={t.displayName || t.email} />
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text style={{ color: p.text, fontSize: 15.5, fontWeight: '800' }} numberOfLines={1}>{t.displayName || t.email}</Text>
                <Text style={{ color: p.textSecondary, fontSize: 12.5 }} numberOfLines={1}>
                  {t.email}{t.whatsapp ? ` · ${t.whatsapp}` : ''}
                </Text>
                <Text style={{ color: p.textSecondary, fontSize: 12.5 }} numberOfLines={1}>
                  Joined {shortDate(t.createdAt)}{t.managerName ? ` · Invited by ${isMine(t) ? 'you' : t.managerName}` : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={p.textSecondary} />
            </Pressable>

            {/* Users coached, relative to the busiest trainer */}
            <View style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: p.textSecondary, fontSize: 12.5 }}>Assigned users</Text>
                <Text style={{ color: p.text, fontSize: 13.5, fontWeight: '800' }}>{t.clientCount}</Text>
              </View>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: p.elevated, overflow: 'hidden' }}>
                <View style={{ height: 6, borderRadius: 3, width: `${(t.clientCount / maxLoad) * 100}%`, backgroundColor: p.accent }} />
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Badge label={t.isArchived ? 'Inactive' : 'Active'} tone={t.isArchived ? 'inactive' : 'active'} />
              <View style={{ flex: 1 }} />
              {mayToggle(t) && (
                <>
                  <Text style={{ color: p.textSecondary, fontSize: 12.5 }}>Account active</Text>
                  <Switch value={!t.isArchived} onValueChange={(v) => toggle(t, v)} disabled={busyId === t.uid}
                    trackColor={{ true: p.accent, false: p.border }} thumbColor="#fff"
                    accessibilityLabel={`${t.displayName || t.email} active`} />
                </>
              )}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
