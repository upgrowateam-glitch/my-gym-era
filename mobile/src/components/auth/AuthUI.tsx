// Building blocks for the login / sign-up / invitation / profile pages:
// near-black background, white text, Outfit font, and one accent colour.
// The accent is mint by default; pages inside <AuthAccentProvider value={GOLD}>
// (login, sign-up, invitation) use gold to match their gym photos.

import { createContext, useContext, useState, type ReactNode } from 'react';
import {
  ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions, type TextInputProps,
} from 'react-native';
import { Image, type ImageSource } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { danger, fitzone as c, font } from '@/theme/colors';

export interface AuthAccent {
  main: string;
  light: string;
  /** text on a filled accent button */
  on: string;
  /** "r,g,b" of `main`, for see-through versions */
  rgb: string;
}
export const MINT: AuthAccent = { main: c.mint, light: '#86E8B1', on: c.onMint, rgb: '111,224,160' };
export const GOLD: AuthAccent = { main: '#C9A66B', light: '#E6CB94', on: '#17120A', rgb: '201,166,107' };

const AccentContext = createContext<AuthAccent>(MINT);
export const AuthAccentProvider = AccentContext.Provider;
const useAccent = () => useContext(AccentContext);
const tint = (a: AuthAccent, alpha: number) => `rgba(${a.rgb},${alpha})`;

/** Dark background with a soft accent haze and thin diagonal light streaks. */
export function AuthBackdrop() {
  const a = useAccent();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={[c.bgSecondary, c.bg, '#000000']} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={[tint(a, 0.12), tint(a, 0)]}
        start={{ x: 0.75, y: 0 }}
        end={{ x: 0.35, y: 0.45 }}
        style={StyleSheet.absoluteFill}
      />
      <Streak style={{ top: 40, left: -70, width: 260, height: 2 }} opacity={0.4} />
      <Streak style={{ top: 22, right: -50, width: 200, height: 1.5 }} opacity={0.3} />
      <Streak style={{ bottom: 120, right: -60, width: 230, height: 2 }} opacity={0.3} />
    </View>
  );
}

function Streak({ style, opacity }: { style: object; opacity: number }) {
  const a = useAccent();
  return (
    <LinearGradient
      colors={[tint(a, 0), tint(a, opacity), tint(a, 0)]}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
      style={[{ position: 'absolute', transform: [{ rotate: '-22deg' }] }, style]}
    />
  );
}

/**
 * Full-screen gym photo behind a page. The lower part fades to black, so the
 * form stays readable (this also hides any text printed low in the photo).
 * On wide screens (web) the photo stays phone-width in the middle.
 */
export function PhotoBackdrop({ source }: { source: ImageSource }) {
  const { width } = useWindowDimensions();
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', alignItems: 'center' }]} pointerEvents="none">
      <View style={{ flex: 1, width: Math.min(width, 520), overflow: 'hidden' }}>
        <Image source={source} contentFit="cover" contentPosition="top" style={StyleSheet.absoluteFill}
          accessibilityIgnoresInvertColors />
        <LinearGradient
          colors={['rgba(5,6,7,0.25)', 'rgba(5,6,7,0)', 'rgba(5,6,7,0.55)', 'rgba(5,6,7,0.97)', c.bg]}
          locations={[0, 0.14, 0.34, 0.54, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>
    </View>
  );
}

/** Big uppercase heading in the accent colour with a small caption, e.g. WELCOME BACK / SIGN IN TO CONTINUE. */
export function PhotoHeading({ title, caption }: { title: string; caption: string }) {
  const a = useAccent();
  return (
    <View style={{ alignItems: 'center', gap: 6 }}>
      <Text style={[styles.photoTitle, { color: a.main }]} numberOfLines={1} adjustsFontSizeToFit accessibilityRole="header">
        {title}
      </Text>
      <Text style={[styles.photoCaption, { color: a.light }]}>{caption}</Text>
    </View>
  );
}

/** Dark glass card with a soft accent edge light on two corners. */
export function GlowCard({ children }: { children: ReactNode }) {
  const a = useAccent();
  return (
    <LinearGradient
      colors={[tint(a, 0.55), 'rgba(35,42,47,0.7)', 'rgba(35,42,47,0.7)', tint(a, 0.55)]}
      locations={[0, 0.28, 0.72, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.glowBorder, { shadowColor: a.main }]}
    >
      <View style={styles.glowInner}>{children}</View>
    </LinearGradient>
  );
}

/** Text field with an accent icon; password fields get a show/hide eye. */
export function AuthField({ icon, secure, ...props }: TextInputProps & { icon: keyof typeof Ionicons.glyphMap; secure?: boolean }) {
  const a = useAccent();
  const [hidden, setHidden] = useState(true);
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.field, focused && { borderColor: a.main }]}>
      <Ionicons name={icon} size={21} color={a.main} style={{ marginRight: 10 }} />
      <TextInput
        placeholderTextColor={c.muted}
        selectionColor={a.main}
        style={[styles.input, props.editable === false && { color: c.textSecondary }]}
        secureTextEntry={secure && hidden}
        autoCapitalize="none"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...props}
      />
      {secure && (
        <Pressable onPress={() => setHidden(!hidden)} hitSlop={10} accessibilityLabel={hidden ? 'Show password' : 'Hide password'}>
          <Ionicons name={hidden ? 'eye-off-outline' : 'eye-outline'} size={21} color={c.textSecondary} />
        </Pressable>
      )}
    </View>
  );
}

