/**
 * Login screen — "Bienvenido de vuelta".
 *
 * Renders the email + password form, the "Olvidé mi contraseña"
 * link, the "Crear cuenta" link, and the "Continuar con Google"
 * button. On successful sign-in, the `useSession` listener fires
 * `SIGNED_IN` and we `router.replace(returnTo ?? '/(tabs)')` so
 * the user lands on their original destination (or the home tab).
 *
 * `returnTo` is read from the URL and validated against
 * `isAllowedReturnTo` — an attacker-crafted deep link can never
 * redirect the user off-allow-list (see `allowList.ts` for the
 * threat model). Invalid `returnTo` values are silently ignored.
 *
 * The submit button is debounced 800ms by `useSignIn` so rapid
 * double-taps don't fire 2 parallel `signInWithPassword` calls.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { Divider } from '@/components/molecules/Divider';
import { ErrorState } from '@/components/molecules/ErrorState';
import { isAllowedReturnTo } from '@/features/auth/allowList';
import { useGoogleOAuth } from '@/features/auth/hooks/useGoogleOAuth';
import { useSession } from '@/features/auth/hooks/useSession';
import { useSignIn } from '@/features/auth/hooks/useSignIn';
import { colors, radius, spacing, typography } from '@/theme';

const FALLBACK_RETURN_TO = '/(tabs)';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ returnTo?: string }>();

  // Validate `returnTo` once on mount. The router.replace after
  // sign-in only fires for valid paths; an invalid one is dropped
  // and the user lands on the fallback home tab.
  const safeReturnTo = useMemo(() => {
    const raw = typeof params.returnTo === 'string' ? params.returnTo : undefined;
    return raw && isAllowedReturnTo(raw) ? raw : FALLBACK_RETURN_TO;
  }, [params.returnTo]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const signIn = useSignIn();
  const google = useGoogleOAuth();
  const { session } = useSession();

  // Redirect once a session appears. Watching `session` instead of
  // the mutation's `onSuccess` keeps the navigation in sync with
  // the auth state — useful if the user opens login in two tabs
  // (e.g. on web) and signs in via the second one.
  useEffect(() => {
    if (session) {
      router.replace(safeReturnTo as never);
    }
  }, [session, safeReturnTo]);

  const onSubmit = () => {
    signIn.reset();
    signIn.mutate({ email: email.trim(), password });
  };

  const onGoogle = () => {
    google.reset();
    google.mutate();
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: insets.top + spacing.xl,
            paddingBottom: insets.bottom + spacing.xl,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Brand mark */}
        <View style={styles.brand}>
          <View style={styles.brandMark}>
            <Image
              source={require('@/../assets/icons/cargador.png')}
              style={styles.brandIcon}
              accessibilityIgnoresInvertColors
            />
          </View>
          <Text style={styles.brandText}>Enchufate</Text>
        </View>

        <Text style={styles.title}>Bienvenido de vuelta</Text>

        <View style={styles.form}>
          <Input
            label="Correo"
            value={email}
            onChangeText={setEmail}
            placeholder="tu@correo.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!signIn.isPending}
          />
          <Input
            label="Contraseña"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            editable={!signIn.isPending}
          />

          <Link href="/reset" asChild>
            <Text style={styles.forgotLink} accessibilityRole="link">
              Olvidé mi contraseña
            </Text>
          </Link>

          {signIn.error ? (
            <ErrorState
              title="No pudimos iniciar sesión"
              body={signIn.error.userMessage}
              onRetry={onSubmit}
              retryLabel="Reintentar"
              style={styles.inlineError}
            />
          ) : null}

          <Button
            label="Iniciar sesión"
            onPress={onSubmit}
            variant="primary"
            fullWidth
            loading={signIn.isPending}
            disabled={!email || !password}
          />

          <View style={styles.signupRow}>
            <Text style={styles.signupText}>¿No tenés cuenta?</Text>
            <Link href="/signup" asChild>
              <Text style={styles.signupLink} accessibilityRole="link">
                Creá tu cuenta
              </Text>
            </Link>
          </View>

          <Divider label="o continuá con" style={styles.divider} />

          {google.error && google.error.code !== 'oauth_cancelled' ? (
            <ErrorState
              title="No pudimos iniciar con Google"
              body={google.error.userMessage}
              onRetry={onGoogle}
              retryLabel="Reintentar"
              style={styles.inlineError}
            />
          ) : null}

          <Button
            label="Continuar con Google"
            onPress={onGoogle}
            variant="secondary"
            fullWidth
            loading={google.isPending}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  brandMark: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandIcon: { width: 24, height: 24 },
  brandText: { ...typography.display, color: colors.primary, fontSize: 24 },
  title: { ...typography.display, color: colors.textPrimary },
  form: { gap: spacing.base },
  forgotLink: {
    ...typography.caption,
    color: colors.primary,
    textAlign: 'right',
    fontWeight: '600',
  },
  inlineError: { paddingVertical: spacing.sm },
  signupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  signupText: { ...typography.caption, color: colors.textSecondary },
  signupLink: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  divider: { marginVertical: spacing.sm },
});
