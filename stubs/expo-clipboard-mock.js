/**
 * expo-clipboard stub
 * Purpose: Prevents TurboModule init crash in Hermes HBC production builds.
 * All clipboard functions are no-ops or return empty values.
 */
'use strict';

function getStringAsync() { return Promise.resolve(''); }
function setStringAsync(_text) { return Promise.resolve(true); }
function getString() { return ''; }
function setString(_text) {}
function hasStringAsync() { return Promise.resolve(false); }
function getImageAsync(_options) { return Promise.resolve(null); }
function setImageAsync(_base64Image) { return Promise.resolve(); }
function hasImageAsync() { return Promise.resolve(false); }
function getUrlAsync() { return Promise.resolve(null); }
function setUrlAsync(_url) { return Promise.resolve(); }
function hasUrlAsync() { return Promise.resolve(false); }
function addClipboardListener(_listener) { return { remove: function() {} }; }
function removeClipboardListener(_subscription) {}

var StringFormat = { PLAIN_TEXT: 'plainText' };

module.exports = {
  getStringAsync: getStringAsync,
  setStringAsync: setStringAsync,
  getString: getString,
  setString: setString,
  hasStringAsync: hasStringAsync,
  getImageAsync: getImageAsync,
  setImageAsync: setImageAsync,
  hasImageAsync: hasImageAsync,
  getUrlAsync: getUrlAsync,
  setUrlAsync: setUrlAsync,
  hasUrlAsync: hasUrlAsync,
  addClipboardListener: addClipboardListener,
  removeClipboardListener: removeClipboardListener,
  StringFormat: StringFormat,
};
module.exports.default = module.exports;
