# Dockerfile for MCPDog

# ---- Base Stage ----
# Use a specific Node.js version for reproducibility.
FROM node:20-alpine AS base
WORKDIR /usr/src/app

# Install dependencies first to leverage Docker layer caching.
COPY package*.json ./

# ---- Dependencies Stage ----
FROM base AS dependencies
# Install all dependencies, including dev dependencies for building
RUN npm install

# Install web app dependencies
COPY web/package*.json ./web/
RUN cd web && npm install

# ---- Build Stage ----
FROM dependencies AS build
# Copy the rest of the application source code
COPY . .
# Build the application (TypeScript to JavaScript)
RUN npm run build

# ---- Production Stage ----
FROM base AS production

# Copy only the necessary production dependencies
COPY --from=dependencies /usr/src/app/node_modules ./node_modules
# Copy the built application code
COPY --from=build /usr/src/app/dist ./dist
# Copy the built web UI
COPY --from=build /usr/src/app/web/dist ./web/dist
# Copy package.json for runtime information
COPY package.json . 

# Create a non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /usr/src/app
USER appuser

# Expose the default ports
# 3000 for the web dashboard
# 4000 for the MCP HTTP transport
EXPOSE 3000 4000

# The command to run the application
# This starts the daemon which includes the web UI and all transports
CMD ["node", "dist/cli/cli-main.js", "start"]