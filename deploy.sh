#!/bin/bash

# WOLF FD Dashboard Docker Deployment Script

set -e

echo "🚀 Starting WOLF FD Dashboard deployment..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose > /dev/null 2&1; then
    echo "❌ docker-compose is not installed. Please install it first."
    exit 1
fi

echo "✅ Docker and docker-compose are available"

# Build and start services
if [ "$1" = "rebuild" ]; then
    echo "📦 Rebuilding Docker images..."
    docker-compose build --no-cache
else
    echo "📦 Building Docker images..."
    docker-compose build
fi

echo "🔧 Starting services..."
docker-compose up -d

echo "⏳ Waiting for services to be ready..."
sleep 10

# Check service health
echo "📊 Checking service health..."
docker-compose ps

echo "📋 Health checks:"
docker-compose exec backend wget --no-verbose --tries=1 --spider http://localhost:5057/health || echo "⚠️  Backend health check failed"
docker-compose exec postgres pg_isready -U salesapp -d salesdb || echo "⚠️  Database health check failed"

echo ""
echo "✅ Deployment completed!"
echo ""
echo "🌐 Access your dashboard:"
echo "  Frontend: http://localhost:8080"
echo "  Backend API: http://localhost:5057"
echo "  Database: localhost:5432"
echo ""
echo "📋 Useful commands:"
echo "  View logs: docker-compose logs -f"
echo "  Stop services: docker-compose down"
echo "  Rebuild: ./deploy.sh rebuild"
echo "  Status: docker-compose ps"
echo ""
echo "🔧 Import data when ready:"
echo "  docker-compose exec backend npm run import-data"
echo ""
echo "🔒 Security notes:"
echo "  - Change default passwords in production"
echo "  - Use environment variables for sensitive data"
echo "  - Consider adding SSL/HTTPS in production"
echo ""