import test from 'node:test';
import assert from 'node:assert/strict';
import { initialHealthDraft, type HealthDraft } from './healthBranch';
import { HEALTH_PROBLEM_LABELS, HEALTH_BARRIER_LABELS, HEALTH_DEFINITION_LABELS, COOKING_FREQUENCY_LABELS, MEAL_PRIORITY_LABELS, MEAL_TO_IMPROVE_LABELS, FOOD_STYLE_LABELS, HEALTH_COMMITMENT_LABELS, problemAcknowledgement, problemDiagnosisHeadline, problemDiagnosisBody, solutionHeadline, solutionSupport, planSummaryRows, revealSummary } from './healthBranchCopy';
const draft: HealthDraft = { ...initialHealthDraft, healthProblem: 'too_much_takeout', healthBarrier: 'not_enough_time', mealToImprove: 'dinner', cookingFrequency: 'one_to_two_week', healthDefinition: 'less_takeout', mealPriority: 'tastes_good', foodStyles: ['comfort_food'], flexibleCommitment: 'one_meal_daily' };
const keys = <T extends string>(map: Record<T, string>) => Object.keys(map) as T[];
test('diagnosis repeats the four explicit Problem answers naturally', () => {
  assert.equal(problemDiagnosisHeadline('dinner'), 'Dinner is where you want the biggest change.');
  assert.equal(problemDiagnosisBody(draft), "You said too much takeout is the main issue, and not enough time gets in the way. Since you cook 1–2 times a week, we'll start by making dinner easier.");
  assert.equal(problemDiagnosisBody({ ...draft, healthProblem: 'meals_unbalanced', healthBarrier: 'dont_know_what_to_cook', mealToImprove: 'lunch', cookingFrequency: 'three_to_four_week' }), "You said meals feeling unbalanced is the main issue, and being unsure what to cook gets in the way. Since you cook 3–4 times a week, we'll start by making lunch easier.");
  assert.equal(problemDiagnosisBody({ ...draft, healthProblem: 'low_energy', healthBarrier: 'too_hungry_tired', mealToImprove: 'breakfast', cookingFrequency: 'almost_never' }), "You said low energy is the main issue, and feeling too hungry or tired gets in the way. Since you almost never cook, we'll start by making breakfast easier.");
  assert.equal(problemDiagnosisBody({ ...draft, healthProblem: 'eating_inconsistent', healthBarrier: 'struggle_consistency', mealToImprove: 'it_varies', cookingFrequency: 'every_day' }), "You said inconsistent eating is the main issue, and difficulty staying consistent gets in the way. Since you cook every day, we'll start by making meals across your day easier.");
  assert.equal(problemDiagnosisHeadline('snacks'), 'Snacks are where you want the biggest change.');
  assert.equal(problemDiagnosisHeadline('it_varies'), 'You want changes across your day.');
});
test('the acknowledgement is empathetic and tied to the barrier without inventing a medical claim', () => {
  for (const barrier of keys(HEALTH_BARRIER_LABELS)) {
    const acknowledgement = problemAcknowledgement(barrier);
    assert.doesNotMatch(acknowledgement.title, /undefined|null|diagnos|cure|treat/i);
    assert.match(acknowledgement.body, /^You don’t need a perfect routine\./);
    assert.match(acknowledgement.body, /food you already enjoy/);
  }
  assert.equal(problemAcknowledgement('not_enough_time').title, 'Finding time is hard.');
  assert.equal(problemAcknowledgement('too_expensive').title, 'Eating well can get expensive.');
});
test('every problem, barrier, meal, and frequency combination has safe complete copy', () => {
  for (const healthProblem of keys(HEALTH_PROBLEM_LABELS)) for (const healthBarrier of keys(HEALTH_BARRIER_LABELS)) for (const mealToImprove of keys(MEAL_TO_IMPROVE_LABELS)) for (const cookingFrequency of keys(COOKING_FREQUENCY_LABELS)) {
    const text = problemDiagnosisBody({ healthProblem, healthBarrier, mealToImprove, cookingFrequency });
    assert.doesNotMatch(text, /undefined|null|caused|falls? apart|Mornings is/);
    assert.match(text, /^You said .+ Since .+ easier\.$/);
  }
});
test('solution copy preserves the selected goal and ties the starting action to the meal and priority', () => {
  for (const definition of keys(HEALTH_DEFINITION_LABELS)) for (const priority of keys(MEAL_PRIORITY_LABELS)) for (const meal of keys(MEAL_TO_IMPROVE_LABELS)) {
    const headline = solutionHeadline(definition, meal, priority);
    assert.match(headline, new RegExp(`^${HEALTH_DEFINITION_LABELS[definition]}, starting with easier homemade`));
    assert.doesNotMatch(headline, /undefined|null/);
  }
  assert.equal(solutionHeadline('less_takeout', 'dinner', 'tastes_good'), 'Less takeout, starting with easier homemade dinners.');
  const supports = keys(MEAL_PRIORITY_LABELS).map((priority) => solutionSupport('dinner', priority));
  assert.equal(new Set(supports).size, 5);
  supports.forEach(text => assert.match(text, /^Scan or describe a dish\. Okyo gives you the recipe/));
  assert.match(solutionSupport('dinner', 'tastes_good'), /dinner easier while keeping flavor/);
});
test('final plan has two three-item story sections and a concise personalized next move', () => {
  assert.deepEqual(planSummaryRows(draft), [
    { id: 'problem', label: 'Your main challenge', value: 'Too much takeout' },
    { id: 'barrier', label: 'What gets in the way', value: 'Not enough time' },
    { id: 'meal', label: 'Hardest meal', value: 'Dinner' },
    { id: 'goal', label: 'Your goal', value: 'Less takeout' },
    { id: 'priority', label: 'What matters most', value: 'Tastes good' },
    { id: 'pace', label: 'Starting pace', value: 'One healthier meal a day' },
  ]);
  for (const flexibleCommitment of keys(HEALTH_COMMITMENT_LABELS)) assert.equal(planSummaryRows({ ...draft, flexibleCommitment })[5].value, HEALTH_COMMITMENT_LABELS[flexibleCommitment]);
  for (const style of keys(FOOD_STYLE_LABELS)) assert.doesNotMatch(revealSummary({ ...draft, foodStyles: [style] }), /undefined|null/);
  assert.equal(revealSummary(draft), 'Start with one easier homemade dinner a day — less takeout, still comfort food.');
  assert.match(planSummaryRows(initialHealthDraft)[0].value, /Not yet specified/);
});
