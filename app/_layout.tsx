import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { useEffect, useState } from 'react';
import { Asset } from 'expo-asset';
import * as SplashScreen from 'expo-splash-screen';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { LoadingScreen } from '@/components/LoadingScreen';
import { useFileSystemStore } from '@/store/useFileSystemStore';

// Prevent the native splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        await SplashScreen.hideAsync();

        // Initialize the file system store (generates files + assigns image assets)
        const store = useFileSystemStore.getState();
        if (!store.initialized) {
          store.initialize();
        }

        // Preload only the images actually assigned to initial files
        const files = useFileSystemStore.getState().files;
        const assets = files
          .map((f: any) => f.asset)
          .filter((a: any) => a != null);

        const minDelay = new Promise((resolve) => setTimeout(resolve, 3000));

        await Promise.all([
          assets.length > 0 ? Asset.loadAsync(assets) : Promise.resolve(),
          minDelay,
        ]);
      } catch (e) {
        console.warn('Preloading failed:', e);
      } finally {
        setAppReady(true);
      }
    }

    prepare();
  }, []);

  if (!appReady) {
    return <LoadingScreen />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
        <StatusBar style="auto" hidden />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
