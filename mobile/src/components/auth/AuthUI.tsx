// Building blocks for the login / sign-up / invitation pages,
// in the FitZone look (same as the splash screen): near-black, muted mint, white, Outfit font.

import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { danger, fitzone as c, font } from '@/theme/colors';

const MINT = (a: number) => `rgba(111,224,160,${a})`;

/** Dark background with a soft mint haze and thin diagonal light streaks. */
export function AuthBackdrop() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={[c.bgSecondary, c.bg, '#000000']} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={[MINT(0.12), MINT(0)]}
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
  return (
    <LinearGradient
      colors={[MINT(0), MINT(opacity), MINT(0)]}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
      style={[{ position: 'absolute', transform: [{ rotate: '-22deg' }] }, style]}
    />
  );
}

/** Dark glass card with a soft mint edge light on two corners. */
export function GlowCard({ children }: { children: ReactNode }) {
  return (
    <LinearGradient
      colors={[MINT(0.55), 'rgba(35,42,47,0.7)', 'rgba(35,42,47,0.7)', MINT(0.55)]}
      locations={[0, 0.28, 0.72, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.glowBorder}
    >
      <View style={styles.glowInner}>{children}</View>
    </LinearGradient>
  );
}

/** Text field with a mint icon; password fields get a show/hide eye. */
export function AuthField({ icon, secure, ...props }: TextInputProps & { icon: keyof typeof Ionicons.glyphMap; secure?: boolean }) {
  const [hidden, setHidden] = useState(true);
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.field, focused && { borderColor: c.mint }]}>
      <Ionicons name={icon} size={21} color={c.mint} style={{ marginRight: 10 }} />
      <TextInput
        placeholderTextColor={c.muted}
        selectionColor={c.mint}
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

/** Large filled mint button with an optional loading spinner. */
export function PrimaryButton({ label, icon, onPress, loading }: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  loading?: boolean;
}) {
  return (
    <Pressable onPress={loading ? undefined : onPress} accessibilityRole="button"
      style={({ pressed }) => [styles.btnShadow, pressed && { opacity: 0.88 }]}>
      <LinearGradient colors={['#86E8B1', c.mint]} style={styles.btn}>
        {loading ? (
          <ActivityIndicator color={c.onMint} />
        ) : (
          <>
            <Text style={styles.btnText}>{label}</Text>
            {icon && <Ionicons name={icon} size={20} color={c.onMint} style={{ marginLeft: 8 }} />}
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
  const color = kind === 'error' ? danger : c.mint;
  return (
    <View style={[styles.msg, { borderColor: color + '59', backgroundColor: color + '1A' }]}>
      <Ionicons name={kind === 'error' ? 'alert-circle' : 'information-circle'} size={20} color={color} />
      <Text style={[styles.msgText, { color: kind === 'error' ? '#FFCDD2' : '#D6F7E4' }]}>{text}</Text>
    </View>
  );
}

/** "TRAIN • TRANSFORM • THRIVE" between two mint lines (same motto as the splash). */
export function Tagline() {
  return (
    <View style={styles.tagRow}>
      <LinearGradient colors={[MINT(0), c.mint]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.tagLine} />
      <Text style={styles.tagText} numberOfLines={1} adjustsFontSizeToFit>
        TRAIN <Text style={styles.tagDot}> • </Text> TRANSFORM <Text style={styles.tagDot}> • </Text> THRIVE
      </Text>
      <LinearGradient colors={[c.mint, MINT(0)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.tagLine} />
    </View>
  );
}

/** Page heading: white first part, mint second part, short mint underline. */
export function AuthTitle({ first, highlight, subtitle, size = 30 }: { first: string; highlight: string; subtitle?: string; size?: number }) {
  return (
    <View>
      <Text style={[styles.title, { fontSize: size }]} numberOfLines={1} adjustsFontSizeToFit>
        {first} <Text style={{ color: c.mint }}>{highlight}</Text>
      </Text>
      {subtitle ? <Text style={[styles.subtitle, { fontSize: Math.max(14, size * 0.5) }]}>{subtitle}</Text> : null}
      <View style={styles.underline} />
    </View>
  );
}

const styles = StyleSheet.create({
  glowBorder: {
    borderRadius: 25,
    padding: 1.2,
    shadowColor: c.mint,
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
    shadowColor: c.mint,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  btn: { height: 54, borderRadius: 27, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  btnText: { color: c.onMint, fontFamily: font.bold, fontSize: 17 },
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
  tagDot: { color: c.mint },
  title: { color: c.text, fontFamily: font.bold, letterSpacing: -0.4, textShadowColor: '#000', textShadowRadius: 10 },
  subtitle: { color: c.textSecondary, fontFamily: font.regular, marginTop: 6, lineHeight: 21, textShadowColor: '#000', textShadowRadius: 8 },
  underline: { width: 56, height: 3, borderRadius: 2, backgroundColor: c.mint, marginTop: 14 },
});
