.PHONY: install install-backend install-frontend dev-backend dev-frontend test test-backend test-frontend build e2e docker-up docker-down migrate seed

install: install-backend install-frontend

install-backend:
	python -m pip install -r backend/requirements.txt

install-frontend:
	cd frontend && npm install

dev-backend:
	cd backend && uvicorn app.main:app --reload --port 8000

dev-frontend:
	cd frontend && npm run dev

test: test-backend test-frontend

test-backend:
	cd backend && python -m pytest -q

test-frontend:
	cd frontend && npm test

build:
	cd frontend && npm run build

e2e:
	cd frontend && npm run e2e

docker-up:
	docker compose up --build -d

docker-down:
	docker compose down

migrate:
	cd backend && alembic upgrade head

seed:
	cd backend && python -m scripts.seed_demo
