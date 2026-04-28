module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
  settings: { react: { version: '18.3' } },
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', 'coverage', 'node_modules', 'playwright-report', 'test-results'],
  rules: {
    'react/prop-types': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/ban-ts-comment': ['error', { 'ts-ignore': true, 'ts-expect-error': 'allow-with-description' }],
    'no-restricted-imports': [
      'error',
      {
        paths: [
          { name: 'moment', message: 'Use date-fns instead of moment.js (see .specfleet/instruction.md).' },
          { name: 'lodash', message: 'Import specific lodash modules (lodash/X) — never the full bundle.' },
        ],
      },
    ],
    'no-restricted-syntax': [
      'error',
      {
        selector: "CallExpression[callee.name='eval']",
        message: 'eval() is forbidden by NoviMart security policy.',
      },
    ],
  },
  overrides: [
    {
      files: ['**/*.test.ts', '**/*.test.tsx', 'src/test/**/*'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
  ],
};
