/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'ui-must-not-use-repositories',
      comment:
        'UI behavior must invoke application services instead of accessing persistence directly. ' +
        'src/ui/composition is the composition-root exception.',
      severity: 'error',
      from: {
        path: '^src/ui/',
        pathNot: '^src/ui/composition/',
      },
      to: {
        path: '^src/(?:infrastructure/|domain/[^/]+/repository/)',
      },
    },
  ],
  options: {
    // Repository dependencies are architectural even when imported with
    // `import type`, so include TypeScript pre-compilation dependencies.
    tsPreCompilationDeps: true,
    doNotFollow: {
      path: 'node_modules',
    },
    tsConfig: {
      fileName: 'tsconfig.json',
    },
  },
};
