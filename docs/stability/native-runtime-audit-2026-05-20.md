# Native Runtime Audit — 2026-05-20

Scope: iOS development-client errors seen while testing from
`/Users/zaurhatuev/vibes-app`.

## Finding

The repeated runtime error:

```text
[@RNC/AsyncStorage]: NativeModule: AsyncStorage is null
```

is a native-shell mismatch, not a Jest failure. The Jest text is part of the
generic AsyncStorage troubleshooting message.

The source checkout already declares the required native modules:

- `@react-native-async-storage/async-storage`
- `expo-screen-orientation`
- `expo-dev-client`
- `expo-apple-authentication`

The finished iOS development build
`7dfddc84-2240-4a7e-b6db-efb91c56e113` was built from the correct source commit
`b8f89e2 Fix native R2 uploads and push token refresh`.

## Interpretation

Metro can update JavaScript, but it cannot add native modules to an already
installed development client. If the iPhone still has an older development
client, the JS bundle can ask for native modules that the installed app shell
does not contain.

This explains the cascade:

- `lib/authStore.ts` imports AsyncStorage and fails first.
- `lib/themeStore.ts` also imports AsyncStorage.
- `src/_layout.full.tsx` then reports `useThemeStore` as unavailable because
  the theme module did not initialize cleanly.
- Expo Router reports route files as missing default exports even though sampled
  files such as `app/(tabs)/index.tsx` and `app/(onboarding)/guild.tsx` do
  export default components. Those warnings are likely module-evaluation fallout
  from the native module crash.

## Required Test Procedure

1. Delete the old Serlo development-client app from the iPhone.
2. Install the development build:

```bash
cd /Users/zaurhatuev/vibes-app
npx eas build:view 7dfddc84-2240-4a7e-b6db-efb91c56e113
```

Open the Expo build page and install the internal iOS build on the iPhone.

3. Start Metro from the same checkout:

```bash
cd /Users/zaurhatuev/vibes-app
npm run start -- --clear
```

4. Retest:

- App opens without `AsyncStorage is null`.
- App opens without `Cannot find native module 'ExpoScreenOrientation'`.
- Profile/avatar upload works.
- Login/session persists after reload.
- Feed opens and post interactions work.

## Stop Rule

Do not create a new TestFlight/App Store production build until the development
client test above is clean.
