# W.I.T. Terminal Project Makefile

.PHONY: all build test clean install dev docs

all: build

build:
	@echo "Building all components..."
	$(MAKE) -C firmware build
	$(MAKE) -C software/backend build
	cd software/frontend && npm run build

test:
	@echo "Running all tests..."
	$(MAKE) -C firmware test
	cd software/backend && python -m pytest
	cd software/frontend && npm test
	$(MAKE) -C tests integration

clean:
	@echo "Cleaning build artifacts..."
	$(MAKE) -C firmware clean
	rm -rf software/backend/__pycache__
	rm -rf software/frontend/build
	find . -type f -name "*.pyc" -delete

install:
	@echo "Installing dependencies..."
	pip install -r software/backend/requirements.txt
	cd software/frontend && npm install
	cd software/mobile && npm install

dev:
	@echo "Starting development environment..."
	docker-compose up -d postgres redis mqtt
	cd software/backend && python -m uvicorn main:app --reload &
	cd software/frontend && npm run dev

docs:
	@echo "Building documentation..."
	cd docs && make html

firmware-flash:
	$(MAKE) -C firmware flash

hardware-check:
	@echo "Running hardware design checks..."
	cd hardware/electrical && python tools/drc_check.py
	cd hardware/mechanical && python tools/interference_check.py
