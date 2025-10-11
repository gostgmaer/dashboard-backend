const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const passport = require('passport');
const User = require('../models/user');
// const { logger } = require('../utils/logger');
const { sendEmail } = require('../services/emailService');
// const { getDeviceInfo } = require('../utils/deviceUtils');
const DeviceDetector = require('../services/deviceDetector');
const { isSupportedProvider } = require('../services/socialProvider');
// Environment configuration
const { GOOGLE_CLIENT_ID, FACEBOOK_APP_ID, TWITTER_API_KEY, GITHUB_CLIENT_ID, JWT_SECRET, FRONTEND_URL = 'http://localhost:3000' } = process.env;

// Initialize OAuth clients
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

class SocialAccountController {
  async linkSocialAccount(req, res) {
    try {
      const { provider, accessToken, code, email, identityToken } = req.body;
      const userId = req.user?.id || req.user?._id;
      if (!isSupportedProvider(provider)) return res.status(400).json({ success: false, message: 'Invalid provider.' });
      if (!userId) return res.status(401).json({ success: false, message: 'Auth required.' });
      const user = await User.findById(userId);
      if (!user || user.status !== 'active') return res.status(403).json({ success: false, message: 'Inactive or missing user.' });

      let profile;
      switch (provider) {
        case 'google':
          profile = await this.validateGoogleToken(accessToken || code);
          break;
        case 'facebook':
          profile = await this.validateFacebookToken(accessToken);
          break;
        case 'twitter':
          profile = await this.validateTwitterToken(accessToken, code);
          break;
        case 'github':
          profile = await this.validateGithubToken(accessToken || code);
          break;
        case 'apple':
          profile = await this.validateAppleToken(identityToken);
          break;
        case 'linkedin':
          profile = await this.validateLinkedInToken(accessToken);
          break;
        case 'microsoft':
          profile = await this.validateMicrosoftToken(accessToken);
          break;
        case 'discord':
          profile = await this.validateDiscordToken(accessToken);
          break;
        default:
          return res.status(400).json({ success: false, message: 'Unsupported provider.' });
      }

      if (!profile || !(profile.id || profile.sub)) return res.status(400).json({ success: false, message: 'Profile not found.' });

      const providerId = profile.id || profile.sub;
      const providerEmail = profile.email || email || user.email;

      if (user.socialAccounts.some((a) => a.provider === provider && a.providerId === providerId)) return res.status(409).json({ success: false, message: `${provider} already linked.` });

      const conflicting = await User.findOne({ 'socialAccounts.provider': provider, 'socialAccounts.providerId': providerId, _id: { $ne: userId } });
      if (conflicting) return res.status(409).json({ success: false, message: `This ${provider} account is linked elsewhere.` });

      if (providerEmail && providerEmail !== user.email) {
        const conflictUser = await User.findOne({ email: providerEmail.toLowerCase(), _id: { $ne: userId } });
        if (conflictUser) return res.status(409).json({ success: false, message: `Email for ${provider} already registered.` });
      }

      user.socialAccounts.push({ provider, providerId, email: providerEmail, verified: true, connectedAt: new Date() });
      await user.save();
      await user.logSecurityEvent('social_account_linked', `${provider} linked`, 'medium');
      res.status(200).json({ success: true, message: `${provider} linked successfully`, data: user.socialAccounts });
    } catch (err) {
      // logger.error('Link social account error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async unlinkSocialAccount(req, res) {
    try {
      const { provider, providerId } = req.body;
      const userId = req.user?.id || req.user?._id;
      if (!isSupportedProvider(provider)) return res.status(400).json({ success: false, message: 'Invalid provider.' });
      if (!userId) return res.status(401).json({ success: false, message: 'Auth required.' });
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ success: false, message: 'User missing.' });
      const idx = user.socialAccounts.findIndex((a) => a.provider === provider && (!providerId || a.providerId === providerId));
      if (idx < 0) return res.status(404).json({ success: false, message: `No ${provider} linked.` });
      const hasPassword = !!user.hash_password;
      const hasOtherAccounts = user.socialAccounts.length > 1;
      if (!hasPassword && !hasOtherAccounts) return res.status(400).json({ success: false, message: 'Cannot unlink last method.' });

      user.socialAccounts.splice(idx, 1);
      await user.save();
      await user.logSecurityEvent('social_account_unlinked', `${provider} unlinked`, 'medium');
      res.status(200).json({ success: true, message: `${provider} unlinked.`, data: user.socialAccounts });
    } catch (err) {
      // logger.error('Unlink social account error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async getSocialAccounts(req, res) {
    try {
      const userId = req.user?.id || req.user?._id;
      if (!userId) return res.status(401).json({ success: false, message: 'Auth required.' });
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ success: false, message: 'User missing.' });
      res.status(200).json({ success: true, data: user.socialAccounts });
    } catch (err) {
      // logger.error('Social accounts retrieval error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * Social login - authenticate or create user via social provider
   * POST /api/auth/social/login
   */
  async socialLogin(req, res) {
    try {
      const { provider, code, accessToken, email, profile } = req.body;
      const deviceInfo = DeviceDetector.detectDevice(req);

      // Validation
      if (!provider || !['google', 'facebook', 'twitter', 'github'].includes(provider)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or missing provider',
        });
      }

      let socialProfile;
      let providerId;
      let providerEmail;
      let profileData = {};

      // Provider-specific validation
      switch (provider) {
        case 'google':
          socialProfile = await this.validateGoogleToken(accessToken || code);
          if (!socialProfile) {
            return res.status(400).json({
              success: false,
              message: 'Invalid Google authentication',
            });
          }
          providerId = socialProfile.sub;
          providerEmail = socialProfile.email;
          profileData = {
            firstName: socialProfile.given_name,
            lastName: socialProfile.family_name,
            profilePicture: { url: socialProfile.picture },
          };
          break;

        case 'facebook':
          socialProfile = await this.validateFacebookToken(accessToken);
          if (!socialProfile) {
            return res.status(400).json({
              success: false,
              message: 'Invalid Facebook access token',
            });
          }
          providerId = socialProfile.id;
          providerEmail = socialProfile.email;
          profileData = {
            firstName: socialProfile.first_name,
            lastName: socialProfile.last_name,
            profilePicture: { url: socialProfile.picture?.data?.url },
          };
          break;

        case 'twitter':
          socialProfile = await this.validateTwitterToken(accessToken, code);
          if (!socialProfile) {
            return res.status(400).json({
              success: false,
              message: 'Invalid Twitter authentication',
            });
          }
          providerId = socialProfile.id_str || socialProfile.id;
          providerEmail = socialProfile.email;
          profileData = {
            firstName: socialProfile.name?.split(' ')[0],
            lastName: socialProfile.name?.split(' ').slice(1).join(' '),
            profilePicture: { url: socialProfile.profile_image_url_https },
          };
          break;

        case 'github':
          socialProfile = await this.validateGithubToken(accessToken || code);
          if (!socialProfile) {
            return res.status(400).json({
              success: false,
              message: 'Invalid GitHub access token',
            });
          }
          providerId = socialProfile.id.toString();
          providerEmail = socialProfile.email;
          profileData = {
            firstName: socialProfile.name?.split(' ')[0] || socialProfile.login,
            lastName: socialProfile.name?.split(' ').slice(1).join(' '),
            profilePicture: { url: socialProfile.avatar_url },
          };
          break;
      }

      if (!providerId) {
        return res.status(400).json({
          success: false,
          message: `Unable to retrieve ${provider} account information`,
        });
      }

      // Try to authenticate existing user
      const { user, isNewUser } = await User.authenticateViaSocial(
        {
          provider,
          providerId,
          email: email || providerEmail,
          profile: profileData,
        },
        deviceInfo
      );

      // Generate tokens
      const tokens = await user.generateTokens(deviceInfo);

      // Log successful login
      await user.logSecurityEvent(isNewUser ? 'social_registration' : 'social_login', `${isNewUser ? 'New user registered' : 'User logged in'} via ${provider}`, 'low', { ...deviceInfo, provider, isNewUser });

      res.status(200).json({
        success: true,
        message: `${isNewUser ? 'Account created and logged in' : 'Logged in'} successfully via ${provider}`,
        data: {
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
            fullName: user.fullName,
            profilePicture: user.profilePicture,
            isVerified: user.isVerified,
            status: user.status,
          },
          tokens: {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresAt: tokens.accessTokenExpiresAt,
          },
          isNewUser,
          provider,
          deviceId: tokens.deviceId,
        },
      });
    } catch (error) {
      // logger.error('Social login error:', error);

      // Log failed login attempt
      try {
        const deviceInfo = DeviceDetector.detectDevice(req);
        // Create a temporary log since we don't have a user
        // logger.warn('Social login failed', {
        //   provider: req.body?.provider,
        //   error: error.message,
        //   deviceInfo,
        //   timestamp: new Date()
        // });
      } catch (logError) {
        // logger.error('Failed to log social login error:', logError);
      }

      res.status(500).json({
        success: false,
        message: 'Social login failed',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Authentication failed',
      });
    }
  }

  /**
   * Verify social account linked to user
   * POST /api/auth/social/verify
   */
  async verifySocialAccount(req, res) {
    try {
      const { provider, providerId } = req.body;
      const userId = req.user?.id || req.user?._id;
      const deviceInfo = DeviceDetector.detectDevice(req);

      if (!provider || !providerId) {
        return res.status(400).json({
          success: false,
          message: 'Provider and providerId are required',
        });
      }

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      const verifiedAccount = await user.verifySocialAccount(provider, providerId);

      res.status(200).json({
        success: true,
        message: `${provider} account verified successfully`,
        data: {
          provider: verifiedAccount.provider,
          email: verifiedAccount.email,
          verified: verifiedAccount.verified,
          connectedAt: verifiedAccount.connectedAt,
        },
      });
    } catch (error) {
      // logger.error('Social account verification error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to verify social account',
      });
    }
  }

  /**
   * Update email for a linked social account
   * PUT /api/auth/social/update-email
   */
  async updateSocialAccountEmail(req, res) {
    try {
      const { provider, providerId, newEmail } = req.body;
      const userId = req.user?.id || req.user?._id;

      if (!provider || !providerId || !newEmail) {
        return res.status(400).json({
          success: false,
          message: 'Provider, providerId, and newEmail are required',
        });
      }

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      // Validate email format
      const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
      if (!emailRegex.test(newEmail)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email format',
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      const updatedAccount = await user.updateSocialAccountEmail(provider, providerId, newEmail.toLowerCase());

      res.status(200).json({
        success: true,
        message: `${provider} account email updated successfully`,
        data: {
          provider: updatedAccount.provider,
          email: updatedAccount.email,
          verified: updatedAccount.verified,
          connectedAt: updatedAccount.connectedAt,
        },
      });
    } catch (error) {
      // logger.error('Social account email update error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update social account email',
      });
    }
  }

  // Private helper methods for provider validation

  async validateGoogleToken(token) {
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: token,
        audience: GOOGLE_CLIENT_ID,
      });
      return ticket.getPayload();
    } catch (error) {
      // logger.error('Google token validation error:', error);
      return null;
    }
  }

  async validateFacebookToken(accessToken) {
    try {
      const response = await fetch(`https://graph.facebook.com/me?fields=id,name,first_name,last_name,email,picture&access_token=${accessToken}`);
      const data = await response.json();

      if (data.error) {
        // logger.error('Facebook token validation error:', data.error);
        return null;
      }

      return data;
    } catch (error) {
      // logger.error('Facebook token validation error:', error);
      return null;
    }
  }

  async validateTwitterToken(accessToken, accessTokenSecret) {
    try {
      // Twitter OAuth 1.0a validation would go here
      // This is a simplified version - implement proper OAuth 1.0a signature validation
      // Or use Twitter OAuth 2.0 with Bearer tokens for simpler validation

      const OAuth = require('oauth').OAuth;
      const oauth = new OAuth('https://api.twitter.com/oauth/request_token', 'https://api.twitter.com/oauth/access_token', TWITTER_API_KEY, process.env.TWITTER_API_SECRET, '1.0A', null, 'HMAC-SHA1');

      return new Promise((resolve, reject) => {
        oauth.get('https://api.twitter.com/1.1/account/verify_credentials.json?include_email=true', accessToken, accessTokenSecret, (error, data) => {
          if (error) {
            reject(error);
          } else {
            resolve(JSON.parse(data));
          }
        });
      });
    } catch (error) {
      // logger.error('Twitter token validation error:', error);
      return null;
    }
  }

  async validateGithubToken(accessToken) {
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `token ${accessToken}`,
          'User-Agent': 'YourApp/1.0',
        },
      });

      if (!response.ok) {
        // logger.error('GitHub token validation failed:', response.status);
        return null;
      }

      const userData = await response.json();

      // Get user email if not public
      if (!userData.email) {
        const emailResponse = await fetch('https://api.github.com/user/emails', {
          headers: {
            Authorization: `token ${accessToken}`,
            'User-Agent': 'YourApp/1.0',
          },
        });

        if (emailResponse.ok) {
          const emails = await emailResponse.json();
          const primaryEmail = emails.find((email) => email.primary && email.verified);
          if (primaryEmail) {
            userData.email = primaryEmail.email;
          }
        }
      }

      return userData;
    } catch (error) {
      // logger.error('GitHub token validation error:', error);
      return null;
    }
  }

  // Add additional provider validators into the controller
  // Place these inside SocialAccountController class

  // Apple Sign-In (JWT validation)
  async validateAppleToken(identityToken) {
    // Apple returns a JWT (identityToken). Validate signature and decode claims.
    // Use apple-signin-auth or jose libraries
    try {
      const { jwtVerify, decodeJwt, importJWK } = require('jose');

      const header = JSON.parse(Buffer.from(identityToken.split('.')[0], 'base64').toString());
      const kid = header.kid;

      // Fetch Apple public keys
      const res = await fetch('https://appleid.apple.com/auth/keys');
      const { keys } = await res.json();
      const jwk = keys.find((k) => k.kid === kid);
      if (!jwk) return null;

      const publicKey = await importJWK(jwk, 'RS256');
      await jwtVerify(identityToken, publicKey, {
        issuer: 'https://appleid.apple.com',
        audience: process.env.APPLE_CLIENT_ID,
      });

      const payload = decodeJwt(identityToken);
      return {
        sub: payload.sub,
        email: payload.email,
        email_verified: payload.email_verified,
      };
    } catch (err) {
      // logger.error('Apple token validation error:', err);
      return null;
    }
  }

  // LinkedIn (OAuth2)
  async validateLinkedInToken(accessToken) {
    try {
      const profileRes = await fetch('https://api.linkedin.com/v2/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const emailRes = await fetch('https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!profileRes.ok) return null;
      const profile = await profileRes.json();
      let email;
      if (emailRes.ok) {
        const emailJson = await emailRes.json();
        email = emailJson.elements?.[0]?.['handle~']?.emailAddress;
      }

      return {
        id: profile.id,
        firstName: profile.localizedFirstName,
        lastName: profile.localizedLastName,
        email,
      };
    } catch (e) {
      // logger.error('LinkedIn token validation error:', e);
      return null;
    }
  }

  // Microsoft (MS Graph)
  async validateMicrosoftToken(accessToken) {
    try {
      const res = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return null;
      const data = await res.json();
      return {
        id: data.id,
        email: data.mail || data.userPrincipalName,
        displayName: data.displayName,
      };
    } catch (e) {
      // logger.error('Microsoft token validation error:', e);
      return null;
    }
  }

  // Discord
  async validateDiscordToken(accessToken) {
    try {
      const res = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return null;
      const data = await res.json();
      return {
        id: data.id,
        email: data.email,
        username: data.username,
        avatar: data.avatar,
      };
    } catch (e) {
      // logger.error('Discord token validation error:', e);
      return null;
    }
  }
}

module.exports = new SocialAccountController();
