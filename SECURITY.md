# Security Policy

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public issues or chat groups.**

Instead, open a private security advisory from the repository's **Security** tab. If private advisories are unavailable, contact a maintainer through a non-public channel listed on their repository profile. Do not include bridge tokens or captured board content in a public issue.

When reporting, please include as much of the following as you can:

1. Type of vulnerability (XSS / privilege escalation / data leak / supply chain / …)
2. Reproduction steps or proof-of-concept
3. Scope (which file, function, browser version, page URL)
4. Suggested mitigation, if you have one

We aim to:

- Acknowledge your report within **5 business days**
- Provide a fix plan or mitigation within **30 days**

## Security Design

- Core capture, board storage, search, revisions, and exports have no telemetry; explicit page capture, Codex, image fetch, and video actions can make outbound requests
- Browser permissions are declared in `manifest.json`; HTTP(S) host access is optional and requested only for explicit page-card reading
- Preview HTML is sanitized through [DOMPurify](https://github.com/cure53/DOMPurify) to prevent XSS
- Third-party libraries are pinned by version and shipped unmodified (see [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md))
- Native Messaging is local-only by default. LAN sharing uses expiring one-time invites, per-client board-scoped tokens, private-network filtering, rate limits, explicit mutation policies, and independently gated deletion
- Terminal and browser file handles are never exposed through the MCP bridge

## Supported Versions

| Version | Security updates |
| --- | --- |
| 2.23.x | ✅ |
| 2.22.x | Critical fixes only |
| < 2.22 | ❌ |

Older versions may still receive backports for critical vulnerabilities on a case-by-case basis.
