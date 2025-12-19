# Dependency Resolution Fix (v0.2.3)

## Problem

When installing `n8n-nodes-memory-redis-isolated@0.2.2` in n8n, users encountered this error:

```
npm error ERESOLVE unable to resolve dependency tree
npm error While resolving: n8n-nodes-memory-redis-isolated@0.2.2
npm error Found: @langchain/core@1.1.7
npm error Could not resolve dependency:
npm error peer @langchain/core@">=0.3.58 <0.4.0" from langchain@0.3.36
```

## Root Cause

The package had LangChain dependencies specified as direct dependencies:

```json
"dependencies": {
  "@langchain/classic": "^1.0.6",
  "@langchain/redis": "^0.1.0",
  "langchain": "^0.3.0",
  "redis": "^4.7.0"
}
```

This caused conflicts because:
- n8n already has its own LangChain packages installed
- `@langchain/classic@1.0.6` requires `@langchain/core@^1.0.0`
- `langchain@0.3.x` requires `@langchain/core@>=0.3.58 <0.4.0`
- n8n has `@langchain/core@1.1.7` installed
- npm couldn't resolve these conflicting peer dependency requirements

## Solution

Move all LangChain packages to **peer dependencies** with wildcard versions:

```json
"dependencies": {
  "redis": "^4.7.0"
},
"peerDependencies": {
  "@langchain/classic": "*",
  "@langchain/core": "*",
  "@langchain/redis": "*",
  "langchain": "*",
  "n8n-workflow": "*"
}
```

### Why This Works

1. **Peer dependencies** tell npm: "I need these packages, but I'll use whatever version the parent application (n8n) provides"
2. **Wildcard versions (`*`)** accept any version n8n has installed
3. **Only `redis` client** remains as a direct dependency since it's not provided by n8n
4. **Dev dependencies** include LangChain packages for local development and building

### Benefits

- ✅ No version conflicts during installation
- ✅ Uses n8n's existing LangChain packages (smaller install size)
- ✅ Automatically compatible with n8n's LangChain version updates
- ✅ Still builds correctly locally with dev dependencies

## Testing

After the fix:

```bash
npm install  # Installs successfully with --legacy-peer-deps
npm run build  # Builds successfully
```

In n8n, the package now installs without errors.

## For Future Development

When developing locally:
- Dev dependencies provide LangChain packages for TypeScript compilation
- Use `npm install --legacy-peer-deps` if needed during development
- The built package in `dist/` will work with any compatible LangChain version in n8n
