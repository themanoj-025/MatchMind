import { OpenAPIRegistry, OpenApiGeneratorV31, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi'
import { z } from 'zod'
extendZodWithOpenApi(z)
export const openapiRegistry = new OpenAPIRegistry()
export function generateOpenAPI() {
  const generator = new OpenApiGeneratorV31(openapiRegistry.definitions)
  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      version: '1.0.0',
      title: 'MatchMind API',
      description: 'API Documentation for MatchMind',
    },
    servers: [{ url: '/api/v1' }],
  })
}