/** Large filled accent button with an optional loading spinner. */
export function PrimaryButton({ label, icon, onPress, loading }: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  loading?: boolean;
}) {
  const a = useAccent();
  return (
    <Pressable onPress={loading ? undefined : onPress} accessibilityRole="button"
      style={({ pressed }) => [styles.btnShadow, { shadowColor: a.main }, pressed && { opacity: 0.88 }]}>
      <LinearGradient colors={[a.light, a.main]} style={styles.btn}>
        {loading ? (
          <ActivityIndicator color={a.on} />
        ) : (
          <>
            <Text style={[styles.btnText, { color: a.on }]}>{label}</Text>
            {icon && <Ionicons name={icon} size={20} color={a.on} style={{ marginLeft: 8 }} />}
          </>
        )}
      </LinearGradient>
    </Pressable>
  );
}

export function SocialButton({ label, icon, onPress }: { label: string; icon: ReactNode; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      style={({ pressed }) => [styles.social, pressed && { backgroundColor: c.elevated }]}>
      {icon}
      <Text style={styles.socialText} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

export function OrDivider() {
  return (
    <View style={styles.orRow}>
      <View style={styles.orLine} />
      <Text style={styles.orText}>OR</Text>
      <View style={styles.orLine} />
    </View>
  );
}

export function Message({ text, kind = 'error' }: { text: string; kind?: 'error' | 'info' }) {
  const a = useAccent();
  const color = kind === 'error' ? danger : a.main;
  return (
    <View style={[styles.msg, { borderColor: color + '59', backgroundColor: color + '1A' }]}>
      <Ionicons name={kind === 'error' ? 'alert-circle' : 'information-circle'} size={20} color={color} />
      <Text style={[styles.msgText, { color: kind === 'error' ? '#FFCDD2' : a.light }]}>{text}</Text>
    </View>
  );
}

/** "TRAIN • TRANSFORM • THRIVE" between two accent lines (same motto as the splash). */
export function Tagline() {
  const a = useAccent();
  return (
    <View style={styles.tagRow}>
      <LinearGradient colors={[tint(a, 0), a.main]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.tagLine} />
      <Text style={styles.tagText} numberOfLines={1} adjustsFontSizeToFit>
        TRAIN <Text style={{ color: a.main }}> • </Text> TRANSFORM <Text style={{ color: a.main }}> • </Text> THRIVE
      </Text>
      <LinearGradient colors={[a.main, tint(a, 0)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.tagLine} />
    </View>
  );
}

/** Page heading: white first part, accent second part, short accent underline. */
export function AuthTitle({ first, highlight, subtitle, size = 30 }: { first: string; highlight: string; subtitle?: string; size?: number }) {
  const a = useAccent();
  return (
    <View>
      <Text style={[styles.title, { fontSize: size }]} numberOfLines={1} adjustsFontSizeToFit>
        {first} <Text style={{ color: a.main }}>{highlight}</Text>
      </Text>
      {subtitle ? <Text style={[styles.subtitle, { fontSize: Math.max(14, size * 0.5) }]}>{subtitle}</Text> : null}
      <View style={[styles.underline, { backgroundColor: a.main }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  glowBorder: {
    borderRadius: 25,
    padding: 1.2,
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  glowInner: { borderRadius: 24, backgroundColor: 'rgba(17,21,24,0.95)', padding: 18, gap: 14 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(24,29,33,0.9)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: 16,
    minHeight: 56,
  },
  input: { flex: 1, color: c.text, fontFamily: font.regular, fontSize: 16, paddingVertical: 14, outlineStyle: 'none' } as never,
  btnShadow: {
    borderRadius: 27,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  btn: { height: 54, borderRadius: 27, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: font.bold, fontSize: 17 },
  social: {
    height: 52,
    borderRadius: 27,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: 'rgba(11,14,16,0.85)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 16,
  },
  socialText: { color: c.text, fontFamily: font.medium, fontSize: 15.5, flexShrink: 1 },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  orLine: { flex: 1, height: 1, backgroundColor: c.border },
  orText: { color: c.muted, fontFamily: font.semibold, fontSize: 12.5, letterSpacing: 1 },
  msg: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 14, borderWidth: 1 },
  msgText: { flex: 1, fontFamily: font.regular, fontSize: 13.5 },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 },
  tagLine: { flex: 1, height: 1.5 },
  tagText: { color: c.textSecondary, fontFamily: font.medium, fontSize: 11.5, letterSpacing: 2.4, flexShrink: 1 },
  title: { color: c.text, fontFamily: font.bold, letterSpacing: -0.4, textShadowColor: '#000', textShadowRadius: 10 },
  subtitle: { color: c.textSecondary, fontFamily: font.regular, marginTop: 6, lineHeight: 21, textShadowColor: '#000', textShadowRadius: 8 },
  underline: { width: 56, height: 3, borderRadius: 2, marginTop: 14 },
  photoTitle: {
    fontFamily: font.extrabold, fontSize: 38, letterSpacing: 1.5, textTransform: 'uppercase',
    textShadowColor: '#000', textShadowRadius: 14,
  },
  photoCaption: {
    fontFamily: font.medium, fontSize: 14.5, letterSpacing: 1.6, textTransform: 'uppercase',
    textShadowColor: '#000', textShadowRadius: 10,
  },
});
