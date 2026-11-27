// List of accounts of one kind (admins, trainers or users) with search,
// active / deactivated status, and — where allowed — an activate/deactivate
// switch, the Admin access switches (Super Admin only) and, for users, the
// assigned trainer.

import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { confirm } from '@/lib/confirm';
import {
  ALL_PERMISSIONS, PERMISSION_LABELS, ROLE_LABELS, type Permission, type Role, type TrainerSummary, type User,
} from '@/lib/types';
import { TrainerAssign } from './TrainerAssign';
import { Avatar, Badge, Card, Chips, Empty, Field, Notice, ToggleRow, type Palette } from './ui/UI';

type Show = 'all' | 'unassigned';

export function AccountList({ p, roles, canToggle, canEditAccess, canAssignTrainer, emptyText }: {
  p: Palette;
  /** Roles shown, e.g. ['admin', 'super_admin'] or ['trainer']. */
  roles: Role[];
  /** May the signed-in person activate / deactivate these accounts? */
  canToggle: boolean;
  /** Super Admin: may edit Admin access switches. */
  canEditAccess?: boolean;
  /** Users list: may assign users to trainers (Super Admin, or Admin with "view users"). */
  canAssignTrainer?: boolean;
  emptyText: string;
}) {
  const { user: me } = useAuth();
  const [search, setSearch] = useState('');
  const [show, setShow] = useState<Show>('all');
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [assignOpenId, setAssignOpenId] = useState<string | null>(null);

  const list = useApi(async () => {
    const all = await Promise.all(roles.map((role) => api.get<{ users: User[] }>('/api/users', { role })));
    return all.flatMap((r) => r.users);
  });

  // Trainers that may be assigned (Super Admin: all; Admin: their own). Active only.
  const trainers = useApi(async () => (canAssignTrainer
    ? (await api.get<{ trainers: TrainerSummary[] }>('/api/admin/trainers')).trainers
    : []));

  const q = search.trim().toLowerCase();
  const shown = (list.data ?? []).filter((u) =>
    (show === 'all' || !u.trainerId)
    && (!q || u.displayName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.whatsapp ?? '').includes(q)));
  const unassignedCount = (list.data ?? []).filter((u) => !u.trainerId).length;

  async function assignTrainer(u: User, trainerId: string | null) {
    if (trainerId === null && !(await confirm(`Remove the trainer from ${u.displayName || u.email}?`,
      'They will have no trainer until you assign one again.', 'Remove'))) return;
    setBusyId(u.uid);
    setError(null);
    try {
      const res = await api.put<{ user: User }>(`/api/users/${u.uid}/trainer`, { trainerId });
      list.setData((cur) => (cur ?? []).map((x) => (x.uid === u.uid ? res.user : x)));
      setAssignOpenId(null);
      void trainers.reload(); // refresh the "n users" counts
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not change the trainer.');
    } finally {
      setBusyId(null);
    }
  }

  async function setActive(u: User, active: boolean) {
    if (!active && !(await confirm(`Deactivate ${u.displayName || u.email}?`,
      'They will be signed out and cannot log in until reactivated.', 'Deactivate'))) return;
    await update(u, { isArchived: !active });
  }

  async function update(u: User, body: object) {
    setBusyId(u.uid);
    setError(null);
    try {
      const res = await api.patch<{ user: User }>(`/api/users/${u.uid}`, body);
      list.setData((cur) => (cur ?? []).map((x) => (x.uid === u.uid ? res.user : x)));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not update the account.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <View style={{ gap: 12 }}>
      <Field p={p} label="Search" icon="search-outline" value={search} onChangeText={setSearch}
        placeholder="Name, email or WhatsApp" autoCapitalize="none" />
      {canAssignTrainer && (
        <Chips p={p} value={show} onChange={setShow} options={[
          { value: 'all', label: 'All' },
          { value: 'unassigned', label: `No trainer (${unassignedCount})` },
        ]} />
      )}
      {(error || list.error || trainers.error) && <Notice text={(error ?? list.error ?? trainers.error)!} />}
      {list.data && shown.length === 0 && (
        <Empty p={p} icon="people-outline"
          text={show === 'unassigned' && (list.data.length > 0) ? 'Every user has a trainer.' : emptyText} />
      )}
      {shown.map((u) => {
        const self = u.uid === me?.uid;
        const toggleAllowed = canToggle && !self && u.role !== 'super_admin';
        const accessEditable = !!canEditAccess && u.role === 'admin';
        const open = openId === u.uid;
        return (
          <Card key={u.uid} p={p} style={{ gap: 10, opacity: busyId === u.uid ? 0.6 : 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Avatar p={p} name={u.displayName || u.email} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: p.text, fontSize: 15.5, fontWeight: '800' }} numberOfLines={1}>
                  {u.displayName || '—'}{self ? '  (you)' : ''}
                </Text>
                <Text style={{ color: p.textSecondary, fontSize: 12.5 }} numberOfLines={1}>
                  {u.email}{u.whatsapp ? ` · ${u.whatsapp}` : ''}
                </Text>
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                  {roles.length > 1 && <Badge label={ROLE_LABELS[u.role]} tone="pending" />}
                  <Badge label={u.isArchived ? 'Inactive' : 'Active'} tone={u.isArchived ? 'inactive' : 'active'} />
                  {u.role === 'client' && (
                    <Badge label={u.profileCompleted ? 'Profile done' : 'Profile not finished'}
                      tone={u.profileCompleted ? 'active' : 'pending'} />
                  )}
                </View>
              </View>
            </View>
            {u.role === 'client' && (
              <Pressable onPress={() => router.push(`/member/${u.uid}`)} accessibilityRole="button"
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 }}>
                <Ionicons name="clipboard-outline" size={16} color={p.accent} />
                <Text style={{ color: p.accent, fontWeight: '700', flex: 1 }}>View fitness profile</Text>
                <Ionicons name="chevron-forward" size={18} color={p.accent} />
              </Pressable>
            )}
            {canAssignTrainer && u.role === 'client' && (
              <TrainerAssign p={p} user={u} trainers={trainers.data} open={assignOpenId === u.uid}
                busy={busyId === u.uid}
                onToggle={() => setAssignOpenId(assignOpenId === u.uid ? null : u.uid)}
                onAssign={(trainerId) => assignTrainer(u, trainerId)} />
            )}
            {toggleAllowed && (
              <ToggleRow p={p} title="Account active" value={!u.isArchived} onChange={(v) => setActive(u, v)}
                disabled={busyId === u.uid} />
            )}
            {accessEditable && (
              <Pressable onPress={() => setOpenId(open ? null : u.uid)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 }}>
                <Ionicons name="key-outline" size={16} color={p.accent} />
                <Text style={{ color: p.accent, fontWeight: '700', flex: 1 }}>
                  Access ({u.permissions.length}/{ALL_PERMISSIONS.length})
                </Text>
                <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={p.accent} />
              </Pressable>
            )}
            {accessEditable && open && ALL_PERMISSIONS.map((perm: Permission) => (
              <ToggleRow key={perm} p={p} title={PERMISSION_LABELS[perm].title} detail={PERMISSION_LABELS[perm].detail}
                value={u.permissions.includes(perm)} disabled={busyId === u.uid}
                onChange={(on) => update(u, {
                  permissions: on ? [...new Set([...u.permissions, perm])] : u.permissions.filter((x) => x !== perm),
                })} />
            ))}
          </Card>
        );
      })}
    </View>
  );
}
