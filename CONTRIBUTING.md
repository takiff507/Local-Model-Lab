# Contributing

1. Open an issue describing the change, risk, and user impact.
2. Keep changes focused and preserve local-only behavior.
3. Never add telemetry, cloud inference, gated model URLs, or unverified executable downloads without explicit project approval.
4. Run `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd run electron-build`, and `npm.cmd run verify:links` when relevant.
5. Update policy and license disclosures when catalog entries or network behavior change.

Model catalog pull requests must include the public repository, exact single-file download URL, filename, expected size, hardware guidance, license name, and a successful link audit.