#!/usr/bin/env bash
set -e

# ==============================================================================
# One-Command Cloud Deploy Script for YM to SoundCloud SaaS
# Usage: ./deploy.sh [domain.com]
# ==============================================================================

DOMAIN="${1:-}"

echo "=========================================================="
echo "  Deploying YM -> SoundCloud Transfer SaaS Service"
echo "=========================================================="

# Check Docker installation
if ! command -v docker >/dev/null 2>&1; then
    echo "Docker is not installed. Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
fi

if ! command -v docker-compose >/dev/null 2>&1 && ! docker compose version >/dev/null 2>&1; then
    echo "Installing Docker Compose plugin..."
    apt-get update && apt-get install -y docker-compose-plugin || true
fi

# Configure .env
if [ ! -f ".env" ]; then
    if [ -n "$DOMAIN" ]; then
        echo "PUBLIC_DOMAIN=$DOMAIN" > .env
    else
        echo "No domain provided. Using localhost for testing."
        echo "PUBLIC_DOMAIN=localhost" > .env
    fi
    echo "Created .env file."
fi

echo "Building and launching production containers with Docker Compose..."
if docker compose version >/dev/null 2>&1; then
    docker compose up -d --build
else
    docker-compose up -d --build
fi

echo ""
echo "=========================================================="
echo "  ✓ Deployment Complete!"
echo "=========================================================="
echo "Service is live and ready for users!"
if [ -n "$DOMAIN" ] && [ "$DOMAIN" != "localhost" ]; then
    echo "URL: https://$DOMAIN"
else
    echo "URL: http://localhost:8000"
fi
echo "=========================================================="
