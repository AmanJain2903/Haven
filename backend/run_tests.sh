#!/bin/bash
# Quick test runner script for Haven backend

echo "🧪 Running Haven Backend Tests"
echo "================================"

# Navigate to backend directory
cd "$(dirname "$0")"

# Check if pytest is installed
if ! command -v pytest &> /dev/null; then
    echo "❌ pytest not found. Installing test dependencies..."
    pip install pytest pytest-cov httpx
fi

# Run tests based on argument
case "$1" in
    "all")
        echo "Running all tests..."
        pytest -v
        ;;
    "coverage")
        echo "Running tests with coverage report..."
        pytest --cov=app --cov-report=html --cov-report=term-missing
        echo "✅ Coverage report generated in htmlcov/index.html"
        ;;
    "health")
        echo "Running health endpoint tests..."
        pytest tests/test_health.py -v
        ;;
    "images")
        echo "Running image endpoint tests..."
        pytest tests/test_images.py -v
        ;;
    "intelligence")
        echo "Running intelligence endpoint tests..."
        pytest tests/test_intelligence.py -v
        ;;
    "models")
        echo "Running model tests..."
        pytest tests/test_models.py -v
        ;;
    "scanner")
        echo "Running scanner tests..."
        pytest tests/test_scanner.py -v
        ;;
    "ml")
        echo "Running ML client tests..."
        pytest tests/test_ml_client.py -v
        ;;
    "fast")
        echo "Running tests (fast mode, no coverage)..."
        pytest -x --tb=short
        ;;
    *)
        echo "Usage: ./run_tests.sh [option]"
        echo ""
        echo "Options:"
        echo "  all          - Run all tests"
        echo "  coverage     - Run tests with coverage report"
        echo "  health       - Run health endpoint tests"
        echo "  images       - Run image endpoint tests"
        echo "  intelligence - Run AI search tests"
        echo "  models       - Run database model tests"
        echo "  scanner      - Run scanner service tests"
        echo "  ml           - Run ML client tests"
        echo "  fast         - Run tests quickly (fail fast)"
        echo ""
        echo "Example: ./run_tests.sh coverage"
        ;;
esac
