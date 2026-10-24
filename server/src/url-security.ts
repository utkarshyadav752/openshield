/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * OpenShield URL Retrieval & SSRF Protection Module
 * Validates untrusted user URLs against SSRF, private IPv4/IPv6 ranges,
 * localhost, link-local metadata endpoints, DNS rebinding, unsafe redirects,
 * unsupported protocols, and oversized payloads.
 */

import dns from 'node:dns/promises';
import net from 'node:net';

export interface SafeFetchResult {
  ok: boolean;
  finalUrl?: string;
  title?: string;
  text?: string;
  html?: string;
  statusCode?: number;
  errorCode?:
    | 'INVALID_URL'
    | 'UNSUPPORTED_PROTOCOL'
    | 'SSRF_BLOCKED'
    | 'DNS_RESOLUTION_FAILED'
    | 'TOO_MANY_REDIRECTS'
    | 'FETCH_TIMEOUT'
    | 'HTTP_ERROR'
    | 'RESPONSE_TOO_LARGE'
    | 'EMPTY_CONTENT';
  errorMessage?: string;
}

const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 8500;
const MAX_RESPONSE_BYTES = 512 * 1024; // 512 KB cap

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
  'metadata.google.internal',
  'metadata',
  '0.0.0.0',
  '::1',
  '::',
]);

/**
 * Checks whether an IPv4 or IPv6 address belongs to a loopback, private,
 * link-local, multicast, carrier-grade NAT, or reserved range.
 */
export function isPrivateOrReservedIp(ip: string): boolean {
  const normalized = ip.trim().toLowerCase();

  // Handle IPv4-mapped IPv6 addresses (e.g. ::ffff:127.0.0.1)
  if (normalized.startsWith('::ffff:')) {
    const mappedV4 = normalized.slice('::ffff:'.length);
    if (net.isIPv4(mappedV4)) {
      return isPrivateOrReservedIp(mappedV4);
    }
  }

  if (net.isIPv4(normalized)) {
    const parts = normalized.split('.').map((p) => Number(p));
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
      return true;
    }
    const [a, b, c] = parts;
    // 0.0.0.0/8 (Current network)
    if (a === 0) return true;
    // 10.0.0.0/8 (Private network)
    if (a === 10) return true;
    // 100.64.0.0/10 (Shared Address Space / CGNAT)
    if (a === 100 && b >= 64 && b <= 127) return true;
    // 127.0.0.0/8 (Loopback)
    if (a === 127) return true;
    // 169.254.0.0/16 (Link-local / Cloud metadata 169.254.169.254)
    if (a === 169 && b === 254) return true;
    // 172.16.0.0/12 (Private network)
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.0.0.0/24 and 192.0.2.0/24 (IETF / TEST-NET-1)
    if (a === 192 && b === 0 && (c === 0 || c === 2)) return true;
    // 192.168.0.0/16 (Private network)
    if (a === 192 && b === 168) return true;
    // 198.18.0.0/15 (Benchmarking)
    if (a === 198 && (b === 18 || b === 19)) return true;
    // 198.51.100.0/24 (TEST-NET-2), 203.0.113.0/24 (TEST-NET-3)
    if ((a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113)) {
      return true;
    }
    // 224.0.0.0/4 (Multicast) & 240.0.0.0/4 (Reserved / Broadcast)
    if (a >= 224) return true;

    return false;
  }

  if (net.isIPv6(normalized)) {
    if (normalized === '::1' || normalized === '::' || normalized === '0:0:0:0:0:0:0:1') {
      return true;
    }
    // Unique local addresses fc00::/7 (fc00:: - fdff::)
    if (/^f[cd][0-9a-f]{2}:/i.test(normalized)) return true;
    // Link-local unicast fe80::/10
    if (/^fe[89ab][0-9a-f]:/i.test(normalized)) return true;
    // Multicast ff00::/8
    if (/^ff[0-9a-f]{2}:/i.test(normalized)) return true;
    // Documentation 2001:db8::/32
    if (normalized.startsWith('2001:db8:') || normalized.startsWith('2001:0db8:')) {
      return true;
    }
    return false;
  }

  // If not a valid IP format, treat as unsafe
  return true;
}

