import js from '@eslint/js';
import prettier from '@vue/eslint-config-prettier';
import tseslint from '@vue/eslint-config-typescript';

export default [
  {
    ignores: ['dist/**', 'release/**', 'node_modules/**']
  },
  js.configs.recommended,
  ...tseslint(),
  prettier,
  {
    files: ['**/*.{ts,vue}'],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    }
  }
];
