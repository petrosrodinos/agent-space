import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { globalIgnores } from 'eslint/config'

/** §14.1: outside src/platform/, never touch native/browser capabilities directly. CI fails on violations. */
const platformRestrictions = {
  'no-restricted-imports': ['error', { patterns: [{ group: ['@capacitor/*', 'electron'], message: 'Use the platform layer (src/platform).' }] }],
  'no-restricted-globals': ['error', { name: 'Notification', message: 'Use platform.notifications.' }, { name: 'localStorage', message: 'Use platform.storage.' }, { name: 'sessionStorage', message: 'Use platform.storage.' }],
  'no-restricted-properties': [
    'error',
    { object: 'navigator', property: 'clipboard', message: 'Use platform.clipboard.' },
    { object: 'navigator', property: 'mediaDevices', message: 'Use platform.media.' },
    { object: 'navigator', property: 'share', message: 'Use platform.share.' },
    { object: 'window', property: 'open', message: 'Use platform.links.openExternal.' },
    { object: 'window', property: 'localStorage', message: 'Use platform.storage.' },
    { object: 'window', property: 'sessionStorage', message: 'Use platform.storage.' },
  ],
}

export default tseslint.config([
  globalIgnores(['dist', 'android', 'ios']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      ...platformRestrictions,
      'react-refresh/only-export-components': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['src/platform/**/*.{ts,tsx}', 'capacitor.config.ts'],
    rules: { 'no-restricted-globals': 'off', 'no-restricted-properties': 'off', 'no-restricted-imports': 'off' },
  },
])
