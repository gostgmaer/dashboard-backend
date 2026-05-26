import globals from 'globals';
import js from '@eslint/js';

export default [
  {
    ignores: ['node_modules/**', 'uploads/**'],
  },
  js.configs.recommended,
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
    rules: {
      'no-unused-vars': 'warn',
      'no-undef': 'warn'
    }
  }
];
