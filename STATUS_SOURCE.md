# Vaskeladden Status generator

This fork maintains the generated workflows used by `Vaskeladden/status`.
Its initial upstream revision is Upptime v1.44.1,
`8be193bbcb957a3a917d2bb16a0c96959778a889`. Upstream ownership and license
remain unchanged.

`dispatch-graphs` registers the sending job and records its request using the
shared dispatch SDK. The private SDK is fetched at the revision and file hashes
in `src/helpers/dispatch-sdk-pin.ts`; its source is never included in this
public repository or bundle. The existing Status token needs permission to read
that source and dispatch the receiving workflow. A denied read fails the step
and preserves direct graph fallback. It does not waive the collector's sender
receipt obligation. Do not broaden credentials just to make the row pass.

Source changes go through the `Status Generator` check on a pull request.
CI builds on Linux with the Node version declared in `action.yml`, exercises the
native curl binding and packaged dispatch entry point, and compares all emitted
files with committed `dist/`. When packaging changes, download the Linux package
artifact, commit those outputs, and run CI again. Do not ship a Mac native binary.
The dispatch smoke uses public fixtures and makes no real workflow request.

After the protected source PR merges, use its **master merge SHA** to regenerate
the eight Status workflows. A PR head or an arbitrary commit in the public fork
network is insufficient. The Status `Status Workflow Pin` check verifies the
maintained history and compares every generated workflow with this source.

```sh
npm ci --ignore-scripts
npm run build
node tooling/generate-status-workflows.cjs /path/to/status/.upptimerc.yml /path/to/output MERGED_GENERATOR_SHA
```

The offline command writes only generated workflow files. Open a normal Status
PR containing the generated outputs and the same SHA in its source check.
Do not call `update-template` locally: that command commits and pushes.
All generated workflows carry `UPTIME_MONITOR_REF`, preserving the source pin
during later regeneration. `updateTemplate` replaces only its eight owned
workflow names and leaves the separate source-check workflow intact.

Keep every Status writer in the same queued concurrency group. The dispatcher
returns the accepted native receiver identity without waiting for Graphs to
start, so Graphs can run after Setup releases the group. Verify new receipts and
the receiver on the next legitimate Setup event; never dispatch solely to
manufacture production proof.
