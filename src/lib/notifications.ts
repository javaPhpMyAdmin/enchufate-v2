import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/** Configure how notifications appear when the app is in foreground. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Request permission and return the Expo push token, or null if denied.
 * On Android 13+ the POST_NOTIFICATIONS runtime permission is requested.
 * On iOS the alert/sound permissions are requested.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('[Push] Permission denied');
    return null;
  }

  // EAS project ID from app.json → extra.eas.projectId
  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: '89baec1c-7fdd-4972-a65b-5f5fd5f490e7',
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Enchúfate',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  return tokenData.data;
}
