.PHONY: run build clean test deps

# Run development server
run:
	@echo "🚀 Starting server..."
	@go run main.go

# Build binary
build:
	@echo "🔨 Building..."
	@go build -o bin/backend-go main.go
	@echo "✅ Build complete: bin/backend-go"

# Clean build artifacts
clean:
	@echo "🧹 Cleaning..."
	@rm -rf bin/
	@echo "✅ Clean complete"

# Run tests
test:
	@echo "🧪 Running tests..."
	@go test -v ./...

# Install / tidy module dependencies
deps:
	@echo "📦 Installing dependencies..."
	@go mod tidy
	@go mod download
	@echo "✅ Dependencies installed"

# Format code
fmt:
	@echo "✨ Formatting code..."
	@go fmt ./...
	@echo "✅ Format complete"

# Run linter
lint:
	@echo "🔍 Running linter..."
	@golangci-lint run
	@echo "✅ Lint complete"

# Docker: build image
docker-build:
	@echo "🐳 Building Docker image..."
	@docker build -t demo-app:latest .
	@echo "✅ Docker image built"

# Docker: run container
docker-run:
	@echo "🐳 Running Docker container..."
	@docker run -p 8080:8080 \
		-e DATABASE_DSN="host=host.docker.internal port=5432 user=postgres password=password dbname=demo_db sslmode=disable" \
		-e REDIS_ADDR="host.docker.internal:6379" \
		demo-app:latest

# Show help
help:
	@echo "Available commands:"
	@echo "  make run          - Run development server"
	@echo "  make build        - Build binary"
	@echo "  make clean        - Clean build files"
	@echo "  make test         - Run tests"
	@echo "  make deps         - Install dependencies"
	@echo "  make fmt          - Format code"
	@echo "  make lint         - Run linter"
	@echo "  make docker-build - Build Docker image"
	@echo "  make docker-run   - Run Docker container"