/**
 * Validates URL syntax, protocol, hostname, and IP literal safety synchronously.
 */
export function validateUrlSyntaxAndHost(rawInput: string): {
  valid: boolean;
  parsed?: URL;
  errorCode?: SafeFetchResult['errorCode'];
  errorMessage?: string;
} {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return {
      valid: false,
      errorCode: 'INVALID_URL',
      errorMessage: 'Please enter a website or policy URL to analyze.',
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      valid: false,
      errorCode: 'INVALID_URL',
      errorMessage:
        'The entered URL is not formatted as a valid web address (for example, https://example.com/terms).',
    };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      valid: false,
      errorCode: 'UNSUPPORTED_PROTOCOL',
      errorMessage: `Unsupported protocol "${parsed.protocol}". OpenShield only retrieves public http:// and https:// pages.`,
    };
  }

  if (parsed.username || parsed.password) {
    return {
      valid: false,
      errorCode: 'SSRF_BLOCKED',
      errorMessage: 'URLs containing embedded credentials are not permitted.',
    };
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();

  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.arpa')
  ) {
    return {
      valid: false,
      errorCode: 'SSRF_BLOCKED',
      errorMessage:
        'Access to localhost, internal networks, or reserved local domains is blocked for security (SSRF protection).',
    };
  }

  // Check if hostname is a direct IPv4 or IPv6 literal, or octal/hex/integer IP encoding
  if (/^\d+$/.test(hostname) || /^0x[0-9a-f]+$/i.test(hostname)) {
    return {
      valid: false,
      errorCode: 'SSRF_BLOCKED',
      errorMessage: 'Numeric IP encodings are blocked for security.',
    };
  }

  if (net.isIP(hostname) !== 0) {
    if (isPrivateOrReservedIp(hostname)) {
      return {
        valid: false,
        errorCode: 'SSRF_BLOCKED',
        errorMessage:
          'Access to private, loopback, or reserved IP addresses is blocked for security (SSRF protection).',
      };
    }
  }

  return { valid: true, parsed };
}

/**
 * Resolves DNS records for a hostname and verifies that EVERY resolved IP
 * is public and routable before allowing a connection.
 */
export async function verifyPublicDnsResolution(hostname: string): Promise<{
  safe: boolean;
  errorCode?: SafeFetchResult['errorCode'];
  errorMessage?: string;
}> {
  const cleanHost = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (net.isIP(cleanHost) !== 0) {
    if (isPrivateOrReservedIp(cleanHost)) {
      return {
        safe: false,
        errorCode: 'SSRF_BLOCKED',
        errorMessage: 'Resolved IP address belongs to a private or reserved network range.',
      };
    }
    return { safe: true };
  }

  try {
    const records = await dns.lookup(cleanHost, { all: true, verbatim: true });
    if (!records || records.length === 0) {
      return {
        safe: false,
        errorCode: 'DNS_RESOLUTION_FAILED',
        errorMessage: `Could not resolve domain name "${cleanHost}".`,
      };
    }

    for (const record of records) {
      if (isPrivateOrReservedIp(record.address)) {
        return {
          safe: false,
          errorCode: 'SSRF_BLOCKED',
          errorMessage: `Domain "${cleanHost}" resolved to a restricted or private network address (${record.address}). Request blocked.`,
        };
      }
    }

    return { safe: true };
  } catch {
    return {
      safe: false,
      errorCode: 'DNS_RESOLUTION_FAILED',
      errorMessage: `Could not resolve "${cleanHost}". Verify the domain exists or paste the policy text directly below.`,
    };
  }
}

/**
 * Strips scripts, styles, and HTML tags to extract clean visible text and title.
 */
export function extractVisibleTextFromHtml(html: string): {
  title: string;
  text: string;
} {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const rawTitle = titleMatch
    ? titleMatch[1].replace(/\s+/g, ' ').trim()
    : 'Analyzed Webpage';

  const cleaned = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|iframe|canvas|template)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(h[1-6]|p|div|section|article|li|tr|blockquote|header|footer)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&mdash;|&#8212;/gi, '—')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();

  return {
    title: rawTitle.slice(0, 140),
    text: cleaned,
  };
}

