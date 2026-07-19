/**
 * Signup screen — "Creá tu cuenta".
 *
 * Three inputs: email, password, confirm password. On submit, we
 * run a client-side match check (the spec's "complexity rules" are
 * the Supabase Auth defaults: min 6 chars; Phase 7 will add a
 * strength meter). On success, the screen swaps to a confirmation
 * state with "Te enviamos un correo para verificar tu cuenta" and
 * a "Volver a iniciar sesión" link.
 *
 * Unlike the login screen, there is no auto-redirect on success:
 * Supabase has NOT established a session (email verification is on
 * by default) and the user must check their inbox. The session
 * listener won't fire `SIGNED_IN` until the verification link is
 * clicked.
 */
import { useEffect, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Link, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircle2 } from 'lucide-react-native';

import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { Icon } from '@/components/atoms/Icon';
import { ErrorState } from '@/components/molecules/ErrorState';
import { useSignUp } from '@/features/auth/hooks/useSignUp';
import { colors, radius, spacing, typography } from '@/theme';

const MIN_PASSWORD_LENGTH = 6;

export default function SignupScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const signUp = useSignUp();

  // If the user navigates back to signup after a successful submit
  // (e.g. taps "Volver a iniciar sesión" and then comes back), we
  // want a fresh form. Clear the result when the inputs change.
  useEffect(() => {
    if (signUp.data) signUp.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, password, confirm]);

  const localMismatch =
    confirm.length > 0 && password !== confirm
      ? 'Las contraseñas no coinciden'
      : null;
  const tooShort =
    password.length > 0 && password.length < MIN_PASSWORD_LENGTH
      ? `Mínimo ${MIN_PASSWORD_LENGTH} caracteres`
      : null;
  const passwordError = tooShort ?? localMismatch;

  const onSubmit = () => {
    signUp.reset();
    signUp.mutate({ email: email.trim(), password });
  };

  const canSubmit =
    email.length > 0 &&
    password.length >= MIN_PASSWORD_LENGTH &&
    password === confirm;

  // Success state — Supabase created the user but did NOT start a
  // session (email verification pending).
  if (signUp.data) {
    return (
      <View
        style={[
          styles.flex,
          styles.success,
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl },
        ]}
      >
        <View style={styles.successIcon}>
          <Icon icon={CheckCircle2} size="xl" color={colors.success} />
        </View>
        <Text style={styles.title}>Revisá tu correo</Text>
        <Text style={styles.body}>
          Te enviamos un correo para verificar tu cuenta. Cuando lo
          confirmes, ya podés iniciar sesión.
        </Text>
        <Button
          label="Volver a iniciar sesión"
          onPress={() => router.replace('/login' as never)}
          variant="primary"
        />
      </View>
    );
  }

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

        <Text style={styles.title}>Creá tu cuenta</Text>

        <View style={styles.form}>
          <Input
            label="Correo"
            value={email}
            onChangeText={setEmail}
            placeholder="tu@correo.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!signUp.isPending}
          />
          <Input
            label="Contraseña"
            value={password}
            onChangeText={setPassword}
            placeholder="Mínimo 6 caracteres"
            secureTextEntry
            editable={!signUp.isPending}
            errorMessage={tooShort ?? undefined}
            variant={tooShort ? 'error' : 'default'}
          />
          <Input
            label="Confirmar contraseña"
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Volvé a escribir tu contraseña"
            secureTextEntry
            editable={!signUp.isPending}
            errorMessage={localMismatch ?? undefined}
            variant={localMismatch ? 'error' : 'default'}
          />

          {signUp.error ? (
            <ErrorState
              title="No pudimos crear la cuenta"
              body={signUp.error.userMessage}
              onRetry={onSubmit}
              retryLabel="Reintentar"
              style={styles.inlineError}
            />
          ) : null}

          <Button
            label="Crear cuenta"
            onPress={onSubmit}
            variant="primary"
            fullWidth
            loading={signUp.isPending}
            disabled={!canSubmit}
          />

          <View style={styles.signinRow}>
            <Text style={styles.signinText}>¿Ya tenés cuenta?</Text>
            <Link href="/login" asChild>
              <Text style={styles.signinLink} accessibilityRole="link">
                Iniciá sesión
              </Text>
            </Link>
          </View>
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
  inlineError: { paddingVertical: spacing.sm },
  signinRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  signinText: { ...typography.caption, color: colors.textSecondary },
  signinLink: { ...typography.caption, color: colors.primary, fontWeight: '600' },

  success: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.base,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.successSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 320,
  },
});
