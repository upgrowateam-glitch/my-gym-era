// Fitness profile setup (Phase 2) — for Users (clients).
// Welcome → Personal → Height & weight → BMI → Health → Goals → Daily routine
// → Food habits → Sleep → Review & finish.
// Each step is saved to the server when the person taps Continue, so they can
// stop and later carry on where they stopped. A new User must finish this
// before using the app (they can only log out); afterwards it is their
// profile page, where they can review and edit every answer.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewInstance,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import { useFitZoneFonts } from '@/lib/fonts';
import {
  ACTIVITY_LEVELS, BMI_INFO, DIET_TYPES, EATING_OUT, EXPERIENCE, GENDERS, GOALS, PAST_TRAINING, SLEEP_QUALITY, SMOKING,
  TRAINING_DURATION,
  WORK_TYPES, WORKOUT_TIMES, ageFrom, bmiFor, completeFitness, getFitness, labelOf, pastTrainingText, saveSection, sleepHoursFor,
  type ActivityLevel, type DietType, type PastTraining, type TrainingDuration, type EatingOut, type Experience, type FitnessProfile, type Gender, type Goal,
  type Section, type SleepQuality, type Smoking, type WorkoutTime, type WorkType,
} from '@/lib/fitness';
import { RequireRole } from '@/components/RequireRole';
import { AuthBackdrop, Message, PrimaryButton } from '@/components/auth/AuthUI';
import { FitZoneLogo, Glow } from '@/components/fitzone/Brand';
import {
  DateInput, FZInput, Label, MultiOptionCards, OptionCards, Pills, Stepper, TimePicker,
} from '@/components/fitzone/Form';
import { fitzone as c, font } from '@/theme/colors';

type Step = 'welcome' | Section | 'bmi' | 'review' | 'done';
const ORDER: Step[] = ['welcome', 'personal', 'body', 'bmi', 'health', 'goals', 'routine', 'food', 'sleep', 'review'];
const PROGRESS: Step[] = ['personal', 'body', 'bmi', 'health', 'goals', 'routine', 'food', 'sleep'];
const SECTION_ORDER: Section[] = ['personal', 'body', 'health', 'goals', 'routine', 'food', 'sleep'];

interface Form {
  displayName: string; gender: Gender | null; day: string; month: string; year: string; whatsapp: string;
  height: string; weight: string; target: string;
  injuries: string; medical: string; smoking: Smoking | null;
  mainGoal: Goal | null; extraGoals: Goal[]; experience: Experience | null;
  pastTraining: PastTraining[]; duration: TrainingDuration | null; expNotes: string;
  workType: WorkType | null; activity: ActivityLevel | null; workoutDays: number; workoutTime: WorkoutTime | null;
  diet: DietType | null; meals: number; water: number; avoid: string; eatingOut: EatingOut | null;
  bedtime: string; wakeTime: string; quality: SleepQuality | null;
}

const num = (t: string) => Number(t.trim().replace(',', '.'));
const numText = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n));

function formFrom(f: FitnessProfile | null, name: string, whatsapp: string | null): Form {
  const [y = '', m = '', d = ''] = f?.personal?.dateOfBirth?.split('-') ?? [];
  return {
    displayName: name, gender: f?.personal?.gender ?? null, day: d, month: m, year: y, whatsapp: whatsapp ?? '',
    height: numText(f?.body?.heightCm), weight: numText(f?.body?.weightKg), target: numText(f?.body?.targetWeightKg),
    injuries: f?.health?.injuries ?? '', medical: f?.health?.medicalConditions ?? '', smoking: f?.health?.smoking ?? null,
    mainGoal: f?.goals?.mainGoal ?? null, extraGoals: f?.goals?.extraGoals ?? [], experience: f?.goals?.experience ?? null,
    pastTraining: f?.goals?.pastTraining ?? [], duration: f?.goals?.trainingDuration ?? null,
    expNotes: f?.goals?.experienceNotes ?? '',
    workType: f?.routine?.workType ?? null, activity: f?.routine?.activityLevel ?? null,
    workoutDays: f?.routine?.workoutDays ?? 3, workoutTime: f?.routine?.workoutTime ?? null,
    diet: f?.food?.dietType ?? null, meals: f?.food?.mealsPerDay ?? 3, water: f?.food?.waterLitres ?? 2.5,
    avoid: f?.food?.avoidFoods ?? '', eatingOut: f?.food?.eatingOut ?? null,
    bedtime: f?.sleep?.bedtime ?? '23:00', wakeTime: f?.sleep?.wakeTime ?? '07:00', quality: f?.sleep?.quality ?? null,
  };
}

