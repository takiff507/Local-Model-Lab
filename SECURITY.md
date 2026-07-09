# Security Policy

## Supported version

Security fixes target the latest release and the current `main` branch.

## Reporting a vulnerability

Report vulnerabilities privately through GitHub Security Advisories after the repository is published. Do not open a public issue for an unpatched vulnerability and do not include credentials, private prompts, personal data, model files, or sensitive local paths.

Include:

- affected version and operating system
- reproduction steps
- impact and realistic attack scenario
- suggested mitigation, if known

## Security boundaries

Local Model Lab disables Node integration in the renderer and exposes an allowlisted IPC bridge. Model downloads are restricted to approved HTTPS sources and validated for redirects, response type, and expected size. Local models and backends are still third-party code or data; users should review sources, keep backups, and protect their operating system.