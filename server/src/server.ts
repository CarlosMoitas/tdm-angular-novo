import { createApp } from './app';
import { env } from './config/env';
import { logger } from './logging/logger';

const app = createApp();

app.listen(env.port, () => {
  logger.info(`Servidor tdm-angular-novo rodando em http://localhost:${env.port}`);
});
