# FLUX Image Generation MCP Server

This MCP server provides image generation capabilities using the FLUX.1-schnell model via IONOS API.

## Features

- Generate images from text prompts
- Support for multiple image sizes
- Returns images as base64-encoded data for direct display in LibreChat

## Configuration

The server is configured in `librechat.yaml`:

```yaml
mcpServers:
  flux-image-gen:
    command: "node"
    args:
      - "/app/mcp-servers/flux-image-gen/index.js"
    env:
      IONOS_API_KEY: "${IONOS_API_KEY}"
```

## Usage

1. Build the Docker container (dependencies are installed during build)
2. The tool will be available in LibreChat agents
3. Users can generate images by asking the agent to create/generate images

## Example Prompts

- "Generate an image of a cat sitting on a windowsill"
- "Create a landscape image of mountains at sunset"
- "Make a picture of a futuristic city"
