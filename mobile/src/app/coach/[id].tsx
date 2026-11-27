// A trainer's page for the Super Admin and Admins (FitZone gold):
// profile, status, their assigned users (move one, or all, to another
// trainer) and adding users who are waiting for a trainer.
// Admins need "View all users" to see and move users; they can switch a
// trainer on / off only for trainers they invited (with "Manage trainers").
// The server checks every action. /coach/<id>?move=1 opens "move all users".

import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View, type LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { can, homeRouteFor, useAuth } from '@/lib/auth';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { assignTrainer, moveAllUsers, setTrainerActive } from '@/lib/userActions';
import type { TrainerSummary, User } from '@/lib/types';
import { RequireRole } from '@/components/RequireRole';
import { TrainerPicker } from '@/components/TrainerPicker';
import { Avatar, Badge, Button, Notice, ToggleRow } from '@/components/ui/UI';
import { dashboardStyles, Grid, Loading, Locked, Muted, Panel, shortDate, TWO_COLUMNS_MIN } from '@/components/staff/DashboardUI';
import { SUPER as p } from '@/theme/palettes';

type Picking = { mode: 'all' } | { mode: 'one'; user: User } | null;

export default function CoachRoute() {
  return (
    <RequireRole roles={['super_admin', 'admin']}>
      <CoachPage />
    </RequireRole>
  );
}

