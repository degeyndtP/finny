import type { NextConfig } from "next";

// =============================================================================
// Security headers
// =============================================================================
// Single source applied to every route via `next.config.ts`'s `headers()`. We
// deliberately do not use a nonce-based CSP because that would force every
// page into dynamic rendering (see node_modules/next/dist/docs/01-app/02-guides/
// content-security-policy.md → "Without Nonces") — Finny is small enough
// that the marginal benefit isn't worth the perf hit on /, /cashflow, etc.
//
// `'unsafe-inline'` on script-src is the price of skipping nonces. React 19
// streams flight payloads as inline <script> tags and Recharts injects inline
// `style` attributes; tightening this requires migrating to a nonce or hash
// scheme, which can come later.
// =============================================================================

const isDev = process.env.NODE_ENV === "development";

const csp = [
  "default-src 'self'",
  // 'unsafe-eval' is only required in dev (React debug stacks).
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  // Bank logos can come from Enable Banking / arbitrary CDNs; we don't
  // control the origin. data: + blob: for chart screenshots and SVG.
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  // Supabase Auth + Postgrest both speak over HTTPS + WSS to <ref>.supabase.co.
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // frame-ancestors replaces X-Frame-Options for modern browsers — but we
  // still send the header below for old user agents.
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // HSTS: 2 years, include subdomains, preload-ready.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Disable sensors we don't use. `interest-cohort=()` opts out of FLoC.
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // Disable DNS-prefetch leakage to third parties.
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
