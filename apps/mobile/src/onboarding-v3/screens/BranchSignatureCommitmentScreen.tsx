import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { NavArrowLeft } from 'iconoir-react-native';
import Svg, { Path } from 'react-native-svg';

import { colors, onboardingFontFamilies as fontFamilies, onboardingTitleFont } from '../../theme/okyoTheme';
import { OnboardingCTA } from '../components/OnboardingCTA';
import { useMascotName } from '../../state/useMascotName';
import { branchCommitmentPersistence, type CommitmentBranch } from '../state/branchCommitmentPersistence';
import { beginStroke, clearSignature, compactSignature, emptySignature, extendStroke, isValidSignature, pointFromTouchEvent, pointFromSignatureDrag, resizeSignatureCanvas, signaturePathData, type SignatureCanvasSize, type SignatureDrawing, type SignaturePoint } from '../state/signatureDrawing';

const KIKO = require('../../../assets/onboarding-v3/stickers/fox-sleeping.png');
const copy: Record<CommitmentBranch, { title: string; body: string; cta: string }> = {
  eat_healthier: { title: 'Ready to make healthier choices that fit your life?', body: 'Sign your name and make this plan yours.', cta: 'Create an account' },
  save_money: { title: 'Ready to cook a little more and keep more?', body: 'Sign your name and commit to a plan that fits your week.', cta: 'Continue to your account' },
  hit_macros: { title: 'Ready to build meals around your goals?', body: 'Sign your name and make your plan personal.', cta: 'Continue to your account' },
};

export function BranchSignatureCommitmentScreen({ branch, onBack, onContinue }: { branch: CommitmentBranch; onBack: () => void; onContinue: () => void }) {
  const mascotName = useMascotName();
  const { height, width } = useWindowDimensions();
  const compactLayout = height < 740 || width < 380;
  const [drawing, setDrawing] = useState<SignatureDrawing>(() => emptySignature(0.42));
  const [ready, setReady] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [canvas, setCanvas] = useState<SignatureCanvasSize>({ width: 1, height: 0.42 });
  const canvasRef = useRef<SignatureCanvasSize>({ width: 1, height: 0.42 });
  const submitting = useRef(false);
  const strokeOrigin = useRef<SignaturePoint | null>(null);
  useEffect(() => { let active = true; void branchCommitmentPersistence.read(branch).then((saved) => { if (active && saved) setDrawing(resizeSignatureCanvas(saved, canvasRef.current.height / canvasRef.current.width)); if (active) setReady(true); }); return () => { active = false; }; }, [branch]);
  const valid = isValidSignature(drawing);
  const path = useMemo(() => signaturePathData(drawing, canvas.width), [canvas.width, drawing]);
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponderCapture: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (event) => {
      const point = pointFromTouchEvent(event, canvasRef.current);
      strokeOrigin.current = point;
      if (point) setDrawing((current) => beginStroke(resizeSignatureCanvas(current, canvasRef.current.height / canvasRef.current.width), point));
    },
    onPanResponderMove: (_event, gesture) => {
      const point = pointFromSignatureDrag(strokeOrigin.current, gesture.dx, gesture.dy, canvasRef.current);
      if (point) setDrawing((current) => extendStroke(resizeSignatureCanvas(current, canvasRef.current.height / canvasRef.current.width), point));
    },
    onPanResponderRelease: () => undefined,
    onPanResponderTerminate: () => undefined,
  }), []);
  const handleCanvasLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
    const next = { width, height };
    canvasRef.current = next;
    setCanvas(next);
    setDrawing((current) => resizeSignatureCanvas(current, height / width));
  };
  const details = copy[branch];
  const back = async () => {
    if (!ready) return;
    try {
      await branchCommitmentPersistence.write(branch, drawing);
      onBack();
    } catch {
      setSaveError(true);
    }
  };
  const submit = async () => {
    if (!valid || submitting.current) return;
    submitting.current = true;
    try {
      await branchCommitmentPersistence.write(branch, compactSignature(drawing, 180));
      onContinue();
    } catch {
      setSaveError(true);
    } finally {
      submitting.current = false;
    }
  };
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.scrollContent} style={styles.scroll}><View style={[styles.page, compactLayout && styles.pageCompact]}>
    <Pressable accessibilityLabel="Go back" accessibilityRole="button" onPress={() => { void back(); }} style={styles.back}><NavArrowLeft color={colors.ink} height={25} strokeWidth={2.35} width={25} /></Pressable>
    <Image accessibilityLabel={`${mascotName} resting with your plan`} contentFit="contain" source={KIKO} style={[styles.kiko, compactLayout && styles.kikoCompact]} />
    <Text accessibilityRole="header" style={[styles.title, compactLayout && styles.titleCompact]}>{details.title}</Text><Text style={[styles.body, compactLayout && styles.bodyCompact]}>{details.body}</Text>
    <View accessibilityLabel="Signature canvas" onLayout={handleCanvasLayout} pointerEvents={ready ? 'auto' : 'none'} style={[styles.canvas, compactLayout && styles.canvasCompact]} {...responder.panHandlers}>
      <Svg pointerEvents="none" height="100%" width="100%" viewBox={`0 0 ${canvas.width} ${canvas.height}`}>
        <Path d={path} fill="none" stroke={colors.ink} strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.2} />
      </Svg>
      {!drawing.strokes.length ? <Text pointerEvents="none" style={styles.placeholder}>Draw your signature here</Text> : null}
    </View>
    <Pressable accessibilityLabel="Clear signature" accessibilityRole="button" onPress={() => { setDrawing(clearSignature(drawing)); setSaveError(false); }} style={styles.clear}><Text style={styles.clearText}>Clear signature</Text></Pressable>
    {saveError ? <Text accessibilityRole="alert" style={styles.error}>Couldn’t save your signature. Please try again.</Text> : null}
    <OnboardingCTA disabled={!ready || !valid} label={details.cta} onPress={() => { void submit(); }} tone="pastelPink" />
  </View></ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.canvas, flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  page: { flexGrow: 1, gap: 10, paddingHorizontal: 24, paddingBottom: 18 },
  pageCompact: { gap: 6, paddingBottom: 10, paddingHorizontal: 20 },
  back: { alignItems: 'center', borderColor: colors.border, borderRadius: 24, borderWidth: 1, height: 48, justifyContent: 'center', marginTop: 4, width: 48 },
  kiko: { alignSelf: 'center', height: 124, marginTop: 0, transform: [{ translateY: -5 }], width: 150 },
  kikoCompact: { height: 120, width: 146 },
  title: { ...onboardingTitleFont, alignSelf: 'stretch', color: colors.ink, fontSize: 29, lineHeight: 35, textAlign: 'center' },
  titleCompact: { fontSize: 28, lineHeight: 34 },
  body: { alignSelf: 'stretch', color: colors.body, fontFamily: fontFamilies.body, fontSize: 16, lineHeight: 22, textAlign: 'center' },
  bodyCompact: { fontSize: 15, lineHeight: 20 },
  canvas: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 22, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 160, overflow: 'hidden' },
  canvasCompact: { minHeight: 124 },
  placeholder: { color: colors.muted, fontFamily: fontFamilies.medium, fontSize: 15, position: 'absolute', textAlign: 'center' },
  clear: { alignItems: 'center', minHeight: 40, justifyContent: 'center' },
  clearText: { color: colors.body, fontFamily: fontFamilies.semibold, fontSize: 15 },
  error: { color: colors.coralDark, fontFamily: fontFamilies.medium, fontSize: 14, textAlign: 'center' },
});
