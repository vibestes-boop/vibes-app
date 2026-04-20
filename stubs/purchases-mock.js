/**
 * react-native-purchases Stub für Expo Go.
 * Im Dev/EAS Build wird das echte RevenueCat SDK geladen.
 */
const Purchases = {
  configure: () => {},
  getOfferings: async () => ({ current: null }),
  purchasePackage: async () => { throw new Error('IAP not available in Expo Go'); },
  restorePurchases: async () => ({}),
  getCustomerInfo: async () => ({ entitlements: { active: {} } }),
  setLogLevel: () => {},
  LOG_LEVEL: { DEBUG: 'DEBUG', INFO: 'INFO', WARN: 'WARN', ERROR: 'ERROR' },
};

const PurchasesPackageType = {
  CONSUMABLE: 'CONSUMABLE',
  NON_CONSUMABLE: 'NON_CONSUMABLE',
};

module.exports = { default: Purchases, Purchases, PurchasesPackageType };
