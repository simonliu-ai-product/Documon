# Makefile for the Next.js project

# Variables
NODE_MODULES = node_modules
SHELL = /bin/bash

# Phony targets
.PHONY: all install dev genkit-dev genkit-watch build start lint typecheck clean docker-build docker-run docker-run-d docker-stop docker-rm docker-logs docker-shell docker-clean

# Default target
all: install lint typecheck build

# Install dependencies
install: $(NODE_MODULES)

$(NODE_MODULES): package.json
	npm install
	touch $(NODE_MODULES)

# Development
dev:
	npm run dev

genkit-dev:
	npm run genkit:dev

genkit-watch:
	npm run genkit:watch

# Build and Start
build:
	npm run build

start:
	npm run start

# Code quality
lint:
	npm run lint

typecheck:
	npm run typecheck

# Clean
clean:
	rm -rf .next

# Docker
DOCKER_IMAGE_NAME = documon
DOCKER_CONTAINER_NAME = documon-container

docker-build:
	docker build -t $(DOCKER_IMAGE_NAME) .

docker-run:
	docker run -p 3000:3000 --name $(DOCKER_CONTAINER_NAME) $(DOCKER_IMAGE_NAME)

docker-run-d:
	docker run -d -p 3000:3000 --name $(DOCKER_CONTAINER_NAME) $(DOCKER_IMAGE_NAME)

docker-stop:
	docker stop $(DOCKER_CONTAINER_NAME)

docker-rm:
	docker rm $(DOCKER_CONTAINER_NAME)

docker-logs:
	docker logs -f $(DOCKER_CONTAINER_NAME)

docker-shell:
	docker exec -it $(DOCKER_CONTAINER_NAME) /bin/bash

docker-clean: docker-stop docker-rm

# Docker Compose
compose-up:
	docker-compose up

compose-up-d:
	docker-compose up -d --build

compose-down:
	docker-compose down