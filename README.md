# n8n-nodes-memory-redis-isolated

This is an n8n community node that provides Redis-based chat memory for AI agents with **user isolation** for n8n queue mode deployments.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.

- [Installation](#installation)
- [Features](#features)
- [Operations](#operations)
- [Credentials](#credentials)
- [Compatibility](#compatibility)
- [Usage](#usage)
- [How User Isolation Works](#how-user-isolation-works)
- [Resources](#resources)

## Installation

### Community Nodes (Recommended)

1. In n8n, go to **Settings** > **Community Nodes**
2. Select **Install**
3. Enter `n8n-nodes-memory-redis-isolated`
4. Accept the installation

### Manual Installation (Local Development)

For n8n v1.0+:
```bash
cd ~/.n8n/custom-nodes
npm install n8n-nodes-memory-redis-isolated
```

For n8n v2.0+ (Docker/Self-hosted):
1. Mount the volume to `/home/node/.n8n/custom-nodes`
2. Install the package inside that directory

## Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Start n8n with the node loaded:
   ```bash
   npm run dev
   ```
4. The node will appear as **Redis Chat Memory (Isolated)** in the AI Agent node's Memory selector.

## Troubleshooting

- **Node not showing up?** Ensure you are looking in the **Memory** input of the AI Agent node, not just the main node list.
- **Can't find the node?** In the main node list, search for **"isolated"** to find this node. Searching for "redis" may not show it due to n8n's search indexing prioritizing built-in nodes.
- **Connection failed?** Verify your Redis credentials and network connectivity.
- **Port conflicts?** If `npm run dev` fails, check if another n8n instance is running on port 5678.

## Features

- **Workflow Isolation**: Chat histories are isolated per workflow using hashed workflow IDs
- **Queue Mode Compatible**: Designed specifically for n8n queue mode where simple in-memory storage doesn't work reliably
- **Dedicated Credentials**: Uses its own credential type, not shared with regular Redis operation nodes. This prevents users from using the same credential to list keys or access other workflows' memory data via Redis operation nodes.
- **Session Management**: Supports session TTL and context window length
- **Secure**: Workflow IDs are hashed (SHA-256) and only the first 10 characters are used as prefix

## Operations

This node provides a single operation: **Redis Chat Memory (Isolated)**

The node stores and retrieves chat history for AI agents with the following parameters:

- **Session ID**: Session identifier for the conversation
- **Context Window Length**: Number of previous messages to keep in memory (default: 10)
- **Session Time To Live**: How long the session should be stored in seconds (0 = no expiration)

## Credentials

This node uses a dedicated **Redis Memory (Isolated)** credential type that is NOT shared with the standard Redis operation node.

### Setting up credentials:

1. In n8n, go to **Credentials** → **New**
2. Search for "Redis Memory (Isolated)"
3. Configure the following:
   - **Host**: Redis server hostname (default: localhost)
   - **Port**: Redis server port (default: 6379)
   - **Password**: Redis password (if required)
   - **User**: Redis username (leave blank for password-only auth)
   - **Database Number**: Redis database number (default: 0)
   - **SSL**: Enable SSL/TLS connection
   - **Disable TLS Verification**: Only for self-signed certificates (insecure)

### Azure Cache for Redis:

When using **Azure Cache for Redis**, configure the credentials as follows:
- **Host**: Your Azure Redis hostname (e.g., `yourname.redis.cache.windows.net`)
- **Port**: `6380` (Azure uses SSL by default)
- **Password**: Use your Azure Redis **Access Key** (Primary or Secondary)
- **User**: Leave blank (Azure Redis uses password-only authentication)
- **SSL**: Enable this option (required for Azure)
- **Database Number**: 0 (or your preferred database)

### Prerequisites:

- A running Redis server (version 4.0+)
- Redis credentials with read/write access

## Compatibility

- **Minimum n8n version**: 1.0.0
- **Tested with**: n8n 1.x
- **Node.js**: 18.x or higher
- **Redis**: 4.0 or higher

## Usage

### Basic Setup

1. Add an **AI Agent** node to your workflow
2. Add the **Redis Chat Memory (Isolated)** node
3. Connect it to your AI Agent's memory input
4. Configure the credentials
5. Set the Session ID parameter

### Example Configuration

```javascript
// Session ID - can be conversation-specific or user-specific
{{ $json.sessionId }}
// or
{{ $json.conversationId }}
```

### Queue Mode

This node is specifically designed for n8n queue mode deployments where:
- Multiple worker processes handle requests
- In-memory storage is unreliable across workers
- Persistent storage is required for chat history

## How Workflow Isolation Works

The node ensures that workflows cannot access each other's chat history through a two-step process:

1. **Hashing**: The workflow ID is hashed using SHA-256
2. **Prefix**: Only the first 10 characters of the hash are used as a prefix
3. **Key Format**: Redis keys are stored as `{workflowHash}:{sessionId}`

### Example:

```
Workflow ID: "abc123xyz"
SHA-256 Hash: "96cae35ce8a9b0244178bf28e4966c2ce1b8385723a96a6b838858cdd6ca0a1e"
Prefix (first 10 chars): "96cae35ce8"
Session ID: "conv456"
Final Redis Key: "96cae35ce8:conv456"
```

This ensures:
- Different workflows cannot access each other's memory
- Memory is isolated per workflow, preventing cross-workflow data leaks
- The workflow ID is consistent across all queue workers
- The system is scalable and performant

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [Redis documentation](https://redis.io/documentation)
- [LangChain Redis Memory](https://js.langchain.com/docs/integrations/memory/redis)

## Version History

### 0.1.0 (Initial Release)

- Redis-based chat memory with user isolation
- Dedicated credential type
- Support for queue mode deployments
- Configurable context window and session TTL
