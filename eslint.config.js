import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'android/**',
      'node_modules/**',
      'coverage/**',
      'eslint.config.js',
      // Standalone Node content-generator for reservoir.json (GDD §2.6/§3.2)
      // - a build-time authoring tool, not part of the typed app/tsconfig.
      'scripts/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        window: 'readonly',
        document: 'readonly',
        screen: 'readonly',
        localStorage: 'readonly',
        console: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['*.config.ts', '*.config.js'],
    languageOptions: {
      globals: {
        __dirname: 'readonly',
      },
    },
  },
  eslintConfigPrettier,
);
