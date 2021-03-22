const esbuild = require('esbuild')
const path = require('path')

esbuild.build({
    entryPoints: ['src/index.jsx'],
    bundle: true,
    sourcemap: true,
    outfile: 'build/index.js',
    define: {
      'process.env.NODE_ENV': '"development"',
    },
    logLevel: 'info',
}).catch((e) => console.error(e.message))
