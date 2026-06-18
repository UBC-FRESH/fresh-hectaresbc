# Arbutus S3 Special Remote Plan

## Purpose

Capture the planned user-local credential and DataLad/git-annex special-remote pattern for publishing HectaresBC payloads to an Arbutus S3-compatible bucket.

This is a Phase 4 planning note. Do not create storage remotes or credentials during Phase 2.

## Intended Storage Role

Phase 4 is expected to configure a DataLad/git-annex S3 special remote for `UBC-FRESH/fresh-hectaresbc-data`.

The special remote should point to a new S3 bucket in the maintainer's DRAC Arbutus cloud project. The bucket does not exist yet and must be created during the active Phase 4 storage-remote task.

## User-Local Credential Pattern

Use the same user-local pattern established in FEMIC.

Credentials must live outside the repository:

```text
~/.config/fresh-hectaresbc/
  arbutus_env.sh
  datalad-env.sh
```

`arbutus_env.sh` is required when configuring or operating the Arbutus-backed special remote. `datalad-env.sh` is optional and should only exist if package-specific DataLad/git-annex environment setup is useful.

The config directory should be private:

```bash
mkdir -p ~/.config/fresh-hectaresbc
chmod 700 ~/.config/fresh-hectaresbc
```

The credential file should be private:

```bash
touch ~/.config/fresh-hectaresbc/arbutus_env.sh
chmod 600 ~/.config/fresh-hectaresbc/arbutus_env.sh
```

## Credential File Contract

`~/.config/fresh-hectaresbc/arbutus_env.sh` should export AWS-compatible credentials and endpoint configuration required by Arbutus object storage and git-annex.

Template shape:

```bash
# User-local secret file. Do not commit.
export AWS_ACCESS_KEY_ID="..."
export AWS_SECRET_ACCESS_KEY="..."

# Fill these from the actual Arbutus S3 bucket and endpoint contract.
export FRESH_HECTARESBC_ARBUTUS_ENDPOINT_URL="..."
export FRESH_HECTARESBC_ARBUTUS_BUCKET="..."
export FRESH_HECTARESBC_ARBUTUS_REGION="..."
```

Exact variable names can be adjusted during Phase 4 if DataLad/git-annex commands require a different form. Keep project-specific helper variables prefixed with `FRESH_HECTARESBC_`.

## Repo Safety Rules

- Do not commit `arbutus_env.sh`, `datalad-env.sh`, generated credential files, access keys, secret keys, endpoint secrets, or bucket credentials.
- Do not paste real credentials into GitHub issues, PRs, changelog entries, tracked docs, or terminal transcripts intended for publication.
- Do not encode secrets in DataLad or git-annex special-remote configuration.
- Commit only public special-remote metadata needed for cold-clone data retrieval.
- Keep any credential bootstrap commands documented as templates with placeholders.

## Phase 4 Special Remote Work

When Phase 4 is active, the storage-remote task should:

1. Create or confirm the Arbutus S3 bucket for HectaresBC annexed payloads.
2. Create `~/.config/fresh-hectaresbc/arbutus_env.sh` locally with private credentials.
3. Source the credential file before running DataLad/git-annex S3 commands.
4. Initialize the S3 special remote in `UBC-FRESH/fresh-hectaresbc-data`.
5. Confirm that remote configuration does not store secrets.
6. Publish representative annexed payloads to the special remote.
7. Validate from a clean clone that representative payloads can be retrieved with documented commands.

## Deferred Decisions

- Final bucket name.
- Arbutus S3 endpoint URL and region value.
- Whether Arbutus remains the primary public object store or is later mirrored to UBC ARC Chinook.
- Exact git-annex/DataLad command sequence for special-remote initialization.
- Whether anonymous read access is supported, credential-gated, or mediated by a later application layer.

