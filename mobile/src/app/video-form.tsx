// Add or edit a library video (Super Admin / Admins). /video-form or /video-form?id=<video>
// A video is either an uploaded file (from the phone's gallery or the computer)
// or a YouTube link, plus category, difficulty, duration and body parts.

import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { ApiError } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import {
  BODY_PARTS, DIFFICULTIES, library, uploadFile, youtubeId, type BodyPart, type Category, type Difficulty, type VideoSource, type WorkoutVideo,
} from '@/lib/workouts';
import { RequireRole } from '@/components/RequireRole';
import { BackPage } from '@/components/staff/BackPage';
import { Button, Card, Chips, Field, Notice } from '@/components/ui/UI';
import { Loading } from '@/components/staff/DashboardUI';
import { SUPER as p } from '@/theme/palettes';

export default function VideoFormRoute() {
  return (
    <RequireRole roles={['super_admin', 'admin']}>
      <VideoFormPage />
    </RequireRole>
  );
}

function VideoFormPage() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const data = useApi(async () => ({
    categories: await library.categories(),
    video: id ? await library.video(id) : null,
  }));
  return (
    <BackPage p={p} kicker="WORKOUT LIBRARY" title={id ? 'Edit video' : 'Add video'} maxWidth={760}>
      {data.error && <Notice text={data.error} />}
      {!data.data && !data.error && <Loading />}
      {data.data && <VideoForm categories={data.data.categories} video={data.data.video} />}
    </BackPage>
  );
}

