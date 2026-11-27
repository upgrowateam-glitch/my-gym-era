// Sign-up page (new User account) — gym photo background (assets/auth/signup-bg.jpg)
// with gold accents, like the login page.

import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { homeRouteFor, useAuth } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import { fitzone as c, font } from '@/theme/colors';
import { useFitZoneFonts } from '@/lib/fonts';
import {
  AuthAccentProvider, AuthField, GlowCard, GOLD, Message, OrDivider, PhotoBackdrop, PhotoHeading, PrimaryButton,
  SocialButton, Tagline,
} from '@/components/auth/AuthUI';

const BACKGROUND = require('../../assets/auth/signup-bg.jpg');
const MIN_PASSWORD = 6;

export default function SignupScreen() {
  useFitZoneFonts();
  const { user, register } = useAuth();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (user) return <Redirect href={homeRouteFor(user)} />;
  const width = Math.min(screenW, 460);
  // The sign-up form is longer, so a little less photo shows above the heading.
  const photoSpace = Math.max(90, Math.min(screenH * 0.22, 230));

  async function submit() {
    setInfo(null);
    if (!name.trim() || !email.trim() || !password) {
      setError('Please fill in all fields.');
      return;
    }
    if (password.length < MIN_PASSWORD) {
      setError(`Password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await register(name.trim(), email.trim(), password);
      // Account created: sign in on the login page (email filled in); the fitness
      // profile form then opens after that first sign-in.
      router.replace({ pathname: '/login', params: { email: email.trim(), created: '1' } });
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
    <AuthAccentProvider value={GOLD}>
      <View style={styles.root}>
        <PhotoBackdrop source={BACKGROUND} />
        <SafeAreaView style={{ flex: 1 }}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={{ alignItems: 'center', paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
              <View style={{ width, paddingHorizontal: 20, gap: 14 }}>
                <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/login'))}
                  style={styles.back} hitSlop={10} accessibilityLabel="Back to login">
                  <Ionicons name="chevron-back" size={24} color={c.text} />
                </Pressable>
                <View style={{ height: photoSpace }} />
                <PhotoHeading title="Join the Clan" caption="Create an account to begin" />

                {error && <Message text={error} />}
                {info && <Message text={info} kind="info" />}

                <GlowCard>
                  <AuthField icon="person-outline" placeholder="Full Name" autoCapitalize="words"
                    autoComplete="name" value={name} onChangeText={setName} />
                  <AuthField icon="mail-outline" placeholder="Email Address" keyboardType="email-address"
                    autoComplete="email" value={email} onChangeText={setEmail} />
                  <AuthField icon="lock-closed-outline" placeholder={`Password (min. ${MIN_PASSWORD} characters)`} secure
                    autoComplete="new-password" value={password} onChangeText={setPassword} onSubmitEditing={submit} />
                  <PrimaryButton label="Create Account" icon="arrow-forward" onPress={submit} loading={busy} />
                </GlowCard>

                <OrDivider />
                <SocialButton label="Sign up with Apple" icon={<Ionicons name="logo-apple" size={24} color="#fff" />}
                  onPress={() => notAvailable('Apple sign-up')} />
                <SocialButton label="Sign up with Google" icon={<Ionicons name="logo-google" size={20} color="#fff" />}
                  onPress={() => notAvailable('Google sign-up')} />

                <View style={styles.row}>
                  <Text style={styles.muted}>Already have an account?</Text>
                  <Pressable onPress={() => router.replace('/login')} hitSlop={8}>
                    <Text style={styles.link}> Log In</Text>
                  </Pressable>
                </View>
                <Tagline />
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </AuthAccentProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  back: {
    position: 'absolute', top: 8, left: 20, zIndex: 1,
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  link: { color: GOLD.main, fontFamily: font.bold, fontSize: 14 },
  muted: { color: c.textSecondary, fontFamily: font.regular, fontSize: 14 },
  row: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', paddingVertical: 6 },
});
