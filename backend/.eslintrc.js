module.exports = {
  env: {
    browser: false,
    commonjs: true,
    es6: true,
    node: true,
    jest: true
  },
  extends: [
    'eslint:recommended',
    'airbnb-base',
    'prettier'
  ],
  plugins: [
    'prettier'
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  rules: {
    // Prettier integration
    'prettier/prettier': 'error',
    
    // Console statements
    'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'warn',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'warn',
    
    // Variables
    'no-unused-vars': ['error', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_'
    }],
    'no-var': 'error',
    'prefer-const': 'error',
    'no-undef': 'error',
    
    // Functions
    'func-names': 'off',
    'prefer-arrow-callback': 'error',
    'arrow-spacing': 'error',
    'no-param-reassign': ['error', { props: false }],
    
    // Objects and Arrays
    'object-shorthand': 'error',
    'prefer-destructuring': ['error', {
      array: true,
      object: true
    }, {
      enforceForRenamedProperties: false
    }],
    'prefer-template': 'error',
    
    // Async/Await
    'prefer-promise-reject-errors': 'error',
    'no-async-promise-executor': 'error',
    'require-atomic-updates': 'off',
    
    // Imports
    'import/prefer-default-export': 'off',
    'import/no-unresolved': 'error',
    'import/order': ['error', {
      groups: [
        'builtin',
        'external',
        'internal',
        'parent',
        'sibling',
        'index'
      ],
      'newlines-between': 'always'
    }],
    'import/newline-after-import': 'error',
    'import/no-duplicates': 'error',
    
    // Code style
    'consistent-return': 'error',
    'no-else-return': 'error',
    'no-return-await': 'error',
    'no-useless-return': 'error',
    'no-multiple-empty-lines': ['error', { max: 2, maxEOF: 1 }],
    'padded-blocks': ['error', 'never'],
    'space-before-blocks': 'error',
    'keyword-spacing': 'error',
    
    // Error handling
    'no-throw-literal': 'error',
    'prefer-promise-reject-errors': 'error',
    
    // Security
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    
    // Performance
    'no-loop-func': 'error',
    'no-await-in-loop': 'warn',
    
    // Node.js specific
    'global-require': 'off',
    'no-process-exit': 'off',
    'no-sync': 'warn',
    
    // Complexity
    'complexity': ['warn', 10],
    'max-depth': ['warn', 4],
    'max-lines': ['warn', 300],
    'max-lines-per-function': ['warn', 50],
    'max-params': ['warn', 4],
    
    // Comments
    'spaced-comment': ['error', 'always'],
    'multiline-comment-style': ['error', 'starred-block'],
    
    // Naming conventions
    'camelcase': ['error', { properties: 'never' }],
    'new-cap': ['error', { newIsCap: true, capIsNew: false }],
    
    // Semicolons and commas
    'semi': ['error', 'always'],
    'comma-dangle': ['error', 'never'],
    
    // Quotes
    'quotes': ['error', 'single', { avoidEscape: true }],
    
    // Spacing
    'indent': ['error', 2, { SwitchCase: 1 }],
    'no-trailing-spaces': 'error',
    'eol-last': 'error',
    
    // Operators
    'eqeqeq': ['error', 'always'],
    'no-eq-null': 'error',
    'no-unneeded-ternary': 'error',
    
    // Control flow
    'no-lonely-if': 'error',
    'no-nested-ternary': 'error',
    'no-unneeded-ternary': 'error',
    
    // Regular expressions
    'no-regex-spaces': 'error',
    'no-invalid-regexp': 'error',
    
    // Best practices
    'no-magic-numbers': ['warn', { 
      ignore: [-1, 0, 1, 2, 100, 200, 201, 400, 401, 403, 404, 500],
      ignoreArrayIndexes: true,
      enforceConst: true
    }],
    'no-duplicate-imports': 'error',
    'no-useless-constructor': 'error',
    'class-methods-use-this': 'off',
    
    // MongoDB/Mongoose specific
    'no-underscore-dangle': ['error', { 
      allow: ['_id', '__v', '_doc', '_update', '_conditions']
    }]
  },
  overrides: [
    {
      files: ['**/*.test.js', '**/*.spec.js', '**/tests/**/*.js'],
      env: {
        jest: true
      },
      rules: {
        'no-magic-numbers': 'off',
        'max-lines-per-function': 'off',
        'prefer-promise-reject-errors': 'off'
      }
    },
    {
      files: ['**/config/**/*.js', '**/scripts/**/*.js'],
      rules: {
        'no-console': 'off',
        'global-require': 'off'
      }
    },
    {
      files: ['**/middleware/**/*.js'],
      rules: {
        'consistent-return': 'off'
      }
    }
  ],
  settings: {
    'import/resolver': {
      node: {
        extensions: ['.js', '.json']
      }
    }
  },
  globals: {
    process: 'readonly',
    Buffer: 'readonly',
    __dirname: 'readonly',
    __filename: 'readonly',
    global: 'writable',
    module: 'readonly',
    require: 'readonly',
    exports: 'writable',
    console: 'readonly',
    setTimeout: 'readonly',
    clearTimeout: 'readonly',
    setInterval: 'readonly',
    clearInterval: 'readonly',
    setImmediate: 'readonly',
    clearImmediate: 'readonly'
  }
};