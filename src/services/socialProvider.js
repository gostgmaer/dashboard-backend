// Provider map and validation utilities for social auth

const SUPPORTED_PROVIDERS = [
  'google',
  'facebook',
  'twitter',
  'github',
  'apple',
  'linkedin',
  'microsoft',
  'discord'
];

const PROVIDER_DISPLAY_NAMES = {
  google: 'Google',
  facebook: 'Facebook',
  twitter: 'Twitter/X',
  github: 'GitHub',
  apple: 'Apple',
  linkedin: 'LinkedIn',
  microsoft: 'Microsoft',
  discord: 'Discord'
};

function isSupportedProvider(provider) {
  return SUPPORTED_PROVIDERS.includes(provider);
}

module.exports = {
  SUPPORTED_PROVIDERS,
  PROVIDER_DISPLAY_NAMES,
  isSupportedProvider
};