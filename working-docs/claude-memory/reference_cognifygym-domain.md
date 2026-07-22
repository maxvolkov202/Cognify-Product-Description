---
name: reference_cognifygym-domain
description: cognifygym.com custom domain — points to the v2 (cognify-v2 / neon) Vercel project; registrar + DNS setup
metadata: 
  node_type: memory
  type: reference
  originSessionId: 3764addb-f39e-4757-8eb0-cadcd540ccf6
---

**cognifygym.com serves the v2 app** (the `cognify-v2` Vercel project, aliased `cognify-v2-neon.vercel.app`) as of 2026-07-22. Migrated off the old v1 static holding page.

- **Registrar:** GoDaddy (IANA registrar ID 146). GoDaddy account is branded "Cognify"; Max has login access.
- **Nameservers:** GoDaddy default (`ns07/ns08.domaincontrol.com`) — switched FROM Vercel NS (which were tied to a separate, inaccessible Vercel account that hosted v1). DNS is now GoDaddy-hosted, so DNS records are edited in the GoDaddy DNS Records table.
- **DNS records at GoDaddy:** apex `A @ → 216.198.79.1` (Vercel's current anycast IP); `CNAME www → cname.vercel-dns.com` (legacy but works — Vercel "DNS Change Recommended" flag left as-is, optional new value was `94ca1e8e...vercel-dns-017.com`). Two `_vercel` TXT verify records were added to move the domain off the old account, can be deleted post-verification.
- **Vercel side:** domain added to `cognify-v2` project → Settings → Domains. It was "linked to another Vercel account" (v1's), so required `_vercel` TXT ownership verification to MOVE it (dashboard flow — CLI `vercel domains add` 403s `domain_not_owned` for cross-account; can't do it via CLI). Primary = **www.cognifygym.com** (apex 308-redirects to www); SSL auto-issued.
- **Key gotcha:** Vercel's `216.198.79.1` anycast IP is SHARED across all accounts — pointing DNS at it does NOT move ownership; the domain kept serving v1 until the `_vercel` TXT verification reassigned it to cognify-v2. Related: [[project_grading-engine-v2]], [[reference_prod-deploy]].
