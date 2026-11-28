// Photo credits for the starter food photos (from Wikimedia Commons). Their free
// licenses ask us to name each photographer and the license. Anyone signed in.

import { Linking, Pressable, Text, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/useApi';
import { foodsApi } from '@/lib/nutrition';
import { RequireRole } from '@/components/RequireRole';
import { BackPage } from '@/components/staff/BackPage';
import { Notice } from '@/components/ui/UI';
import { Loading } from '@/components/staff/DashboardUI';
import { SUPER as p } from '@/theme/palettes';

export default function PhotoCreditsRoute() {
  return (
    <RequireRole roles={['client', 'trainer', 'admin', 'super_admin']}>
      <PhotoCredits />
    </RequireRole>
  );
}

function PhotoCredits() {
  const { user } = useAuth();
  const data = useApi(foodsApi.photoCredits);
  return (
    <BackPage p={p} kicker="FOODS & NUTRITION" title="Photo credits" maxWidth={760} fallback={user?.role === 'client' ? '/nutrition' : undefined}>
      <Text style={{ color: p.textSecondary, fontSize: 14, lineHeight: 20 }}>
        The food photos come from Wikimedia Commons and are shared under free licenses. Thank you to the photographers below.
        Photos that admins upload themselves are not listed here.
      </Text>
      {data.error && <Notice text={data.error} />}
      {!data.data && !data.error && <Loading />}
      {data.data?.map((c) => (
        <Pressable key={c.food} onPress={() => Linking.openURL(c.source)} accessibilityRole="link"
          style={({ pressed }) => ({ padding: 12, borderRadius: 14, borderWidth: 1, borderColor: p.border, backgroundColor: pressed ? p.elevated : p.card, gap: 2 })}>
          <Text style={{ color: p.text, fontWeight: '700', fontSize: 14.5 }}>{c.food}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <Text style={{ color: p.textSecondary, fontSize: 12.5 }}>Photo: {c.author}</Text>
            <Text style={{ color: p.accent, fontSize: 12.5, fontWeight: '700' }}>· {c.license}</Text>
          </View>
        </Pressable>
      ))}
    </BackPage>
  );
}
