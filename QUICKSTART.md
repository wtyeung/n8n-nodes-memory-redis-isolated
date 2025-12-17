# Quick Start Guide

## Prerequisites
- n8n installed (version 1.0.0+)
- Redis server running (version 4.0+)
- Node.js 18.x or higher

## Installation

### Option 1: Local Development
```bash
# In your n8n custom nodes directory
npm install /path/to/n8n-nodes-memory-redis-isolated

# Restart n8n
```

### Option 2: From npm (after publishing)
```bash
# In n8n, go to Settings > Community Nodes
# Install: n8n-nodes-memory-redis-isolated
```

## Setup Redis Credentials

1. In n8n, navigate to **Credentials** → **New**
2. Search for "Redis Memory (Isolated)"
3. Fill in your Redis connection details:
   ```
   Host: localhost (or your Redis server)
   Port: 6379
   Password: your-redis-password (if required)
   Database: 0
   ```
4. Test and save the credential

## Create Your First Workflow

### Example: AI Chatbot with User Isolation

```
[Webhook] → [AI Agent] → [Respond to Webhook]
                ↑
        [Redis Chat Memory (Isolated)]
```

### Configuration

**Webhook Node:**
- Method: POST
- Path: `/chat`
- Expected JSON:
  ```json
  {
    "userId": "user123",
    "sessionId": "session456",
    "message": "Hello!"
  }
  ```

**Redis Chat Memory (Isolated) Node:**
- User ID: `{{ $json.userId }}`
- Session ID: `{{ $json.sessionId }}`
- Context Window Length: `10`
- Session TTL: `3600` (1 hour)

**AI Agent Node:**
- Connect the Redis Chat Memory to the Memory input
- Configure your AI model (OpenAI, etc.)
- Set system prompt as needed

## Testing User Isolation

### Test 1: Same User, Same Session
```bash
# Request 1
curl -X POST http://localhost:5678/webhook/chat \
  -H "Content-Type: application/json" \
  -d '{"userId": "alice", "sessionId": "conv1", "message": "My name is Alice"}'

# Request 2 - Should remember Alice
curl -X POST http://localhost:5678/webhook/chat \
  -H "Content-Type: application/json" \
  -d '{"userId": "alice", "sessionId": "conv1", "message": "What is my name?"}'
```

### Test 2: Different User, Same Session ID
```bash
# Request 1
curl -X POST http://localhost:5678/webhook/chat \
  -H "Content-Type: application/json" \
  -d '{"userId": "bob", "sessionId": "conv1", "message": "My name is Bob"}'

# Request 2 - Should NOT know about Alice, only Bob
curl -X POST http://localhost:5678/webhook/chat \
  -H "Content-Type: application/json" \
  -d '{"userId": "bob", "sessionId": "conv1", "message": "What is my name?"}'
```

### Test 3: Same User, Different Session
```bash
# New conversation for Alice
curl -X POST http://localhost:5678/webhook/chat \
  -H "Content-Type: application/json" \
  -d '{"userId": "alice", "sessionId": "conv2", "message": "What is my name?"}'

# Should NOT remember from conv1 (different session)
```

## Verify in Redis

Connect to your Redis instance and check the keys:

```bash
redis-cli

# List all keys
KEYS *

# You should see keys like:
# 96cae35ce8:conv1  (Alice's session)
# a3c7b8f2d1:conv1  (Bob's session)

# View a specific conversation
LRANGE 96cae35ce8:conv1 0 -1
```

## Queue Mode Deployment

When running n8n in queue mode:

```bash
# Start n8n in queue mode
n8n start --mode=queue

# Start workers
n8n worker --mode=queue
n8n worker --mode=queue
```

The Redis Chat Memory (Isolated) node ensures:
- ✅ Chat history is shared across all workers
- ✅ No data loss between requests
- ✅ User isolation is maintained
- ✅ Sessions persist across worker restarts

## Troubleshooting

### Issue: "Failed to connect to Redis"
- Check Redis is running: `redis-cli ping`
- Verify host and port in credentials
- Check firewall rules

### Issue: "User ID is required"
- Ensure your webhook/trigger provides `userId`
- Check the expression: `{{ $json.userId }}`

### Issue: "Memory not persisting"
- Verify Redis credentials are correct
- Check Session TTL isn't too short
- Ensure same User ID and Session ID are used

### Issue: "Users seeing each other's history"
- This should NOT happen due to hashing
- Verify you're using different User IDs
- Check Redis keys to debug

## Advanced Configuration

### Custom Session TTL by User Type
```javascript
// In a Function node before the memory node
if ($json.userType === 'premium') {
  $json.sessionTTL = 86400; // 24 hours
} else {
  $json.sessionTTL = 3600; // 1 hour
}
return $json;
```

### Dynamic Context Window
```javascript
// Adjust based on conversation complexity
if ($json.conversationType === 'support') {
  $json.contextWindow = 20; // More context for support
} else {
  $json.contextWindow = 5; // Less for simple chats
}
return $json;
```

## Best Practices

1. **User ID**: Use stable identifiers (database IDs, not emails)
2. **Session ID**: Use UUIDs or timestamp-based IDs
3. **TTL**: Set appropriate expiration (3600s = 1 hour is good default)
4. **Context Window**: Balance between context and token usage (10 is good default)
5. **Monitoring**: Monitor Redis memory usage and key count

## Support

For issues or questions:
- Check the [README.md](./README.md) for detailed documentation
- Review [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) for technical details
- Open an issue on GitHub (update repository URL in package.json)
