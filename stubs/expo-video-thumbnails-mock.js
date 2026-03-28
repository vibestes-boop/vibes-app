/**
 * expo-video-thumbnails stub
 * Purpose: Prevents TurboModule init crash in Hermes HBC production builds.
 * getThumbnailAsync returns null so VideoGridThumb gracefully shows nothing.
 */
'use strict';

function getThumbnailAsync(_sourceFilename, _options) {
  return Promise.resolve({ uri: '', width: 0, height: 0 });
}

module.exports = {
  getThumbnailAsync: getThumbnailAsync,
};
module.exports.default = module.exports;
