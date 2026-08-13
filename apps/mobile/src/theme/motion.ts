export const motionTokens = Object.freeze({
  press: { inMs: 90, outMs: 140, pressedScale: 0.97, easing: 'outQuad' },
  enter: { durationMs: 260, translateY: 8, easing: 'outCubic' },
  exit: { durationMs: 180, easing: 'inQuad' },
  carousel: { damping: 22, stiffness: 220 },
  countUp: { durationMs: 700, easing: 'outCubic' },
  graphDraw: { durationMs: 900, easing: 'outQuad' },
  splash: { opacityMs: 220, scaleMs: 300, wiggleLegMs: 600, wiggleDelayMs: 300 },
  pagerDot: { durationMs: 180, reduceMotionMs: 100, inactiveWidth: 6, activeWidth: 18, inactiveOpacity: 0.3 },
  cta: { pressInMs: 90, pressOutMs: 140, pressedScale: 0.975, shadowResting: 0.18, shadowPressed: 0.1 },
  settle: {
    pageMs: 250, pageTranslateY: 8, pageInitialOpacity: 0.92,
    kikoMs: 280, kikoDelayMs: 40, kikoTranslateY: 6, kikoInitialScale: 0.98, kikoInitialOpacity: 0.9,
    reduceMotionMs: 150,
  },
  stagger: { durationMs: 240, delayStepMs: 50, translateY: 6, reduceMotionMs: 150 },
  scanSweep: { travelMs: 1450, pauseMs: 550, startPercent: 15, endPercent: 82, reduceMotionPercent: 50, reduceMotionOpacity: 0.5 },
  chipFloat: { legMs: 2100, delayStepMs: 260, translateY: -2 },
  attribution: { rowMs: 220, rowDelayStepMs: 40, selectMs: 160, springDamping: 18, springStiffness: 220 },
  graph: { textLeadMs: 260, lineMs: 900, takeoutDelayMs: 380, endpointMs: 200, endpointDelayMs: 1350, footnoteMs: 240, footnoteDelayMs: 1550 },
  approach: { backCardMs: 260, frontCardMs: 280, kikoCardMs: 300, frontDelayMs: 40, kikoDelayMs: 80 },
  value: { bowlMs: 280, tileMs: 220, tileDelayStepMs: 60 },
  meetKiko: { entryMs: 280, doodleMs: 180, doodleDelayStepMs: 40, idleTranslateLegMs: 2000, idleRotateLegMs: 2400, idleDelayMs: 400 },
  nameFox: { entryMs: 260, translateX: 16 },
  loading: { backdropMs: 150, spinnerMs: 800 },
  dietary: { toggleMs: 150 },
} as const);

export const motionEasings = Object.freeze({
  entrance: 'outQuad',
  loop: 'inOutQuad',
  float: 'inOutSin',
  linear: 'linear',
} as const);
