// Run with: npm run check:tdz
// Catches the crash class that the TypeScript compiler cannot: reading a const/let BEFORE its declaration
// (even from inside a callback) throws "Cannot access 'x' before initialization" when the screen renders,
// and hooks that run in a different order between renders. Added after the Pulse screen crashed on exactly this.
import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import hooks from 'eslint-plugin-react-hooks'
export default [{
  files: ['**/*.ts', '**/*.tsx'],
  linterOptions: { reportUnusedDisableDirectives: 'off' },
  languageOptions: { parser: tsParser, parserOptions: { ecmaFeatures: { jsx: true } } },
  plugins: { '@typescript-eslint': tsPlugin, 'react-hooks': hooks },
  rules: {
    '@typescript-eslint/no-use-before-define': ['error', { functions: false, classes: true, variables: true, typedefs: false, ignoreTypeReferences: true }],
    'react-hooks/rules-of-hooks': 'error',
  },
}]
