// Video player for phones (Android / iPhone). The website uses VideoPlayer.web.tsx.
// Uploaded videos play in expo-video's native player (with fullscreen);
// YouTube links play in YouTube's own embedded player inside a WebView.

import { StyleSheet, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { WebView } from 'react-native-webview';
import { youtubeId, type VideoSource } from '@/lib/workouts';

// YouTube needs a real web page address as the embed's origin.
const EMBED_ORIGIN = 'https://fitzone.upgrowa.cloud';

export function VideoPlayer({ source, url }: { source: VideoSource; url: string }) {
  return (
    <View style={st.frame}>
      {source === 'youtube' ? <YouTube url={url} /> : <FileVideo url={url} />}
    </View>
  );
}

function FileVideo({ url }: { url: string }) {
  const player = useVideoPlayer(url, (p) => { p.loop = false; });
  return (
    <VideoView player={player} style={StyleSheet.absoluteFill} nativeControls contentFit="contain"
      fullscreenOptions={{ enable: true }} />
  );
}

function YouTube({ url }: { url: string }) {
  const id = youtubeId(url);
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:#000}iframe{position:fixed;inset:0;width:100%;height:100%;border:0}</style></head>
<body><iframe src="https://www.youtube-nocookie.com/embed/${id}?playsinline=1&rel=0&modestbranding=1"
allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></body></html>`;
  return (
    <WebView source={{ html, baseUrl: EMBED_ORIGIN }} style={{ flex: 1, backgroundColor: '#000' }}
      allowsFullscreenVideo allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false} />
  );
}

const st = StyleSheet.create({
  frame: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000', borderRadius: 16, overflow: 'hidden' },
});
