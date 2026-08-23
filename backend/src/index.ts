import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import routes from './routes/index.js';
import { config } from './config/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { apiRateLimit } from './middleware/rateLimit.js';

function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: config.cors.origin,
      credentials: true,
    })
  );
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  if (config.isDevelopment) {
    app.use(morgan('dev'));
  }

  app.use('/api', apiRateLimit, routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

function startServer() {
  const app = createApp();

  app.listen(config.port, () => {
    console.log(`\n🚀 Assignment Tracker API running on port ${config.port}`);
    console.log(`   Environment: ${config.env}`);
    console.log(`   CORS: ${config.cors.origin}`);
    console.log(`   Health check: http://localhost:${config.port}/api/health\n`);
  });
}

startServer();
