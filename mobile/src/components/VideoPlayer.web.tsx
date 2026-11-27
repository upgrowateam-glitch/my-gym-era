// Video player for the website (phones use VideoPlayer.tsx).
// Uploaded videos: the browser's own <video> player. YouTube: the embedded player.

import { createElement } from 'react';
import { StyleSheet, View } from 'react-native';
import { youtubeId, type VideoSource } from '@/lib/workouts';

export function VideoPlayer({ source, url }: { source: VideoSource; url: string }) {
  const full = { position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, background: '#000' };
  return (
    <View style={st.frame}>
      {source === 'youtube'
        ? createElement('iframe', {
          src: `https://www.youtube-nocookie.com/embed/${youtubeId(url)}?rel=0&modestbranding=1`,
          allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen',
          allowFullScreen: true,
          style: full,
          title: 'Workout video',
        })
        : createElement('video', { src: url, controls: true, playsInline: true, preload: 'metadata', style: full })}
    </View>
  );
}

const st = StyleSheet.create({
  frame: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000', borderRadius: 16, overflow: 'hidden' },
});
