// PM2 startup script for development
process.env.NODE_ENV = 'development';
import('./server/index-dev.ts');
