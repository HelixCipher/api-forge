# API Forge

<p align="center">
  <img src="https://github.com/HelixCipher/api-forge/blob/main/Project_Demonstration_GIF.gif" width="800" alt="Project Project_Demonstration_GIF.gif"/>
</p>

A POC project where we have an AI-powered OpenAPI specification generator with multi-agent architecture, MCP context sharing, and automatic validation with auto-fix.

## Key Features

- **Local** AI models only
- **Strict API-Only Chat**: Rejects non-API queries (jokes, weather, gibberish)
- **100% Valid OpenAPI**: Auto-validates and fixes until spec is valid
- **MCP Demonstrated**: Real-time context sharing between agents
- **REST Best Practices**: POST→201, DELETE→204, proper schemas
-  **AI-Enhanced Documentation**: Smart documentation generation with intelligent AI improvements
- **Interactive Editing**: Context-aware AI assistant for real-time documentation enhancement

## Quick Start

Choose command based on your system:

```bash
# CPU-only mode (works on all systems)
docker compose --profile cpu up

# NVIDIA GPU acceleration
docker compose --profile gpu-nvidia up

# AMD GPU acceleration (ROCm)
docker compose --profile gpu-amd up
```

**Note:** GPU modes require NVIDIA Container Toolkit (for NVIDIA) or ROCm drivers (for AMD).

First-time setup (optional):
```bash
# Copy environment file and customize if needed
cp .env.example .env
```

Opens at `http://localhost:3000`

## How to Use

1. **Start the app**: Run one of the commands above based on your system

2. **Open browser**: Navigate to `http://localhost:3000`

3. **Describe your API**: "Design an API for zoo management"
4. **Review endpoints**: Approve/reject proposed endpoints
5. **Generate spec**: Click "Generate Spec" - auto-validates and fixes
6. **Export**: Copy/Download YAML/JSON

## Stopping the Application

```bash
# For CPU mode
docker compose --profile cpu down

# For NVIDIA GPU mode
docker compose --profile gpu-nvidia down

# For AMD GPU mode
docker compose --profile gpu-amd down
```

To remove volumes and start fresh:
```bash
docker compose --profile cpu down -v
docker compose --profile gpu-nvidia down -v
docker compose --profile gpu-amd down -v
```

Available models include: `llama3.2`, `phi3`, `mistral`, `gemma2`, `qwen2`

## GPU Requirements

### NVIDIA GPU
- NVIDIA GPU with compute capability 7.0 or higher
- NVIDIA Container Toolkit installed
- Docker with NVIDIA runtime configured

### AMD GPU
- AMD GPU supported by ROCm (e.g., RX 6000/7000 series, MI series)
- ROCm drivers installed
- Docker with GPU access configured

### Troubleshooting

```bash
# View logs for all services (use same profile as start)
docker compose --profile cpu logs -f
docker compose --profile gpu-nvidia logs -f
docker compose --profile gpu-amd logs -f

# View logs for specific service
docker compose --profile cpu logs -f backend
docker compose --profile cpu logs -f frontend
docker compose --profile gpu logs -f ollama-cpu

# Rebuild containers
docker compose --profile cpu down
docker compose --profile cpu build --no-cache
docker compose --profile cpu up

# Check if GPU is available (NVIDIA)
docker run --rm --gpus all nvidia/cuda:11.0-base nvidia-smi

# Check if GPU is available (AMD - ROCm)
docker run --rm --device=/dev/kfd --device=/dev/dri rocm/dev-ubuntu-22.04:latest rocm-smi
```

## Stopping the Application

```bash
docker compose down
```

To remove volumes and start fresh:
```bash
docker compose down -v
```

## Validation Features

| Check | Description |
|-------|-------------|
| YAML Syntax | Proper spacing (`parameters: []`) |
| Response Codes | POST→201, DELETE→204 |
| Schema Completeness | Full properties, not just id/timestamps |
| Schema Naming | Detects typos (Specy→Species) |

## Non-API Rejection

**Rejected**: "tell me a joke", "$%#@"

**Accepted**: "design an API for...", "need endpoints for..."

## Architecture

```
Frontend (React) ──HTTP──▶ Backend (FastAPI)
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
         Orchestrator    Drafter Agent   Validator Agent
              └───────── MCP Context ─────────┘
                              │
                              ▼
                         Ollama (LLM)
```

## Structure

```
├── src/                 # React frontend
├── backend/app/         # FastAPI + agents
│   └── agents/          # Orchestrator, Drafter, Validator
├── docker-compose.yml   # Container setup with profiles
└── .env.example         # Environment configuration
```

## Troubleshooting

```bash
# View logs
docker compose logs backend-gpu-nvidia

# Rebuild
docker compose down
docker compose --profile cpu build --no-cache
docker compose --profile cpu up
```

## License & Attribution

This project is licensed under the **Creative Commons Attribution 4.0 International (CC BY 4.0)** license.

You are free to **use, share, copy, modify, and redistribute** this material for any purpose (including commercial use), **provided that proper attribution is given**.

### Attribution requirements

Any reuse, redistribution, or derivative work **must** include:

1. **The creator’s name**: `HelixCipher`
2. **A link to the original repository**:  
   https://github.com/HelixCipher/api-forge
3. **An indication of whether changes were made**
4. **A reference to the license (CC BY 4.0)**

#### Example Attribution

> This work is based on *api-forge* by `HelixCipher`.  
> Original source: https://github.com/HelixCipher/api-forge
> Licensed under the Creative Commons Attribution 4.0 International (CC BY 4.0).

You may place this attribution in a README, documentation, credits section, or other visible location appropriate to the medium.

Full license text: https://creativecommons.org/licenses/by/4.0/


---

## Disclaimer

This project is provided **“as-is”**. The author accepts no responsibility for how this material is used. There is **no warranty** or guarantee that the scripts are safe, secure, or appropriate for any particular purpose. Use at your own risk.

see `DISCLAIMER.md` for full terms. Use at your own risk.
