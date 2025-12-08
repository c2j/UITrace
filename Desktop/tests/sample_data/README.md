# Sample Data Files for Data-Driven Testing

This directory contains sample CSV files for testing the data-driven testing functionality in UITrace.

## Files

### 1. `login_test_data.csv`
**Purpose**: Test login functionality with different user credentials
**Columns**: username, password, email, expected_message, login_button_text
**Test Cases**: 5 different user scenarios

### 2. `ecommerce_test_data.csv`
**Purpose**: Test e-commerce functionality with different products and shipping methods
**Columns**: product_name, product_id, price, quantity, expected_total, shipping_method
**Test Cases**: 5 different product purchase scenarios

### 3. `form_validation_data.csv`
**Purpose**: Test form validation with different input types and validation rules
**Columns**: field_name, field_value, field_type, expected_validation, error_message
**Test Cases**: 10 different validation scenarios (valid/invalid pairs)

## Usage

These sample files are used by the integration tests in `tests/integration/sample_data_test.rs` to verify:

1. **CSV Parsing**: All files can be parsed correctly with proper headers and data types
2. **Variable Substitution**: Variables in test scripts are substituted correctly with data from CSV rows
3. **Data Validation**: Data types and constraints are validated properly
4. **Performance**: Large datasets can be processed efficiently
5. **Edge Cases**: Special characters, Unicode, and various data formats are handled correctly

## Adding New Sample Data

When adding new sample CSV files:

1. Follow the naming convention: `{scenario}_test_data.csv`
2. Include a descriptive header row
3. Ensure data types are consistent within each column
4. Add corresponding tests in `sample_data_test.rs`
5. Update this README with the new file description

## Data Format Guidelines

- **Headers**: Use lowercase with underscores (snake_case)
- **Text Data**: Use quotes if containing commas or special characters
- **Numeric Data**: Ensure consistent decimal formatting
- **Email Addresses**: Use valid email format for testing
- **URLs**: Use valid URL format for testing
- **Dates**: Use ISO format (YYYY-MM-DD) for consistency

## Test Coverage

These sample files provide comprehensive test coverage for:
- Basic data-driven execution
- Variable substitution in multiple contexts
- Data validation and type checking
- Performance testing with realistic data volumes
- Edge case handling (special characters, Unicode, etc.)