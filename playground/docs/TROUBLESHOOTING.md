# Troubleshooting

## The editor loads but Run fails

Use HTTP or HTTPS rather than `file://`. Keep all `dist/` files, including `worker.js`, `input-runtime.js`, and both engine files. Deploy generated JavaScript and Wasm from the same build. Reload after updating.

## Pages shows a 404

Confirm **Settings → Pages → Source → GitHub Actions**, then inspect the workflow run. Check `.github/workflows/pages.yml` exists and its publishing branch matches yours.

Use GitHub's displayed deployment URL. The workflow uploads `dist/`, so `index.html` is at the artifact root. Do not upload the repository root instead.

## Deployment fails

Open the failed step in Actions. Confirm required files exist, Pages is enabled, and organization/repository policies permit the included actions and Pages permissions.

Initial deployment requires repository setup. Inspect the actual GitHub Actions run to verify success.

## Music is silent

Click Run or the Sound toggle to unlock audio. Check Sound is on and device volume is audible. Sound off keeps note timing, so a silent program can still pause.

## Animation is too slow

Choose Quick drawing pace. Other settings add delays between teaching steps as well as explicit waits.

## A game is waiting

`key()` waits for a new arrow or Space press in the direction panel. Use its buttons or focus it and press a supported key. A held key counts once; paused programs ignore directions.

## Saved work is missing

Check the browser profile and exact site origin. Hosted and local copies have separate storage. Check Project bin or import a downloaded `.milo` backup.

## Saving fails

There is a 30-active-project limit, and browser storage may be full or blocked. Download important source before changing storage settings. Back up work before clearing site data.

## Panel order is different

Use Swap panels above the results. This changes the saved layout preference, not your code.

## The program hits a limit

Reduce loops or drawing commands. See [runtime limits](REFERENCE.md#limits).
