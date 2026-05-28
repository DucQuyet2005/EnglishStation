# ============================================
# EnglishStation Backend Dockerfile
# Multi-stage build for smaller production image
# ============================================

# ---- Stage 1: Install Dependencies ----
FROM oven/bun:1 AS dependencies

WORKDIR /app

# Copy package files for caching
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production

# ---- Stage 2: Production Image ----
FROM oven/bun:1-slim AS production

WORKDIR /app

# Create non-root user for security
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs expressuser

# Copy dependencies from build stage
COPY --from=dependencies /app/node_modules ./node_modules

# Copy application source
COPY package.json ./
COPY src ./src

# Create uploads directory
RUN mkdir -p /app/uploads && chown -R expressuser:nodejs /app

# Switch to non-root user
USER expressuser

# Expose port
EXPOSE 3001

# Health check (bun:1-slim has no curl, use bun's built-in fetch)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e "fetch('http://localhost:3001/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))" || exit 1

# Start the application
CMD ["bun", "src/server.ts"]
