// Invitation management (Super Admin: Admins + Trainers; Admin: Trainers).
// Create an invitation, then share its link (copy / share / WhatsApp);
// list of invitations with status, revoke and renew.

import { useState } from 'react';
import { Linking, Platform, Pressable, Share, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, can } from '@/lib/auth';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { confirm } from '@/lib/confirm';
import { invitationUrl, whatsappUrl } from '@/lib/links';
import {
  ALL_PERMISSIONS, PERMISSION_LABELS, ROLE_LABELS, type Invitation, type Permission,
} from '@/lib/types';
import {
  Badge, Button, Card, Chips, Empty, Field, Notice, Page, SectionTitle, ToggleRow, type Palette,
} from './ui/UI';

const EXPIRY = [1, 3, 7, 14] as const;
type Filter = 'all' | 'pending' | 'used' | 'expired' | 'revoked';

/** A freshly created / renewed link, shown once with the share buttons. */
interface Shareable { invitation: Invitation; url: string }

export function InvitationsScreen({ p, kicker }: { p: Palette; kicker: string }) {
  const { user } = useAuth();
  const isSuper = user?.role === 'super_admin';
  const mayInvite = can(user, 'invite_trainers');
  const list = useApi(() => api.get<{ invitations: Invitation[] }>('/api/invitations').then((r) => r.invitations));

  const [showForm, setShowForm] = useState(false);
  const [shareable, setShareable] = useState<Shareable | null>(null);
  const [filter, setFilter] = useState<Filter>('pending');

  const shown = (list.data ?? []).filter((i) => filter === 'all' || i.status === filter);

  async function renew(inv: Invitation) {
    try {
      const res = await api.post<{ invitation: Invitation; token: string }>(`/api/invitations/${inv.id}/renew`, { expiresInDays: 7 });
      setShareable({ invitation: res.invitation, url: invitationUrl(res.token) });
      void list.reload();
    } catch (e) {
      alertError(e);
    }
  }

  async function revoke(inv: Invitation) {
    if (!(await confirm('Revoke invitation', `The link for ${inv.name} will stop working.`, 'Revoke'))) return;
    try {
      await api.post(`/api/invitations/${inv.id}/revoke`);
      void list.reload();
    } catch (e) {
      alertError(e);
    }
  }

  return (
    <Page p={p} kicker={kicker} title="Invitations" onRefresh={list.reload} refreshing={list.loading && !!list.data}>
      {!mayInvite ? (
        <Notice kind="info" text="Your account does not have access to invite trainers. Ask the Super Admin to turn it on." />
      ) : shareable ? (
        <SharePanel p={p} shareable={shareable} onDone={() => setShareable(null)} />
      ) : showForm ? (
        <InviteForm p={p} allowAdmin={isSuper} onCancel={() => setShowForm(false)}
          onCreated={(s) => { setShowForm(false); setShareable(s); void list.reload(); }} />
      ) : (
        <Button p={p} label={isSuper ? 'New invitation' : 'Invite a trainer'} icon="person-add-outline" onPress={() => setShowForm(true)} />
      )}

      <SectionTitle p={p}>{isSuper ? 'All invitations' : 'My invitations'}</SectionTitle>
      <Chips p={p} value={filter} onChange={setFilter} options={[
        { value: 'pending', label: 'Pending' }, { value: 'used', label: 'Used' }, { value: 'expired', label: 'Expired' },
        { value: 'revoked', label: 'Revoked' }, { value: 'all', label: 'All' },
      ]} />
      {list.error && <Notice text={list.error} />}
      {list.data && shown.length === 0 && <Empty p={p} icon="mail-open-outline" text="No invitations here." />}
      {shown.map((inv) => (
        <Card key={inv.id} p={p}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: p.text, fontSize: 16, fontWeight: '800' }}>{inv.name}</Text>
              <Text style={{ color: p.textSecondary, fontSize: 13 }}>
                {ROLE_LABELS[inv.role]}{inv.email ? ` · ${inv.email}` : ''}{inv.whatsapp ? ` · ${inv.whatsapp}` : ''}
              </Text>
              <Text style={{ color: p.textSecondary, fontSize: 12 }}>
                {inv.status === 'used'
                  ? `Accepted ${fmt(inv.usedAt)}${inv.usedByName ? ` by ${inv.usedByName}` : ''}`
                  : inv.status === 'revoked' ? `Revoked ${fmt(inv.revokedAt)}`
                  : `${inv.status === 'expired' ? 'Expired' : 'Expires'} ${fmt(inv.expiresAt)}`}
                {isSuper && inv.invitedByName ? ` · by ${inv.invitedByName}` : ''}
              </Text>
            </View>
            <Badge label={inv.status} />
          </View>
          {mayInvite && (inv.status === 'pending' || inv.status === 'expired' || inv.status === 'revoked') && (
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <Button p={p} small kind="outline" icon="refresh-outline"
                label={inv.status === 'pending' ? 'New link' : 'Renew (7 days)'} onPress={() => renew(inv)} />
              {inv.status === 'pending' && (
                <Button p={p} small kind="danger" icon="close-circle-outline" label="Revoke" onPress={() => revoke(inv)} />
              )}
            </View>
          )}
        </Card>
      ))}
    </Page>
  );
}

