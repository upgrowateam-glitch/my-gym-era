// FitZone welcome slides: three full-screen gym photos (STRENGTH, PROGRESS,
// CONSISTENCY — the titles are part of the photos, assets/welcome/*.jpg).
// Swipe or tap Next; Skip (slides 1–2) and Get Started (slide 3) open the login page.
// Shown every time the app opens for someone who is not signed in (see app/index.tsx).

import { useRef, useState } from 'react';
import {
  Pressable, ScrollView, StyleSheet, Text, View,
  type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewInstance,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFitZoneFonts } from '@/lib/fonts';
import { GOLD } from '@/components/auth/AuthUI';
import { fitzone as c, font } from '@/theme/colors';

const MAX_W = 520; // on wide screens (web) the slides stay phone-width

const SLIDES = [
  { image: require('../../assets/welcome/strength.jpg'), label: 'Strength: unleash your potential' },
  { image: require('../../assets/welcome/progress.jpg'), label: 'Progress: track every lift' },
  { image: require('../../assets/welcome/consistency.jpg'), label: 'Consistency: stay the course' },
];

export default function Welcome() {
  useFitZoneFonts();
  // Slide width = the measured width of the column (0 until measured, so the
  // slides never show a strip of the next photo).
  const [pageW, setPageW] = useState(0);
  const [index, setIndex] = useState(0);
  const scroller = useRef<ScrollViewInstance>(null);
  const leaving = useRef(false);
  const last = index === SLIDES.length - 1;

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!pageW) return;
    const i = Math.round(e.nativeEvent.contentOffset.x / pageW);
    if (i !== index && i >= 0 && i < SLIDES.length) setIndex(i);
  }

  function goTo(i: number) {
    scroller.current?.scrollTo({ x: i * pageW, animated: true });
    setIndex(i);
  }

  function finish() {
    if (leaving.current) return;
    leaving.current = true;
    router.replace('/login');
  }

  function onPagerLayout(e: LayoutChangeEvent) {
    const w = e.nativeEvent.layout.width;
    if (w && Math.abs(w - pageW) > 1) {
      setPageW(w);
      requestAnimationFrame(() => scroller.current?.scrollTo({ x: index * w, animated: false }));
    }
  }

  return (
    <View style={styles.root}>
      <View style={[styles.column, { maxWidth: MAX_W }]} onLayout={onPagerLayout}>
        {pageW > 0 && <ScrollView
          ref={scroller}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          style={StyleSheet.absoluteFill}
        >
          {SLIDES.map((s, i) => (
            <View key={i} style={{ width: pageW, height: '100%' }} accessible accessibilityLabel={s.label}>
              {/* Anchored to the bottom so the title in the photo stays visible on shorter screens. */}
              <Image source={s.image} contentFit="cover" contentPosition="bottom" style={StyleSheet.absoluteFill}
                accessibilityIgnoresInvertColors />
            </View>
          ))}
        </ScrollView>}

        {/* Dark fade at the bottom: keeps the buttons readable and hides the
            "Get Started" text printed at the very bottom of the photos. */}
        <LinearGradient pointerEvents="none"
          colors={['rgba(5,6,7,0)', 'rgba(5,6,7,0.94)', c.bg]} locations={[0, 0.5, 0.72]}
          style={styles.bottomFade} />

        <SafeAreaView style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <View style={styles.topBar} pointerEvents="box-none">
            {!last && (
              <Pressable onPress={finish} hitSlop={12} accessibilityRole="button" accessibilityLabel="Skip"
                style={({ pressed }) => [styles.skip, pressed && { opacity: 0.7 }]}>
                <Text style={styles.skipText}>Skip</Text>
              </Pressable>
            )}
          </View>

          <View style={{ flex: 1 }} pointerEvents="none" />

          <View style={styles.bottomBar}>
            <View style={styles.dots}>
              {SLIDES.map((_, i) => (
                <Pressable key={i} onPress={() => goTo(i)} hitSlop={8} accessibilityLabel={`Slide ${i + 1}`}>
                  <View style={[styles.dot, i === index && styles.dotActive]} />
                </Pressable>
              ))}
            </View>

            {last ? (
              <Pressable onPress={finish} accessibilityRole="button"
                style={({ pressed }) => [styles.btn, styles.btnFilled, pressed && { opacity: 0.85 }]}>
                <Text style={[styles.btnText, { color: GOLD.on }]}>Get Started</Text>
                <Ionicons name="arrow-forward" size={19} color={GOLD.on} />
              </Pressable>
            ) : (
              <Pressable onPress={() => goTo(index + 1)} accessibilityRole="button"
                style={({ pressed }) => [styles.btn, styles.btnOutline, pressed && { backgroundColor: 'rgba(201,166,107,0.15)' }]}>
                <Text style={[styles.btnText, { color: GOLD.main }]}>Next</Text>
                <Ionicons name="arrow-forward" size={19} color={GOLD.main} />
              </Pressable>
            )}
          </View>
        </SafeAreaView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', alignItems: 'center' },
  column: { flex: 1, width: '100%', overflow: 'hidden', backgroundColor: c.bg },
  bottomFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '19%' },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20, paddingTop: 10, minHeight: 48 },
  skip: {
    paddingVertical: 7, paddingHorizontal: 16, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: 1, borderColor: 'rgba(201,166,107,0.45)',
  },
  skipText: { color: GOLD.light, fontFamily: font.semibold, fontSize: 14.5 },
  bottomBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 6, paddingBottom: 16,
  },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.25)' },
  dotActive: { width: 24, backgroundColor: GOLD.main },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 52, borderRadius: 26, paddingHorizontal: 26,
  },
  btnOutline: { borderWidth: 1.5, borderColor: GOLD.main, backgroundColor: 'rgba(0,0,0,0.35)' },
  btnFilled: { backgroundColor: GOLD.main, paddingHorizontal: 30 },
  btnText: { fontFamily: font.bold, fontSize: 16 },
});
