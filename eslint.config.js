import js from '@eslint/js'
import globals from 'globals'

export default [
  { ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**'] },
  {
    files: ['backend/**/*.js'],
    ...js.configs.recommended,
    languageOptions: { globals: globals.node },
  },
]
