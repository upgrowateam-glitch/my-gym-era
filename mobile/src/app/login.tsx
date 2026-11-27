// Login page — gym photo background (assets/auth/signin-bg.jpg) with gold accents.

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

const BACKGROUND = require('../../assets/auth/signin-bg.jpg');

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
  // Leave the top of the photo (logo and gym) visible above the heading.
  const photoSpace = Math.max(130, Math.min(screenH * 0.3, 300));

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
    <AuthAccentProvider value={GOLD}>
      <View style={styles.root}>
        <PhotoBackdrop source={BACKGROUND} />
        <SafeAreaView style={{ flex: 1 }}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={{ alignItems: 'center', paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
              <View style={{ width, paddingHorizontal: 20, gap: 14 }}>
                <View style={{ height: photoSpace }} />
                <PhotoHeading title="Welcome Back" caption="Sign in to continue" />

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
                  <Text style={styles.muted}>Don&apos;t have an account?</Text>
                  <Pressable onPress={() => router.push('/signup')} hitSlop={8}>
                    <Text style={[styles.link, { fontFamily: font.bold }]}> Sign Up</Text>
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
  link: { color: GOLD.main, fontFamily: font.semibold, fontSize: 14 },
  muted: { color: c.textSecondary, fontFamily: font.regular, fontSize: 14 },
  signupRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', paddingVertical: 6 },
});
