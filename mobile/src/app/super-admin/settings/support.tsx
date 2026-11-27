// Super Admin → Settings → Support WhatsApp.
// Deactivated users see a "Share on WhatsApp" button on the sign-in page that
// sends their request to this number.

import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { Button, Card, Field, Notice, Page } from '@/components/ui/UI';
import { SUPER as p } from '@/theme/palettes';

interface Settings { supportWhatsapp: string | null }

export default function SupportSettings() {
  const data = useApi(() => api.get<{ settings: Settings }>('/api/admin/settings').then((r) => r.settings));
  return (
    <Page p={p} kicker="SETTINGS" title="Support WhatsApp">
      {data.error && <Notice text={data.error} />}
      {data.data && <SupportForm initial={data.data} />}
      <Button p={p} kind="outline" label="Back to settings" icon="chevron-back" onPress={() => router.back()} />
    </Page>
  );
}

function SupportForm({ initial }: { initial: Settings }) {
  const [number, setNumber] = useState(initial.supportWhatsapp ?? '');
  const [saved, setSaved] = useState(initial.supportWhatsapp);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function save(value: string) {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const r = await api.put<{ settings: Settings }>('/api/admin/settings', { supportWhatsapp: value.trim() });
      setSaved(r.settings.supportWhatsapp);
      setNumber(r.settings.supportWhatsapp ?? '');
      setDone(r.settings.supportWhatsapp ? 'Saved. Deactivated users can now message this number.' : 'Removed.');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card p={p} style={{ gap: 14 }}>
      <Text style={{ color: p.textSecondary, fontSize: 14, lineHeight: 20 }}>
        When a deactivated person tries to sign in, they can choose what they need (for example &quot;I can&apos;t log in&quot;)
        and tap <Text style={{ color: p.text, fontWeight: '700' }}>Share on WhatsApp</Text>. The message goes to this number
        and starts with &quot;Hi, I am &lt;their name&gt;&quot;.
      </Text>
      <Field p={p} label="WhatsApp number (with country code)" icon="logo-whatsapp" placeholder="+91 98765 43210"
        keyboardType="phone-pad" value={number} onChangeText={setNumber} error={error} />
      {done && <Notice kind="success" text={done} />}
      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
        <Button p={p} label="Save" icon="checkmark" loading={busy} onPress={() => save(number)} />
        {saved && <Button p={p} kind="outline" label="Remove number" icon="trash-outline" disabled={busy} onPress={() => save('')} />}
      </View>
      {!saved && <Notice kind="info" text="No number set yet: deactivated users are told to contact the gym directly." />}
    </Card>
  );
}
