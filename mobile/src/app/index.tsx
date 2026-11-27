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
import { GOLD } from '@/components/auth/AuthUI';
import { fitzone as c, font } from '@/theme/colors';

const SPLASH_MS = 1500;
const LOGO = require('../../assets/brand/logo.png');
/** Background of the logo picture (and of the phone's own start screen, app.json). */
const LOGO_BG = '#202020';
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
  return playing ? <Splash /> : <LoadingScreen color={GOLD.main} background={c.bg} />;
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

  const logo = Math.min(w * 0.82, screenH * 0.46, 380);
  const barW = Math.min(w * 0.42, 180);

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <View style={[styles.column, { width: w }]}>
          <View style={{ flex: 1 }} />
          {/* The logo shows straight away, so it follows on from the phone's own start screen. */}
          <View style={[styles.logoBox, { width: logo, height: logo }]}>
            <Image source={LOGO} contentFit="contain" style={{ width: logo, height: logo }}
              accessibilityLabel="FitZone" />
          </View>

          <Animated.View style={[styles.bottom, { opacity: fade, flex: 1 }]}>
            {fontsReady && <>
              <Text style={styles.motto}>TRAIN  •  TRANSFORM  •  THRIVE</Text>
              <View style={{ flex: 1 }} />
              <Text style={styles.quote}>
                A healthier you is a <Text style={{ color: GOLD.main }}>stronger you</Text>
              </Text>
              <View style={[styles.track, { width: barW }]}>
                <Animated.View
                  style={[styles.fill, { width: progress.interpolate({ inputRange: [0, 1], outputRange: [0, barW] }) }]}
                />
              </View>
            </>}
          </Animated.View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: LOGO_BG },
  safe: { flex: 1, alignItems: 'center' },
  column: { flex: 1, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 40, alignItems: 'center' },
  logoBox: { alignItems: 'center', justifyContent: 'center' },
  motto: { color: GOLD.light, fontFamily: font.medium, fontSize: 12.5, letterSpacing: 2.6, marginTop: 8 },
  bottom: { alignItems: 'center', gap: 22, alignSelf: 'stretch' },
  quote: { color: c.text, fontFamily: font.semibold, fontSize: 18, textAlign: 'center' },
  track: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.10)', overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2, backgroundColor: GOLD.main },
});