function InviteForm({ p, allowAdmin, onCreated, onCancel }: {
  p: Palette; allowAdmin: boolean; onCreated: (s: Shareable) => void; onCancel: () => void;
}) {
  const [role, setRole] = useState<'admin' | 'trainer'>(allowAdmin ? 'admin' : 'trainer');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [permissions, setPermissions] = useState<Permission[]>([...ALL_PERMISSIONS]);
  const [days, setDays] = useState<number>(7);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) return setError('Enter a name.');
    if (!email.trim() && !whatsapp.trim()) return setError('Enter an email address or a WhatsApp number.');
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ invitation: Invitation; token: string }>('/api/invitations', {
        role, name: name.trim(), email: email.trim() || null, whatsapp: whatsapp.trim() || null,
        expiresInDays: days, ...(role === 'admin' ? { permissions } : {}),
      });
      onCreated({ invitation: res.invitation, url: invitationUrl(res.token) });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not create the invitation.');
    } finally {
      setBusy(false);
    }
  }

  const toggle = (perm: Permission, on: boolean) =>
    setPermissions((cur) => (on ? [...new Set([...cur, perm])] : cur.filter((x) => x !== perm)));

  return (
    <Card p={p}>
      <Text style={{ color: p.text, fontSize: 17, fontWeight: '800' }}>New invitation</Text>
      {error && <Notice text={error} />}
      {allowAdmin && (
        <View style={{ gap: 6 }}>
          <Text style={{ color: p.textSecondary, fontSize: 12.5, fontWeight: '700' }}>Role</Text>
          <Chips p={p} value={role} onChange={setRole} options={[{ value: 'admin', label: 'Admin' }, { value: 'trainer', label: 'Trainer' }]} />
        </View>
      )}
      <Field p={p} label="Name" icon="person-outline" value={name} onChangeText={setName} autoCapitalize="words" />
      <Field p={p} label="Email (optional — the account must use it)" icon="mail-outline" value={email}
        onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <Field p={p} label="WhatsApp number (optional)" icon="logo-whatsapp" value={whatsapp}
        onChangeText={setWhatsapp} keyboardType="phone-pad" placeholder="e.g. +91 98765 43210" />
      {role === 'admin' && (
        <View style={{ gap: 4 }}>
          <Text style={{ color: p.textSecondary, fontSize: 12.5, fontWeight: '700' }}>Access</Text>
          {ALL_PERMISSIONS.map((perm) => (
            <ToggleRow key={perm} p={p} title={PERMISSION_LABELS[perm].title} detail={PERMISSION_LABELS[perm].detail}
              value={permissions.includes(perm)} onChange={(v) => toggle(perm, v)} />
          ))}
        </View>
      )}
      <View style={{ gap: 6 }}>
        <Text style={{ color: p.textSecondary, fontSize: 12.5, fontWeight: '700' }}>Link valid for</Text>
        <Chips p={p} value={days} onChange={setDays} options={EXPIRY.map((d) => ({ value: d, label: `${d} day${d > 1 ? 's' : ''}` }))} />
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><Button p={p} kind="outline" label="Cancel" onPress={onCancel} /></View>
        <View style={{ flex: 2 }}><Button p={p} label="Create link" icon="link-outline" onPress={submit} loading={busy} /></View>
      </View>
    </Card>
  );
}

function SharePanel({ p, shareable, onDone }: { p: Palette; shareable: Shareable; onDone: () => void }) {
  const { invitation, url } = shareable;
  const [copied, setCopied] = useState(false);
  const message = `Hi ${invitation.name}, you're invited to join My Gym Era as ${ROLE_LABELS[invitation.role]}. `
    + `Create your account here (link valid until ${fmt(invitation.expiresAt)}):\n${url}`;

  async function copy() {
    await Clipboard.setStringAsync(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function share() {
    try {
      if (Platform.OS === 'web' && !(typeof navigator !== 'undefined' && 'share' in navigator)) return copy();
      await Share.share({ message, url: Platform.OS === 'ios' ? url : undefined, title: 'My Gym Era invitation' });
    } catch {
      // cancelled
    }
  }

  return (
    <Card p={p} style={{ borderColor: p.accent + '88' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Ionicons name="checkmark-circle" size={26} color="#4CAF50" />
        <Text style={{ color: p.text, fontSize: 17, fontWeight: '800', flex: 1 }}>
          Invitation for {invitation.name} ({ROLE_LABELS[invitation.role]})
        </Text>
      </View>
      <Text style={{ color: p.textSecondary, fontSize: 13 }}>
        Share this link now — for security it is shown only once. You can create a new link from the list later.
      </Text>
      <Pressable onPress={copy} style={{ backgroundColor: p.elevated, borderRadius: 12, borderWidth: 1, borderColor: p.border, padding: 12 }}>
        <Text selectable style={{ color: p.text, fontSize: 13 }}>{url}</Text>
      </Pressable>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <View style={{ flexGrow: 1 }}><Button p={p} small kind="outline" icon={copied ? 'checkmark' : 'copy-outline'} label={copied ? 'Copied' : 'Copy link'} onPress={copy} /></View>
        <View style={{ flexGrow: 1 }}><Button p={p} small kind="outline" icon="share-social-outline" label="Share" onPress={share} /></View>
        <View style={{ flexGrow: 1 }}>
          <Button p={p} small kind="outline" icon="logo-whatsapp" label="WhatsApp"
            onPress={() => Linking.openURL(whatsappUrl(invitation.whatsapp, message))} />
        </View>
      </View>
      <Button p={p} label="Done" onPress={onDone} />
    </Card>
  );
}

function fmt(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function alertError(e: unknown) {
  const text = e instanceof ApiError ? e.message : 'Something went wrong.';
  void confirm('Error', text, 'OK');
}
