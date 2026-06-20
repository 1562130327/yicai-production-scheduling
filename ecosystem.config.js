module.exports = {
  apps: [{
    name: 'production-scheduling',
    script: 'server-mock.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
