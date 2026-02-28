.PHONY: deploy

PROJECT_DIR := $$DEPLOY_PROJECT_DIR
ENV_DIR := $(PROJECT_DIR)/services/core/environments

deploy:
	ssh -o StrictHostKeyChecking=no "$$HOST_USER@$$HOST_NAME" \
	"ENV_SECRET_KEY='$$ENV_SECRET_KEY' bash -c '\
		cd $(PROJECT_DIR) && \
		git pull origin $$BRANCH_NAME && \
		cd $(ENV_DIR) && chmod +x ./decrypt.sh && \
		./decrypt.sh $$MODE && \
		cd $(PROJECT_DIR) && \
		docker compose -f $$DOCKER_COMPOSE_FILE down --remove-orphans && \
		docker container prune -f && \
		docker image prune -af && \
		docker network prune -f && \
		docker builder prune -f --all --filter \"until=24h\" && \
		docker compose -f $$DOCKER_COMPOSE_FILE build && \
		docker compose -f $$DOCKER_COMPOSE_FILE up -d --build \
	'"