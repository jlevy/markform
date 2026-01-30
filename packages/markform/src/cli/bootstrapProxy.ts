/**
 * Bootstrap proxy support for Node.js native fetch.
 *
 * Node.js native fetch (built on undici) does NOT honor HTTP_PROXY/HTTPS_PROXY
 * environment variables. The `NODE_USE_ENV_PROXY` flag is only available in
 * Node.js 23+. This module uses undici's ProxyAgent + setGlobalDispatcher to
 * route all fetch requests through the proxy when one is configured.
 *
 * Must be called synchronously before any fetch calls are made.
 */

import { ProxyAgent, setGlobalDispatcher } from 'undici';

export function bootstrapProxy(): void {
  const proxyUrl = process.env.https_proxy ?? process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY;

  if (proxyUrl) {
    const agent = new ProxyAgent(proxyUrl);
    setGlobalDispatcher(agent);
  }
}
