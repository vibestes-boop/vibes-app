# iOS Release Playbook

Use this playbook for every Serlo iOS build.

## Source Rule

Build only from:

```bash
/Users/zaurhatuev/vibes-app
```

Do not build from:

```bash
/Users/zaurhatuev/Desktop/vibes-app
```

The Desktop checkout produced the invalid `1.26.4 (270)` TestFlight incident
and is quarantined for App Store work.

## Current Safe State

- TestFlight fallback: `1.26.3 (268)`
- Bad invalidated build: `1.26.4 (270)`
- Next production/TestFlight candidate: `1.26.5 (271)`
- Current fixed source commit: `b8f89e2 Fix native R2 uploads and push token refresh`
- Required local source: `/Users/zaurhatuev/vibes-app`

## Development Build Flow

Use this when testing native fixes locally on a physical iPhone.

```bash
cd /Users/zaurhatuev/vibes-app
npm run native:release-guard
npx eas build --platform ios --profile development
```

Install the generated internal development build on the iPhone. Then start
Metro from the same checkout:

```bash
cd /Users/zaurhatuev/vibes-app
npm run start -- --clear
```

If Metro reports `AsyncStorage is null` or `Cannot find native module`, the
iPhone is still running an old development client. Delete that development app
from the phone, install the latest development build, and start Metro again.

## Production/TestFlight Flow

Do not run this while the app is untested locally.

1. Confirm product health is green:

```bash
cd /Users/zaurhatuev/vibes-app
npm run health:dashboard
```

2. Confirm the production build identity and intended version:

```bash
npm run native:release-guard -- --profile production --expected-version 1.26.5 --expected-build-number 271
```

3. Build for App Store Connect:

```bash
npx eas build --platform ios --profile production
```

4. Submit only after confirming the EAS build was produced from the expected
commit and build number:

```bash
npx eas build:view <build-id>
```

5. In App Store Connect, assign the build to the internal test group first.
Do not ship it publicly until:

- Profile/avatar upload works.
- Login/session persists.
- Feed opens and interactions work.
- Push notification token is refreshed.
- `npm run health:dashboard` remains green.

## Stop Rules

Stop immediately if any of these happen:

- Current path is not `/Users/zaurhatuev/vibes-app`.
- Git remote is not `vibestes-boop/vibes-app`.
- EAS project id is not `02ab536a-5836-4560-a5ec-2dfd6e059f90`.
- Bundle id is not `com.vibesapp.vibes`.
- Production version/build is lower than `1.26.5 (271)`.
- Working tree is dirty before a production build.
- The latest EAS build points at `/Users/zaurhatuev/Desktop/vibes-app`,
  `MyxcuH2025/vibes-app`, or a stale commit.

## Verification Notes

The user-facing TestFlight app and the development client are separate apps.
Installing or deleting one does not prove the other is current. Native module
errors in Metro usually mean the development client was not rebuilt after
native dependencies changed.
