# Use the official Node.js runtime as the base image
FROM node:18-alpine AS base

# Set the working directory in the container
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    musl-dev \
    giflib-dev \
    pixman-dev \
    pangomm-dev \
    libjpeg-turbo-dev \
    freetype-dev

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install dependencies
RUN npm install --only=production && npm cache clean --force

# Development stage
FROM base AS development

# Install all dependencies (including dev dependencies)
RUN npm install

# Copy the rest of the application code
COPY . .

# Create necessary directories
RUN mkdir -p logs uploads backups

# Set proper permissions
RUN chown -R node:node /app

# Switch to non-root user
USER node

# Expose the port the app runs on
EXPOSE 5000

# Command to run the application in development mode
CMD ["npm", "run", "dev"]

# Production stage
FROM base AS production

# Copy the rest of the application code
COPY . .

# Create necessary directories
RUN mkdir -p logs uploads backups

# Set proper permissions
RUN chown -R node:node /app

# Switch to non-root user
USER node

# Expose the port the app runs on
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node healthcheck.js

# Command to run the application
CMD ["npm", "start"]

# Multi-stage build for different environments
FROM production AS final

# Add labels for better container management
LABEL maintainer="IIOT Platform Team" \
      version="1.0.0" \
      description="Industrial IoT Platform Backend API" \
      org.opencontainers.image.title="IIOT Platform Backend" \
      org.opencontainers.image.description="Industrial IoT Platform Backend API" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.vendor="IIOT Platform Team" \
      org.opencontainers.image.licenses="MIT"

# Set environment variables
ENV NODE_ENV=production \
    PORT=5000 \
    NPM_CONFIG_LOGLEVEL=warn

# Final command
CMD ["npm", "start"]