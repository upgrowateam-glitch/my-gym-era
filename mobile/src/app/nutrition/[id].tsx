// One nutrition plan: daily totals and each meal's foods. The User sees their
// own; their trainer / admins see it too and can edit (send a new version) or delete it.

import { useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { confirm } from '@/lib/confirm';
import { plansApi } from '@/lib/nutrition';
import { RequireRole } from '@/components/RequireRole';
import { BackPage } from '@/components/staff/BackPage';
import { PlanView } from '@/components/nutrition/NutritionUI';
import { Button, Notice } from '@/components/ui/UI';
import { Loading } from '@/components/staff/DashboardUI';
import { SUPER as p } from '@/theme/palettes';

export default function NutritionPlanViewRoute() {
  return (
    <RequireRole roles={['client', 'trainer', 'admin', 'super_admin']}>
      <PlanPage />
    </RequireRole>
  );
}

function PlanPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const data = useApi(() => plansApi.get(id));
  const plan = data.data;
  const isUser = !!plan && plan.userId === user?.uid;
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!plan || !(await confirm(`Delete "${plan.title}"?`, 'The user will no longer see this plan. Their previous plan (if any) becomes current again.', 'Delete'))) return;
    try {
      await plansApi.remove(plan.id);
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not delete the plan.');
    }
  }

  return (
    <BackPage p={p} onRefresh={data.reload} refreshing={data.loading && !!plan} maxWidth={820} fallback={user?.role === 'client' ? '/nutrition' : undefined}>
      {data.error && <Notice text={data.error} />}
      {!plan && !data.error && <Loading />}
      {plan && (
        <>
          <View>
            <Text style={{ color: p.accent, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 }}>NUTRITION PLAN</Text>
            <Text style={{ color: p.text, fontSize: 24, fontWeight: '800' }}>{plan.title}</Text>
            <Text style={{ color: p.textSecondary, fontSize: 13.5 }}>
              {new Date(plan.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              {plan.sentByName ? ` · from ${plan.sentByName}` : ''}
            </Text>
          </View>
          {error && <Notice text={error} />}
          <PlanView p={p} plan={plan} />
          {!isUser && (
            <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
              <Button p={p} label="Edit and send a new version" icon="create-outline"
                onPress={() => router.push({ pathname: '/nutrition-plan', params: { userId: plan.userId } })} />
              <Button p={p} kind="danger" label="Delete" icon="trash-outline" onPress={remove} />
            </View>
          )}
        </>
      )}
    </BackPage>
  );
}
