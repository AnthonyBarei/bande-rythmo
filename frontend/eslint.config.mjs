import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

export default [
    { ignores: ['dist/**', 'node_modules/**'] },
    {
        files: ['src/**/*.{js,jsx}'],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: 'module',
            parserOptions: { ecmaFeatures: { jsx: true } },
            globals: { ...globals.browser },
        },
        plugins: { 'react-hooks': reactHooks },
        rules: {
            ...js.configs.recommended.rules,
            ...reactHooks.configs.recommended.rules,
            // JSX usage isn't visible to core no-unused-vars without the react
            // plugin; keep vars check but allow _-prefixed escape hatch.
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^[A-Z_]' }],
            'no-empty': ['warn', { allowEmptyCatch: false }],
            'react-hooks/exhaustive-deps': 'off', // RAF/canvas refs make this too noisy for now
            // Compiler-grade hooks rules: real findings but refactor-level work
            // (tracked in REMAKE_PLAN Phase 2). Warn, don't block.
            'react-hooks/set-state-in-effect': 'warn',
            'react-hooks/refs': 'warn',
            'react-hooks/component-hook-factories': 'warn',
            'react-hooks/immutability': 'warn',
            'react-hooks/static-components': 'warn',
            'react-hooks/purity': 'warn',
            'react-hooks/preserve-manual-memoization': 'warn',
            'react-hooks/error-boundaries': 'warn',
            'react-hooks/globals': 'warn',
            'react-hooks/unsupported-syntax': 'warn',
            'react-hooks/incompatible-library': 'warn',
            'react-hooks/use-memo': 'warn',
        },
    },
]
