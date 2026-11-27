// FitZone onboarding: three welcome slides (swipe or tap Next).
// Shown every time the app opens for someone who is not signed in (see
// app/index.tsx). Skip (slides 1–2) and Get Started (slide 3) open the login page.

import { useRef, useState, type ReactNode } from 'react';
import {
  Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions,
  type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewInstance,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFitZoneFonts } from '@/lib/fonts';
import { FitZoneBackdrop, FitZoneLogo, Glow, LightStreaks } from '@/components/fitzone/Brand';
import { PhoneMockup } from '@/components/fitzone/PhoneMockup';
import { fitzone as c, font } from '@/theme/colors';

const MAX_W = 480;

const IMAGES = {
  barbell: { src: require('../../assets/fitzone/equipment/barbell.png'), ratio: 491 / 840 },
  dumbbell: { src: require('../../assets/fitzone/equipment/dumbbell.png'), ratio: 467 / 778 },
  kettlebell: { src: require('../../assets/fitzone/equipment/kettlebell.png'), ratio: 785 / 543 },
};

interface Slide {
  title: string;
  highlight: string;
  text: string;
  art: (w: number, h: number) => ReactNode;
}

const SLIDES: Slide[] = [
  {
    title: 'Welcome to your',
    highlight: 'Fitness Journey!',
    text: 'Build healthy habits, reach your goals and become the best version of yourself with FitZone.',
    art: (w, h) => {
      const iw = Math.min(w * 0.92, h * 1.45);
      return (
        <>
          <Glow width={iw * 1.2} height={iw * 0.85} opacity={0.26} />
          <Glow width={iw * 0.9} height={iw * 0.12} opacity={0.45} style={{ bottom: h * 0.5 - iw * 0.3 }} />
          <Picture img={IMAGES.barbell} width={iw} />
        </>
      );
    },
  },
  {
    title: 'Track Your',
    highlight: 'Progress',
    text: 'Monitor your workouts, calories, steps and overall progress. Stay motivated, every day.',
    art: (w, h) => {
      const pw = Math.min(w * 0.5, h / 2.12, 230);
      return (
        <>
          <Glow width={pw * 2.4} height={pw * 2.2} opacity={0.22} />
          <PhoneMockup width={pw} />
          <View style={{ position: 'absolute', right: Math.max(0, w / 2 - pw * 1.05), bottom: Math.max(0, h / 2 - pw * 1.08) }}>
            <Picture img={IMAGES.dumbbell} width={pw * 0.7} />
          </View>
        </>
      );
    },
  },
  {
    title: 'Get Personalized',
    highlight: 'Coaching',
    text: 'Receive custom workout and nutrition plans, expert guidance and support from your personal trainer.',
    art: (w, h) => {
      const kh = Math.min(h * 0.82, w * 0.85);
      const kw = kh / IMAGES.kettlebell.ratio;
      return (
        <>
          <Glow width={kw * 2.2} height={kh * 1.25} opacity={0.24} />
          <Glow width={kw * 1.6} height={kh * 0.14} opacity={0.45} style={{ bottom: h / 2 - kh * 0.56 }} />
          <View style={{ transform: [{ translateX: kw * 0.18 }] }}>
            <Picture img={IMAGES.kettlebell} width={kw} />
          </View>
          <View style={{ position: 'absolute', left: Math.max(0, w / 2 - kw * 0.95), bottom: Math.max(0, h / 2 - kh * 0.52) }}>
            <Picture img={IMAGES.dumbbell} width={kw * 0.85} />
          </View>
          <Chip icon="barbell-outline" label="Workout plan" style={{ top: h / 2 - kh * 0.46, left: Math.max(4, w / 2 - kw * 1.05) }} />
          <Chip icon="nutrition-outline" label="Nutrition plan" style={{ top: h / 2 - kh * 0.12, right: Math.max(4, w / 2 - kw * 1.05) }} />
        </>
      );
    },
  },
];

