# bun-tarball-url-probe

A minimal Bun probe project for Mend SCA detection testing.
Exercises the `tarball-url` pattern in isolation.

## Pattern

`tarball-url` — a dependency declared as a direct `.tgz` tarball URL
rather than a semver registry reference.

```json
"dependencies": {
  "is-odd": "https://registry.npmjs.org/is-odd/-/is-odd-3.0.1.tgz"
}
```

Mend must report `source: "url"` for `is-odd`, with
`source_detail.url` set to the full tarball URL.

## Why standalone

`source: "url"` is a distinct detection branch in Mend's resolver from
git-sourced deps (`source: "git"`). Bundling tarball-URL deps with git
deps in a single probe would obscure which code path failed when the
`source` field is wrong. Each source-type pattern must localize
cleanly:

| Source type | Probe |
|---|---|
| `registry` | `bun-basic-registry-probe` |
| `git` | `bun-git-sources-probe` |
| `url` | **this probe** |
| `local` | `bun-local-sources-probe` |

## Mend config

No `.whitesource` file is emitted for this probe.

Bun (`js-bun`) is NOT in Mend's `install-tool` supported list.
`scanSettings.versioning` cannot pin a Bun toolchain version.
Detection is lockfile-driven (static parse of `bun.lock`) with no
install pre-step available through the UA config API.

This limitation is tracked in `edge-cases.md` (`bun-not-in-install-tool`)
and in `docs/BUN_COVERAGE_PLAN.md §4` (risk table, row
"Bun not in `install-tool` list").

## Source-type trap

**WARNING.** The tarball URL declared in `package.json` points to
`registry.npmjs.org` — the same host as the npm registry itself:

```
https://registry.npmjs.org/is-odd/-/is-odd-3.0.1.tgz
```

A naive Mend parser that classifies source type by inspecting the
**URL hostname** will see `registry.npmjs.org` and incorrectly emit
`source: "registry"`. The correct classification is driven by the
**manifest declaration form**:

- Semver range (`"^3.0.0"`) → `source: "registry"`
- HTTP/HTTPS URL to a `.tgz` file → `source: "url"` regardless of hostname

This mis-classification is the primary failure mode this probe exists to
expose. If Mend reports `source: "registry"` for `is-odd`, the detection
engine is reading the URL host rather than the manifest form.

## Package selection rationale

| Package | Version | Role |
|---------|---------|------|
| `is-odd` | 3.0.1 | Direct dep, declared as tarball URL. Tiny library (1 file), one transitive dep. Stable version, canonical tarball archived on npm registry. |
| `is-number` | 6.0.0 | Transitive dep of `is-odd` (declared via `"is-number": "^6.0.0"`). Normal registry dep — its source type must remain `"registry"`. No further deps. |

`is-odd` was chosen because:
1. The package is small and has minimal surface area (one transitive dep only).
2. Version 3.0.1 is stable and the tarball URL is permanently archived on the npm CDN.
3. The single transitive (`is-number`) allows the test to confirm that URL
   source-type classification does NOT propagate to transitives — only the
   directly URL-declared dep gets `source: "url"`.

## Dependency graph

```
bun-tarball-url-probe (root)
└── is-odd@3.0.1        [direct, source: url — declared as .tgz tarball URL]
    └── is-number@6.0.0 [transitive, source: registry — normal semver range dep]
```

## Expected tree summary

| Metric | Value |
|--------|-------|
| Direct dependencies | 1 (`is-odd`) |
| Transitive dependencies | 1 (`is-number`) |
| Total packages | 2 |
| `source: "url"` packages | `is-odd` |
| `source: "registry"` packages | `is-number` |

## Known Mend failure modes

1. **Source mis-classification** — `is-odd` reported as `source: "registry"`
   because the URL host is `registry.npmjs.org`. This is the primary target.
2. **Missing `source_detail.url`** — dep is classified as `url` but the
   `source_detail` object carries a `"registry"` key instead of a `"url"` key.
3. **JSONC parse failure** — `bun.lock` JSONC comments and trailing commas
   rejected by a strict JSON parser; zero deps reported.
4. **Tarball URL dep silently dropped** — Mend's parser only handles semver
   references in the packages section; URL-spec entries are skipped.
5. **Version unresolved** — `is-odd` reported with version `null` or the
   full URL string as a version (rather than the resolved `3.0.1`).

## Resolver notes

The UA `javascript.md` resolver documents behavior for the npm resolver,
which Mend uses as the closest analog for Bun. Bun is NOT a named UA
resolver — every Bun-specific feature is exploratory. Key points:

- The npm resolver in the UA reads `package-lock.json` natively.
  Bun's `bun.lock` JSONC format diverges from that shape.
- URL-type deps in `package.json` / `bun.lock` are not mentioned
  explicitly in the UA javascript resolver docs for Bun — making
  this an exploratory probe rather than a regression-bound one.
- If Mend's detection returns an empty tree or mis-classifies
  `is-odd` as `source: "registry"`, the failure is novel and should
  be filed as a Mend SCA bug with this probe as the reproducer.

---

Tracked in: docs/BUN_COVERAGE_PLAN.md §11.2 entry #6
