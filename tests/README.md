# W.I.T. Test Suite

Comprehensive testing for all W.I.T. components.

## Test Categories
- **Unit Tests**: Individual component testing
- **Integration Tests**: Inter-component communication
- **System Tests**: End-to-end functionality
- **Performance Tests**: Latency, throughput, resource usage

## Running Tests
```bash
# Run all tests
make test

# Run specific test suite
pytest tests/unit/
pytest tests/integration/

# Run with coverage
pytest --cov=software/backend tests/
```

## Test Requirements
- Voice latency: <100ms end-to-end
- Vision processing: 30fps minimum
- API response time: <50ms p95
- Equipment control latency: <10ms