/** Checks one step on the phone first (friendly messages); the server checks again. Returns [error, data]. */
function prepare(step: Section, f: Form): [string | null, object] {
  switch (step) {
    case 'personal': {
      if (!f.displayName.trim()) return ['Please enter your name.', {}];
      if (!f.gender) return ['Please choose your gender.', {}];
      const dob = `${f.year.padStart(4, '0')}-${f.month.padStart(2, '0')}-${f.day.padStart(2, '0')}`;
      const d = new Date(`${dob}T00:00:00Z`);
      if (f.year.length !== 4 || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== dob) {
        return ['Please enter a valid date of birth (DD / MM / YYYY).', {}];
      }
      const age = ageFrom(dob) ?? 0;
      if (age < 13 || age > 100) return ['Age must be between 13 and 100 years.', {}];
      return [null, { displayName: f.displayName.trim(), gender: f.gender, dateOfBirth: dob, whatsapp: f.whatsapp.trim() }];
    }
    case 'body': {
      const h = num(f.height), w = num(f.weight), t = f.target.trim() ? num(f.target) : null;
      if (!(h >= 100 && h <= 250)) return ['Please enter your height in cm (between 100 and 250).', {}];
      if (!(w >= 25 && w <= 300)) return ['Please enter your weight in kg (between 25 and 300).', {}];
      if (t !== null && !(t >= 25 && t <= 300)) return ['Target weight must be between 25 and 300 kg, or leave it empty.', {}];
      return [null, { heightCm: h, weightKg: w, targetWeightKg: t }];
    }
    case 'health':
      if (!f.smoking) return ['Please answer the smoking question.', {}];
      return [null, { injuries: f.injuries.trim(), medicalConditions: f.medical.trim(), smoking: f.smoking }];
    case 'goals':
      if (!f.mainGoal) return ['Please choose your main goal.', {}];
      if (!f.experience) return ['Please choose your experience level.', {}];
      if (f.pastTraining.length === 0) return ['Please choose the training you have done before (or "None yet").', {}];
      {
        const none = f.pastTraining.includes('none');
        if (!none && !f.duration) return ['Please choose how long you have been training.', {}];
        return [null, {
          mainGoal: f.mainGoal, extraGoals: f.extraGoals.filter((g) => g !== f.mainGoal), experience: f.experience,
          pastTraining: f.pastTraining, trainingDuration: none ? null : f.duration, experienceNotes: f.expNotes.trim(),
        }];
      }
    case 'routine':
      if (!f.workType) return ['Please choose your type of work.', {}];
      if (!f.activity) return ['Please choose your activity level.', {}];
      if (!f.workoutTime) return ['Please choose when you prefer to work out.', {}];
      return [null, { workType: f.workType, activityLevel: f.activity, workoutDays: f.workoutDays, workoutTime: f.workoutTime }];
    case 'food':
      if (!f.diet) return ['Please choose your diet type.', {}];
      if (!f.eatingOut) return ['Please tell us how often you eat outside.', {}];
      return [null, { dietType: f.diet, mealsPerDay: f.meals, waterLitres: f.water, avoidFoods: f.avoid.trim(), eatingOut: f.eatingOut }];
    case 'sleep':
      if (f.bedtime === f.wakeTime) return ['Bedtime and wake-up time cannot be the same.', {}];
      if (!f.quality) return ['Please rate your sleep quality.', {}];
      return [null, { bedtime: f.bedtime, wakeTime: f.wakeTime, quality: f.quality }];
  }
}

export default function ProfileSetupRoute() {
  return (
    <RequireRole roles={['client']}>
      <ProfileSetup />
    </RequireRole>
  );
}