/**
 * Safely fetches a URL with redirect hop validation, timeout, and size limits.
 */
export async function fetchUrlSafely(rawUrl: string): Promise<SafeFetchResult> {
  let currentUrl = rawUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const syntaxCheck = validateUrlSyntaxAndHost(currentUrl);
    if (!syntaxCheck.valid || !syntaxCheck.parsed) {
      return {
        ok: false,
        errorCode: syntaxCheck.errorCode,
        errorMessage: syntaxCheck.errorMessage,
      };
    }

    const parsedUrl = syntaxCheck.parsed;
    const dnsCheck = await verifyPublicDnsResolution(parsedUrl.hostname);
    if (!dnsCheck.safe) {
      return {
        ok: false,
        errorCode: dnsCheck.errorCode,
        errorMessage: dnsCheck.errorMessage,
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(parsedUrl.toString(), {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent':
            'OpenShield-PolicyAnalyzer/1.0 (+https://openshield.org; consumer-terms-inspection)',
          Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      clearTimeout(timeoutId);

      // Handle redirects manually to re-validate every destination against SSRF
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) {
          return {
            ok: false,
            statusCode: response.status,
            errorCode: 'HTTP_ERROR',
            errorMessage: `Server returned redirect (${response.status}) without a Location header.`,
          };
        }
        if (hop === MAX_REDIRECTS) {
          return {
            ok: false,
            errorCode: 'TOO_MANY_REDIRECTS',
            errorMessage: `URL exceeded the maximum limit of ${MAX_REDIRECTS} redirects.`,
          };
        }
        currentUrl = new URL(location, parsedUrl).toString();
        continue;
      }

      if (!response.ok) {
        return {
          ok: false,
          statusCode: response.status,
          errorCode: 'HTTP_ERROR',
          errorMessage: `The website returned HTTP ${response.status} (${response.statusText || 'Access Restricted'}). Many sites block automated policy readers—you can paste the relevant policy text directly below to analyze it.`,
        };
      }

      const contentLengthHeader = response.headers.get('content-length');
      if (contentLengthHeader && Number(contentLengthHeader) > MAX_RESPONSE_BYTES) {
        return {
          ok: false,
          errorCode: 'RESPONSE_TOO_LARGE',
          errorMessage: `The page exceeds the ${Math.round(MAX_RESPONSE_BYTES / 1024)} KB safety limit. Please paste the relevant terms section directly.`,
        };
      }

      const reader = response.body?.getReader();
      if (!reader) {
        return {
          ok: false,
          errorCode: 'EMPTY_CONTENT',
          errorMessage: 'The server returned an empty response body.',
        };
      }

      const chunks: Uint8Array[] = [];
      let receivedBytes = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          receivedBytes += value.byteLength;
          if (receivedBytes > MAX_RESPONSE_BYTES) {
            await reader.cancel();
            break;
          }
          chunks.push(value);
        }
      }

      const decoder = new TextDecoder('utf-8', { fatal: false });
      const rawHtml = decoder.decode(Buffer.concat(chunks));
      const { title, text } = extractVisibleTextFromHtml(rawHtml);

      if (!text || text.length < 40) {
        return {
          ok: false,
          finalUrl: parsedUrl.toString(),
          errorCode: 'EMPTY_CONTENT',
          errorMessage:
            'The page loaded, but it contained almost no readable static text (it may require client-side JavaScript rendering or login). Paste the policy text below or use the OpenShield Browser Extension on the live tab.',
        };
      }

      return {
        ok: true,
        finalUrl: parsedUrl.toString(),
        title,
        text,
        html: rawHtml,
        statusCode: response.status,
      };
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      const isAbort = err instanceof Error && err.name === 'AbortError';
      return {
        ok: false,
        errorCode: isAbort ? 'FETCH_TIMEOUT' : 'HTTP_ERROR',
        errorMessage: isAbort
          ? 'The website took too long to respond (timed out after 8.5 seconds). Try pasting the policy text directly.'
          : 'Could not connect to the remote website. Check the URL or paste the terms text directly.',
      };
    }
  }

  return {
    ok: false,
    errorCode: 'TOO_MANY_REDIRECTS',
    errorMessage: 'Too many redirects encountered.',
  };
}
