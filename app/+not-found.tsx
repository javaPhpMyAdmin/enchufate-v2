/**
 * 404 catch-all screen — Expo Router 6 renders this whenever a user
 * hits a route that doesn't exist (e.g. a stale deep link, a typo
 * in a `router.push()` call from a notification, or a manual URL
 * entry on web).
 *
 * Style note: the orange `#FF6B1F` is the brand accent. Phase 2 will
 * import it from `src/theme/colors.ts`; for now we use a literal so
 * this file is self-contained and renders correctly even before the
 * design tokens ship.
 */
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function NotFoundScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.brand}>Enchufate</Text>
      <Text style={styles.title}>No encontramos esta página</Text>
      <Text style={styles.body}>
        El enlace que seguiste puede haber expirado o no existir.
      </Text>
      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        onPress={() => router.replace('/')}
        accessibilityRole="button"
        accessibilityLabel="Volver al inicio"
      >
        <Text style={styles.buttonText}>Volver al inicio</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#FAFAFA',
  },
  brand: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FF6B1F',
    marginBottom: 24,
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#0F1419',
    marginBottom: 8,
    textAlign: 'center',
  },
  body: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 32,
    textAlign: 'center',
    lineHeight: 22,
  },
  button: {
    backgroundColor: '#FF6B1F',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
