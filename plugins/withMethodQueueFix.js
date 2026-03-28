/**
 * withMethodQueueFix.js – Expo Config Plugin
 *
 * Problem: ObjCTurboModule::performVoidMethodInvocation dispatches native void
 * methods to the module's serial queue. If that method throws an ObjC exception,
 * the @catch block calls convertNSExceptionToJSError which accesses the Hermes
 * runtime from the wrong thread → concurrent GC corruption → SIGSEGV.
 *
 * Fix: Override methodQueue to return nil for all RCTBridgeModule instances.
 * With nil, performVoidMethodInvocation calls the block() synchronously on the
 * JS thread instead of dispatching to a background queue. If the method throws,
 * convertNSExceptionToJSError runs on the JS thread → Hermes access is safe.
 *
 * This is applied via an Objective-C category added to the generated iOS project.
 */

const { withXcodeProject, withDangerousMod } = require('@expo/config-plugins');
const path = require('path');
const fs   = require('fs');

const FILE_NAME = 'RCTMethodQueueFix.m';

const SOURCE = `//  ${FILE_NAME}
//
//  Overrides -methodQueue on ALL NSObject subclasses to return nil.
//  When ObjCTurboModule::performVoidMethodInvocation receives nil as the queue
//  it calls the dispatch block synchronously on the calling thread (the JS thread)
//  rather than dispatching it to a background serial queue.
//  This makes the @catch-block's call to convertNSExceptionToJSError thread-safe
//  and prevents the concurrent Hermes GC corruption that causes SIGSEGV.
//
#import <Foundation/Foundation.h>

@interface NSObject (RCTMethodQueueFix)
@end

@implementation NSObject (RCTMethodQueueFix)

- (dispatch_queue_t)methodQueue
{
    return nil;
}

@end
`;

module.exports = function withMethodQueueFix(config) {
  // Step 1: Write the .m file into the iOS project directory
  config = withDangerousMod(config, [
    'ios',
    async (modConfig) => {
      const iosDir = path.join(
        modConfig.modRequest.platformProjectRoot,
        modConfig.modRequest.projectName
      );
      fs.mkdirSync(iosDir, { recursive: true });
      fs.writeFileSync(path.join(iosDir, FILE_NAME), SOURCE, 'utf8');
      return modConfig;
    },
  ]);

  // Step 2: Register the file in the Xcode project (.pbxproj)
  config = withXcodeProject(config, (modConfig) => {
    const project     = modConfig.modResults;
    const projectName = modConfig.modRequest.projectName;
    const relPath     = `${projectName}/${FILE_NAME}`;

    if (!project.hasFile(relPath)) {
      // pbxGroupByName() gibt das Gruppen-OBJEKT zurück, addSourceFile braucht aber den
      // Gruppen-SCHLÜSSEL (UUID-String). Wir suchen den Key manuell.
      const groups = project.hash.project.objects['PBXGroup'] || {};
      let groupKey;
      for (const [key, group] of Object.entries(groups)) {
        if (
          typeof group === 'object' &&
          (group.name === projectName || group.path === projectName)
        ) {
          groupKey = key;
          break;
        }
      }

      if (groupKey) {
        project.addSourceFile(relPath, {}, groupKey);
      } else {
        // Fallback: Datei ohne Gruppen-Zuordnung hinzufügen
        const target = project.getFirstTarget().uuid;
        project.addSourceFile(relPath, { target });
      }
    }

    return modConfig;
  });

  return config;
};
