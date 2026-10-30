import './src/startup/nativeSplash';
import { initializeCrashReporting } from './src/observability/sentry';
import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
initializeCrashReporting();
registerRootComponent(App);
