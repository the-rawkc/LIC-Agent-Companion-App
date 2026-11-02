/**
 * Cloudflare Pages Functions route for /api/sync/*
 * Automatically executed when deployed via Cloudflare Pages with D1 binding.
 */
import { handleSyncRequest, type Env } from '../../../worker/index';

export async function onRequest(context: { request: Request; env: Env }): Promise<Response> {
  return handleSyncRequest(context.request, context.env);
}
