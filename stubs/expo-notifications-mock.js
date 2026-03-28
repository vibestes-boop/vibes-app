// expo-notifications Stub für Expo Go
// Im EAS Build wird das echte native Modul verwendet.

module.exports = {
  setNotificationHandler: function() {},
  getPermissionsAsync: async function() { return { status: 'undetermined' }; },
  requestPermissionsAsync: async function() { return { status: 'denied' }; },
  getExpoPushTokenAsync: async function() { return { data: null }; },
  addNotificationReceivedListener: function() { return { remove: function() {} }; },
  addNotificationResponseReceivedListener: function() { return { remove: function() {} }; },
  scheduleNotificationAsync: async function() {},
  cancelAllScheduledNotificationsAsync: async function() {},
  setBadgeCountAsync: async function() {},
};
