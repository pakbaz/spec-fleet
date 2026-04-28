# Security Policy

## No support — AS-IS software

`@pakbaz/eas` is provided **AS-IS**, without warranty of any kind, express
or implied — including but not limited to the warranties of
merchantability, fitness for a particular purpose, and non-infringement.
See the [`LICENSE`](LICENSE) for the full disclaimer.

There is **no security support, no maintenance commitment, no
service-level agreement, and no triage or response process** at this
time. The author does not provide a security contact and does not
accept private vulnerability reports through any channel.

If you adopt EAS in a production or regulated environment, you do so
entirely at your own risk and are responsible for your own security
review, hardening, monitoring, and incident response.

## Hardening reference

The threat model and the hardening controls shipped with the runtime
are documented in [`docs/security.md`](docs/security.md). Operators are
expected to read that document and configure policies, allowlists, and
hooks appropriately for their environment before use.

## Out of scope

- Vulnerabilities in `@github/copilot-sdk`, the GitHub Copilot CLI, or
  any other upstream dependency.
- Issues that require an already-compromised local machine.
- Any expectation of a fix, response, advisory, CVE assignment, or
  coordinated disclosure from this project.
