// "My profile" for every role: view / edit name and WhatsApp, change
// password, log out. The email and role are shown but cannot be changed.

import { useState } from 'react';
import { View, Text } from 'react-native';
import { useAuth } from '@/lib/auth';
import { api, ApiError } from '@/lib/api';
import { ROLE_LABELS, type User } from '@/lib/types';
import { confirm } from '@/lib/confirm';
import { Avatar, Badge, Button, Card, Field, Notice, Page, SectionTitle, type Palette } from './ui/UI';

export function ProfileScreen({ p, kicker }: { p: Palette; kicker: string }) {
  const { user, setUser, logout } = useAuth();
  const [name, setName] = useState(user?.displayName ?? '');
  const [whatsapp, setWhatsapp] = useState(user?.whatsapp ?? '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  if (!user) return null;

  async function saveProfile() {
    if (!name.trim()) return setMsg({ kind: 'error', text: 'Name cannot be empty.' });
    setSaving(true);
    setMsg(null);
    try {
      const res = await api.patch<{ user: User }>('/api/users/me', { displayName: name.trim(), whatsapp: whatsapp.trim() || null });
      setUser(res.user);
      setMsg({ kind: 'success', text: 'Profile saved.' });
    } catch (e) {
      setMsg({ kind: 'error', text: e instanceof ApiError ? e.message : 'Could not save.' });
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    if (next.length < 6) return setPwMsg({ kind: 'error', text: 'New password must be at least 6 characters.' });
    setPwSaving(true);
    setPwMsg(null);
    try {
      await api.post('/api/auth/change-password', { currentPassword: current, newPassword: next });
      setCurrent('');
      setNext('');
      setPwMsg({ kind: 'success', text: 'Password changed.' });
    } catch (e) {
      setPwMsg({ kind: 'error', text: e instanceof ApiError ? e.message : 'Could not change the password.' });
    } finally {
      setPwSaving(false);
    }
  }

  async function signOut() {
    if (await confirm('Log out', 'Do you want to log out?', 'Log out')) await logout();
  }

  return (
    <Page p={p} kicker={kicker} title="My Profile">
      <Card p={p} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Avatar p={p} name={user.displayName || user.email} size={56} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: p.text, fontSize: 18, fontWeight: '800' }}>{user.displayName || '—'}</Text>
          <Text style={{ color: p.textSecondary }}>{user.email}</Text>
          <Badge label={ROLE_LABELS[user.role]} tone="active" />
        </View>
      </Card>

      <SectionTitle p={p}>Basic details</SectionTitle>
      <Card p={p}>
        {msg && <Notice text={msg.text} kind={msg.kind} />}
        <Field p={p} label="Full name" icon="person-outline" value={name} onChangeText={setName} autoCapitalize="words" />
        <Field p={p} label="WhatsApp number" icon="logo-whatsapp" value={whatsapp} onChangeText={setWhatsapp}
          keyboardType="phone-pad" placeholder="e.g. +91 98765 43210" />
        <Field p={p} label="Email (cannot be changed)" icon="mail-outline" value={user.email} editable={false} />
        <Button p={p} label="Save changes" icon="save-outline" onPress={saveProfile} loading={saving} />
      </Card>

      <SectionTitle p={p}>Change password</SectionTitle>
      <Card p={p}>
        {pwMsg && <Notice text={pwMsg.text} kind={pwMsg.kind} />}
        <Field p={p} label="Current password" icon="lock-closed-outline" value={current} onChangeText={setCurrent} secureTextEntry autoCapitalize="none" />
        <Field p={p} label="New password (min. 6 characters)" icon="key-outline" value={next} onChangeText={setNext} secureTextEntry autoCapitalize="none" />
        <Button p={p} label="Change password" kind="outline" icon="shield-checkmark-outline" onPress={changePassword} loading={pwSaving} />
      </Card>

      <Button p={p} label="Log out" kind="danger" icon="log-out-outline" onPress={signOut} />
    </Page>
  );
}
