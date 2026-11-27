// One library video (staff): watch it and see its details.
// Super Admin / Admins: Edit, Delete. Trainers (and admins): "Send in a workout".

import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { confirm } from '@/lib/confirm';
import { bodyPartLabel, library } from '@/lib/workouts';
import { RequireRole } from '@/components/RequireRole';
import { VideoPlayer } from '@/components/VideoPlayer';
import { DifficultyBadge } from '@/components/library/VideoCard';
import { BackPage } from '@/components/staff/BackPage';
import { Badge, Button, Card, Notice } from '@/components/ui/UI';
import { Loading } from '@/components/staff/DashboardUI';
import { SUPER as p } from '@/theme/palettes';
import { useState } from 'react';

export default function VideoRoute() {
  return (
    <RequireRole roles={['super_admin', 'admin', 'trainer']}>
      <VideoPage />
    </RequireRole>
  );
}

function VideoPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const canEdit = user?.role === 'super_admin' || user?.role === 'admin';
  const data = useApi(() => library.video(id));
  const v = data.data;
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!v) return;
    if (!(await confirm(`Delete "${v.title}"?`, 'It will be removed from the library. Workouts already sent keep its name.', 'Delete'))) return;
    try {
      await library.deleteVideo(v.id);
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not delete the video.');
    }
  }

  return (
    <BackPage p={p} onRefresh={data.reload} refreshing={data.loading && !!v} maxWidth={900}>
      {data.error && <Notice text={data.error} />}
      {!v && !data.error && <Loading />}
      {v && (
        <>
          <VideoPlayer source={v.source} url={v.videoUrl} />
          <View style={{ gap: 6 }}>
            <Text style={{ color: p.accent, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 }}>{v.categoryName.toUpperCase()}</Text>
            <Text style={{ color: p.text, fontSize: 24, fontWeight: '800' }}>{v.title}</Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <DifficultyBadge value={v.difficulty} />
              <Badge label={`${v.durationMinutes} min`} tone="pending" />
              {v.source === 'youtube' && <Badge label="YouTube" tone="expired" />}
            </View>
          </View>
          {error && <Notice text={error} />}
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            <Button p={p} label="Send in a workout" icon="paper-plane-outline"
              onPress={() => router.push({ pathname: '/send-workout', params: { videoId: v.id } })} />
            {canEdit && <Button p={p} kind="outline" label="Edit" icon="create-outline" onPress={() => router.push({ pathname: '/video-form', params: { id: v.id } })} />}
            {canEdit && <Button p={p} kind="danger" label="Delete" icon="trash-outline" onPress={remove} />}
          </View>
          <Card p={p} style={{ gap: 10 }}>
            <Row label="Body parts" value={v.bodyParts.map(bodyPartLabel).join(', ')} />
            <Row label="Equipment" value={v.equipment || 'None'} />
            <Row label="Duration" value={`${v.durationMinutes} minutes`} />
            {v.description ? (
              <View style={{ gap: 4, marginTop: 4 }}>
                <Text style={{ color: p.textSecondary, fontSize: 13 }}>How to do it</Text>
                <Text style={{ color: p.text, fontSize: 15, lineHeight: 22 }}>{v.description}</Text>
              </View>
            ) : null}
          </Card>
        </>
      )}
    </BackPage>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
      <Text style={{ color: p.textSecondary, fontSize: 13.5, width: 110 }}>{label}</Text>
      <Text style={{ color: p.text, fontSize: 14.5, fontWeight: '600', flex: 1, minWidth: 140 }}>{value}</Text>
    </View>
  );
}
