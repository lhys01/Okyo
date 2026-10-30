import assert from 'node:assert/strict';
import test from 'node:test';

import { sanitizeAiAnalyticsProperties } from './analytics.js';

test('AI analytics keeps only bounded operational metadata', () => {
  const safe = sanitizeAiAnalyticsProperties({
    '$ai_model': 'openai/gpt-4o-mini',
    '$ai_provider': 'openrouter',
    '$ai_input_tokens': 120,
    '$ai_output_tokens': 300,
    '$ai_is_error': false,
    request_type: 'vision',
    retry_count: 1,
    fallback_used: true,
    environment: 'production',
    photo: 'base64 private image',
    prompt: 'private prompt text',
    allergies: ['peanuts'],
    dietary_restrictions: ['gluten'],
    weight: 71,
    health_goal: 'lose weight',
    email: 'person@example.invalid',
    token: 'secret-token',
    access_token: 'secret-access-token',
    password: 'secret-password',
    dish_name: 'private dish',
    recipe: 'private recipe',
    error_message: 'raw provider response',
    arbitrary: { nested: 'private' },
  });

  assert.deepEqual(safe, {
    '$ai_model': 'openai/gpt-4o-mini',
    '$ai_provider': 'openrouter',
    '$ai_input_tokens': 120,
    '$ai_output_tokens': 300,
    '$ai_is_error': false,
    request_type: 'vision',
    retry_count: 1,
    fallback_used: true,
    environment: 'production',
  });
  assert.doesNotMatch(JSON.stringify(safe), /base64|private|peanuts|71|person@|secret|raw provider/);
});

test('AI analytics rejects caller supplied models and unsafe free-form properties', () => {
  assert.deepEqual(sanitizeAiAnalyticsProperties({
    '$ai_model': 'attacker/model',
    fallback_model: 'attacker/fallback',
    '$ai_error': 'raw-provider-error-with spaces',
    request_id: 'private/request',
    '$ai_input_tokens': Number.POSITIVE_INFINITY,
    '$ai_latency': -1,
  }), {});
});
