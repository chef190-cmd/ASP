# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/
COPY probes.yaml ./

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache \
    curl \
    iputils \
    bind-tools

# Copy from builder
COPY --from=builder /app /app

# Create non-root user
RUN addgroup -g 1001 -S abena && \
    adduser -S -D -u 1001 -G abena abena

USER abena

# Expose metrics port
EXPOSE 9090

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:9090/metrics || exit 1

# Default command
ENTRYPOINT ["node", "src/index.mjs"]
CMD ["--help"]