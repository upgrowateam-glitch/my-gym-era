// List of accounts of one kind (admins, trainers or users) with search,
// active / deactivated status, and — where allowed — an activate/deactivate
// switch and the Admin access switches (Super Admin only).

import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { confirm } from '@/lib/confirm';
import { ALL_PERMISSIONS, PERMISSION_LABELS, ROLE_LABELS, type Permission, type Role, type User } from '@/lib/types';
import { Avatar, Badge, Card, Empty, Field, Notice, ToggleRow, type Palette } from './ui/UI';

export function AccountList({ p, roles, canToggle, canEditAccess, emptyText }: {
  p: Palette;
  /** Roles shown, e.g. ['admin', 'super_admin'] or ['trainer']. */
  roles: Role[];
  /** May the signed-in person activate / deactivate these accounts? */
  canToggle: boolean;
  /** Super Admin: may edit Admin access switches. */
  canEditAccess?: boolean;
  emptyText: string;
}) {
  const { user: me } = useAuth();
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const list = useApi(async () => {
    const all = await Promise.all(roles.map((role) => api.get<{ users: User[] }>('/api/users', { role })));
    return all.flatMap((r) => r.users);
  });

  const q = search.trim().toLowerCase();
  const shown = (list.data ?? []).filter((u) =>
    !q || u.displayName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.whatsapp ?? '').includes(q));

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
      {(error || list.error) && <Notice text={(error ?? list.error)!} />}
      {list.data && shown.length === 0 && <Empty p={p} icon="people-outline" text={emptyText} />}
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
                </View>
              </View>
            </View>
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
