// User dashboard.

import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { Avatar, Button, Card, Page, SectionTitle } from '@/components/ui/UI';
import { USER as p } from '@/theme/palettes';

export default function UserHome() {
  const { user } = useAuth();
  if (!user) return null;
  const first = user.displayName?.split(' ')[0] || 'there';

  return (
    <Page p={p} kicker="FITZONE" title={`Hi, ${first} 👋`}>
      <Card p={p} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Avatar p={p} name={user.displayName || user.email} size={52} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ color: p.text, fontSize: 17, fontWeight: '800' }}>{user.displayName || user.email}</Text>
          <Text style={{ color: p.textSecondary }}>{user.email}</Text>
        </View>
      </Card>

      {user.profileCompleted ? (
        <Card p={p} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Ionicons name="clipboard-outline" size={24} color={p.accent} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: p.text, fontSize: 15, fontWeight: '700' }}>Fitness profile</Text>
            <Text style={{ color: p.textSecondary, fontSize: 13 }}>Your goals, BMI, routine, food and sleep.</Text>
          </View>
          <Button p={p} small kind="outline" label="View" onPress={() => router.push('/profile-setup')} />
        </Card>
      ) : (
        <Card p={p} style={{ gap: 12, borderColor: p.accent + '88' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Ionicons name="clipboard-outline" size={26} color={p.accent} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: p.text, fontSize: 16, fontWeight: '800' }}>Complete your fitness profile</Text>
              <Text style={{ color: p.textSecondary, fontSize: 13.5, marginTop: 2 }}>
                About 3 minutes. Helps your trainer plan workouts and nutrition for you.
              </Text>
            </View>
          </View>
          <Button p={p} label="Continue profile" icon="arrow-forward" onPress={() => router.push('/profile-setup')} />
        </Card>
      )}

      <SectionTitle p={p}>My coach</SectionTitle>
      <Card p={p} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Ionicons name="barbell-outline" size={24} color={p.accent} />
        <Text style={{ color: p.text, fontSize: 15, flex: 1 }}>
          {user.trainerName ? `Your trainer is ${user.trainerName}.` : 'A trainer will be assigned to you soon.'}
        </Text>
      </Card>

      <SectionTitle p={p}>Coming soon</SectionTitle>
      <Card p={p} style={{ gap: 10 }}>
        {[
          ['fitness-outline', 'Daily workouts from your trainer'],
          ['nutrition-outline', 'Nutrition plans'],
          ['chatbubbles-outline', 'Chat with your trainer'],
          ['trending-up-outline', 'Progress tracking'],
        ].map(([icon, text]) => (
          <View key={text} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={19} color={p.textSecondary} />
            <Text style={{ color: p.textSecondary, fontSize: 14 }}>{text}</Text>
          </View>
        ))}
      </Card>

      <Button p={p} kind="outline" label="Edit my profile" icon="create-outline" onPress={() => router.push('/more')} />
    </Page>
  );
}
