# Source publication provenance

This repository is a curated publication copy of Raincheck Raccoons, originally released October 20, 2026. The original Sites deployment snapshot is source commit `6d543dd55d9d19ee0c7bd28c38396f978643d655` in the separate hosting checkout. That checkout and its history were preserved.

The GitHub destination was inspected before preparation: it was an empty public repository with no commits or project-wide license. No published history was rewritten. The publication copy retains the application and build layout, original assets and notices. It replaces internal research dumps and template examples with focused public documentation and selected historical screenshots/reports.

Publication changes add portable browser tooling, a tracked development dependency, local migration/verification helpers and GitHub CI. Game rules, frontend gameplay, API, persistent model and existing hosting identity are unchanged. GitHub pushes do not deploy the original Sites release. The subsequently connected Vercel project rebuilds its own deployment from GitHub.

High-confidence secret patterns were checked across proposed public files and 148 blobs in the original single-commit history. No matches were found. This is a scoped credential-pattern review, not proof against every possible secret format. No runtime environment files, database state, dependency directories, build output, archives or raw chat/PDF attachments are included.

The owner has chosen to reserve rights in original project material without granting a reuse license. See [copyright and reuse](../COPYRIGHT.md) and [third-party notices](../THIRD_PARTY_NOTICES.md).

On November 1, 2026, native Next.js/Vercel hosting was added with a signed server gateway to the existing authoritative Worker/D1 backend. The game UI, artwork, audio, rules and storage algorithms were preserved. See [Vercel release verification](vercel-release.md).

On November 1, 2026, a separate standalone Cloudflare Workers deployment was added using `deploy/cloudflare.json` and a dedicated D1 database. The existing Sites project identity, deployment checkout and database were preserved. A build-time public URL setting gives each deployment its own sharing metadata. See [deployment instructions](development.md#standalone-cloudflare-workers-deployment).
