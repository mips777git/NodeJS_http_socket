const eslintPluginPrettier = require('eslint-plugin-prettier');
const eslintConfigPrettier = require('eslint-config-prettier');

module.exports = [
  {
    // 무시할 파일들
    ignores: [
      'node_modules/**',
      'dist/**',
      '.prettierrc.js',
      'eslint.config.js',
      '.eslintrc.js',
    ],
  },
  {
    // JavaScript 파일에 적용할 설정
    files: ['**/*.js'],

    // 언어 옵션
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'script',
      globals: {
        // Node.js 전역 변수
        console: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'writable',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
      },
    },

    // Prettier 플러그인 사용
    plugins: {
      prettier: eslintPluginPrettier,
    },

    // ESLint 규칙 설정
    rules: {
      // ESLint 기본 권장 규칙
      'no-unused-vars': 'off', // 사용하지 않는 변수 경고 끄기
      'no-console': 'off',
      'no-undef': 'error',

      // Prettier 규칙
      'prettier/prettier': 'error',

      // Prettier와 충돌하는 규칙 비활성화
      ...eslintConfigPrettier.rules,
    },
  },
];
