use crate::models::{TestData, DataRow};
use std::path::Path;
use std::fs;
use csv::{ReaderBuilder, WriterBuilder};
use thiserror::Error;
use serde::{Deserialize, Serialize};
use log::{debug, warn};

#[derive(Error, Debug)]
pub enum CsvParserError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("CSV parsing error: {0}")]
    Csv(#[from] csv::Error),
    #[error("File not found: {0}")]
    FileNotFound(String),
    #[error("Invalid CSV format: {0}")]
    InvalidFormat(String),
    #[error("Empty file: {0}")]
    EmptyFile(String),
}

pub struct CsvParser {
    delimiter: u8,
    has_headers: bool,
}

impl CsvParser {
    pub fn new() -> Self {
        Self {
            delimiter: b',',
            has_headers: true,
        }
    }

    pub fn with_delimiter(mut self, delimiter: char) -> Self {
        self.delimiter = delimiter as u8;
        self
    }

    pub fn with_headers(mut self, has_headers: bool) -> Self {
        self.has_headers = has_headers;
        self
    }

    /// Parse CSV file into TestData
    pub async fn parse(&self, path: &Path) -> Result<TestData, CsvParserError> {
        if !path.exists() {
            return Err(CsvParserError::FileNotFound(
                path.to_string_lossy().to_string()
            ));
        }

        let content = fs::read_to_string(path)?;
        if content.trim().is_empty() {
            return Err(CsvParserError::EmptyFile(
                path.to_string_lossy().to_string()
            ));
        }

        let mut rdr = ReaderBuilder::new()
            .delimiter(self.delimiter)
            .has_headers(self.has_headers)
            .from_reader(content.as_bytes());

        let mut test_data = TestData::new();
        test_data.source = path.to_string_lossy().to_string();
        test_data.file_type = "csv".to_string();

        // Read headers if present
        let headers: Vec<String> = if self.has_headers {
            rdr.headers()?.iter().map(|h| h.to_string()).collect()
        } else {
            // If no headers, peek at first row to determine column count
            let first_row = rdr.records().next();
            match first_row {
                Some(Ok(record)) => (0..record.len())
                    .map(|i| format!("Column{}", i + 1))
                    .collect(),
                _ => return Err(CsvParserError::InvalidFormat(
                    "Cannot determine column structure".to_string()
                )),
            }
        };

        test_data.headers = headers.clone();
        debug!("CSV Headers: {:?}", headers);

        // Reset reader to read all records
        let content = fs::read_to_string(path)?;
        let mut rdr = ReaderBuilder::new()
            .delimiter(self.delimiter)
            .has_headers(self.has_headers)
            .from_reader(content.as_bytes());

        // Read all records
        let mut row_count = 0;
        for result in rdr.records() {
            let record = result?;
            let mut data_row = DataRow::new();

            for (index, value) in record.iter().enumerate() {
                if index < headers.len() {
                    let key = headers[index].clone();
                    data_row.data.insert(key, value.to_string());
                }
            }

            test_data.add_row(data_row);
            row_count += 1;
        }

        test_data.row_count = row_count;
        debug!("Parsed {} rows from CSV file", row_count);

        Ok(test_data)
    }

    /// Save TestData to CSV file
    pub async fn save(&self, data: &TestData, output_path: &Path) -> Result<(), CsvParserError> {
        let file = fs::File::create(output_path)?;
        let mut wtr = WriterBuilder::new()
            .delimiter(self.delimiter)
            .has_headers(true)
            .from_writer(file);

        // Write headers if available
        if !data.headers.is_empty() {
            wtr.write_record(&data.headers)?;
        } else if !data.rows.is_empty() {
            // Extract headers from first row
            let headers: Vec<String> = data.rows[0].data.keys().cloned().collect();
            wtr.write_record(&headers)?;
        }

        // Write data rows
        for row in &data.rows {
            if !data.headers.is_empty() {
                let values: Vec<String> = data.headers.iter()
                    .map(|h| row.data.get(h).unwrap_or(&"".to_string()).clone())
                    .collect();
                wtr.write_record(&values)?;
            } else {
                // Write values in key order
                let mut values: Vec<_> = row.data.values().cloned().collect();
                wtr.write_record(&values)?;
            }
        }

        wtr.flush()?;
        debug!("Saved {} rows to CSV file: {}", data.row_count, output_path.display());
        Ok(())
    }

