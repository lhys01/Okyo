import { NavigationContainer } from '@react-navigation/native';
import { Baloo2_800ExtraBold } from '@expo-google-fonts/baloo-2';
import { Nunito_400Regular, Nunito_700Bold, Nunito_800ExtraBold } from '@expo-google-fonts/nunito';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { initializeAuthSession } from './src/auth/session';
import { AppNavigator } from './src/navigation/AppNavigator';

export default function App() {
  useFonts({
    Baloo2_800ExtraBold,
    Nunito_400Regular,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });

  useEffect(() => {
    void initializeAuthSession();
  }, []);

  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <AppNavigator />
    </NavigationContainer>
  );
}
