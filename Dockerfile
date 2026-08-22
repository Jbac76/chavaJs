# Dockerfile for chavaJs Production

FROM node:20-alpine AS base

# Install production dependencies only
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY examples/starter/package*.json ./examples/starter/

# Install dependencies
RUN npm ci --only=production --ignore-scripts

# Build the application
FROM base AS builder
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY examples/starter/package*.json ./examples/starter/

# Install all dependencies (including dev)
RUN npm ci --ignore-scripts

# Copy source code
COPY . .

# Assemble the framework
RUN npm run assemble

# Build frontend assets
WORKDIR /app/examples/starter
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV APP_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 chavajs

# Copy necessary files
COPY --from=deps --chown=chavajs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=chavajs:nodejs /app/examples/starter ./

# Create storage directories
RUN mkdir -p storage/framework/sessions storage/logs && \
    chown -R chavajs:nodejs storage

# Switch to non-root user
USER chavajs

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); })"

# Start the application
CMD ["node", "bin/chava.js", "serve", "--port", "8080"]
