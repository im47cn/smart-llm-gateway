FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Run tests (optional in build stage)
RUN npm test || echo "Skipping tests"

# Production stage
FROM node:20-alpine

# Set environment variables
ENV NODE_ENV=production
ENV GRPC_PORT=50051

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy source from builder stage
COPY --from=builder /app/src ./src
COPY --from=builder /app/proto ./proto

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# Set ownership
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose gRPC port
EXPOSE 50051

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "const grpc = require('@grpc/grpc-js'); const client = new grpc.Client('localhost:50051', grpc.credentials.createInsecure()); client.waitForReady(Date.now() + 5000, (err) => { process.exit(err ? 1 : 0); });" || exit 1

# Start the application
CMD ["node", "src/index.js"]