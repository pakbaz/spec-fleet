# scratchpad — origin-allowlist

Working notes captured during the spec run. Free-form; not part of the
review surface.

## Open questions while drafting spec.md

- Should `[::ffff:127.0.0.1]` count as loopback? → Decided no, deferred to
  a future spec. Rare in practice and adds a ParseIP dependency that buys
  nothing for the dev-loop scenario that motivated this spec.
- What happens if the operator passes a malformed origin in the flag? →
  `url.Parse` either errors or returns an empty host; both are skipped in
  `OriginAllowed` so a typo silently denies. That's the right default for
  an allow-list.

## Tried and discarded

- Adding `golang.org/x/net/idna` for IDN normalisation. Killed by the
  stdlib-only constitution rule.
- Replacing the `[]string` allow-list with a parsed `[]*url.URL` at
  construction time. Better hygiene but mechanical change touching many
  test fixtures. Recorded in review as a follow-up performance pass.

## Pre-flight before review

- Re-ran `go vet ./...` and `go test ./...` after each helper extraction;
  both green throughout.
- Manually exercised the dashboard with `curl -H 'Origin: http://127.0.0.1:8080' …`
  against a binary built with `--allowed-origins http://localhost:8080` —
  status 200 instead of 403. ✅
