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

## Verified State — 3 October 2026

- Public App Store version: `1.31.0`, released 12 July 2026 (Apple lookup).
- Latest completed production iOS build: **`1.31.1 (293)`**, 3 October 2026,
  commit `14e5e553c097d19268aaee40e93b5d4883e3ee8b` (EAS build and downloaded IPA verified).
- Candidate: `1.31.1 (293)`. Local Xcode 27 Release compilation succeeded for
  the x86_64 simulator, including ExpoGlassEffect and RevenueCat. The signed
  iPhone IPA has now been **uploaded to App Store Connect for internal TestFlight**
  after explicit user approval. Apple processing is pending; no public release.
  Submission: https://expo.dev/accounts/zaurhat/projects/vibes/submissions/5f2f0c25-1435-48c4-8dcd-7f5e015f6f61
  EAS production build completed successfully:
  https://expo.dev/accounts/zaurhat/projects/vibes/builds/ac555de6-f570-47be-8c82-a37f665b8f48
  Native source commit: `14e5e553c097d19268aaee40e93b5d4883e3ee8b`.
  Downloaded IPA: ARM64, expected bundle/version/build, strict code-signature
  verification passed, production APNs entitlement, no debugger entitlement.
  This verifies packaging/signing, not successful push delivery or device behavior.
  Later commits affect only web test configuration/tests and release documentation.
- Native launch remains unverified: GoogleMLKit 8.0.0 excludes arm64 simulator
  builds, while every installed iOS runtime supports only arm64. The compiled
  x86_64 app cannot install in these runtimes. Do not count this as a passed
  device test or remove camera functionality to mask it. Use the approved
  signed build on a physical device or a compatible simulator runtime.
- Release prepared on `codex/serlo-release-1.31.1` from `origin/main`
  (`9a2b50ab`); unrelated Berkat changes are excluded.
  Local `main` has been fast-forwarded to these release commits and is clean.
  The native source guard and full pre-release gate passed before upload.
  Release branch is pushed with draft PR https://github.com/vibestes-boop/vibes-app/pull/84.
  Remote main is unchanged.
- Explicit approval for the EAS source upload/signed build and for the GitHub
  release-branch upload/draft PR was granted on 3 October. Production DB migration
  `20261002220000_create_post_with_product.sql` was separately approved and applied.
  Internal TestFlight submission was separately approved on 3 October and uploaded.
  The existing internal group "Team (Expo)" has access to all builds. Do not
  assign this untested candidate to the external group or release it publicly.
- New `expo-glass-effect` requires a new native binary for native Liquid Glass;
  older binaries have a guarded frosted-glass fallback.
- Required source: `/Users/zaurhatuev/vibes-app`.
- Historical invalid build: `1.26.4 (270)`; never use it as a fallback.

See the dated release-preparation section at the top of `handoff.md` for
verification results and remaining database/device checks. Store and EAS
history must be checked again immediately before the actual release.

Check recent EAS history before deciding which build to install or submit:

```bash
cd /Users/zaurhatuev/vibes-app
npm run native:builds:audit
```

## Development Build Flow

Use this when testing native fixes locally on a physical iPhone.

```bash
cd /Users/zaurhatuev/vibes-app
npm run native:build:development
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
npm run launch:scorecard
npm run native:builds:audit
```

2. Confirm the production build identity and intended version:

```bash
npm run native:build:production:check
```

3. Build for App Store Connect:

```bash
npm run native:build:production
```

The production build command is guarded and will fail while `app.json` is still
below `1.31.1 (293)`, differs from the version pinned in the npm command,
or the working tree is dirty or not on `main`.

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
- Production version/build is lower than `1.31.1 (293)` or differs from the intended release.
- Working tree is dirty before a production build.
- The latest EAS build points at `/Users/zaurhatuev/Desktop/vibes-app`,
  `MyxcuH2025/vibes-app`, or a stale commit.

## Handoff Rule

Before ending a long release/debugging session, update `/Users/zaurhatuev/vibes-app/handoff.md`
with the current goal, commit, checks, open risks, and exact next command. A new
session should read that file before touching TestFlight, App Store Connect,
Vercel, Supabase, or EAS.

## Verification Notes

The user-facing TestFlight app and the development client are separate apps.
Installing or deleting one does not prove the other is current. Native module
errors in Metro usually mean the development client was not rebuilt after
native dependencies changed.
