// pm2 start ecosystem.config.js   (run from repo root after `pnpm run build`)
module.exports = {
  apps: [
    {
      name: 'pm-api',
      cwd: './apps/api',
      script: 'dist/src/main.js',
      env: {
        NODE_ENV: 'production',
        PORT: 8081,
        GITNEXUS_BIN: '/home/cps/.nvm/versions/node/v22.23.2/bin/gitnexus',
      },
    },
    {
      name: 'pm-web',
      // pm2 serve <dir> <port> --spa  → static files + client-route fallback
      script: 'npx',
      args: 'serve ./apps/web/dist -l 3002 -s',
      // ponytail: uses `serve`; swap to nginx for real prod traffic
    },
  ],
};
