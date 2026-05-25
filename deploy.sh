#!/bin/bash

# WOLF FD Dashboard Docker Deployment Script

set -euo pipefail

ensure_env_file() {
    if [ ! -f .env ]; then
        if [ -f .env.example ]; then
            cp .env.example .env
            echo "⚙️  Created .env from .env.example"
            return
        fi
        echo "❌ No .env file found. Create .env or copy from .env.example first."
        exit 1
    fi
}

check_dependencies() {
    # Check if Docker is running
    if ! docker info > /dev/null 2>&1; then
        echo "❌ Docker is not running. Please start Docker first."
        exit 1
    fi

    # Check compose availability
    if command -v docker > /dev/null 2>&1; then
        if docker compose version > /dev/null 2>&1; then
            COMPOSE_CMD="docker compose"
            return
        fi
    fi

    if command -v docker-compose > /dev/null 2>&1; then
        COMPOSE_CMD="docker-compose"
        return
    fi

    echo "❌ Neither docker compose nor docker-compose is available."
    exit 1
}

compose_up() {
    if $COMPOSE_CMD up --help | grep -q -- "--wait"; then
        $COMPOSE_CMD up -d --wait
    else
        $COMPOSE_CMD up -d
        echo "⚠️  This compose version does not support --wait; waiting 10s and checking services manually."
        sleep 10
    fi
}

run_checks() {
    echo "📊 Checking service health..."
    $COMPOSE_CMD ps

    echo "📋 Health checks:"
    $COMPOSE_CMD exec backend curl -fsS http://127.0.0.1:5057/health || echo "⚠️  Backend health check failed"
    $COMPOSE_CMD exec postgres pg_isready -U ${PGUSER:-salesapp} -d ${PGDATABASE:-salesdb} || echo "⚠️  Database health check failed"
}

ensure_env_file

# preload .env for compose-time variable expansion
set -a
. ./.env
set +a

echo "🚀 Starting WOLF FD Dashboard deployment..."
check_dependencies

mkdir -p \
    pos-dashboard-backend/incoming \
    pos-dashboard-backend/processed \
    pos-dashboard-backend/manufacturer-pricebooks/holding \
    pos-dashboard-backend/board-uploads \
    pos-dashboard-backend/social-uploads

echo "✅ Docker is available via $COMPOSE_CMD"

echo "📦 Building Docker images..."
if [ "${1:-}" = "rebuild" ]; then
    $COMPOSE_CMD build --no-cache
else
    $COMPOSE_CMD build
fi

echo "🔧 Starting services..."
compose_up

run_checks

echo ""
echo "✅ Deployment completed!"
echo ""
echo "🌐 Access your dashboard:"
echo "  Frontend: http://localhost:8080"
echo "  Backend API: http://localhost:5057"
echo "  Database: localhost:${PGHOST_PORT:-5433}"
echo ""
echo "📋 Useful commands:"
echo "  View logs: $COMPOSE_CMD logs -f"
echo "  Stop services: $COMPOSE_CMD down"
echo "  Rebuild: ./deploy.sh rebuild"
echo "  Status: $COMPOSE_CMD ps"
echo ""
echo "🔧 Data import:"
echo "  Drop incoming files into pos-dashboard-backend/incoming and watch logs for auto-import."
echo "  To import manually, use the backend API path configured in your deployment docs."
echo ""
echo "🔒 Security notes:"
echo "  - Never commit .env secrets"
echo "  - Use environment variables for sensitive data"
echo "  - Use HTTPS in production"