/**
 * Reservas tab — Phase 2 placeholder.
 *
 * The full Phase 5 screen renders a segmented control (Mis reservas
 * / En mis cargadores) with a list of ReservationCards. For now we
 * render an EmptyState prompting login; the CTA navigates to
 * `/login?returnTo=/reservations` (login lands in Phase 3).
 */
import { useRouter } from 'expo-router';
import { CalendarCheck } from 'lucide-react-native';

import { EmptyState } from '@/components/molecules/EmptyState';

export default function ReservationsTab() {
  const router = useRouter();
  return (
    <EmptyState
      icon={CalendarCheck}
      title="Necesitás iniciar sesión"
      body="Iniciá sesión para ver tus reservas y las reservas de tus cargadores."
      ctaLabel="Iniciá sesión"
      // Phase 3 (auth) owns the login route. Cast via `as never` so the
      // typed-routes pass until Phase 3 lands.
      onCtaPress={() => router.push('/login?returnTo=/reservations' as never)}
    />
  );
}