function ProfileSetup() {
  useFitZoneFonts();
  const { user, setUser, logout } = useAuth();
  const [fitness, setFitness] = useState<FitnessProfile | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [step, setStep] = useState<Step>('welcome');
  const [fromReview, setFromReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const scroller = useRef<ScrollViewInstance>(null);

  async function load() {
    setLoadError(null);
    try {
      const r = await getFitness();
      setFitness(r.fitness);
      setForm(formFrom(r.fitness, user?.displayName ?? '', user?.whatsapp ?? null));
      // Carry on where they stopped.
      const f = r.fitness;
      if (f.completedAt || f.missing.length === 0) setStep('review');
      else if (f.missing.length < SECTION_ORDER.length) setStep(SECTION_ORDER.find((s) => f.missing.includes(s)) ?? 'review');
      else setStep('welcome');
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Could not load your profile.');
    }
  }
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  function go(next: Step) {
    setError(null);
    setStep(next);
    scroller.current?.scrollTo({ y: 0, animated: false });
  }
  const nextOf = (s: Step) => ORDER[Math.min(ORDER.indexOf(s) + 1, ORDER.length - 1)];

  async function onContinue() {
    if (!form) return;
    if (step === 'welcome') return go('personal');
    if (step === 'bmi') return go(fromReview ? 'review' : 'health');
    if (step === 'review') return finish();
    if (step === 'done') return router.replace('/home');

    const section = step as Section;
    const [problem, data] = prepare(section, form);
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      const r = await saveSection(section, data);
      setFitness(r.fitness);
      if (r.user) setUser(r.user);
      // After height & weight, always show the BMI result.
      if (section === 'body') go('bmi');
      else go(fromReview ? 'review' : nextOf(section));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    setBusy(true);
    setError(null);
    try {
      const r = await completeFitness();
      setFitness(r.fitness);
      setUser(r.user);
      go('done');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not finish. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  function back() {
    setError(null);
    if (fromReview && step !== 'review') return go('review');
    const i = ORDER.indexOf(step);
    if (i > 0) go(ORDER[i - 1]);
  }

  function edit(s: Step) {
    setFromReview(true);
    go(s);
  }

  if (loadError) {
    return (
      <Shell>
        <View style={{ padding: 20, gap: 14 }}>
          <Message text={loadError} />
          <PrimaryButton label="Try again" icon="refresh" onPress={load} />
          {user?.profileCompleted
            ? <Text style={st.link} onPress={() => router.replace('/home')}>Go to Home</Text>
            : <Text style={st.link} onPress={() => void logout()}>Log out</Text>}
        </View>
      </Shell>
    );
  }
  if (!form || !fitness) {
    return <Shell><ActivityIndicator color={c.mint} style={{ marginTop: 80 }} /></Shell>;
  }

  const pIndex = PROGRESS.indexOf(step);
  const showBack = step !== 'welcome' && step !== 'done' && !(step === 'review' && fitness.completedAt);
  const buttonLabel =
    step === 'welcome' ? "Let's start"
    : step === 'review' ? 'Finish'
    : step === 'done' ? 'Go to Home'
    : fromReview ? 'Save'
    : 'Continue';

  return (
    <Shell>
      {/* Top bar: back · progress · skip */}
      <View style={st.topBar}>
        <View style={{ width: 96 }}>
          {showBack && (
            <Pressable onPress={back} hitSlop={10} accessibilityLabel="Back" style={st.back}>
              <Ionicons name="chevron-back" size={22} color={c.text} />
            </Pressable>
          )}
        </View>
        <View style={{ flex: 1, alignItems: 'center' }}>
          {pIndex >= 0 ? (
            <Text style={st.stepText}>Step <Text style={{ color: c.text }}>{pIndex + 1}</Text> of {PROGRESS.length}</Text>
          ) : (
            <FitZoneLogo size={18} />
          )}
        </View>
        <View style={{ width: 96, alignItems: 'flex-end' }}>
          {step !== 'done' && (
            <Pressable onPress={() => (user?.profileCompleted ? router.replace('/home') : void logout())}
              hitSlop={10} accessibilityRole="button">
              <Text style={st.skip} numberOfLines={1}>{user?.profileCompleted ? 'Close' : 'Log out'}</Text>
            </Pressable>
          )}
        </View>
      </View>
      {pIndex >= 0 && (
        <View style={st.track}>
          <View style={[st.fill, { width: `${((pIndex + 1) / PROGRESS.length) * 100}%` }]} />
        </View>
      )}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scroller} contentContainerStyle={st.content} keyboardShouldPersistTaps="handled">
          {step === 'welcome' && <WelcomeStep />}
          {step === 'personal' && (
            <StepBody title="About" highlight="you" subtitle="Tell us a little about yourself.">
              <Label>Your name</Label>
              <FZInput icon="person-outline" placeholder="Full name" autoCapitalize="words" value={form.displayName}
                onChangeText={(t) => set('displayName', t)} />
              <Label>Email</Label>
              <FZInput icon="mail-outline" value={user?.email ?? ''} editable={false} />
              <Label>Gender</Label>
              <OptionCards options={GENDERS} value={form.gender} onChange={(v) => set('gender', v)} columns={2} />
              <Label hint={(() => { const a = ageFrom(`${form.year}-${form.month.padStart(2, '0')}-${form.day.padStart(2, '0')}`); return form.year.length === 4 && a !== null && a >= 0 && a < 130 ? `Age: ${a} years` : 'Day / Month / Year'; })()}>
                Date of birth
              </Label>
              <DateInput day={form.day} month={form.month} year={form.year}
                onChange={(p) => setForm((f) => (f ? { ...f, ...p } : f))} />
              <Label hint="Optional — your trainer can contact you on WhatsApp.">Phone / WhatsApp</Label>
              <FZInput icon="logo-whatsapp" placeholder="+91 98765 43210" keyboardType="phone-pad" value={form.whatsapp}
                onChangeText={(t) => set('whatsapp', t)} />
            </StepBody>
          )}
          {step === 'body' && <BodyStep form={form} set={set} />}
          {step === 'bmi' && <BmiStep fitness={fitness} />}
          {step === 'health' && (
            <StepBody title="Your" highlight="health" subtitle="This helps your trainer keep your training safe. Only you, your trainer and the gym admins can see it.">
              <Label hint="Optional — e.g. knee pain, back injury, recent surgery.">Injuries or pain</Label>
              <FZInput icon="bandage-outline" placeholder="None" multiline value={form.injuries} onChangeText={(t) => set('injuries', t)} maxLength={500} />
              <Label hint="Optional — e.g. diabetes, high blood pressure, asthma.">Medical conditions</Label>
              <FZInput icon="medkit-outline" placeholder="None" multiline value={form.medical} onChangeText={(t) => set('medical', t)} maxLength={500} />
              <Label>Do you smoke?</Label>
              <Pills options={SMOKING} value={form.smoking} onChange={(v) => set('smoking', v)} />
            </StepBody>
          )}
          {step === 'goals' && (
            <StepBody title="Goals &" highlight="experience" subtitle="What do you want to achieve, and what have you done before?">
              <Label>Main goal</Label>
              <OptionCards options={GOALS} value={form.mainGoal}
                onChange={(v) => setForm((f) => (f ? { ...f, mainGoal: v, extraGoals: f.extraGoals.filter((g) => g !== v) } : f))} />
              <Label hint="Optional — choose any that also matter to you.">Other goals</Label>
              <MultiOptionCards options={GOALS.filter((g) => g.value !== form.mainGoal).map(({ icon: _i, ...g }) => g)}
                values={form.extraGoals} onChange={(v) => set('extraGoals', v)} max={5} />
              <Label>Experience level</Label>
              <OptionCards options={EXPERIENCE} value={form.experience} onChange={(v) => set('experience', v)} />
              <Label hint="Choose all that apply.">Training you have done before</Label>
              <MultiOptionCards options={PAST_TRAINING} values={form.pastTraining} columns={2}
                onChange={(v) => {
                  // "None yet" cannot be combined with anything else.
                  const added = v.find((x) => !form.pastTraining.includes(x));
                  set('pastTraining', added === 'none' ? ['none'] : v.filter((x) => x !== 'none'));
                }} />
              {form.pastTraining.length > 0 && !form.pastTraining.includes('none') && (
                <>
                  <Label>For how long?</Label>
                  <Pills options={TRAINING_DURATION} value={form.duration} onChange={(v) => set('duration', v)} />
                </>
              )}
              <Label hint="Optional — e.g. a past coach, a sport you played, a break from training.">Anything else about your experience?</Label>
              <FZInput icon="create-outline" placeholder="e.g. Gym for a year in college, stopped in 2023" multiline
                value={form.expNotes} onChangeText={(t) => set('expNotes', t)} maxLength={300} />
            </StepBody>
          )}
          {step === 'routine' && (
            <StepBody title="Your daily" highlight="routine" subtitle="So your plan fits your day.">
              <Label>Type of work</Label>
              <OptionCards options={WORK_TYPES} value={form.workType} onChange={(v) => set('workType', v)} />
              <Label>Activity level right now</Label>
              <OptionCards options={ACTIVITY_LEVELS} value={form.activity} onChange={(v) => set('activity', v)} />
              <Label>Workout days per week</Label>
              <Stepper value={form.workoutDays} onChange={(v) => set('workoutDays', v)} min={1} max={7}
                unit={form.workoutDays === 1 ? 'day a week' : 'days a week'} />
              <Label>Preferred workout time</Label>
              <OptionCards options={WORKOUT_TIMES} value={form.workoutTime} onChange={(v) => set('workoutTime', v)} columns={2} />
            </StepBody>
          )}
          {step === 'food' && (
            <StepBody title="Food" highlight="habits" subtitle="So your nutrition advice suits how you eat.">
              <Label>Diet type</Label>
              <OptionCards options={DIET_TYPES} value={form.diet} onChange={(v) => set('diet', v)} />
              <Label>Meals per day</Label>
              <Stepper value={form.meals} onChange={(v) => set('meals', v)} min={1} max={8}
                unit={form.meals === 1 ? 'meal (including snacks)' : 'meals (including snacks)'} />
              <Label>Water per day</Label>
              <Stepper value={form.water} onChange={(v) => set('water', v)} min={0.5} max={8} step={0.5}
                format={(v) => `${v} L`} unit={`about ${Math.round(form.water * 4)} glasses`} />
              <Label hint="Optional — allergies, foods you dislike or cannot eat.">Foods to avoid</Label>
              <FZInput icon="ban-outline" placeholder="e.g. peanuts, mushrooms" value={form.avoid} onChangeText={(t) => set('avoid', t)} maxLength={300} />
              <Label>How often do you eat outside or order food?</Label>
              <Pills options={EATING_OUT} value={form.eatingOut} onChange={(v) => set('eatingOut', v)} />
            </StepBody>
          )}
          {step === 'sleep' && (
            <StepBody title="Sleep" highlight="schedule" subtitle="Good sleep helps recovery and results.">
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TimePicker label="Bedtime" icon="moon-outline" value={form.bedtime} onChange={(v) => set('bedtime', v)} />
                <TimePicker label="Wake up" icon="sunny-outline" value={form.wakeTime} onChange={(v) => set('wakeTime', v)} />
              </View>
              {form.bedtime !== form.wakeTime && (
                <View style={st.sleepSum}>
                  <Ionicons name="bed-outline" size={20} color={c.mint} />
                  <Text style={st.sleepSumText}>
                    About <Text style={{ color: c.mint, fontFamily: font.bold }}>{sleepHoursFor(form.bedtime, form.wakeTime)} hours</Text> of sleep
                  </Text>
                </View>
              )}
              <Label>How well do you usually sleep?</Label>
              <Pills options={SLEEP_QUALITY} value={form.quality} onChange={(v) => set('quality', v)} />
            </StepBody>
          )}
          {step === 'review' && <ReviewStep fitness={fitness} onEdit={edit} />}
          {step === 'done' && <DoneStep />}

        </ScrollView>

        <View style={st.bottom}>
          {error && <Message text={error} />}
          <PrimaryButton label={buttonLabel} icon={step === 'done' ? 'home-outline' : 'arrow-forward'} onPress={onContinue} loading={busy} />
        </View>
      </KeyboardAvoidingView>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AuthBackdrop />
      <SafeAreaView style={{ flex: 1, alignItems: 'center' }}>
        <View style={{ flex: 1, width: '100%', maxWidth: 520 }}>{children}</View>
      </SafeAreaView>
    </View>
  );
}

function StepBody({ title, highlight, subtitle, children }: { title: string; highlight: string; subtitle?: string; children: ReactNode }) {
  return (
    <View style={{ gap: 12 }}>
      <View style={{ marginBottom: 6 }}>
        <Text style={st.title}>{title} <Text style={{ color: c.mint }}>{highlight}</Text></Text>
        {subtitle ? <Text style={st.subtitle}>{subtitle}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function WelcomeStep() {
  const items: [keyof typeof Ionicons.glyphMap, string][] = [
    ['person-outline', 'About you'],
    ['resize-outline', 'Height, weight & BMI'],
    ['medkit-outline', 'Health'],
    ['trophy-outline', 'Goals & workout experience'],
    ['time-outline', 'Daily routine'],
    ['restaurant-outline', 'Food habits'],
    ['moon-outline', 'Sleep schedule'],
  ];
  return (
    <View style={{ gap: 18 }}>
      <View style={{ alignItems: 'center', justifyContent: 'center', height: 120 }}>
        <Glow width={260} height={150} opacity={0.3} />
        <View style={st.welcomeIcon}><Ionicons name="clipboard-outline" size={40} color={c.mint} /></View>
      </View>
      <View>
        <Text style={st.title}>Let's build your{'\n'}<Text style={{ color: c.mint }}>fitness profile</Text></Text>
        <Text style={st.subtitle}>
          A few quick questions so your trainer can plan workouts and nutrition that fit you. It takes about 3 minutes.
        </Text>
      </View>
      <View style={st.listCard}>
        {items.map(([icon, text], i) => (
          <View key={text} style={st.listRow}>
            <View style={st.listNum}><Text style={st.listNumText}>{i + 1}</Text></View>
            <Ionicons name={icon} size={18} color={c.mint} />
            <Text style={st.listText}>{text}</Text>
          </View>
        ))}
      </View>
      <Text style={st.note}>Please answer every step to start using FitZone. Your answers are saved after each step, so you can carry on later.</Text>
    </View>
  );
}

function BodyStep({ form, set }: { form: Form; set: <K extends keyof Form>(k: K, v: Form[K]) => void }) {
  const preview = bmiFor(num(form.height), num(form.weight));
  return (
    <StepBody title="Height &" highlight="weight" subtitle="Used to calculate your BMI.">
      <Label>Height</Label>
      <FZInput icon="resize-outline" placeholder="e.g. 170" keyboardType="decimal-pad" suffix="cm" maxLength={5}
        value={form.height} onChangeText={(t) => set('height', t.replace(/[^\d.,]/g, ''))} />
      <Label>Current weight</Label>
      <FZInput icon="scale-outline" placeholder="e.g. 68" keyboardType="decimal-pad" suffix="kg" maxLength={5}
        value={form.weight} onChangeText={(t) => set('weight', t.replace(/[^\d.,]/g, ''))} />
      <Label hint="Optional — the weight you would like to reach.">Target weight</Label>
      <FZInput icon="flag-outline" placeholder="e.g. 62" keyboardType="decimal-pad" suffix="kg" maxLength={5}
        value={form.target} onChangeText={(t) => set('target', t.replace(/[^\d.,]/g, ''))} />
      {preview && (
        <View style={st.sleepSum}>
          <Ionicons name="analytics-outline" size={20} color={BMI_INFO[preview.category].color} />
          <Text style={st.sleepSumText}>
            BMI preview: <Text style={{ color: BMI_INFO[preview.category].color, fontFamily: font.bold }}>{preview.value.toFixed(1)}</Text>
          </Text>
        </View>
      )}
    </StepBody>
  );
}

const SCALE_MIN = 15;
const SCALE_MAX = 40;
const SEGMENTS: { to: number; color: string }[] = [
  { to: 18.5, color: BMI_INFO.underweight.color },
  { to: 25, color: BMI_INFO.normal.color },
  { to: 30, color: BMI_INFO.overweight.color },
  { to: SCALE_MAX, color: BMI_INFO.obese.color },
];

function BmiStep({ fitness }: { fitness: FitnessProfile }) {
  const bmi = fitness.bmi;
  const body = fitness.body;
  if (!bmi || !body) return <Message text="Please enter your height and weight first." />;
  const info = BMI_INFO[bmi.category];
  const pos = (Math.min(SCALE_MAX, Math.max(SCALE_MIN, bmi.value)) - SCALE_MIN) / (SCALE_MAX - SCALE_MIN);
  const m2 = (body.heightCm / 100) ** 2;
  const low = Math.round(18.5 * m2);
  const high = Math.round(24.9 * m2);

  return (
    <StepBody title="Your" highlight="BMI" subtitle="Body Mass Index = weight (kg) ÷ height (m)².">
      <View style={st.bmiCard}>
        <Glow width={280} height={170} color={info.color} opacity={0.22} style={{ top: -10 }} />
        <Text style={st.bmiValue}>{bmi.value.toFixed(1)}</Text>
        <View style={[st.bmiBadge, { borderColor: info.color + '88', backgroundColor: info.color + '1F' }]}>
          <Text style={[st.bmiBadgeText, { color: info.color }]}>{info.label}</Text>
        </View>
        <Text style={st.bmiFrom}>{body.heightCm} cm · {body.weightKg} kg</Text>

        <View style={{ width: '100%', marginTop: 18 }}>
          <View style={st.scale}>
            {SEGMENTS.map((sg, i) => {
              const from = i === 0 ? SCALE_MIN : SEGMENTS[i - 1].to;
              return <View key={i} style={{ flex: sg.to - from, backgroundColor: sg.color, opacity: 0.85 }} />;
            })}
          </View>
          <View style={[st.marker, { left: `${pos * 100}%` }]} />
          <View style={st.scaleLabels}>
            {['15', '18.5', '25', '30', '40'].map((t) => {
              const left = ((Number(t) - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100;
              return <Text key={t} style={[st.scaleLabel, { left: `${left}%` }]}>{t}</Text>;
            })}
          </View>
        </View>
      </View>

      <View style={st.listCard}>
        {(Object.keys(BMI_INFO) as (keyof typeof BMI_INFO)[]).map((k) => (
          <View key={k} style={st.legendRow}>
            <View style={[st.dot, { backgroundColor: BMI_INFO[k].color }]} />
            <Text style={[st.listText, k === bmi.category && { color: c.text, fontFamily: font.bold }]}>{BMI_INFO[k].label}</Text>
            <Text style={st.legendRange}>{BMI_INFO[k].range}</Text>
          </View>
        ))}
      </View>

      <Text style={st.subtitle}>{info.note}</Text>
      <Text style={st.subtitle}>
        A healthy weight for your height is about <Text style={{ color: c.text, fontFamily: font.semibold }}>{low} – {high} kg</Text>.
        {body.targetWeightKg ? ` Your target: ${body.targetWeightKg} kg.` : ''}
      </Text>
      <Text style={st.note}>
        BMI is only a rough guide: it does not tell muscle from fat, so muscular people can show a higher BMI. Your trainer looks at the full picture.
      </Text>
    </StepBody>
  );
}

function ReviewStep({ fitness: f, onEdit }: { fitness: FitnessProfile; onEdit: (s: Step) => void }) {
  const rows: { step: Step; title: string; icon: keyof typeof Ionicons.glyphMap; lines: string[] }[] = [
    { step: 'personal', title: 'About you', icon: 'person-outline', lines: f.personal ? [
      f.personal.displayName, `${labelOf(GENDERS, f.personal.gender)} · ${f.age ?? '—'} years`,
      f.personal.whatsapp ? `WhatsApp ${f.personal.whatsapp}` : 'No phone number',
    ] : [] },
    { step: 'body', title: 'Height, weight & BMI', icon: 'resize-outline', lines: f.body ? [
      `${f.body.heightCm} cm · ${f.body.weightKg} kg${f.body.targetWeightKg ? ` → target ${f.body.targetWeightKg} kg` : ''}`,
      f.bmi ? `BMI ${f.bmi.value.toFixed(1)} · ${BMI_INFO[f.bmi.category].label}` : '',
    ] : [] },
    { step: 'health', title: 'Health', icon: 'medkit-outline', lines: f.health ? [
      `Injuries: ${f.health.injuries || 'none'}`, `Medical: ${f.health.medicalConditions || 'none'}`, labelOf(SMOKING, f.health.smoking),
    ] : [] },
    { step: 'goals', title: 'Goals & experience', icon: 'trophy-outline', lines: f.goals ? [
      `Main: ${labelOf(GOALS, f.goals.mainGoal)}`,
      f.goals.extraGoals.length ? `Also: ${f.goals.extraGoals.map((g) => labelOf(GOALS, g)).join(', ')}` : '',
      labelOf(EXPERIENCE, f.goals.experience),
      pastTrainingText(f.goals),
      f.goals.experienceNotes ? `Note: ${f.goals.experienceNotes}` : '',
    ] : [] },
    { step: 'routine', title: 'Daily routine', icon: 'time-outline', lines: f.routine ? [
      `${labelOf(WORK_TYPES, f.routine.workType)} · ${labelOf(ACTIVITY_LEVELS, f.routine.activityLevel)}`,
      `${f.routine.workoutDays} workout day${f.routine.workoutDays === 1 ? '' : 's'} a week · ${labelOf(WORKOUT_TIMES, f.routine.workoutTime)}`,
    ] : [] },
    { step: 'food', title: 'Food habits', icon: 'restaurant-outline', lines: f.food ? [
      `${labelOf(DIET_TYPES, f.food.dietType)} · ${f.food.mealsPerDay} meals · ${f.food.waterLitres} L water`,
      `Eating out: ${labelOf(EATING_OUT, f.food.eatingOut).toLowerCase()}`,
      f.food.avoidFoods ? `Avoid: ${f.food.avoidFoods}` : '',
    ] : [] },
    { step: 'sleep', title: 'Sleep', icon: 'moon-outline', lines: f.sleep ? [
      `${f.sleep.bedtime} → ${f.sleep.wakeTime} · ${f.sleep.sleepHours} h`, `Quality: ${labelOf(SLEEP_QUALITY, f.sleep.quality).toLowerCase()}`,
    ] : [] },
  ];

  return (
    <StepBody
      title={f.completedAt ? 'Your fitness' : 'Review your'}
      highlight="profile"
      subtitle={f.completedAt ? 'Tap Edit to update any part.' : 'Check your answers, then tap Finish.'}
    >
      {rows.map((r) => (
        <View key={r.step} style={st.reviewCard}>
          <View style={st.reviewHead}>
            <Ionicons name={r.icon} size={18} color={c.mint} />
            <Text style={st.reviewTitle}>{r.title}</Text>
            <Pressable onPress={() => onEdit(r.step)} hitSlop={10} accessibilityLabel={`Edit ${r.title}`}>
              <Text style={st.editLink}>{r.lines.length ? 'Edit' : 'Answer'}</Text>
            </Pressable>
          </View>
          {r.lines.length
            ? r.lines.filter(Boolean).map((l, i) => <Text key={i} style={st.reviewLine}>{l}</Text>)
            : <Text style={[st.reviewLine, { color: '#EF9A9A' }]}>Not answered yet</Text>}
        </View>
      ))}
    </StepBody>
  );
}

function DoneStep() {
  return (
    <View style={{ alignItems: 'center', gap: 14, paddingTop: 40 }}>
      <View style={{ alignItems: 'center', justifyContent: 'center', height: 150, width: '100%' }}>
        <Glow width={280} height={180} opacity={0.35} />
        <View style={[st.welcomeIcon, { width: 96, height: 96, borderRadius: 48 }]}>
          <Ionicons name="checkmark" size={52} color={c.mint} />
        </View>
      </View>
      <Text style={[st.title, { textAlign: 'center' }]}>Profile <Text style={{ color: c.mint }}>complete!</Text></Text>
      <Text style={[st.subtitle, { textAlign: 'center' }]}>
        Thank you. Your trainer will use this to plan your workouts and nutrition. You can update it any time from Home.
      </Text>
    </View>
  );
}

const st = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, minHeight: 50 },
  back: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },
  stepText: { color: c.muted, fontFamily: font.semibold, fontSize: 13.5, letterSpacing: 0.5 },
  skip: { color: c.textSecondary, fontFamily: font.semibold, fontSize: 13.5 },
  track: { height: 4, marginHorizontal: 20, marginTop: 8, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2, backgroundColor: c.mint },
  content: { padding: 20, paddingBottom: 30 },
  bottom: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, gap: 10 },
  title: { color: c.text, fontFamily: font.bold, fontSize: 28, lineHeight: 35, letterSpacing: -0.3 },
  subtitle: { color: c.textSecondary, fontFamily: font.regular, fontSize: 14.5, lineHeight: 21, marginTop: 6 },
  note: { color: c.muted, fontFamily: font.regular, fontSize: 12.5, lineHeight: 18 },
  link: { color: c.mint, fontFamily: font.bold, fontSize: 14, textAlign: 'center', paddingVertical: 6 },
  welcomeIcon: {
    width: 84, height: 84, borderRadius: 26, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(201,166,107,0.5)', backgroundColor: 'rgba(201,166,107,0.08)',
  },
  listCard: { borderRadius: 18, borderWidth: 1, borderColor: c.border, backgroundColor: 'rgba(17,21,24,0.9)', padding: 14, gap: 12 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  listNum: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },
  listNumText: { color: c.textSecondary, fontFamily: font.semibold, fontSize: 11.5 },
  listText: { color: '#DCE1E5', fontFamily: font.medium, fontSize: 14.5, flex: 1 },
  sleepSum: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(201,166,107,0.3)', backgroundColor: 'rgba(201,166,107,0.06)',
  },
  sleepSumText: { color: c.text, fontFamily: font.regular, fontSize: 15 },
  bmiCard: {
    alignItems: 'center', padding: 20, paddingBottom: 30, borderRadius: 22, borderWidth: 1, borderColor: c.border,
    backgroundColor: 'rgba(17,21,24,0.9)', overflow: 'hidden',
  },
  bmiValue: { color: c.text, fontFamily: font.extrabold, fontSize: 56, lineHeight: 64 },
  bmiBadge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 5 },
  bmiBadgeText: { fontFamily: font.bold, fontSize: 14, letterSpacing: 0.3 },
  bmiFrom: { color: c.muted, fontFamily: font.regular, fontSize: 13, marginTop: 8 },
  scale: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden' },
  marker: {
    position: 'absolute', top: -5, width: 4, height: 20, marginLeft: -2, borderRadius: 2,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#000',
  },
  scaleLabels: { height: 18, marginTop: 6 },
  scaleLabel: { position: 'absolute', transform: [{ translateX: -10 }], color: c.muted, fontFamily: font.regular, fontSize: 11 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendRange: { color: c.muted, fontFamily: font.regular, fontSize: 13 },
  reviewCard: { borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: 'rgba(17,21,24,0.9)', padding: 14, gap: 4 },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  reviewTitle: { color: c.text, fontFamily: font.semibold, fontSize: 15, flex: 1 },
  editLink: { color: c.mint, fontFamily: font.bold, fontSize: 14 },
  reviewLine: { color: c.textSecondary, fontFamily: font.regular, fontSize: 13.5, lineHeight: 19 },
});
