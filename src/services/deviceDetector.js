const crypto = require('crypto');
const geoip = require('geoip-lite');
const UAParser = require('ua-parser-js');

/**
 * 🔍 DEVICE DETECTION & FINGERPRINTING SERVICE
 *
 * Features:
 * ✅ Device identification and tracking
 * ✅ Browser and OS detection
 * ✅ IP geolocation
 * ✅ Device fingerprinting
 * ✅ Suspicious device detection
 */

class DeviceDetector {
  /**
   * Detect and analyze device information from request
   */
  static detectDevice(req) {
    const userAgent = req.headers['user-agent'] || '';
    const ip = this.getClientIP(req);
    const parser = new UAParser(req);
    const result = UAParser(req.headers).withClientHints();
    let osName = result.os.name || 'Unknown';
    let osVersion = result.os.version || 'Unknown';
    const platform = req.headers['sec-ch-ua-platform']?.replace(/"/g, '') || '';
    const platformVersion = req.headers['Sec-CH-UA-Platform-Version']?.replace(/"/g, '') || '';

    if (platform.toLowerCase() === 'windows' && platformVersion) {
      const majorVersion = parseFloat(platformVersion.split('.')[0]);
      if (majorVersion >= 13) {
        osName = 'Windows';
        osVersion = '11';
      }
    }

    // Log if key hints are missing
    if (platform.toLowerCase() === 'windows' && !platformVersion) {
      console.warn('Missing Sec-CH-UA-Platform-Version header; OS detection may default to Windows 10. Ensure server sends Accept-CH header.');
    }
    const deviceInfo = {
      // Basic identifiers
      userAgent,
      ipAddress: ip,
      deviceId: this.generateDeviceId(req),
      fingerprint: this.generateFingerprint(req),
      // Parsed device information
      browser: result.browser,
      os: result.os,
      device:result.device,
      // Geolocation
      location: this.getLocationFromIP(ip),
      // Additional headers
      headers: this.extractRelevantHeaders(req),
      // Security indicators
      security: this.analyzeSecurityIndicators(req),
      // Timestamp
      detectedAt: new Date(),
    };

    return deviceInfo;
  }

  /**
   * Generate unique device ID based on multiple factors
   */
  static generateDeviceId(req) {
    const factors = [
      req.headers['user-agent'],
      req.headers['accept'],
      req.headers['accept-language'],
      req.headers['accept-encoding'],
      this.getClientIP(req),
      // Add more fingerprinting factors as needed
    ].filter(Boolean);

    const fingerprint = factors.join('|');
    return crypto.createHash('sha256').update(fingerprint).digest('hex').substring(0, 16);
  }

  /**
   * Generate device fingerprint for more detailed tracking
   */
  static generateFingerprint(req) {
    const factors = [
      req.headers['user-agent'],
      req.headers['accept'],
      req.headers['accept-language'],
      req.headers['accept-encoding'],
      req.headers['connection'],
      req.headers['upgrade-insecure-requests'],
      req.headers['sec-fetch-site'],
      req.headers['sec-fetch-mode'],
      req.headers['sec-fetch-user'],
      req.headers['sec-fetch-dest'],
      this.getClientIP(req),
      // Screen resolution if available
      req.headers['sec-ch-viewport-width'],
      req.headers['sec-ch-viewport-height'],
      // Timezone if available
      req.headers['sec-ch-ua-platform'],
      req.headers['sec-ch-ua-mobile'],
    ].filter(Boolean);

    const fingerprint = factors.join('|');
    return crypto.createHash('sha256').update(fingerprint).digest('hex');
  }

  /**
   * Extract client IP address (handle proxies)
   */
  static getClientIP(req) {
    const xForwardedFor = req.headers['x-forwarded-for'];
    const xRealIP = req.headers['x-real-ip'];
    const cfConnectingIP = req.headers['cf-connecting-ip']; // Cloudflare
    const xClientIP = req.headers['x-client-ip'];
    const xForwarded = req.headers['x-forwarded'];
    const xCluster = req.headers['x-cluster-client-ip'];

    let ip = xForwardedFor?.split(',')[0]?.trim() || xRealIP || cfConnectingIP || xClientIP || xForwarded || xCluster || req.connection?.remoteAddress || req.socket?.remoteAddress || req.ip || '127.0.0.1';

    // Clean up IPv4-mapped IPv6 addresses
    if (ip.startsWith('::ffff:')) {
      ip = ip.substring(7);
    }

    return ip;
  }

  /**
   * Get location information from IP address
   */
  static getLocationFromIP(ip) {
    try {
      if (ip === '127.0.0.1' || ip === 'localhost' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
        return {
          country: 'Local',
          region: 'Local',
          city: 'Local',
          coordinates: { lat: null, lng: null },
          timezone: null,
          isLocal: true,
        };
      }

      const geo = geoip.lookup(ip);
      if (geo) {
        return {
          country: geo.country,
          region: geo.region,
          city: geo.city,
          coordinates: {
            lat: geo.ll?.[0] || null,
            lng: geo.ll?.[1] || null,
          },
          timezone: geo.timezone,
          isLocal: false,
        };
      }
    } catch (error) {
      console.warn('Failed to get location from IP:', error.message);
    }

    return {
      country: 'Unknown',
      region: 'Unknown',
      city: 'Unknown',
      coordinates: { lat: null, lng: null },
      timezone: null,
      isLocal: false,
    };
  }

  /**
   * Guess device type from user agent
   */
  static guessDeviceType(userAgent) {
    const ua = userAgent.toLowerCase();

    if (/mobile|android|iphone|ipad|ipod|blackberry|windows phone/.test(ua)) {
      if (/ipad|tablet/.test(ua)) {
        return 'tablet';
      }
      return 'mobile';
    }

    if (/smart-tv|smarttv|googletv|appletv|hbbtv|pov_tv|netcast\.tv/.test(ua)) {
      return 'smarttv';
    }

    if (/bot|crawler|spider|scraper/.test(ua)) {
      return 'bot';
    }

    return 'desktop';
  }

  /**
   * Extract relevant security headers
   */
  static extractRelevantHeaders(req) {
    const relevantHeaders = ['sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform', 'sec-fetch-site', 'sec-fetch-mode', 'sec-fetch-user', 'sec-fetch-dest', 'upgrade-insecure-requests', 'dnt', 'connection', 'cache-control', 'pragma'];

    const headers = {};
    relevantHeaders.forEach((header) => {
      if (req.headers[header]) {
        headers[header] = req.headers[header];
      }
    });

    return headers;
  }

  /**
   * Analyze security indicators from request
   */
  static analyzeSecurityIndicators(req) {
    const indicators = {
      suspiciousScore: 0,
      flags: [],
      analysis: {},
    };

    const userAgent = req.headers['user-agent'] || '';
    const ip = this.getClientIP(req);

    // Check for bot/crawler patterns
    if (/bot|crawler|spider|scraper|automated|selenium|phantomjs|headless/i.test(userAgent)) {
      indicators.suspiciousScore += 30;
      indicators.flags.push('potential_bot');
    }

    // Check for missing or suspicious headers
    if (!req.headers['user-agent']) {
      indicators.suspiciousScore += 20;
      indicators.flags.push('missing_user_agent');
    }

    if (!req.headers['accept']) {
      indicators.suspiciousScore += 15;
      indicators.flags.push('missing_accept_header');
    }

    // Check for Tor exit nodes (you'd need a Tor exit node list)
    if (this.isTorExitNode(ip)) {
      indicators.suspiciousScore += 40;
      indicators.flags.push('tor_exit_node');
    }

    // Check for data center IPs (simplified check)
    if (this.isDataCenterIP(ip)) {
      indicators.suspiciousScore += 25;
      indicators.flags.push('datacenter_ip');
    }

    // Check for VPN indicators
    if (this.hasVPNIndicators(req)) {
      indicators.suspiciousScore += 20;
      indicators.flags.push('potential_vpn');
    }

    // Check for automated tool signatures
    if (this.hasAutomatedToolSignatures(req)) {
      indicators.suspiciousScore += 35;
      indicators.flags.push('automated_tool');
    }

    // Determine risk level
    if (indicators.suspiciousScore >= 50) {
      indicators.riskLevel = 'high';
    } else if (indicators.suspiciousScore >= 25) {
      indicators.riskLevel = 'medium';
    } else {
      indicators.riskLevel = 'low';
    }

    indicators.analysis = {
      userAgentLength: userAgent.length,
      hasSecurityHeaders: this.hasSecurityHeaders(req),
      headerCount: Object.keys(req.headers).length,
      timestamp: new Date().toISOString(),
    };

    return indicators;
  }

  /**
   * Check if IP is a Tor exit node
   */
  static isTorExitNode(ip) {
    // In production, you would maintain a list of Tor exit nodes
    // This is a simplified check
    return false;
  }

  /**
   * Check if IP belongs to a data center
   */
  static isDataCenterIP(ip) {
    // In production, you would use a service or database to check
    // Common data center IP ranges (simplified)
    const dataCenterRanges = [
      /^54\.|^52\.|^34\.|^35\./, // AWS
      /^104\.|^199\.|^162\./, // DigitalOcean, etc.
    ];

    return dataCenterRanges.some((range) => range.test(ip));
  }

  /**
   * Check for VPN indicators
   */
  static hasVPNIndicators(req) {
    // Look for headers that might indicate VPN usage
    const vpnHeaders = ['x-vpn-client', 'x-proxy-id', 'x-forwarded-proto'];

    return vpnHeaders.some((header) => req.headers[header]);
  }

  /**
   * Check for automated tool signatures
   */
  static hasAutomatedToolSignatures(req) {
    const userAgent = req.headers['user-agent'] || '';
    const automatedSignatures = ['curl', 'wget', 'postman', 'insomnia', 'httpie', 'python-requests', 'python-urllib', 'go-http-client', 'java/', 'node-fetch', 'axios', 'http.rb'];

    return automatedSignatures.some((signature) => userAgent.toLowerCase().includes(signature.toLowerCase()));
  }

  /**
   * Check if request has modern security headers
   */
  static hasSecurityHeaders(req) {
    const securityHeaders = ['sec-fetch-site', 'sec-fetch-mode', 'sec-ch-ua'];

    return securityHeaders.some((header) => req.headers[header]);
  }

  /**
   * Compare two devices for similarity
   */
  static compareDevices(device1, device2) {
    if (!device1 || !device2) return { similarity: 0, matches: [] };

    const matches = [];
    let similarity = 0;

    // Compare fingerprints (most important)
    if (device1.fingerprint === device2.fingerprint) {
      similarity += 50;
      matches.push('fingerprint');
    }

    // Compare browser
    if (device1.browser?.name === device2.browser?.name) {
      similarity += 15;
      matches.push('browser_name');
    }

    if (device1.browser?.version === device2.browser?.version) {
      similarity += 10;
      matches.push('browser_version');
    }

    // Compare OS
    if (device1.os?.name === device2.os?.name) {
      similarity += 15;
      matches.push('os_name');
    }

    // Compare location
    if (device1.location?.country === device2.location?.country) {
      similarity += 10;
      matches.push('country');
    }

    return {
      similarity,
      matches,
      isSimilar: similarity >= 70,
      isLikelySame: similarity >= 90,
    };
  }

  /**
   * Generate device summary for display
   */
  static generateDeviceSummary(deviceInfo) {
    const browser = deviceInfo.browser?.name || 'Unknown Browser';
    const browserVersion = deviceInfo.browser?.version || '';
    const os = deviceInfo.os?.name || 'Unknown OS';
    const osVersion = deviceInfo.os?.version || '';
    const deviceType = deviceInfo.device?.type || 'unknown';
    const location = deviceInfo.location?.city ? `${deviceInfo.location.city}, ${deviceInfo.location.country}` : deviceInfo.location?.country || 'Unknown Location';

    return {
      displayName: `${browser} on ${os}`,
      fullDescription: `${browser} ${browserVersion} on ${os} ${osVersion}`.trim(),
      deviceType,
      location,
      riskLevel: deviceInfo.security?.riskLevel || 'unknown',
      suspiciousFlags: deviceInfo.security?.flags || [],
      lastSeen: deviceInfo.detectedAt || new Date(),
    };
  }

  /**
   * Check if device change is suspicious
   */
  static isSuspiciousDeviceChange(oldDevice, newDevice, user) {
    if (!oldDevice || !newDevice) return false;

    const comparison = this.compareDevices(oldDevice, newDevice);
    let suspiciousScore = 0;
    const reasons = [];

    // Different fingerprint
    if (oldDevice.fingerprint !== newDevice.fingerprint) {
      suspiciousScore += 20;
    }

    // Different country
    if (oldDevice.location?.country !== newDevice.location?.country) {
      suspiciousScore += 30;
      reasons.push('different_country');
    }

    // Very different browser/OS
    if (oldDevice.browser?.name !== newDevice.browser?.name) {
      suspiciousScore += 15;
      reasons.push('different_browser');
    }

    if (oldDevice.os?.name !== newDevice.os?.name) {
      suspiciousScore += 15;
      reasons.push('different_os');
    }

    // Time-based analysis
    const timeDiff = new Date() - new Date(user.lastLogin || 0);
    const hoursSinceLastLogin = timeDiff / (1000 * 60 * 60);

    // If it's been a while since last login, less suspicious
    if (hoursSinceLastLogin < 1) {
      suspiciousScore += 20;
      reasons.push('rapid_device_change');
    }

    return {
      isSuspicious: suspiciousScore >= 40,
      suspiciousScore,
      reasons,
      comparison,
    };
  }
}

module.exports = DeviceDetector;
