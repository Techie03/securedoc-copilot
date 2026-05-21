#!/bin/bash
set -e

echo "=========================================="
echo "Deploying SecureDoc Copilot"
echo "=========================================="

# Check for .env file
if [ ! -f .env ]; then
  echo "Error: .env file is missing."
  echo "Please copy .env.example to .env and configure the variables."
  exit 1
fi

# Make sure Docker is available
if ! command -v docker-compose &> /dev/null; then
    echo "docker-compose could not be found. Please install Docker Compose."
    exit 1
fi

echo "Building and starting containers..."
# Run docker-compose with production overrides
docker-compose -f docker-compose.prod.yml up -d --build

echo "=========================================="
echo "Deployment started successfully!"
echo "SecureDoc Copilot will be available at http://localhost"
echo "API backend will be available at http://localhost/api"
echo "=========================================="