function CoachPage() {
  const { id, move } = useLocalSearchParams<{ id: string; move?: string }>();
  const { user: me } = useAuth();
  const seeUsers = me?.role === 'super_admin' || can(me, 'view_users');

  const data = useApi(async () => {
    const [trainer, all, users, waiting] = await Promise.all([
      api.get<{ user: User }>(`/api/users/${id}`).then((r) => r.user),
      api.get<{ trainers: TrainerSummary[] }>('/api/admin/trainers', seeUsers ? { scope: 'all', archived: 'any' } : { archived: 'any' })
        .then((r) => r.trainers),
      seeUsers ? api.get<{ users: User[] }>('/api/users', { role: 'client', trainerId: id }).then((r) => r.users) : Promise.resolve([]),
      seeUsers ? api.get<{ users: User[] }>('/api/users', { role: 'client', unassigned: 'true' }).then((r) => r.users.filter((u) => !u.isArchived))
        : Promise.resolve([]),
    ]);
    return { trainer, all, users, waiting, summary: all.find((t) => t.uid === id) ?? null };
  });
  const d = data.data;

  const [width, setWidth] = useState(0);
  const twoCols = width >= TWO_COLUMNS_MIN;
  const [picking, setPicking] = useState<Picking>(move === '1' ? { mode: 'all' } : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const back = () => {
    if (router.canGoBack()) router.back();
    else if (me) router.replace(homeRouteFor(me));
  };

  async function run(action: () => Promise<void>, fallback: string) {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : fallback);
    } finally {
      setBusy(false);
    }
  }

  const t = d?.trainer;
  const name = t ? t.displayName || t.email : '';
  const userCount = d?.users.filter((u) => !u.isArchived).length ?? 0;
  const canToggle = !!t && (me?.role === 'super_admin' || (can(me, 'manage_trainers') && t.managedBy === me?.uid));

  async function pick(target: TrainerSummary) {
    const current = picking;
    setPicking(null);
    if (!current) return;
    if (current.mode === 'all') {
      await run(async () => {
        const moved = await moveAllUsers(id, target.uid);
        setInfo(`Moved ${moved} ${moved === 1 ? 'user' : 'users'} to ${target.displayName || target.email}.`);
        await data.reload();
      }, 'Could not move the users.');
    } else {
      await run(async () => {
        await assignTrainer(current.user, target.uid);
        setInfo(`${current.user.displayName || current.user.email} moved to ${target.displayName || target.email}.`);
        await data.reload();
      }, 'Could not move the user.');
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={dashboardStyles.page}
        refreshControl={<RefreshControl refreshing={data.loading && !!d} onRefresh={data.reload} tintColor={p.accent} />}>
        <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)} style={{ gap: 16 }}>
          <Pressable onPress={back} hitSlop={10} accessibilityRole="button"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
            <Ionicons name="chevron-back" size={20} color={p.accent} />
            <Text style={{ color: p.accent, fontWeight: '700', fontSize: 14.5 }}>Back</Text>
          </Pressable>

          {data.error && <Notice text={data.error} />}
          {!d && !data.error && <Loading />}

          {d && t && (
            <>
              {/* Header */}
              <View style={{
                backgroundColor: p.card, borderColor: p.border, borderWidth: 1, borderRadius: 20, padding: 18,
                flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap',
              }}>
                <Avatar p={p} name={name} size={56} />
                <View style={{ flex: 1, minWidth: 200, gap: 3 }}>
                  <Text style={{ color: p.accent, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 }}>TRAINER</Text>
                  <Text style={{ color: p.text, fontSize: 22, fontWeight: '800' }} numberOfLines={1}>{name}</Text>
                  <Text style={{ color: p.textSecondary, fontSize: 13.5 }} numberOfLines={1}>
                    {t.email}{t.whatsapp ? ` · ${t.whatsapp}` : ''}
                  </Text>
                  <Text style={{ color: p.textSecondary, fontSize: 13.5 }} numberOfLines={1}>
                    Joined {shortDate(t.createdAt)}{d.summary?.managerName ? ` · Invited by ${d.summary.managerName}` : ''}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                    <Badge label={t.isArchived ? 'Inactive' : 'Active'} tone={t.isArchived ? 'inactive' : 'active'} />
                    {seeUsers && <Badge label={`${userCount} ${userCount === 1 ? 'user' : 'users'}`} tone="pending" />}
                  </View>
                </View>
              </View>

              {error && <Notice text={error} />}
              {info && <Notice kind="success" text={info} />}

              <Grid twoCols={twoCols}>
                {/* Assigned users */}
                <Panel title={`Assigned users${seeUsers ? ` (${userCount})` : ''}`} icon="people-outline"
                  action={seeUsers && userCount > 0 ? { label: 'Move all', onPress: () => setPicking({ mode: 'all' }) } : undefined}>
                  {!seeUsers ? <Locked text={'Needs the "View all users" access from the Super Admin.'} /> : d.users.length === 0
                    ? <Muted>No users assigned yet. Add users who are waiting for a trainer.</Muted>
                    : d.users.map((u) => (
                      <View key={u.uid} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, opacity: busy ? 0.6 : 1 }}>
                        <Pressable onPress={() => router.push(`/member/${u.uid}`)} accessibilityRole="button"
                          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 }}>
                          <Avatar p={p} name={u.displayName || u.email} size={34} />
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={{ color: p.text, fontSize: 14.5, fontWeight: '700' }} numberOfLines={1}>{u.displayName || u.email}</Text>
                            <Text style={{ color: p.textSecondary, fontSize: 12.5 }} numberOfLines={1}>
                              {u.isArchived ? 'Deactivated' : u.profileCompleted ? 'Profile done' : 'Profile not finished'} · Joined {shortDate(u.createdAt)}
                            </Text>
                          </View>
                        </Pressable>
                        <Button p={p} small kind="outline" label="Move" icon="swap-horizontal-outline" disabled={busy}
                          onPress={() => setPicking({ mode: 'one', user: u })} />
                      </View>
                    ))}
                  {seeUsers && userCount > 0 && (
                    <Button p={p} kind="outline" label="Move all users to another trainer" icon="swap-horizontal-outline" disabled={busy}
                      onPress={() => setPicking({ mode: 'all' })} />
                  )}
                </Panel>

                <View style={{ gap: 16 }}>
                  {/* Add users */}
                  <Panel title="Add users" icon="person-add-outline">
                    {!seeUsers ? <Locked text={'Needs the "View all users" access from the Super Admin.'} />
                      : t.isArchived ? <Muted>Activate this trainer to assign users.</Muted>
                      : d.waiting.length === 0 ? <Muted>No users are waiting for a trainer.</Muted>
                      : (
                        <>
                          <Muted>{d.waiting.length} {d.waiting.length === 1 ? 'user is' : 'users are'} waiting for a trainer:</Muted>
                          {d.waiting.map((u) => (
                            <View key={u.uid} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                              <Avatar p={p} name={u.displayName || u.email} size={34} />
                              <View style={{ flex: 1, minWidth: 0 }}>
                                <Text style={{ color: p.text, fontSize: 14.5, fontWeight: '700' }} numberOfLines={1}>{u.displayName || u.email}</Text>
                                <Text style={{ color: p.textSecondary, fontSize: 12.5 }}>Joined {shortDate(u.createdAt)}</Text>
                              </View>
                              <Button p={p} small label="Add" icon="add" disabled={busy}
                                onPress={() => run(async () => {
                                  await assignTrainer(u, t.uid);
                                  setInfo(`${u.displayName || u.email} assigned to ${name}.`);
                                  await data.reload();
                                }, 'Could not assign the user.')} />
                            </View>
                          ))}
                        </>
                      )}
                  </Panel>

                  {/* Status */}
                  <Panel title="Status" icon="settings-outline">
                    {canToggle ? (
                      <ToggleRow p={p} title="Account active" detail={t.isArchived ? 'Deactivated: cannot sign in' : 'Can sign in'}
                        value={!t.isArchived} disabled={busy}
                        onChange={(v) => run(async () => {
                          const r = await setTrainerActive(t, v, userCount);
                          if (!r) return;
                          if ('moveFirst' in r) { setPicking({ mode: 'all' }); return; }
                          if (r.info) setInfo(r.info);
                          await data.reload();
                        }, 'Could not update the account.')} />
                    ) : (
                      <Muted>{t.isArchived ? 'This trainer is deactivated.' : 'This trainer is active.'} Only the Super Admin
                        {me?.role === 'admin' ? ' or the Admin who invited them' : ''} can switch it.</Muted>
                    )}
                  </Panel>
                </View>
              </Grid>
            </>
          )}
        </View>
      </ScrollView>

      {d && (
        <TrainerPicker visible={!!picking} trainers={d.all} excludeId={id}
          title={picking?.mode === 'one' ? `Move ${picking.user.displayName || picking.user.email}` : `Move all of ${name}'s users`}
          subtitle={picking?.mode === 'all' ? `${userCount} ${userCount === 1 ? 'user' : 'users'} will move to the trainer you choose.` : 'Choose the new trainer.'}
          onPick={pick} onClose={() => setPicking(null)} />
      )}
    </SafeAreaView>
  );
}
