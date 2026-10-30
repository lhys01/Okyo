import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL } from 'node:url';
import { CommonActions, TabRouter } from '@react-navigation/routers';

test('Back from a Settings detail returns to Settings and recipe Back returns to its source', () => {
  const source = readFileSync(new URL('./MainTabs.tsx', import.meta.url), 'utf8');
  const backBehavior = source.match(/<Tab.Navigator\s+backBehavior="([^"]+)"/)?.[1];
  assert.equal(backBehavior, 'history');
  const router = TabRouter({ initialRouteName: 'HomeScreen', backBehavior: 'history' });
  const options = {
    routeNames: ['HomeScreen', 'SettingsScreen', 'DietaryPreferencesScreen', 'LibraryScreen', 'RecipeDetailScreen'],
    routeParamList: {}, routeGetIdList: {},
  };
  let state = router.getInitialState(options);
  const dispatch = (action: ReturnType<typeof CommonActions.navigate> | ReturnType<typeof CommonActions.goBack>) => {
    const next = router.getStateForAction(state, action, options);
    assert.ok(next);
    state = router.getRehydratedState(next, options);
  };
  const navigate = (name: string) => dispatch(CommonActions.navigate(name));
  const back = () => dispatch(CommonActions.goBack());
  navigate('SettingsScreen'); navigate('DietaryPreferencesScreen'); back();
  assert.equal(state.routes[state.index].name, 'SettingsScreen');
  navigate('LibraryScreen'); navigate('RecipeDetailScreen'); back();
  assert.equal(state.routes[state.index].name, 'LibraryScreen');
});
