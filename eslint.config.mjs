// @ts-check - Bật TypeScript checking cho file config này
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * ESLint Configuration - Cấu hình ESLint cho dự án NestJS
 * 
 * Sử dụng ESLint Flat Config (format mới nhất từ ESLint v9+)
 * Thay thế cho format cũ .eslintrc.js
 * 
 * Cấu hình này bao gồm:
 * - TypeScript support với type checking
 * - Prettier integration để format code tự động
 * - Node.js và Jest environment
 * - Rules tùy chỉnh cho dự án
 */
export default tseslint.config(
  {
    // Bỏ qua file config này để tránh lint chính nó
    ignores: ['eslint.config.mjs'],
  },
  
  // Sử dụng ESLint recommended rules (cơ bản)
  eslint.configs.recommended,
  
  // Sử dụng TypeScript ESLint recommended rules với type checking
  // Bao gồm cả recommended và recommendedTypeChecked
  // Đây là cấu hình tốt hơn so với chỉ 'plugin:@typescript-eslint/recommended'
  ...tseslint.configs.recommendedTypeChecked,
  
  // Tích hợp Prettier với ESLint
  // Tự động format code theo Prettier rules
  // Tránh conflict giữa ESLint và Prettier
  eslintPluginPrettierRecommended,
  
  {
    // Cấu hình ngôn ngữ và môi trường
    languageOptions: {
      // Định nghĩa global variables có sẵn
      globals: {
        ...globals.node,    // Node.js globals (process, console, Buffer, ...)
        ...globals.jest,    // Jest globals (describe, it, expect, ...)
      },
      
      // Loại module system
      sourceType: 'commonjs',
      
      // Cấu hình parser cho TypeScript
      parserOptions: {
        projectService: {
          allowDefaultProject: ['test/*.ts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  
  {
    // Rules tùy chỉnh cho dự án
    rules: {
      // Cho phép sử dụng 'any' type (tắt warning)
      // Lý do: Đôi khi cần dùng any cho external libraries hoặc dynamic data
      '@typescript-eslint/no-explicit-any': 'off',
      
      // Cảnh báo khi có promise không được await/return
      // Lý do: Có thể gây memory leak hoặc lỗi không xử lý
      '@typescript-eslint/no-floating-promises': 'warn',
      
      // Cảnh báo khi truyền argument không an toàn
      // Lý do: Có thể gây runtime error
      '@typescript-eslint/no-unsafe-argument': 'warn',
      
      // Tắt các rules quá strict cho testing và mock
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-enum-comparison': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/require-await': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',
      '@typescript-eslint/prefer-as-const': 'warn',
    },
  },
);