/**
 * Password reset screen — "Recuperá tu contraseña".
 *
 * Single email input. On submit, calls `useResetPassword` and
 * renders "Revisá tu correo para restablecer la contraseña" on
 * success. The Supabase email contains a deep link to the app
 * (configured in `useResetPassword` via `Linking.createURL('/')`);
 * v2.1 will add a `/reset-callback` route that handles the new
 * password form once the user taps the link.
 *
 * We intentionally do NOT validate that the email exists —
 * Supabase returns success either way (no user-enumeration leak).
 * The success copy is the same for "email sent" and "email not
 * registered" cases for that reason.
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
import { MailCheck } from 'lucide-react-native';

import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { Icon } from '@/components/atoms/Icon';
import { ErrorState } from '@/components/molecules/ErrorState';
import { useResetPassword } from '@/features/auth/hooks/useResetPassword';
import { colors, radius, spacing, typography } from '@/theme';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ResetScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const reset = useResetPassword();

  useEffect(() => {
    if (reset.error) reset.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  const isValidEmail = EMAIL_RE.test(email.trim());

  if (reset.isSuccess) {
    return (
      <View
        style={[
          styles.flex,
          styles.success,
          {
            paddingTop: insets.top + spacing.xl,
            paddingBottom: insets.bottom + spacing.xl,
          },
        ]}
      >
        <View style={styles.successIcon}>
          <Icon icon={MailCheck} size="xl" color={colors.success} />
        </View>
        <Text style={styles.title}>Revisá tu correo</Text>
        <Text style={styles.body}>
          Si la dirección está registrada, te enviamos un link para
          restablecer la contraseña.
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

        <Text style={styles.title}>Recuperá tu contraseña</Text>
        <Text style={styles.subtitle}>
          Te enviamos un link para que la cambies.
        </Text>

        <View style={styles.form}>
          <Input
            label="Correo"
            value={email}
            onChangeText={setEmail}
            placeholder="tu@correo.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!reset.isPending}
          />

          {reset.error ? (
            <ErrorState
              title="No pudimos enviar el link"
              body={reset.error.userMessage}
              onRetry={() => reset.mutate({ email: email.trim() })}
              retryLabel="Reintentar"
              style={styles.inlineError}
            />
          ) : null}

          <Button
            label="Enviar link"
            onPress={() => reset.mutate({ email: email.trim() })}
            variant="primary"
            fullWidth
            loading={reset.isPending}
            disabled={!isValidEmail}
          />

          <View style={styles.backRow}>
            <Link href="/login" asChild>
              <Text style={styles.backLink} accessibilityRole="link">
                Volver a iniciar sesión
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
  subtitle: { ...typography.body, color: colors.textSecondary },
  form: { gap: spacing.base },
  inlineError: { paddingVertical: spacing.sm },
  backRow: { alignItems: 'center', marginTop: spacing.xs },
  backLink: { ...typography.caption, color: colors.primary, fontWeight: '600' },

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
