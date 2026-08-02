/**
 * 5-tab native bottom-bar layout.
 *
 * Uses NativeTabs (expo-router/unstable-native-tabs) for a true native
 * UITabBar on iOS and BottomNavigationView on Android.
 *
 * Platform icons:
 *   - iOS → SF Symbols via `sf` prop (native, scalable, auto-tinted)
 *   - Android → VectorIcon helper generates an image source, the native
 *     layer tints it using `iconColor`.
 */
import { NativeTabs, Icon, VectorIcon, Label } from 'expo-router/unstable-native-tabs';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { colors } from '@/theme';

const iconFamily = MaterialCommunityIcons;

export default function TabsLayout() {
  return (
    <NativeTabs
      disableIndicator
      rippleColor={colors.border}
      tintColor={colors.primary}
      iconColor={{ default: colors.tabInactive, selected: colors.primary }}
      labelStyle={{
        default: { fontSize: 13, fontWeight: '700', color: colors.tabInactive },
        selected: { fontSize: 13, fontWeight: '700', color: colors.primary },
      }}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.TabBar />
        <Label>Inicio</Label>
        <Icon
          sf="house.fill"
          androidSrc={<VectorIcon family={iconFamily} name="home" />}
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="map">
        <NativeTabs.Trigger.TabBar />
        <Label>Mapa</Label>
        <Icon
          sf="map.fill"
          androidSrc={<VectorIcon family={iconFamily} name="map" />}
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="messages">
        <NativeTabs.Trigger.TabBar />
        <Label>Mensajes</Label>
        <Icon
          sf="message.fill"
          androidSrc={<VectorIcon family={iconFamily} name="message" />}
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="reservations">
        <NativeTabs.Trigger.TabBar />
        <Label>Reservas</Label>
        <Icon
          sf="calendar"
          androidSrc={<VectorIcon family={iconFamily} name="calendar" />}
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.TabBar />
        <Label>Perfil</Label>
        <Icon
          sf="person.fill"
          androidSrc={<VectorIcon family={iconFamily} name="account" />}
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
