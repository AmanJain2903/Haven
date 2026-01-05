# Haven Backend Test Suite

Comprehensive pytest test suite for the Haven API backend.

## ✅ Test Results

- **47 tests passing** ✨
- **7 tests skipped** (require PostgreSQL with pgvector for vector search operations)
- **Fast execution**: ~0.3 seconds for full test suite

## 📁 Test Structure

```
tests/
├── __init__.py                 # Tests package marker
├── conftest.py                 # Shared fixtures and configuration
├── test_health.py              # Health check endpoint tests
├── test_images.py              # Image management endpoint tests
├── test_intelligence.py        # AI semantic search endpoint tests
├── test_models.py              # Database model tests
├── test_scanner.py             # Directory scanner service tests
└── test_ml_client.py           # ML/AI client tests
```

## 🧪 Test Coverage

### Endpoints Tested
- ✅ `GET /api/v1/health/` - Welcome message
- ✅ `GET /api/v1/health/status` - Database health check
- ✅ `POST /api/v1/images/scan` - Directory scanning
- ✅ `POST /api/v1/images/process` - AI embedding generation
- ✅ `POST /api/v1/intelligence/search` - Semantic search

### Components Tested
- ✅ Image model (CRUD operations, constraints)
- ✅ Scanner service (EXIF extraction, GPS parsing, duplicate detection)
- ✅ CLIP client (embedding generation for images and text)
- ✅ Database operations (sessions, transactions, queries)

## 🚀 Running Tests

### Run All Tests
```bash
cd backend
pytest
```

### Run Specific Test File
```bash
pytest tests/test_health.py
pytest tests/test_images.py
pytest tests/test_intelligence.py
```

### Run Specific Test Class
```bash
pytest tests/test_images.py::TestImageScanEndpoint
```

### Run Specific Test Function
```bash
pytest tests/test_images.py::TestImageScanEndpoint::test_scan_success
```

### Run with Coverage Report
```bash
pytest --cov=app --cov-report=html
```

Then open `htmlcov/index.html` in your browser.

### Run Verbose Mode
```bash
pytest -v
```

### Run with Output Capture Disabled (see print statements)
```bash
pytest -s
```

## 🔧 Test Configuration

Configuration is managed in `pytest.ini`:
- Test discovery patterns
- Default options (verbose, show locals, etc.)
- Test markers for categorization
- Coverage settings

## 🎯 Key Fixtures

### `db_session`
Provides a fresh in-memory SQLite database for each test.
- Automatically creates all tables
- Tears down after test completes
- Ensures test isolation
- **Note**: Uses PickleType for embeddings instead of Vector (SQLite limitation)

### `client`
FastAPI TestClient with database dependency overridden.
- Makes HTTP requests to test endpoints
- Uses the test database session
- Automatically cleans up after tests

### `sample_images`
Creates 3 test images in the database:
- `beach.jpg` - Unprocessed, with GPS
- `mountain.jpg` - Unprocessed, with GPS
- `city.heic` - Processed, with embedding

### `mock_embedding`
Returns a mock 512-dimensional embedding vector for testing AI features.

## ⚠️ Known Limitations

### Vector Search Tests (7 tests skipped)
The semantic search tests in `test_intelligence.py` are skipped because:
- SQLite doesn't support pgvector's `cosine_distance()` operator
- These require PostgreSQL with pgvector extension for integration testing
- Tests are marked with `@pytest.mark.skip(reason="Requires PostgreSQL...")`

**To run vector search tests**:
1. Start PostgreSQL with pgvector: `docker-compose up -d db`
2. Update test configuration to use PostgreSQL
3. Run: `pytest tests/test_intelligence.py`

## 📊 Test Categories

### Unit Tests
Test individual functions in isolation:
- `test_models.py` - Model validation and constraints
- `test_scanner.py` - GPS conversion, EXIF parsing
- `test_ml_client.py` - Embedding generation

### Integration Tests
Test API endpoints with database:
- `test_health.py` - Health check endpoints
- `test_images.py` - Image management endpoints
- `test_intelligence.py` - AI search endpoints

## 🛡️ Mocking Strategy

External dependencies are mocked to ensure:
- **Speed**: No actual file I/O or ML model loading
- **Reliability**: Tests don't depend on external resources
- **Isolation**: Each test is independent

### Mocked Components
- `PIL.Image.open` - Prevents actual image file reads
- `os.walk` - Simulates directory structure
- `model.encode` - Skips actual ML inference
- `scan_directory` - Avoids filesystem operations

## ✅ Best Practices

1. **Test Isolation**: Each test gets a fresh database
2. **Descriptive Names**: Test names clearly describe what they verify
3. **AAA Pattern**: Arrange, Act, Assert structure
4. **Edge Cases**: Test both success and failure scenarios
5. **Mock External Calls**: Don't depend on filesystem or ML models

## 🔍 Example Test

```python
@patch('app.api.v1.endpoints.images.scan_directory')
def test_scan_success(self, mock_scan, client):
    """Test successful directory scan"""
    # Arrange
    mock_scan.return_value = 5
    
    # Act
    response = client.post(
        "/api/v1/images/scan",
        params={"path": "/test/photos"}
    )
    
    # Assert
    assert response.status_code == 200
    assert response.json()["images_added"] == 5
    mock_scan.assert_called_once()
```

## 📈 Adding New Tests

When adding new endpoints or features:

1. Create test file: `test_<feature>.py`
2. Import necessary fixtures from `conftest.py`
3. Create test class: `class Test<Feature>:`
4. Write test methods: `def test_<scenario>:`
5. Use mocks for external dependencies
6. Verify both success and error cases

## 🐛 Debugging Failed Tests

```bash
# Run with verbose output and show local variables
pytest -vv --showlocals

# Run single failing test
pytest tests/test_images.py::test_scan_error -vv

# Drop into debugger on failure
pytest --pdb
```

## 📝 Test Maintenance

- Keep tests updated when API changes
- Remove obsolete tests for deprecated features
- Maintain high test coverage (aim for >80%)
- Run tests before committing code
- Add tests for bug fixes to prevent regression
