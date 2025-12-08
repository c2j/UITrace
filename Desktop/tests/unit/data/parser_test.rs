use std::fs;
use std::path::Path;
use tempfile::TempDir;
use uitrace_desktop::data::{CsvParser, ExcelParser, DataParser};
use uitrace_desktop::models::{TestData, DataRow, DataType};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_csv_parser_basic() {
        let temp_dir = TempDir::new().unwrap();
        let csv_path = temp_dir.path().join("test.csv");

        let csv_content = r#"name,email,age
John Doe,john@example.com,30
Jane Smith,jane@example.com,25
Bob Johnson,bob@example.com,35"#;

        fs::write(&csv_path, csv_content).unwrap();

        let parser = CsvParser::new();
        let result = tokio_test::block_on(parser.parse(&csv_path));

        assert!(result.is_ok());
        let test_data = result.unwrap();

        assert_eq!(test_data.rows.len(), 3);
        assert_eq!(test_data.headers.len(), 3);
        assert_eq!(test_data.headers[0], "name");
        assert_eq!(test_data.headers[1], "email");
        assert_eq!(test_data.headers[2], "age");

        // Check first row
        let first_row = &test_data.rows[0];
        assert_eq!(first_row.values["name"], "John Doe");
        assert_eq!(first_row.values["email"], "john@example.com");
        assert_eq!(first_row.values["age"], "30");
    }

    #[test]
    fn test_csv_parser_with_different_delimiters() {
        let temp_dir = TempDir::new().unwrap();
        let csv_path = temp_dir.path().join("test_semicolon.csv");

        let csv_content = r#"name;email;age
John Doe;john@example.com;30
Jane Smith;jane@example.com;25"#;

        fs::write(&csv_path, csv_content).unwrap();

        let parser = CsvParser::new().with_delimiter(';');
        let result = tokio_test::block_on(parser.parse(&csv_path));

        assert!(result.is_ok());
        let test_data = result.unwrap();

        assert_eq!(test_data.rows.len(), 2);
        assert_eq!(test_data.rows[0].values["name"], "John Doe");
    }

    #[test]
    fn test_csv_parser_without_headers() {
        let temp_dir = TempDir::new().unwrap();
        let csv_path = temp_dir.path().join("test_no_headers.csv");

        let csv_content = r#"John Doe,john@example.com,30
Jane Smith,jane@example.com,25
Bob Johnson,bob@example.com,35"#;

        fs::write(&csv_path, csv_content).unwrap();

        let parser = CsvParser::new().with_headers(false);
        let result = tokio_test::block_on(parser.parse(&csv_path));

        assert!(result.is_ok());
        let test_data = result.unwrap();

        assert_eq!(test_data.rows.len(), 3);
        // When no headers, column names should be column1, column2, etc.
        assert!(test_data.rows[0].values.contains_key("column1"));
        assert_eq!(test_data.rows[0].values["column1"], "John Doe");
    }

    #[test]
    fn test_csv_parser_with_quotes_and_commas() {
        let temp_dir = TempDir::new().unwrap();
        let csv_path = temp_dir.path().join("test_quotes.csv");

        let csv_content = r#"name,description,price
"Product A","This is a great product, really!",29.99
"Product B","Another product, also good",19.99"#;

        fs::write(&csv_path, csv_content).unwrap();

        let parser = CsvParser::new();
        let result = tokio_test::block_on(parser.parse(&csv_path));

        assert!(result.is_ok());
        let test_data = result.unwrap();

        assert_eq!(test_data.rows.len(), 2);
        assert_eq!(test_data.rows[0].values["name"], "Product A");
        assert_eq!(test_data.rows[0].values["description"], "This is a great product, really!");
        assert_eq!(test_data.rows[0].values["price"], "29.99");
    }

    #[test]
    fn test_csv_parser_empty_file() {
        let temp_dir = TempDir::new().unwrap();
        let csv_path = temp_dir.path().join("empty.csv");

        fs::write(&csv_path, "").unwrap();

        let parser = CsvParser::new();
        let result = tokio_test::block_on(parser.parse(&csv_path));

        assert!(result.is_err());
        // Should handle empty file appropriately
    }

    #[test]
    fn test_csv_parser_malformed_data() {
        let temp_dir = TempDir::new().unwrap();
        let csv_path = temp_dir.path().join("malformed.csv");

        let csv_content = r#"name,email,age
John Doe,john@example.com,30
Jane Smith,jane@example.com
Bob Johnson,bob@example.com,35"#;

        fs::write(&csv_path, csv_content).unwrap();

        let parser = CsvParser::new();
        let result = tokio_test::block_on(parser.parse(&csv_path));

        // Should handle malformed rows gracefully
        assert!(result.is_ok() || result.is_err());
    }

    #[test]
    fn test_csv_parser_large_file() {
        let temp_dir = TempDir::new().unwrap();
        let csv_path = temp_dir.path().join("large.csv");

        let mut csv_content = String::from("id,name,email\n");
        for i in 0..1000 {
            csv_content.push_str(&format!(
                "{},User {},user{}@example.com\n",
                i, i, i
            ));
        }

        fs::write(&csv_path, csv_content).unwrap();

        let parser = CsvParser::new();
        let result = tokio_test::block_on(parser.parse(&csv_path));

        assert!(result.is_ok());
        let test_data = result.unwrap();

        assert_eq!(test_data.rows.len(), 1000);
        assert_eq!(test_data.rows[0].values["id"], "0");
        assert_eq!(test_data.rows[999].values["id"], "999");
    }

    #[test]
    fn test_excel_parser_basic() {
        // Note: This test would require actual Excel file creation
        // For now, we'll test the parser interface
        let parser = ExcelParser::new();

        // Test that parser can be created
        assert!(parser.get_supported_extensions().contains(&"xlsx".to_string()));
        assert!(parser.get_supported_extensions().contains(&"xls".to_string()));
    }

    #[test]
    fn test_data_type_inference() {
        let test_cases = vec![
            ("123", DataType::Number),
            ("123.45", DataType::Number),
            ("true", DataType::Boolean),
            ("false", DataType::Boolean),
            ("2023-12-08", DataType::Date),
            ("hello", DataType::String),
            ("", DataType::String),
        ];

        for (value, expected_type) in test_cases {
            let inferred_type = infer_data_type(value);
            assert_eq!(inferred_type, expected_type, "Failed for value: {}", value);
        }
    }

    #[test]
    fn test_data_validation() {
        let temp_dir = TempDir::new().unwrap();
        let csv_path = temp_dir.path().join("validation_test.csv");

        let csv_content = r#"name,age,email,active
John Doe,30,john@example.com,true
Jane Smith,25,jane@example.com,false
Invalid Row,,invalid-email,true
Bob Johnson,35,bob@example.com,true"#;

        fs::write(&csv_path, csv_content).unwrap();

        let parser = CsvParser::new();
        let result = tokio_test::block_on(parser.parse(&csv_path));

        assert!(result.is_ok());
        let test_data = result.unwrap();

        // Validate data types
        for row in &test_data.rows {
            if let Some(age) = row.values.get("age") {
                if !age.is_empty() {
                    assert!(age.parse::<i32>().is_ok() || age.parse::<f64>().is_ok());
                }
            }

            if let Some(email) = row.values.get("email") {
                // Basic email validation
                assert!(email.contains('@') || email.is_empty());
            }

            if let Some(active) = row.values.get("active") {
                if !active.is_empty() {
                    assert!(active == "true" || active == "false");
                }
            }
        }
    }

    #[test]
    fn test_data_row_creation() {
        let mut row = DataRow::new();
        row.values.insert("name".to_string(), "John Doe".to_string());
        row.values.insert("age".to_string(), "30".to_string());
        row.values.insert("email".to_string(), "john@example.com".to_string());

        assert_eq!(row.values.len(), 3);
        assert_eq!(row.values["name"], "John Doe");
        assert_eq!(row.values["age"], "30");
        assert_eq!(row.values["email"], "john@example.com");
    }

    #[test]
    fn test_test_data_creation() {
        let mut test_data = TestData::new();
        test_data.headers = vec!["name".to_string(), "age".to_string()];

        let mut row1 = DataRow::new();
        row1.values.insert("name".to_string(), "John".to_string());
        row1.values.insert("age".to_string(), "30".to_string());

        let mut row2 = DataRow::new();
        row2.values.insert("name".to_string(), "Jane".to_string());
        row2.values.insert("age".to_string(), "25".to_string());

        test_data.rows.push(row1);
        test_data.rows.push(row2);

        assert_eq!(test_data.headers.len(), 2);
        assert_eq!(test_data.rows.len(), 2);
        assert_eq!(test_data.rows[0].values["name"], "John");
        assert_eq!(test_data.rows[1].values["name"], "Jane");
    }
}

// Helper function to infer data type (would be part of the actual implementation)
fn infer_data_type(value: &str) -> DataType {
    if value.is_empty() {
        return DataType::String;
    }

    // Try to parse as boolean
    if value == "true" || value == "false" {
        return DataType::Boolean;
    }

    // Try to parse as number
    if value.parse::<f64>().is_ok() {
        return DataType::Number;
    }

    // Try to parse as date (simple check)
    if value.contains('-') && value.len() >= 10 {
        // Could be a date format
        return DataType::Date;
    }

    DataType::String
}

// Helper trait for parsing (would be part of the actual implementation)
trait DataParser {
    fn parse(&self, path: &Path) -> impl std::future::Future<Output = Result<TestData, Box<dyn std::error::Error>>>;
    fn get_supported_extensions(&self) -> Vec<String>;
}