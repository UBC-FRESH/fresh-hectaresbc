# Arbutus S3 Special Remote Plan

## Purpose

Capture the planned user-local credential and DataLad/git-annex special-remote pattern for publishing HectaresBC payloads to an Arbutus S3-compatible bucket.

This note records the Phase 4 user-local credential and DataLad/git-annex special-remote pattern for publishing HectaresBC payloads to Arbutus S3-compatible object storage.

## Intended Storage Role

Phase 4 is expected to configure a DataLad/git-annex S3 special remote for `UBC-FRESH/fresh-hectaresbc-data`.

The special remote points to a bucket in the maintainer's DRAC Arbutus cloud project.

Current non-secret remote details:

```text
remote name: arbutus-s3
bucket: fresh-hectaresbc-data
endpoint host: object-arbutus.cloud.computecanada.ca
region: ca-west-1
protocol: https
port: 443
request style: path
file prefix: annex/
encryption: none
embed credentials: no
```

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

export AWS_DEFAULT_REGION="ca-west-1"
export S3_ENDPOINT_URL="https://object-arbutus.cloud.computecanada.ca"
```

The working configuration uses standard AWS-compatible variables so that boto3, DataLad, and git-annex can share the same local environment.

## Repo Safety Rules

- Do not commit `arbutus_env.sh`, `datalad-env.sh`, generated credential files, access keys, secret keys, endpoint secrets, or bucket credentials.
- Do not paste real credentials into GitHub issues, PRs, changelog entries, tracked docs, or terminal transcripts intended for publication.
- Do not encode secrets in DataLad or git-annex special-remote configuration.
- Commit only public special-remote metadata needed for cold-clone data retrieval.
- Keep any credential bootstrap commands documented as templates with placeholders.

## Phase 4 Special Remote Work

When Phase 4 is active, the storage-remote task should:

1. Created Arbutus S3 bucket `fresh-hectaresbc-data`.
2. Created `~/.config/fresh-hectaresbc/arbutus_env.sh` locally with private credentials.
3. Sourced the credential file before running DataLad/git-annex S3 commands.
4. Initialized the S3 special remote in `UBC-FRESH/fresh-hectaresbc-data`.
5. Confirmed that remote configuration uses `embedcreds=no` and stores credentials locally.
6. Published `metadata/validation/arbutus_s3_smoke_test.bin` to the special remote.
7. Validated clean-clone retrieval with `datalad get`.

Smoke-test SHA-256:

```text
b9e0965b49a18d3e53d4476b7712662438be93f02ff253d8067da8cb777427cc
```

## Deferred Decisions

- Whether Arbutus remains the primary public object store or is later mirrored to UBC ARC Chinook.
- Whether anonymous read access is supported, credential-gated, or mediated by a later application layer.
- Whether payload publication should begin with only the Phase 3 representative ZIPs or the full recovered archive payload. Resolved: Phase 4 published the representative set; Phase 5 publishes the remaining recovered archive payloads.
