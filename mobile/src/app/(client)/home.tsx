// User dashboard.

import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { Avatar, Button, Card, Page, SectionTitle } from '@/components/ui/UI';
import { useApi } from '@/lib/useApi';
import { todayKey, workouts } from '@/lib/workouts';
import { plansApi } from '@/lib/nutrition';
import { WorkoutRow } from '@/components/library/WorkoutList';
import { USER as p } from '@/theme/palettes';

export default function UserHome() {
  const { user } = useAuth();
  const list = useApi(() => workouts.of('me'));
  const diet = useApi(() => plansApi.of('me'));
  if (!user) return null;
  const today = todayKey();
  const todays = (list.data ?? []).filter((w) => w.date === today);
  const next = (list.data ?? []).filter((w) => w.date > today).sort((a, b) => a.date.localeCompare(b.date))[0];
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

      <SectionTitle p={p} right={<Button p={p} small kind="outline" label="All workouts" onPress={() => router.push('/workouts')} />}>
        Today&apos;s workout
      </SectionTitle>
      {todays.length > 0 ? todays.map((w) => <WorkoutRow key={w.id} p={p} w={w} />) : (
        <Card p={p} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Ionicons name="barbell-outline" size={24} color={p.textSecondary} />
          <Text style={{ color: p.textSecondary, fontSize: 14, flex: 1 }}>
            {list.data === null ? 'Loading…' : next ? 'No workout today. Your next one is below.' : 'No workout for today. Your trainer will send workouts here.'}
          </Text>
        </Card>
      )}
      {todays.length === 0 && next && <WorkoutRow p={p} w={next} />}

      <SectionTitle p={p}>My nutrition</SectionTitle>
      <Card p={p} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Ionicons name="nutrition-outline" size={24} color={diet.data?.current ? p.accent : p.textSecondary} />
        <View style={{ flex: 1 }}>
          {diet.data?.current ? (
            <>
              <Text style={{ color: p.text, fontSize: 15, fontWeight: '700' }}>{diet.data.current.title}</Text>
              <Text style={{ color: p.textSecondary, fontSize: 13 }}>
                {diet.data.current.totals.calories} kcal a day · protein {diet.data.current.totals.protein} g
              </Text>
            </>
          ) : (
            <Text style={{ color: p.textSecondary, fontSize: 14 }}>
              {diet.data === null ? 'Loading…' : 'No nutrition plan yet. Your trainer will send it here.'}
            </Text>
          )}
        </View>
        {diet.data?.current && <Button p={p} small kind="outline" label="View" onPress={() => router.push('/nutrition')} />}
      </Card>

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
