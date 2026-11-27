// FitZone splash screen — shown once each time the app starts (~1.5 s).
// While it plays, the saved login is checked; then the visitor goes to:
//   signed in      -> their dashboard
//   not signed in  -> /welcome (the 3 welcome slides, every time), then /login
// Later visits to "/" in the same session (e.g. right after logging in)
// skip the animation and route straight away.

import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Redirect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { homeRouteFor, useAuth } from '@/lib/auth';
import { useFitZoneFonts } from '@/lib/fonts';
import { LoadingScreen } from '@/components/LoadingScreen';
import { FitZoneBackdrop, FitZoneLogo, Glow } from '@/components/fitzone/Brand';
import { fitzone as c, font } from '@/theme/colors';

const SPLASH_MS = 1500;
let splashPlayed = false; // per app start (module memory resets when the app restarts)

export default function Index() {
  const { loading, user } = useAuth();
  const [playing] = useState(!splashPlayed); // decided once, when the screen first appears
  const [timeUp, setTimeUp] = useState(!playing);

  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => { splashPlayed = true; setTimeUp(true); }, SPLASH_MS);
    return () => clearTimeout(t);
  }, [playing]);

  if (timeUp && !loading) {
    return <Redirect href={user ? homeRouteFor(user) : '/welcome'} />;
  }
  return playing ? <Splash /> : <LoadingScreen color={c.mint} background={c.bg} />;
}

function Splash() {
  const fontsReady = useFitZoneFonts();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const w = Math.min(screenW, 480);
  const [fade] = useState(() => new Animated.Value(0));
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: SPLASH_MS, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
  }, [progress]);

  useEffect(() => {
    if (fontsReady) Animated.timing(fade, { toValue: 1, duration: 350, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [fontsReady, fade]);

  const art = Math.min(w * 0.72, screenH * 0.32, 330);
  const barW = Math.min(w * 0.42, 180);

  return (
    <View style={styles.root}>
      <FitZoneBackdrop />
      <SafeAreaView style={styles.safe}>
        {fontsReady && (
          <Animated.View style={[styles.column, { width: w, opacity: fade }]}>
            <View style={styles.top}>
              <FitZoneLogo size={Math.min(40, w * 0.1)} />
              <Text style={styles.motto}>TRAIN  •  TRANSFORM  •  THRIVE</Text>
            </View>

            <View style={[styles.artBox, { height: art * 0.8 }]}>
              <Glow width={art * 1.5} height={art * 0.9} opacity={0.3} />
              <Glow width={art * 1.1} height={art * 0.16} opacity={0.5} style={{ bottom: art * 0.02 }} />
              <Image
                source={require('../../assets/fitzone/equipment/dumbbell.png')}
                contentFit="contain"
                style={{ width: art, height: art * (467 / 778) }}
                accessibilityIgnoresInvertColors
              />
            </View>

            <View style={styles.bottom}>
              <Text style={styles.quote}>
                A healthier you is a <Text style={{ color: c.mint }}>stronger you</Text>
              </Text>
              <View style={[styles.track, { width: barW }]}>
                <Animated.View
                  style={[styles.fill, { width: progress.interpolate({ inputRange: [0, 1], outputRange: [0, barW] }) }]}
                />
              </View>
            </View>
          </Animated.View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  safe: { flex: 1, alignItems: 'center' },
  column: { flex: 1, paddingHorizontal: 24, paddingVertical: 28, alignItems: 'center', justifyContent: 'space-between' },
  top: { alignItems: 'center', gap: 16, marginTop: '14%' },
  motto: { color: c.textSecondary, fontFamily: font.medium, fontSize: 12.5, letterSpacing: 2.6 },
  artBox: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  bottom: { alignItems: 'center', gap: 22, marginBottom: 12 },
  quote: { color: c.text, fontFamily: font.semibold, fontSize: 18, textAlign: 'center' },
  track: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.10)', overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2, backgroundColor: c.mint },
});
