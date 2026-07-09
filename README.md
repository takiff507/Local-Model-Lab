# Local Model Lab

Local Model Lab is a Windows desktop workspace for private, local AI chat and image generation. Text inference runs through the bundled llama.cpp runtime. Image generation uses stable-diffusion.cpp or a compatible local API backend.

## Highlights

- Offline multi-turn chat with local GGUF models and exportable conversations.
- Local image generation controls for size, seed, scheduler, CFG, steps, batch, GPU, CPU threads, VAE, and safety.
- Searchable model library with hardware fit, source, license, install, resume, cancel, delete, and import controls.
- Live model preflight checks before download.
- Download hardening: trusted HTTPS hosts, redirect validation, response-type checks, expected-size validation, and partial-file resume.
- Local policy guard and in-app Privacy, Terms, Acceptable Use, and Model License pages.
- No account, analytics, ads, telemetry, or Local Model Lab cloud inference.
- Static product website ready for GitHub Pages.

## Run the desktop app

```powershell
npm.cmd install
npm.cmd run electron-start
```

PowerShell environments with script execution disabled should use `npm.cmd` instead of `npm`.

## Build

```powershell
npm.cmd run build
npm.cmd run electron-build
npm.cmd run dist
```

`npm.cmd run dist` creates a portable Windows executable in `release`. Use `npm.cmd run dist:dir` for an unpacked development build.

## Website

The static website is in `website` and can be opened directly or served locally:

```powershell
npm.cmd run site:dev
```

GitHub Pages deployment is configured in `.github/workflows/pages.yml`. After pushing to a repository, enable **Settings > Pages > Source: GitHub Actions**.

## Model link audit

```powershell
npm.cmd run verify:links
```

The audit checks every model and backend download URL and exits non-zero on HTTP failures. A weekly GitHub Actions audit is included. The desktop app also verifies the selected source immediately before each download.

## Local data

- Models: `%APPDATA%\Local Model Lab\LocalAI_Models`
- Generated images: `%APPDATA%\Local Model Lab\LML_Generations`
- Partial downloads: stored beside the target model with a `.tmp` suffix and resumed on retry

Prompts and outputs are not sent to an Local Model Lab-operated server. Model downloads connect to Hugging Face; optional backend downloads connect to GitHub.

## Image backends

Local Model Lab can use:

- stable-diffusion.cpp installed by the app or placed in the packaged `bin` directory
- A1111 or Forge running locally with API access
- Compatible loopback workflows exposed by supported local tools

No placeholder image is shown when a backend is missing.

## Policies and third-party content

See the in-app Policy & Legal section and:

- `website/privacy.html`
- `website/terms.html`
- `website/acceptable-use.html`
- `website/licenses.html`
- `THIRD_PARTY_NOTICES.md`
- `SECURITY.md`

Model weights are independently published and remain governed by their upstream licenses. A catalog listing is not an endorsement or a grant of rights.