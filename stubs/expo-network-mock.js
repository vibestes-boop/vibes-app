/**
 * expo-network compatibility stub.
 * Verhindert dass expo-networks native Modul startObserving() aufruft,
 * was auf iOS 18/26 eine ObjC-Exception wirft → Hermes-Crash.
 */
'use strict';

var NetworkStateType = {
  NONE: 'NONE',
  UNKNOWN: 'UNKNOWN',
  CELLULAR: 'CELLULAR',
  WIFI: 'WIFI',
  BLUETOOTH: 'BLUETOOTH',
  ETHERNET: 'ETHERNET',
  WIMAX: 'WIMAX',
  VPN: 'VPN',
  OTHER: 'OTHER',
};

var mockState = {
  type: NetworkStateType.WIFI,
  isConnected: true,
  isInternetReachable: true,
};

module.exports = {
  NetworkStateType: NetworkStateType,
  getNetworkStateAsync: function () {
    return Promise.resolve(mockState);
  },
  getIpAddressAsync: function () {
    return Promise.resolve('0.0.0.0');
  },
  getMacAddressAsync: function () {
    return Promise.resolve(null);
  },
  isAirplaneModeEnabledAsync: function () {
    return Promise.resolve(false);
  },
  addNetworkStateChangeListener: function (_callback) {
    return { remove: function () {} };
  },
};
module.exports.default = module.exports;
