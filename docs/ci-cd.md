# CI/CD

The project uses one GitHub Actions pipeline for continuous integration and
continuous delivery.

## Continuous integration

The pipeline runs for pull requests targeting `main`, pushes to `main`, release
tags, and manual dispatches. It checks that required project documents exist,
detects unresolved merge-conflict markers, lints Markdown, and validates GitHub
Actions workflow files.

Configure the `main` branch ruleset to require the **Validate repository** check
before merging. The repository ruleset is managed in GitHub settings and is not
stored in this repository.

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
from merged pull requests. GitHub automatically attaches source archives. No
runtime deployment is configured yet because the repository does not contain an
application or identify a hosting environment. Add build, package, and deploy
steps to the release job when those choices are established.

## Maintenance

Dependabot checks GitHub Actions dependencies weekly and groups related updates
into one pull request. Action references are pinned to full commit hashes; keep
the version comments beside those hashes so Dependabot can update both.
