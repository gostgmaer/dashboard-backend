import globals from 'globals';
import js from '@eslint/js';

export default [
  {
    files: ['**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        process: 'readonly'
      }
    }
  },
  {
    files: ['**/*.js'],
    plugins: {
      js
    },
    extends: [
      'plugin:js/recommended'
    ],
    rules: {
      'no-unused-vars': 'warn',
      'no-undef': 'warn'
    }
  }
];
