/**
 * 5-tab bottom-bar layout.
 *
 * Tabs in order: Inicio, Mapa, Mensajes, Reservas, Perfil.
 * Active tab is tinted with `colors.primary`; inactive is the
 * secondary text color. Each tab has a lucide icon rendered
 * through the shared `Icon` atom so the icon set stays
 * swappable in one place.
 *
 * Real screen content lands in Phase 4 (Inicio + Mapa) and Phase 5
 * (Mensajes + Reservas + Perfil). Auth gating (useRequireAuth on
 * the auth-gated tabs) lands in Phase 3.
 */
import { Tabs } from 'expo-router';
import { CalendarCheck, Home, Map as MapIcon, MessageCircle, User } from 'lucide-react-native';

import { Icon } from '@/components/atoms/Icon';
import { colors } from '@/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '500' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color, size }) => <Icon icon={Home} size="md" color={color} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Mapa',
          tabBarIcon: ({ color, size }) => <Icon icon={MapIcon} size="md" color={color} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Mensajes',
          tabBarIcon: ({ color, size }) => <Icon icon={MessageCircle} size="md" color={color} />,
        }}
      />
      <Tabs.Screen
        name="reservations"
        options={{
          title: 'Reservas',
          tabBarIcon: ({ color, size }) => <Icon icon={CalendarCheck} size="md" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => <Icon icon={User} size="md" color={color} />,
        }}
      />
    </Tabs>
  );
}
