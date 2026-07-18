/**
 * 5-tab bottom-bar layout — Phase 1 placeholder.
 *
 * Tabs in order: Inicio, Mapa, Mensajes, Reservas, Perfil.
 * Real screen content lands in Phase 4 (Inicio + Mapa) and Phase 5
 * (Mensajes + Reservas + Perfil). Auth gating (useRequireAuth on
 * the auth-gated tabs) lands in Phase 3.
 *
 * Icons and active-tint coloring use real values from `src/theme`
 * in Phase 2 once the color tokens are populated. For now, tabs
 * render with text labels only.
 */
import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="map" options={{ title: 'Mapa' }} />
      <Tabs.Screen name="messages" options={{ title: 'Mensajes' }} />
      <Tabs.Screen name="reservations" options={{ title: 'Reservas' }} />
      <Tabs.Screen name="profile" options={{ title: 'Perfil' }} />
    </Tabs>
  );
}
