import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import 'react-native-url-polyfill/auto';

import { supabasePublicConfig } from './config';

export const supabaseClient = supabasePublicConfig
  ? createClient(supabasePublicConfig.url, supabasePublicConfig.publishableKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

if (supabaseClient) {
  if (AppState.currentState === 'active') {
    supabaseClient.auth.startAutoRefresh();
  } else {
    supabaseClient.auth.stopAutoRefresh();
  }

  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabaseClient.auth.startAutoRefresh();
    } else {
      supabaseClient.auth.stopAutoRefresh();
    }
  });
}
