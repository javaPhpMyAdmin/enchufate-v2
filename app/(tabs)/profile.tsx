/**
 * Perfil tab — Phase 2 placeholder.
 *
 * The full Phase 5 screen renders the user's avatar, name,
 * "Miembro desde", stat cards, and "Mis cargadores" list. For
 * now we render an EmptyState prompting login; the CTA navigates
 * to `/login?returnTo=/profile` (login lands in Phase 3).
 */
import { useRouter } from 'expo-router';
import { User } from 'lucide-react-native';

import { EmptyState } from '@/components/molecules/EmptyState';

export default function ProfileTab() {
  const router = useRouter();
  return (
    <EmptyState
      icon={User}
      title="Iniciá sesión para gestionar tu cuenta"
      body="Publicá cargadores, editá tu perfil y revisá tus estadísticas desde acá."
      ctaLabel="Iniciá sesión"
      onCtaPress={() => router.push('/login?returnTo=/profile')}
    />
  );
}
