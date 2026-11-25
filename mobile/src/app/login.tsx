// Login page — FitZone look (near-black, mint, white), athletes photo header.

import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { homeRouteFor, useAuth } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import { fitzone as c, font } from '@/theme/colors';
import { useFitZoneFonts } from '@/lib/fonts';
import { FitZoneLogo, Glow } from '@/components/fitzone/Brand';
import {
  AuthBackdrop, AuthField, AuthTitle, GlowCard, Message, PrimaryButton, OrDivider, SocialButton, Tagline,
} from '@/components/auth/AuthUI';

const IMG = {
  male: require('../../assets/login/athlete_male.png'),
  female: require('../../assets/login/athlete_female.png'),
  dumbbell: require('../../assets/fitzone/equipment/dumbbell.png'),
  kettlebell: require('../../assets/fitzone/equipment/kettlebell.png'),
};

export default function LoginScreen() {
  useFitZoneFonts();
  const { user, login, notice } = useAuth();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (user) return <Redirect href={homeRouteFor(user)} />;

  const width = Math.min(screenW, 460);
  const headerH = Math.max(250, Math.min(width * 0.98, screenH * 0.4, 420));

  async function submit() {
    setInfo(null);
    if (!email.trim() || !password) {
      setError('Please fill in all fields.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
      router.replace('/');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const notAvailable = (what: string) => {
    setError(null);
    setInfo(`${what} is not available yet.`);
  };

  return (
    <View style={styles.root}>
      <AuthBackdrop />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ alignItems: 'center' }} keyboardShouldPersistTaps="handled">
            <View style={{ width }}>
              <Header width={width} height={headerH} />

              <View style={{ paddingHorizontal: 20, gap: 14 }}>
                {notice && !error && <Message text={notice} kind="info" />}
                {error && <Message text={error} />}
                {info && <Message text={info} kind="info" />}

                <GlowCard>
                  <AuthField icon="mail-outline" placeholder="Email Address" keyboardType="email-address"
                    autoComplete="email" value={email} onChangeText={setEmail} returnKeyType="next" />
                  <AuthField icon="lock-closed-outline" placeholder="Password" secure autoComplete="password"
                    value={password} onChangeText={setPassword} onSubmitEditing={submit} returnKeyType="go" />
                  <Pressable onPress={() => notAvailable('Password reset')} style={{ alignSelf: 'flex-end' }} hitSlop={8}>
                    <Text style={styles.link}>Forgot Password?</Text>
                  </Pressable>
                  <PrimaryButton label="Log In" icon="arrow-forward" onPress={submit} loading={busy} />
                </GlowCard>

                <OrDivider />
                <SocialButton label="Continue with Apple" icon={<Ionicons name="logo-apple" size={24} color="#fff" />}
                  onPress={() => notAvailable('Apple sign-in')} />
                <SocialButton label="Continue with Google" icon={<Ionicons name="logo-google" size={20} color="#fff" />}
                  onPress={() => notAvailable('Google sign-in')} />

                <View style={styles.signupRow}>
                  <Text style={styles.muted}>Don't have an account?</Text>
                  <Pressable onPress={() => router.push('/signup')} hitSlop={8}>
                    <Text style={[styles.link, { fontFamily: font.bold }]}> Sign Up</Text>
                  </Pressable>
                </View>
              </View>

              <BottomDecor width={width} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

/** Logo, welcome text and the two athletes (woman slightly in front). */
function Header({ width, height }: { width: number; height: number }) {
  const maleH = height;
  const maleW = maleH * (438 / 941);
  const femaleH = height * 0.9;
  const femaleW = femaleH * (409 / 856);
  const femaleRight = maleW * 0.62;
  const groupW = femaleRight + femaleW;
  const scale = Math.min(1.1, Math.max(0.82, width / 390));

  return (
    <View style={{ height, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', top: 0, right: -maleW * 0.06, width: groupW, height }}>
        <Image source={IMG.male} contentFit="contain" contentPosition="top"
          style={{ position: 'absolute', right: 0, top: 0, width: maleW, height: maleH }} />
        <Image source={IMG.female} contentFit="contain" contentPosition="top"
          style={{ position: 'absolute', right: femaleRight, top: height * 0.1, width: femaleW, height: femaleH }} />
      </View>
      {/* fade the athletes into the background at the bottom (full width, so no visible box edge) */}
      <LinearGradient pointerEvents="none" colors={['rgba(5,6,7,0)', 'rgba(5,6,7,0)', 'rgba(5,6,7,0.92)']} locations={[0, 0.62, 1]} style={StyleSheet.absoluteFill} />

      <View style={{ position: 'absolute', left: 20, top: 14, bottom: 18, width: width * 0.56 }}>
        <View style={{ marginTop: 6 }}><FitZoneLogo size={26 * scale} /></View>
        <View style={{ flex: 1 }} />
        <AuthTitle first="Welcome" highlight="Back" subtitle="Log in to continue your fitness journey." size={30 * scale} />
      </View>
    </View>
  );
}

/** Dumbbell and kettlebell on a soft mint glow, with the tagline. */
function BottomDecor({ width }: { width: number }) {
  const bandH = Math.min(175, Math.max(120, width * 0.4));
  return (
    <View style={{ height: bandH, marginTop: 6 }} pointerEvents="none">
      <Glow width={width * 0.9} height={bandH * 0.35} opacity={0.35} style={{ left: width * 0.05, bottom: bandH * 0.12 }} />
      <Image source={IMG.dumbbell} contentFit="contain"
        style={{ position: 'absolute', left: width * 0.04, bottom: bandH * 0.22, width: width * 0.38, height: width * 0.38 * (467 / 778), opacity: 0.95 }} />
      <Image source={IMG.kettlebell} contentFit="contain"
        style={{ position: 'absolute', right: width * 0.07, bottom: bandH * 0.22, height: bandH * 0.68, width: bandH * 0.68 * (543 / 785), opacity: 0.95 }} />
      <LinearGradient colors={['rgba(5,6,7,0)', 'rgba(5,6,7,0)', 'rgba(5,6,7,0.9)']} locations={[0, 0.6, 1]} style={StyleSheet.absoluteFill} />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 10 }}>
        <Tagline />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  link: { color: c.mint, fontFamily: font.semibold, fontSize: 14 },
  muted: { color: c.textSecondary, fontFamily: font.regular, fontSize: 14 },
  signupRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', paddingVertical: 6 },
});
