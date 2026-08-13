# CI/CD

The project uses one GitHub Actions pipeline for continuous integration and
continuous delivery.

## Continuous integration

The pipeline runs for pull requests targeting `main`, pushes to `main`, release
tags, and manual dispatches. It checks that required project documents exist,
detects unresolved merge-conflict markers, lints Markdown, and validates GitHub
Actions workflow files.

A second job, **Domain and persistence checks**, sets up Node.js 22, installs
dependencies with `npm ci`, and runs `npm run typecheck` (TypeScript) and
`npm test` (Jest with jest-expo). The Jest suites execute the real SQLite
engine through the `node:sqlite` test adapter and cover migrations from an
empty database, migration idempotency, transaction rollback, exact decimal
round-trips, and the no-foreign-key / no-`entities`-table schema rules.

Configure the `main` branch ruleset to require the **Validate repository** and
**Domain and persistence checks** checks before merging. The repository ruleset
is managed in GitHub settings and is not stored in this repository.

## Continuous delivery

Publishing a SemVer tag starts delivery after all integration checks pass. The
tag must use a form such as `v1.2.3` and point to a commit contained in `main`.
Pre-release tags such as `v1.2.3-rc.1` create GitHub pre-releases.

Create and push a release tag with:

```sh
git switch main
git pull --ff-only
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```

The pipeline creates an idempotent GitHub Release and generates release notes
from merged pull requests. GitHub automatically attaches source archives.
Building and publishing the iOS app is handled separately by the manual
**Publish iOS** workflow; see the next section.

## iOS publishing

The **Publish iOS** workflow (`.github/workflows/publish.yml`) is triggered
manually from the GitHub Actions page and takes a `destination` input:

- `testflight` — builds the app with EAS Build and uploads it to App Store
  Connect with EAS Submit, where it appears in TestFlight.
- `appstore` — does the same, then submits the uploaded build for App Store
  review with `fastlane deliver` on a macOS runner. The version's metadata and
  screenshots must already be complete in App Store Connect.

Publishing is restricted to the `main` branch. Build numbers are managed
remotely by EAS (`appVersionSource: remote` with `autoIncrement`), so repeated
builds do not collide; the marketing version comes from `app.json`.

### One-time setup

1. Create a free Expo account at [expo.dev/signup](https://expo.dev/signup),
   then link the repository to an EAS project and commit the result:

   ```sh
   npx eas-cli@21.8.0 init
   ```

   This rewrites `extra.eas.projectId` in `app.json`.
2. In the Apple Developer portal, register the App ID `com.logact.becoming`
   under
   [Certificates, Identifiers & Profiles → Identifiers](https://developer.apple.com/account/resources/identifiers/list)
   (use **+** → App IDs → App), then create the app under
   [App Store Connect → Apps](https://appstoreconnect.apple.com/apps)
   (use **+** → New App) with that bundle ID.
3. In App Store Connect, create an API key under
   [Users and Access → Integrations → App Store Connect API](https://appstoreconnect.apple.com/access/integrations/api)
   (App Manager role is sufficient). Download the `.p8` file once — Apple does
   not let you download it again.
4. Put the key's **Issuer ID** and **Key ID** (both shown on the same page,
   not secret) into `eas.json` under `submit.production.ios`, replacing the
   placeholders.
5. Run one interactive build locally so EAS can create and store the
   distribution certificate and provisioning profile:

   ```sh
   npx eas-cli@21.8.0 build --platform ios --profile production
   ```

   After this, CI builds run non-interactively.
6. Add the GitHub repository secrets under
   [Settings → Secrets and variables → Actions](https://github.com/logact/becoming/settings/secrets/actions):

   - `EXPO_TOKEN` — a robot access token created under
     [Expo account settings → Access tokens](https://expo.dev/settings/access-tokens).
   - `ASC_API_KEY_P8` — the base64-encoded contents of the `.p8` key
     (`base64 -i AuthKey_XXXX.p8 | pbcopy`).

To publish, open
[Actions → Publish iOS → Run workflow](https://github.com/logact/becoming/actions/workflows/publish.yml),
choose `testflight` or `appstore`, and run it on `main`. The workflow
typechecks and runs the test suites before building.

## Maintenance

Dependabot checks GitHub Actions dependencies weekly and groups related updates
into one pull request. Action references are pinned to full commit hashes; keep
the version comments beside those hashes so Dependabot can update both.
