#!/bin/bash

# WOLF FD Dashboard Docker Deployment Script

set -e

ensure_env_file() {
    if [ ! -f .env ]; then
        if [ -f .env.example ]; then
            cp .env.example .env
            echo "⚙️  Created .env from .env.example"
            return
        fi
    fi
}

echo "🚀 Starting WOLF FD Dashboard deployment..."

# Ensure build-time vars are present for frontend image
ensure_env_file

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check compose availability
if ! command -v docker-compose > /dev/null 2>&1; then
    # docker compose is preferred in modern Docker installs
    if ! command -v docker > /dev/null 2>&1; then
        echo "❌ docker is not installed. Please install Docker Desktop first."
        exit 1
    fi
fi

if command -v docker-compose > /dev/null 2>&1; then
    COMPOSE_CMD="docker-compose"
else
    COMPOSE_CMD="docker compose"
fi

echo "✅ Docker is available via $COMPOSE_CMD"

echo "📦 Building Docker images..."
if [ "$1" = "rebuild" ]; then
    $COMPOSE_CMD build --no-cache
else
    $COMPOSE_CMD build
fi

echo "🔧 Starting services..."
$COMPOSE_CMD up -d

echo "⏳ Waiting for services to be ready..."
sleep 10

echo "📊 Checking service health..."
$COMPOSE_CMD ps

echo "📋 Health checks:"
$COMPOSE_CMD exec backend wget --no-verbose --tries=1 --spider http://localhost:5057/health || echo "⚠️  Backend health check failed"
$COMPOSE_CMD exec postgres pg_isready -U ${PGUSER:-salesapp} -d ${PGDATABASE:-salesdb} || echo "⚠️  Database health check failed"

echo ""
echo "✅ Deployment completed!"
echo ""
echo "🌐 Access your dashboard:"
echo "  Frontend: http://localhost:8080"
echo "  Backend API: http://localhost:5057"
echo "  Database: localhost:5433"
echo ""
echo "📋 Useful commands:"
echo "  View logs: $COMPOSE_CMD logs -f"
echo "  Stop services: $COMPOSE_CMD down"
echo "  Rebuild: ./deploy.sh rebuild"
echo "  Status: $COMPOSE_CMD ps"
echo ""
echo "🔧 Import data when ready:"
echo "  $COMPOSE_CMD exec backend npm run import-data"
echo ""
echo "🔒 Security notes:"
echo "  - Change default passwords in .env"
echo "  - Use environment variables for sensitive data"
echo "  - Use HTTPS in production"
