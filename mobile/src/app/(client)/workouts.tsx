// User → Workouts: the workouts their trainer sent (today, upcoming, earlier).
// Tap one to watch the videos and mark them done.

import { Text, View } from 'react-native';
import { useApi } from '@/lib/useApi';
import { workouts } from '@/lib/workouts';
import { WorkoutSections } from '@/components/library/WorkoutList';
import { Card, Notice, Page } from '@/components/ui/UI';
import { Loading } from '@/components/staff/DashboardUI';
import { USER as p } from '@/theme/palettes';

export default function UserWorkouts() {
  const data = useApi(() => workouts.of('me'));
  const list = data.data ?? [];
  const done = list.filter((w) => w.completed).length;
  return (
    <Page p={p} kicker="FITZONE" title="My Workouts" onRefresh={data.reload} refreshing={data.loading && !!data.data}>
      {data.error && <Notice text={data.error} />}
      {!data.data && !data.error && <Loading />}
      {data.data && list.length > 0 && (
        <Card p={p} style={{ flexDirection: 'row', gap: 10 }}>
          <Stat label="Sent to you" value={list.length} />
          <Stat label="Completed" value={done} />
          <Stat label="To do" value={list.length - done} />
        </Card>
      )}
      {data.data && <WorkoutSections p={p} list={list} emptyText="No workouts yet. Your trainer will send them here." />}
    </Page>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Text style={{ color: p.text, fontSize: 22, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: p.textSecondary, fontSize: 12.5 }}>{label}</Text>
    </View>
  );
}
