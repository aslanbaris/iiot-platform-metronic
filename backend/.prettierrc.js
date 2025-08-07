module.exports = {
  // Basic formatting
  semi: true,
  trailingComma: 'none',
  singleQuote: true,
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  
  // Object and array formatting
  bracketSpacing: true,
  bracketSameLine: false,
  
  // Arrow function formatting
  arrowParens: 'always',
  
  // String formatting
  quoteProps: 'as-needed',
  
  // Line endings
  endOfLine: 'lf',
  
  // Embedded language formatting
  embeddedLanguageFormatting: 'auto',
  
  // HTML formatting
  htmlWhitespaceSensitivity: 'css',
  
  // Prose formatting
  proseWrap: 'preserve',
  
  // Range formatting
  rangeStart: 0,
  rangeEnd: Infinity,
  
  // Parser
  requirePragma: false,
  insertPragma: false,
  
  // Vue formatting
  vueIndentScriptAndStyle: false,
  
  // Override for specific file types
  overrides: [
    {
      files: '*.json',
      options: {
        printWidth: 80,
        tabWidth: 2
      }
    },
    {
      files: '*.md',
      options: {
        printWidth: 80,
        proseWrap: 'always',
        tabWidth: 2
      }
    },
    {
      files: '*.yml',
      options: {
        tabWidth: 2,
        singleQuote: false
      }
    },
    {
      files: '*.yaml',
      options: {
        tabWidth: 2,
        singleQuote: false
      }
    },
    {
      files: ['*.js', '*.jsx'],
      options: {
        semi: true,
        singleQuote: true,
        trailingComma: 'none',
        bracketSpacing: true,
        arrowParens: 'always'
      }
    },
    {
      files: ['*.ts', '*.tsx'],
      options: {
        semi: true,
        singleQuote: true,
        trailingComma: 'es5',
        bracketSpacing: true,
        arrowParens: 'always'
      }
    },
    {
      files: '*.html',
      options: {
        printWidth: 120,
        tabWidth: 2,
        htmlWhitespaceSensitivity: 'ignore'
      }
    },
    {
      files: '*.css',
      options: {
        printWidth: 120,
        tabWidth: 2
      }
    },
    {
      files: '*.scss',
      options: {
        printWidth: 120,
        tabWidth: 2
      }
    },
    {
      files: '*.less',
      options: {
        printWidth: 120,
        tabWidth: 2
      }
    }
  ]
};