    /// Parse CSV from string content
    pub fn parse_from_string(&self, content: &str) -> Result<TestData, CsvParserError> {
        if content.trim().is_empty() {
            return Err(CsvParserError::EmptyFile("Empty content".to_string()));
        }

        let mut rdr = ReaderBuilder::new()
            .delimiter(self.delimiter)
            .has_headers(self.has_headers)
            .from_reader(content.as_bytes());

        let mut test_data = TestData::new();
        test_data.source = "string".to_string();
        test_data.file_type = "csv".to_string();

        // Read headers if present
        let headers: Vec<String> = if self.has_headers {
            rdr.headers()?.iter().map(|h| h.to_string()).collect()
        } else {
            // If no headers, peek at first row
            let first_row = rdr.records().next();
            match first_row {
                Some(Ok(record)) => (0..record.len())
                    .map(|i| format!("Column{}", i + 1))
                    .collect(),
                _ => return Err(CsvParserError::InvalidFormat(
                    "Cannot determine column structure".to_string()
                )),
            }
        };

        test_data.headers = headers.clone();

        // Reset and read all records
        let mut rdr = ReaderBuilder::new()
            .delimiter(self.delimiter)
            .has_headers(self.has_headers)
            .from_reader(content.as_bytes());

        let mut row_count = 0;
        for result in rdr.records() {
            let record = result?;
            let mut data_row = DataRow::new();

            for (index, value) in record.iter().enumerate() {
                if index < headers.len() {
                    let key = headers[index].clone();
                    data_row.data.insert(key, value.to_string());
                }
            }

            test_data.add_row(data_row);
            row_count += 1;
        }

        test_data.row_count = row_count;
        Ok(test_data)
    }

    /// Convert TestData to CSV string
    pub fn to_string(&self, data: &TestData) -> Result<String, CsvParserError> {
        let mut wtr = WriterBuilder::new()
            .delimiter(self.delimiter)
            .has_headers(true)
            .from_writer(vec![]);

        // Write headers if available
        if !data.headers.is_empty() {
            wtr.write_record(&data.headers)?;
        } else if !data.rows.is_empty() {
            // Extract headers from first row
            let headers: Vec<String> = data.rows[0].data.keys().cloned().collect();
            wtr.write_record(&headers)?;
        }

        // Write data rows
        for row in &data.rows {
            if !data.headers.is_empty() {
                let values: Vec<String> = data.headers.iter()
                    .map(|h| row.data.get(h).unwrap_or(&"".to_string()).clone())
                    .collect();
                wtr.write_record(&values)?;
            } else {
                let mut values: Vec<_> = row.data.values().cloned().collect();
                wtr.write_record(&values)?;
            }
        }

        let csv_string = String::from_utf8(wtr.into_inner()?)?;
        Ok(csv_string)
    }
}

impl Default for CsvParser {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use tempfile::NamedTempFile;

    #[tokio::test]
    async fn test_csv_parsing_with_headers() {
        let csv_content = "username,password,email\nuser1,pass1,user1@example.com\nuser2,pass2,user2@example.com";
        let parser = CsvParser::new().with_headers(true);

        let test_data = parser.parse_from_string(csv_content).unwrap();

        assert_eq!(test_data.headers, vec!["username", "password", "email"]);
        assert_eq!(test_data.row_count, 2);
        assert_eq!(test_data.get_row_count(), 2);

        let first_row = &test_data.rows[0];
        assert_eq!(first_row.data.get("username"), Some(&"user1".to_string()));
        assert_eq!(first_row.data.get("password"), Some(&"pass1".to_string()));
        assert_eq!(first_row.data.get("email"), Some(&"user1@example.com".to_string()));
    }

    #[tokio::test]
    async fn test_csv_parsing_without_headers() {
        let csv_content = "user1,pass1,user1@example.com\nuser2,pass2,user2@example.com";
        let parser = CsvParser::new().with_headers(false);

        let test_data = parser.parse_from_string(csv_content).unwrap();

        assert_eq!(test_data.headers, vec!["Column1", "Column2", "Column3"]);
        assert_eq!(test_data.row_count, 2);

        let first_row = &test_data.rows[0];
        assert_eq!(first_row.data.get("Column1"), Some(&"user1".to_string()));
        assert_eq!(first_row.data.get("Column2"), Some(&"pass1".to_string()));
    }

    #[tokio::test]
    async fn test_csv_to_string() {
        let mut test_data = TestData::new();
        test_data.headers = vec!["Name".to_string(), "Age".to_string()];

        let mut row1 = DataRow::new();
        row1.data.insert("Name".to_string(), "Alice".to_string());
        row1.data.insert("Age".to_string(), "30".to_string());

        let mut row2 = DataRow::new();
        row2.data.insert("Name".to_string(), "Bob".to_string());
        row2.data.insert("Age".to_string(), "25".to_string());

        test_data.add_row(row1);
        test_data.add_row(row2);

        let parser = CsvParser::new();
        let csv_string = parser.to_string(&test_data).unwrap();

        assert!(csv_string.contains("Name,Age"));
        assert!(csv_string.contains("Alice,30"));
        assert!(csv_string.contains("Bob,25"));
    }

    #[test]
    fn test_csv_parser_configuration() {
        let parser = CsvParser::new()
            .with_delimiter(';')
            .with_headers(false);

        assert_eq!(parser.delimiter, b';');
        assert!(!parser.has_headers);
    }

    #[tokio::test]
    async fn test_empty_csv() {
        let parser = CsvParser::new();
        let result = parser.parse_from_string("");
        assert!(result.is_err());
        match result.unwrap_err() {
            CsvParserError::EmptyFile(_) => {},
            _ => panic!("Expected EmptyFile error"),
        }
    }
}