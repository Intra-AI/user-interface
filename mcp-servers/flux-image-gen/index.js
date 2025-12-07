#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import fetch from 'node-fetch';

const IONOS_API_KEY = process.env.IONOS_API_KEY;
const IONOS_BASE_URL = 'https://openai.inference.de-txl.ionos.com/v1';

class FluxImageGenServer {
  constructor() {
    this.server = new Server(
      {
        name: 'flux-image-gen',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'generate_image',
          description: 'Generate an image using FLUX.1-schnell model via IONOS. Returns the image as base64 encoded data.',
          inputSchema: {
            type: 'object',
            properties: {
              prompt: {
                type: 'string',
                description: 'Detailed text description of the image to generate',
              },
              size: {
                type: 'string',
                description: 'Image size (default: 1024x1024)',
                enum: ['256x256', '512x512', '1024x1024', '1024x1792', '1792x1024'],
                default: '1024x1024',
              },
            },
            required: ['prompt'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name === 'generate_image') {
        return await this.generateImage(request.params.arguments);
      }
      
      throw new Error(`Unknown tool: ${request.params.name}`);
    });
  }

  async generateImage(args) {
    const { prompt, size = '1024x1024' } = args;

    if (!IONOS_API_KEY) {
      return {
        content: [
          {
            type: 'text',
            text: 'Error: IONOS_API_KEY environment variable is not set',
          },
        ],
        isError: true,
      };
    }

    try {
      const response = await fetch(`${IONOS_BASE_URL}/images/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${IONOS_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'black-forest-labs/FLUX.1-schnell',
          prompt: prompt,
          n: 1,
          size: size,
          response_format: 'b64_json',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`IONOS API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.data || !data.data[0] || !data.data[0].b64_json) {
        throw new Error('Invalid response from IONOS API');
      }

      const imageData = data.data[0].b64_json;

      return {
        content: [
          {
            type: 'image',
            data: imageData,
            mimeType: 'image/png',
          },
          {
            type: 'text',
            text: `Successfully generated image with prompt: "${prompt}"`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error generating image: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('FLUX Image Generation MCP server running on stdio');
  }
}

const server = new FluxImageGenServer();
server.run().catch(console.error);