export default function Welcome() {
  useFitZoneFonts();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [pageW, setPageW] = useState(Math.min(screenW, MAX_W));
  const [artH, setArtH] = useState(screenH * 0.4);
  const [index, setIndex] = useState(0);
  const scroller = useRef<ScrollViewInstance>(null);
  const leaving = useRef(false);
  const last = index === SLIDES.length - 1;

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
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

  const compact = pageW < 360 || screenH < 680;

  return (
    <View style={styles.root}>
      <FitZoneBackdrop />
      <SafeAreaView style={styles.safe}>
        <View style={[styles.column, { maxWidth: MAX_W }]}>
          <View style={styles.topBar}>
            <FitZoneLogo size={22} />
            {!last && (
              <Pressable onPress={finish} hitSlop={12} accessibilityRole="button" accessibilityLabel="Skip">
                {({ pressed }) => <Text style={[styles.skip, pressed && { opacity: 0.6 }]}>Skip</Text>}
              </Pressable>
            )}
          </View>

          <View style={{ flex: 1 }} onLayout={onPagerLayout}>
            <ScrollView
              ref={scroller}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={onScroll}
              scrollEventThrottle={16}
              style={{ flex: 1 }}
            >
              {SLIDES.map((s, i) => (
                <View key={i} style={[styles.page, { width: pageW }]}>
                  <View style={styles.textBlock}>
                    <Text style={[styles.title, compact && styles.titleCompact]}>
                      {s.title}{'\n'}<Text style={{ color: c.mint }}>{s.highlight}</Text>
                    </Text>
                    <Text style={[styles.text, compact && { fontSize: 14.5, lineHeight: 21 }]}>{s.text}</Text>
                  </View>
                  <View style={styles.art} onLayout={i === 0 ? (e) => setArtH(e.nativeEvent.layout.height) : undefined}>
                    <LightStreaks width={pageW} height={artH} />
                    {s.art(pageW - 40, artH)}
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>

          <View style={styles.bottomBar}>
            <View style={{ gap: 10 }}>
              <Text style={styles.counter}>
                <Text style={{ color: c.text }}>{String(index + 1).padStart(2, '0')}</Text>
                {'  /  '}{String(SLIDES.length).padStart(2, '0')}
              </Text>
              <View style={styles.dots}>
                {SLIDES.map((_, i) => (
                  <Pressable key={i} onPress={() => goTo(i)} hitSlop={8} accessibilityLabel={`Slide ${i + 1}`}>
                    <View style={[styles.dot, i === index && styles.dotActive]} />
                  </Pressable>
                ))}
              </View>
            </View>

            {last ? (
              <Pressable onPress={finish} accessibilityRole="button"
                style={({ pressed }) => [styles.btn, styles.btnFilled, pressed && { opacity: 0.85 }]}>
                <Text style={[styles.btnText, { color: c.onMint }]}>Get Started</Text>
                <Ionicons name="arrow-forward" size={19} color={c.onMint} />
              </Pressable>
            ) : (
              <Pressable onPress={() => goTo(index + 1)} accessibilityRole="button"
                style={({ pressed }) => [styles.btn, styles.btnOutline, pressed && { backgroundColor: 'rgba(111,224,160,0.12)' }]}>
                <Text style={[styles.btnText, { color: c.mint }]}>Next</Text>
                <Ionicons name="arrow-forward" size={19} color={c.mint} />
              </Pressable>
            )}
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

function Picture({ img, width }: { img: { src: number; ratio: number }; width: number }) {
  return <Image source={img.src} contentFit="contain" style={{ width, height: width * img.ratio }} accessibilityIgnoresInvertColors />;
}

function Chip({ icon, label, style }: { icon: keyof typeof Ionicons.glyphMap; label: string; style: object }) {
  return (
    <View style={[styles.chip, style]}>
      <Ionicons name={icon} size={15} color={c.mint} />
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  safe: { flex: 1, alignItems: 'center' },
  column: { flex: 1, width: '100%' },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 10, minHeight: 48,
  },
  skip: { color: c.textSecondary, fontFamily: font.semibold, fontSize: 15, paddingVertical: 6, paddingHorizontal: 4 },
  page: { flex: 1, paddingHorizontal: 20 },
  textBlock: { paddingTop: 18, gap: 12 },
  title: { color: c.text, fontFamily: font.bold, fontSize: 32, lineHeight: 39, letterSpacing: -0.4 },
  titleCompact: { fontSize: 27, lineHeight: 33 },
  text: { color: c.textSecondary, fontFamily: font.regular, fontSize: 15.5, lineHeight: 23, maxWidth: 400 },
  art: { flex: 1, alignItems: 'center', justifyContent: 'center', marginVertical: 12 },
  bottomBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 6, paddingBottom: 18,
  },
  counter: { color: c.muted, fontFamily: font.semibold, fontSize: 14, letterSpacing: 1 },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.18)' },
  dotActive: { width: 24, backgroundColor: c.mint },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 52, borderRadius: 26, paddingHorizontal: 26,
  },
  btnOutline: { borderWidth: 1.5, borderColor: c.mint },
  btnFilled: { backgroundColor: c.mint, paddingHorizontal: 30 },
  btnText: { fontFamily: font.bold, fontSize: 16 },
  chip: {
    position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14,
    backgroundColor: 'rgba(17,21,24,0.85)', borderWidth: 1, borderColor: 'rgba(111,224,160,0.35)',
  },
  chipText: { color: c.text, fontFamily: font.medium, fontSize: 12.5 },
});
