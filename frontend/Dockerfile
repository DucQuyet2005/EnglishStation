# ============================================
# EnglishStation Frontend Dockerfile
# Multi-stage build: Build → Serve with Nginx
# ============================================

# ---- Stage 1: Build ----
FROM node:20-alpine AS build

WORKDIR /app

# Accept build arguments for Vite
ARG VITE_API_URL=/api
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

# Copy package files
COPY package.json package-lock.json* ./
RUN npm install

# Copy source and build
COPY . .
RUN npm run build

# ---- Stage 2: Serve with Nginx ----
FROM nginx:alpine AS production

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy custom Nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built app from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
