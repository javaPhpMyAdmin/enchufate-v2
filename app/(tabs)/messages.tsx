/**
 * Mensajes tab — Phase 2 placeholder.
 *
 * The full Phase 5 screen renders a search bar + conversation list
 * (avatar, display name, last message preview, relative timestamp).
 * For now we render an EmptyState that prompts login; the CTA
 * navigates to `/login?returnTo=/messages` (login lands in
 * Phase 3, so the navigation will be a 404 until then).
 */
import { useRouter } from 'expo-router';
import { MessageCircle } from 'lucide-react-native';

import { EmptyState } from '@/components/molecules/EmptyState';

export default function MessagesTab() {
  const router = useRouter();
  return (
    <EmptyState
      icon={MessageCircle}
      title="Necesitás iniciar sesión"
      body="Iniciá sesión para ver tus conversaciones con anfitriones y huéspedes."
      ctaLabel="Iniciá sesión"
      onCtaPress={() => router.push('/login?returnTo=/messages')}
    />
  );
}
