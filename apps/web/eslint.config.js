import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

const FORBIDDEN_COACHING_WORDS = ['failing', 'below target', 'underperforming', 'red flag'];

const coachingLanguagePlugin = {
  rules: {
    'no-forbidden-coaching-words': {
      meta: {
        type: 'problem',
        messages: {
          forbidden:
            'Forbidden coaching language: "{{word}}" — use metric_definitions.coaching_prompt from the database instead.',
        },
      },
      create(context) {
        return {
          JSXText(node) {
            const text = node.value.toLowerCase();
            for (const word of FORBIDDEN_COACHING_WORDS) {
              if (text.includes(word)) {
                context.report({ node, messageId: 'forbidden', data: { word } });
              }
            }
          },
        };
      },
    },
  },
};

export default [
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react-hooks': reactHooksPlugin,
      scorecard: coachingLanguagePlugin,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'scorecard/no-forbidden-coaching-words': 'error',
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
];
