# ═══════════════════════════════════════════════════════════════════════
# Match-Mind — ergonomic Docker entry points
# ═══════════════════════════════════════════════════════════════════════

DOCKER_COMPOSE := docker compose

.PHONY: help up down logs ps build shell test config clean reset

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

up: ## Start the stack (postgres + redis + app)
	$(DOCKER_COMPOSE) up -d

down: ## Stop the stack
	$(DOCKER_COMPOSE) down

logs: ## Tail logs from all services
	$(DOCKER_COMPOSE) logs -f --tail=100

ps: ## Show running services
	$(DOCKER_COMPOSE) ps

build: ## Build images
	$(DOCKER_COMPOSE) build

shell: ## Open a shell in the app container
	$(DOCKER_COMPOSE) exec app /bin/sh

test: ## Run the ephemeral test compose
	$(DOCKER_COMPOSE) -f docker-compose.yml -f docker-compose.test.yml up --build --abort-on-container-exit

config: ## Validate compose files
	$(DOCKER_COMPOSE) config

clean: ## Stop and remove containers + volumes (data loss!)
	$(DOCKER_COMPOSE) down -v --remove-orphans

reset: clean ## Full rebuild from scratch
	$(DOCKER_COMPOSE) build --no-cache
	$(DOCKER_COMPOSE) up -d
