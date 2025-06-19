FROM node:18-alpine as builder

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./

# Install dependencies including development dependencies
RUN npm ci

# Bundle app source
COPY . .

# Create production build or any optimizations
# Prune dev dependencies once any build processes are done
RUN npm prune --production

# Production image
FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install Python and pip for DevOps utilities
RUN apk add --no-cache python3 py3-pip \
    && apk add --no-cache --virtual .build-deps \
    gcc \
    python3-dev \
    musl-dev \
    && ln -sf python3 /usr/bin/python

# Copy package.json and package-lock.json
COPY --from=builder /usr/src/app/package*.json ./

# Copy node_modules from builder stage
COPY --from=builder /usr/src/app/node_modules ./node_modules

# Copy application code
COPY --from=builder /usr/src/app ./

# Install Python dependencies
COPY requirements.txt ./
RUN pip3 install --no-cache-dir -r requirements.txt && \
    apk del .build-deps

# Create non-root user for enhanced security
RUN adduser -D appuser && \
    mkdir -p /usr/src/app/uploads && \
    chown -R appuser:appuser /usr/src/app

# Switch to non-root user
USER appuser

# Expose the port the app runs on
EXPOSE 3000

# Set up healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/api/health || exit 1

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Run the application
CMD ["node", "server.js"] 