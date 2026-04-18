'use strict';

/**
 * New Relic agent configuration.
 * Loaded automatically when started with `node -r newrelic`.
 * Values can be overridden via NEW_RELIC_* environment variables.
 */
exports.config = {
  app_name: [process.env.NEW_RELIC_APP_NAME || 'mcp-to-mcp-weather'],
  license_key: process.env.NEW_RELIC_LICENSE_KEY,
  logging: {
    level: process.env.NEW_RELIC_LOG_LEVEL || 'info',
  },
  allow_all_headers: true,
  attributes: {
    exclude: [
      'request.headers.cookie',
      'request.headers.authorization',
      'request.headers.proxyAuthorization',
      'request.headers.setCookie*',
      'request.headers.x*',
      'response.headers.cookie',
      'response.headers.authorization',
      'response.headers.proxyAuthorization',
      'response.headers.setCookie*',
      'response.headers.x*',
    ],
  },
  distributed_tracing: {
    enabled: true,
  },
  transaction_tracer: {
    enabled: true,
    record_sql: 'obfuscated',
  },
  application_logging: {
    forwarding: {
      enabled: true,
    },
  },
};
