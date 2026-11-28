// User → Nutrition: their current diet plan from the trainer (daily totals and
// each meal), plus earlier plans.

import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useApi } from '@/lib/useApi';
import { plansApi } from '@/lib/nutrition';
import { PlanView } from '@/components/nutrition/NutritionUI';
import { Notice, Page, SectionTitle } from '@/components/ui/UI';
import { Loading } from '@/components/staff/DashboardUI';
import { USER as p } from '@/theme/palettes';

export default function UserNutrition() {
  const data = useApi(() => plansApi.of('me'));
  const current = data.data?.current ?? null;
  const history = data.data?.history ?? [];
  return (
    <Page p={p} kicker="FITZONE" title="My Nutrition" onRefresh={data.reload} refreshing={data.loading && !!data.data}>
      {data.error && <Notice text={data.error} />}
      {!data.data && !data.error && <Loading />}
      {data.data && !current && (
        <View style={{ alignItems: 'center', gap: 10, paddingVertical: 30 }}>
          <Ionicons name="nutrition-outline" size={34} color={p.textSecondary} />
          <Text style={{ color: p.textSecondary, textAlign: 'center' }}>No nutrition plan yet. Your trainer will send it here.</Text>
        </View>
      )}
      {current && (
        <>
          <View>
            <Text style={{ color: p.text, fontSize: 19, fontWeight: '800' }}>{current.title}</Text>
            <Text style={{ color: p.textSecondary, fontSize: 13 }}>
              Your plan for every day{current.sentByName ? ` · from ${current.sentByName}` : ''} · since{' '}
              {new Date(current.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </Text>
          </View>
          <PlanView p={p} plan={current} />
        </>
      )}
      {history.length > 0 && (
        <>
          <SectionTitle p={p}>Earlier plans</SectionTitle>
          {history.map((h) => (
            <Pressable key={h.id} onPress={() => router.push(`/nutrition/${h.id}`)} accessibilityRole="button"
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1,
                borderColor: p.border, backgroundColor: pressed ? p.elevated : p.card })}>
              <Ionicons name="document-text-outline" size={20} color={p.textSecondary} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: p.text, fontWeight: '700' }} numberOfLines={1}>{h.title}</Text>
                <Text style={{ color: p.textSecondary, fontSize: 12.5 }}>
                  {new Date(h.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · {h.totals.calories} kcal
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={p.textSecondary} />
            </Pressable>
          ))}
        </>
      )}
    </Page>
  );
}
