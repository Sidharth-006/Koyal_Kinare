import crypto from 'crypto';

/**
 * Derives a safe, sanitized human-readable device label from User-Agent.
 * NEVER leaks raw UA strings or personal identifiers.
 */
export function parseDeviceLabel(userAgent?: string | null): string {
  if (!userAgent || typeof userAgent !== 'string' || userAgent.trim() === '') {
    return 'Unknown Device';
  }

  const ua = userAgent.toLowerCase();

  // OS Detection
  let os = 'Unknown OS';
  if (ua.includes('windows phone')) {
    os = 'Windows Phone';
  } else if (ua.includes('windows nt') || ua.includes('windows')) {
    os = 'Windows';
  } else if (ua.includes('android')) {
    os = 'Android';
  } else if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) {
    os = 'iOS';
  } else if (ua.includes('macintosh') || ua.includes('mac os x')) {
    os = 'macOS';
  } else if (ua.includes('cros')) {
    os = 'ChromeOS';
  } else if (ua.includes('linux')) {
    os = 'Linux';
  }

  // Browser Detection (order matters)
  let browser = 'Browser';
  if (ua.includes('edg/') || ua.includes('edge/')) {
    browser = 'Edge';
  } else if (ua.includes('opr/') || ua.includes('opera/')) {
    browser = 'Opera';
  } else if (ua.includes('firefox/') || ua.includes('fxios/')) {
    browser = 'Firefox';
  } else if (ua.includes('chrome/') || ua.includes('crios/')) {
    browser = 'Chrome';
  } else if (ua.includes('safari/') && !ua.includes('chrome')) {
    browser = 'Safari';
  }

  return `${browser} on ${os}`;
}

/**
 * Computes a secure one-way SHA-256 hash of the User-Agent.
 */
export function hashUserAgent(userAgent?: string | null): string {
  const value = (userAgent || 'unknown').trim();
  return crypto.createHash('sha256').update(value).digest('hex');
}

/**
 * Computes a secure one-way SHA-256 hash of the IP address.
 * Never returns the raw IP address.
 */
export function hashIp(ip?: string | null): string | null {
  if (!ip || typeof ip !== 'string' || ip.trim() === '') {
    return null;
  }
  return crypto.createHash('sha256').update(ip.trim()).digest('hex');
}
