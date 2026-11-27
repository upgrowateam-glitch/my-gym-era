// One workout video as a card: cover picture, duration, title, category,
// difficulty and body parts. Used in the Library and when choosing videos.

import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { bodyPartsText, difficultyOf, type WorkoutVideo } from '@/lib/workouts';
import type { Palette } from '@/components/ui/UI';

export function VideoThumb({ p, video, height = 150 }: {
  p: Palette; video: Pick<WorkoutVideo, 'thumbnailUrl' | 'source' | 'durationMinutes'>; height?: number;
}) {
  const small = height < 90; // tiny thumbnail in lists: just the play icon
  return (
    <View style={{ height, backgroundColor: p.elevated, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {video.thumbnailUrl
        ? <Image source={{ uri: video.thumbnailUrl }} style={{ position: 'absolute', inset: 0 }} contentFit="cover" />
        : <Ionicons name="film-outline" size={34} color={p.textSecondary} />}
      <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center', width: small ? 28 : 44, height: small ? 28 : 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.55)' }}>
        <Ionicons name="play" size={small ? 14 : 22} color="#fff" style={{ marginLeft: small ? 2 : 3 }} />
      </View>
      {!small && (
        <View style={{ position: 'absolute', right: 8, bottom: 8, flexDirection: 'row', gap: 6 }}>
          {video.source === 'youtube' && <Tag text="YouTube" />}
          <Tag text={`${video.durationMinutes} min`} />
        </View>
      )}
    </View>
  );
}

function Tag({ text }: { text: string }) {
  return (
    <View style={{ backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
      <Text style={{ color: '#fff', fontSize: 11.5, fontWeight: '700' }}>{text}</Text>
    </View>
  );
}

export function DifficultyBadge({ value }: { value: WorkoutVideo['difficulty'] }) {
  const d = difficultyOf(value);
  return (
    <View style={{ borderWidth: 1, borderColor: d.color + '77', backgroundColor: d.color + '1F', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
      <Text style={{ color: d.color, fontSize: 11.5, fontWeight: '800' }}>{d.label}</Text>
    </View>
  );
}

export function VideoCard({ p, video, onPress, selected, compact }: {
  p: Palette; video: WorkoutVideo; onPress: () => void; selected?: boolean; compact?: boolean;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={selected !== undefined ? { checked: selected } : undefined}
      style={({ pressed }) => ({
        flexGrow: 1, flexBasis: compact ? 240 : 260, maxWidth: compact ? 340 : 420, borderRadius: 18, overflow: 'hidden',
        borderWidth: selected ? 2 : 1, borderColor: selected ? p.accent : p.border, backgroundColor: p.card, opacity: pressed ? 0.88 : 1,
      })}>
      <VideoThumb p={p} video={video} height={compact ? 120 : 150} />
      <View style={{ padding: 12, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          <Text style={{ flex: 1, color: p.text, fontSize: 15, fontWeight: '800' }} numberOfLines={2}>{video.title}</Text>
          {selected !== undefined && (
            <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={selected ? p.accent : p.textSecondary} />
          )}
        </View>
        <Text style={{ color: p.textSecondary, fontSize: 12.5 }} numberOfLines={1}>
          {video.categoryName} · {bodyPartsText(video.bodyParts)}
        </Text>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <DifficultyBadge value={video.difficulty} />
          {video.equipment ? <Text style={{ color: p.textSecondary, fontSize: 12 }} numberOfLines={1}>{video.equipment}</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}
