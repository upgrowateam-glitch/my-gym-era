// Super Admin → Settings.

import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { confirm } from '@/lib/confirm';
import { Card, Page, type IconName } from '@/components/ui/UI';
import { SUPER as p } from '@/theme/palettes';

export default function SuperAdminSettings() {
  const { logout } = useAuth();
  return (
    <Page p={p} kicker="SUPER ADMIN" title="Settings">
      <Card p={p} style={{ padding: 6, gap: 0 }}>
        <Item icon="people-circle-outline" title="User Management" detail="Admins, trainers and users · activate, deactivate, access"
          onPress={() => router.push('/super-admin/users')} />
        <Item icon="mail-outline" title="Invitations" detail="Invite Admins and Trainers"
          onPress={() => router.push('/super-admin/invitations')} />
        <Item icon="logo-whatsapp" title="Support WhatsApp" detail="Where deactivated users can message the gym"
          onPress={() => router.push('/super-admin/settings/support')} />
        <Item icon="person-outline" title="My Profile" detail="Name, WhatsApp, password"
          onPress={() => router.push('/super-admin/settings/profile')} />
        <Item icon="log-out-outline" title="Log out" danger
          onPress={async () => { if (await confirm('Log out', 'Do you want to log out?', 'Log out')) await logout(); }} />
      </Card>
    </Page>
  );
}

function Item({ icon, title, detail, onPress, danger }: {
  icon: IconName; title: string; detail?: string; onPress: () => void; danger?: boolean;
}) {
  const color = danger ? '#EF5350' : p.accent;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({
      flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 14,
      backgroundColor: pressed ? p.elevated : 'transparent',
    })}>
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: color + '22', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={21} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: danger ? color : p.text, fontSize: 15.5, fontWeight: '700' }}>{title}</Text>
        {detail && <Text style={{ color: p.textSecondary, fontSize: 12.5, marginTop: 2 }}>{detail}</Text>}
      </View>
      {!danger && <Ionicons name="chevron-forward" size={18} color={p.textSecondary} />}
    </Pressable>
  );
}
