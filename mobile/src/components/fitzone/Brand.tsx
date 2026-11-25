// FitZone visual building blocks shared by the splash and onboarding screens:
// logo, soft mint glow, diagonal light streaks and the dark backdrop.

import { useId } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { fitzone as c, font } from '@/theme/colors';

/** "FitZone" word mark with a small dumbbell badge. */
export function FitZoneLogo({ size = 34 }: { size?: number }) {
  const badge = Math.round(size * 1.25);
  return (
    <View style={styles.logoRow} accessibilityRole="header" accessibilityLabel="FitZone">
      <View style={[styles.badge, { width: badge, height: badge, borderRadius: badge * 0.32 }]}>
        <Ionicons name="barbell" size={Math.round(badge * 0.6)} color={c.mint} />
      </View>
      <Text style={[styles.logoText, { fontSize: size }]}>
        Fit<Text style={{ color: c.mint }}>Zone</Text>
      </Text>
    </View>
  );
}

/** Soft radial mint glow (drawn with SVG so it looks the same on phones and web). */
export function Glow({ width, height = width, color = c.mint, opacity = 0.32, style }: {
  width: number; height?: number; color?: string; opacity?: number; style?: StyleProp<ViewStyle>;
}) {
  const id = 'glow' + useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <View pointerEvents="none" style={[{ position: 'absolute', width, height }, style]}>
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={opacity} />
            <Stop offset="0.55" stopColor={color} stopOpacity={opacity * 0.35} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={width / 2} cy={height / 2} rx={width / 2} ry={height / 2} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/** A few thin diagonal mint light lines behind the artwork. */
export function LightStreaks({ width, height }: { width: number; height: number }) {
  const lines = [
    { top: 0.18, opacity: 0.35, thickness: 1.5 },
    { top: 0.34, opacity: 0.18, thickness: 1 },
    { top: 0.62, opacity: 0.28, thickness: 2 },
    { top: 0.8, opacity: 0.14, thickness: 1 },
  ];
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
      {lines.map((l, i) => (
        <LinearGradient
          key={i}
          colors={['transparent', c.mint, 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{
            position: 'absolute',
            left: -width * 0.25,
            top: height * l.top,
            width: width * 1.5,
            height: l.thickness,
            opacity: l.opacity,
            transform: [{ rotate: '-22deg' }],
          }}
        />
      ))}
    </View>
  );
}

/** Full-screen near-black background with a faint mint haze at the top. */
export function FitZoneBackdrop() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient colors={[c.bgSecondary, c.bg, '#000000']} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={['rgba(111,224,160,0.10)', 'rgba(111,224,160,0)']}
        start={{ x: 0.8, y: 0 }}
        end={{ x: 0.3, y: 0.45 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: {
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(111,224,160,0.55)', backgroundColor: 'rgba(111,224,160,0.08)',
  },
  logoText: { color: c.text, fontFamily: font.extrabold, letterSpacing: -0.5 },
});