function VideoForm({ categories, video }: { categories: Category[]; video: WorkoutVideo | null }) {
  const [title, setTitle] = useState(video?.title ?? '');
  const [categoryId, setCategoryId] = useState(video?.categoryId ?? categories[0]?.id ?? '');
  const [source, setSource] = useState<VideoSource>(video?.source ?? 'upload');
  const [youtube, setYoutube] = useState(video?.source === 'youtube' ? video.videoUrl : '');
  const [fileUrl, setFileUrl] = useState(video?.source === 'upload' ? video.videoUrl : '');
  const [fileName, setFileName] = useState<string | null>(null);
  const [cover, setCover] = useState<string | null>(video?.source === 'upload' ? video.thumbnailUrl : null);
  const [difficulty, setDifficulty] = useState<Difficulty>(video?.difficulty ?? 'beginner');
  const [duration, setDuration] = useState(video ? String(video.durationMinutes) : '');
  const [bodyParts, setBodyParts] = useState<BodyPart[]>(video?.bodyParts ?? []);
  const [equipment, setEquipment] = useState(video?.equipment ?? '');
  const [description, setDescription] = useState(video?.description ?? '');
  const [uploading, setUploading] = useState<'video' | 'cover' | null>(null);
  const [progress, setProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (categories.length === 0) {
    return (
      <Card p={p} style={{ gap: 12 }}>
        <Text style={{ color: p.text, fontSize: 15 }}>Add a category first (for example &quot;Strength&quot; or &quot;Cardio&quot;).</Text>
        <Button p={p} label="Back to the library" icon="chevron-back" onPress={() => router.back()} />
      </Card>
    );
  }

  const ytId = youtubeId(youtube);

  async function pick(kind: 'video' | 'cover') {
    setError(null);
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: kind === 'video' ? ['videos'] : ['images'], quality: 0.8 });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    setUploading(kind);
    setProgress(0);
    try {
      const url = await uploadFile(asset, 'workouts', setProgress);
      if (kind === 'video') {
        setFileUrl(url);
        setFileName(asset.fileName ?? 'Video uploaded');
        if (!duration && asset.duration) setDuration(String(Math.max(1, Math.round(asset.duration / 60000))));
      } else {
        setCover(url);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(null);
    }
  }

  async function save() {
    setError(null);
    if (!title.trim()) return setError('Please enter a title.');
    if (source === 'youtube' && !ytId) return setError('Paste a YouTube video link (for example https://youtu.be/...).');
    if (source === 'upload' && !fileUrl) return setError('Choose a video file to upload.');
    const minutes = Number(duration);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 300) return setError('Duration must be a whole number of minutes (1–300).');
    if (bodyParts.length === 0) return setError('Choose at least one body part.');
    setSaving(true);
    try {
      const saved = await library.saveVideo(video?.id ?? null, {
        title: title.trim(), categoryId, source, difficulty, durationMinutes: minutes, bodyParts,
        equipment: equipment.trim(), description: description.trim(),
        videoUrl: source === 'youtube' ? youtube.trim() : fileUrl,
        thumbnailUrl: source === 'upload' ? cover : null,
      });
      router.replace(`/video/${saved.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ gap: 16 }}>
      <Card p={p} style={{ gap: 14 }}>
        <Field p={p} label="Title" icon="text-outline" value={title} onChangeText={setTitle} placeholder="e.g. Push-ups" maxLength={120} />
        <Label text="Category" />
        <Chips p={p} value={categoryId} onChange={setCategoryId} options={categories.map((c) => ({ value: c.id, label: c.name }))} />
      </Card>

      <Card p={p} style={{ gap: 14 }}>
        <Label text="Video" />
        <Chips p={p} value={source} onChange={setSource} options={[
          { value: 'upload' as const, label: 'Upload a file' }, { value: 'youtube' as const, label: 'YouTube link' },
        ]} />
        {source === 'youtube' ? (
          <>
            <Field p={p} label="YouTube link" icon="logo-youtube" value={youtube} onChangeText={setYoutube}
              placeholder="https://youtu.be/..." autoCapitalize="none" keyboardType="url" />
            {youtube.trim() !== '' && (ytId
              ? <Image source={{ uri: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` }} style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 14 }} contentFit="cover" />
              : <Text style={{ color: '#EF9A9A', fontSize: 13 }}>That does not look like a YouTube video link.</Text>)}
            <Text style={{ color: p.textSecondary, fontSize: 12.5 }}>Tip: upload to YouTube as &quot;Unlisted&quot; so only people with the link can see it.</Text>
          </>
        ) : (
          <>
            <UploadBox icon="film-outline" label={fileUrl ? (fileName ?? 'Video uploaded') : 'Choose a video'}
              detail={fileUrl ? 'Tap to replace the video' : 'From your gallery or computer · up to 200 MB'}
              done={!!fileUrl} busy={uploading === 'video'} onPress={() => pick('video')}
              busyText={`Uploading… ${Math.round(progress * 100)}%`} />
            {uploading === 'video' && (
              <View style={{ gap: 6 }}>
                <View style={{ height: 8, borderRadius: 4, backgroundColor: p.elevated, overflow: 'hidden' }}>
                  <View style={{ height: 8, width: `${Math.round(progress * 100)}%`, backgroundColor: p.accent }} />
                </View>
                <Text style={{ color: p.textSecondary, fontSize: 12.5 }}>
                  Uploading… {Math.round(progress * 100)}% · keep this screen open. Wi-Fi is fastest; on mobile data it keeps going if the signal drops briefly.
                </Text>
              </View>
            )}
            <UploadBox icon="image-outline" label={cover ? 'Cover picture added' : 'Add a cover picture (optional)'}
              detail="Shown on the video card" done={!!cover} busy={uploading === 'cover'} onPress={() => pick('cover')} />
            {cover && <Image source={{ uri: cover }} style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 14 }} contentFit="cover" />}
          </>
        )}
      </Card>

      <Card p={p} style={{ gap: 14 }}>
        <Label text="Difficulty" />
        <Chips p={p} value={difficulty} onChange={setDifficulty} options={DIFFICULTIES.map((d) => ({ value: d.value, label: d.label }))} />
        <Field p={p} label="Duration (minutes)" icon="time-outline" value={duration} keyboardType="number-pad" maxLength={3}
          onChangeText={(t) => setDuration(t.replace(/\D/g, ''))} placeholder="e.g. 10" />
        <Label text="Body parts (choose all that apply)" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {BODY_PARTS.map((b) => {
            const on = bodyParts.includes(b.value);
            return (
              <Pressable key={b.value} onPress={() => setBodyParts(on ? bodyParts.filter((x) => x !== b.value) : [...bodyParts, b.value])}
                accessibilityRole="checkbox" accessibilityState={{ checked: on }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
                  borderWidth: 1, borderColor: on ? p.accent : p.border, backgroundColor: on ? p.accent + '22' : p.elevated }}>
                <Ionicons name={on ? 'checkmark-circle' : b.icon} size={16} color={on ? p.accent : p.textSecondary} />
                <Text style={{ color: on ? p.accent : p.text, fontWeight: '700', fontSize: 13.5 }}>{b.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Field p={p} label="Equipment (optional)" icon="barbell-outline" value={equipment} onChangeText={setEquipment}
          placeholder="e.g. Dumbbells, mat" maxLength={120} />
        <Field p={p} label="How to do it (optional)" icon="document-text-outline" value={description} onChangeText={setDescription}
          placeholder="Steps, tips, common mistakes" multiline maxLength={2000}
          style={{ flex: 1, color: p.text, fontSize: 15.5, paddingVertical: 12, minHeight: 90, textAlignVertical: 'top', outlineStyle: 'none' } as never} />
      </Card>

      {error && <Notice text={error} />}
      <Button p={p} label={video ? 'Save changes' : 'Add to library'} icon="checkmark" loading={saving} disabled={!!uploading} onPress={save} />
    </View>
  );
}

function Label({ text }: { text: string }) {
  return <Text style={{ color: p.textSecondary, fontSize: 12.5, fontWeight: '700', letterSpacing: 0.3 }}>{text}</Text>;
}

function UploadBox({ icon, label, detail, done, busy, onPress, busyText = 'Uploading…' }: {
  icon: 'film-outline' | 'image-outline'; label: string; detail: string; done: boolean; busy: boolean; onPress: () => void; busyText?: string;
}) {
  return (
    <Pressable onPress={onPress} disabled={busy} accessibilityRole="button"
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed',
        borderColor: done ? p.accent : p.border, backgroundColor: pressed ? p.elevated : 'transparent', opacity: busy ? 0.6 : 1,
      })}>
      <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: p.accent + '22' }}>
        <Ionicons name={busy ? 'cloud-upload-outline' : done ? 'checkmark' : icon} size={22} color={p.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: p.text, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>{busy ? busyText : label}</Text>
        <Text style={{ color: p.textSecondary, fontSize: 12.5 }}>{detail}</Text>
      </View>
    </Pressable>
  );
}
