use csv::Reader;
use calamine::{Reader as ExcelReader, Xlsx, open_workbook};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use tracing::{info, debug, error};
use uuid::Uuid;

use crate::models::{TestDataFile, DataFileType, DataColumn, DataType, DataRow};

pub struct DataManager {
    data_directory: String,
}

impl DataManager {
    pub fn new(data_dir: String) -> Self {
        Self {
            data_directory: data_dir,
        }
    }

    pub fn import_csv_file(&self, file_path: &str, name: String) -> Result<TestDataFile, Box<dyn std::error::Error>> {
        info!("Importing CSV file: {}", file_path);

        let mut reader = Reader::from_path(file_path)?;
        let headers = reader.headers()?.iter().map(|h| h.to_string()).collect::<Vec<_>>();

        debug!("CSV headers: {:?}", headers);

        let mut rows = Vec::new();
        let mut row_count = 0;
        let mut sample_values: HashMap<String, Vec<String>> = HashMap::new();

        // Collect sample data (first 5 rows)
        for result in reader.records() {
            let record = result?;
            row_count += 1;

            let mut row = HashMap::new();
            for (i, header) in headers.iter().enumerate() {
                if let Some(value) = record.get(i) {
                    row.insert(header.clone(), value.to_string());

                    // Collect sample values
                    if rows.len() < 5 {
                        sample_values.entry(header.clone()).or_insert_with(Vec::new).push(value.to_string());
                    }
                }
            }
            rows.push(row);

            if rows.len() >= 1000 { // Limit to first 1000 rows for initial processing
                break;
            }
        }

        // Create column metadata
        let mut columns = Vec::new();
        for header in &headers {
            let empty_vec: Vec<String> = Vec::new();
            let data_type = Self::infer_data_type(sample_values.get(header).unwrap_or(&empty_vec));
            let samples = sample_values.get(header).unwrap_or(&empty_vec).clone();

            columns.push(DataColumn {
                name: header.clone(),
                data_type,
                sample_values: samples,
            });
        }

        // Get file size
        let file_size = std::fs::metadata(file_path)?.len();

        let mut data_file = TestDataFile::new(
            name,
            Some(format!("CSV file with {} rows", row_count)),
            file_path.to_string(),
            DataFileType::Csv,
            file_size,
        );
        data_file.column_headers = columns;
        data_file.row_count = row_count;

        info!("CSV import completed: {} rows, {} columns", row_count, headers.len());
        Ok(data_file)
    }

    pub fn import_excel_file(&self, file_path: &str, name: String) -> Result<TestDataFile, Box<dyn std::error::Error>> {
        info!("Importing Excel file: {}", file_path);

        let mut workbook: Xlsx<_> = open_workbook(file_path)?;
        let sheet_names = workbook.sheet_names();

        if sheet_names.is_empty() {
            return Err("Excel file has no sheets".into());
        }

        // Use first sheet
        let sheet_name = &sheet_names[0];
        let range = match workbook.worksheet_range(sheet_name) {
            Some(Ok(range)) => range,
            Some(Err(_)) => return Err("Error reading sheet".into()),
            None => return Err("Sheet not found".into()),
        };

        let mut headers = Vec::new();
        let mut rows = Vec::new();
        let mut sample_values: HashMap<String, Vec<String>> = HashMap::new();
        let mut row_count = 0;

        // Extract headers from first row
        if let Some(first_row) = range.rows().next() {
            for cell in first_row {
                headers.push(cell.to_string());
            }
        }

        debug!("Excel headers: {:?}", headers);

        // Process data rows
        for (i, row) in range.rows().enumerate() {
            if i == 0 { // Skip header row
                continue;
            }

            row_count += 1;
            let mut row_data = HashMap::new();

            for (j, header) in headers.iter().enumerate() {
                if let Some(cell) = row.get(j) {
                    let value = cell.to_string();
                    row_data.insert(header.clone(), value.clone());

                    // Collect sample values
                    if rows.len() < 5 {
                        sample_values.entry(header.clone()).or_insert_with(Vec::new).push(value);
                    }
                }
            }
            rows.push(row_data);

            if rows.len() >= 1000 { // Limit to first 1000 rows
                break;
            }
        }

        // Create column metadata
        let mut columns = Vec::new();
        for header in &headers {
            let empty_vec: Vec<String> = Vec::new();
            let data_type = Self::infer_data_type(sample_values.get(header).unwrap_or(&empty_vec));
            let samples = sample_values.get(header).unwrap_or(&empty_vec).clone();

            columns.push(DataColumn {
                name: header.clone(),
                data_type,
                sample_values: samples,
            });
        }

        // Get file size
        let file_size = std::fs::metadata(file_path)?.len();

        let mut data_file = TestDataFile::new(
            name,
            Some(format!("Excel file with {} rows from sheet '{}'", row_count, sheet_name)),
            file_path.to_string(),
            DataFileType::Excel,
            file_size,
        );
        data_file.column_headers = columns;
        data_file.row_count = row_count;

        info!("Excel import completed: {} rows, {} columns from sheet '{}'", row_count, headers.len(), sheet_name);
        Ok(data_file)
    }

    fn infer_data_type(values: &[String]) -> DataType {
        if values.is_empty() {
            return DataType::Text;
        }

        let mut all_boolean = true;
        let mut all_numeric = true;
        let mut all_dates = true;
        let mut all_emails = true;
        let mut all_urls = true;

        for value in values {
            let lower = value.to_lowercase();

            // Check boolean
            if !matches!(lower.as_str(), "true" | "false" | "yes" | "no" | "1" | "0") {
                all_boolean = false;
            }

            // Check numeric
            if value.parse::<f64>().is_err() {
                all_numeric = false;
            }

            // Check date (simplified)
            if !Self::is_date_like(value) {
                all_dates = false;
            }

            // Check email
            if !value.contains('@') || !value.contains('.') {
                all_emails = false;
            }

            // Check URL
            if !value.starts_with("http://") && !value.starts_with("https://") {
                all_urls = false;
            }
        }

        if all_boolean {
            DataType::Boolean
        } else if all_numeric {
            DataType::Number
        } else if all_dates {
            DataType::Date
        } else if all_emails {
            DataType::Email
        } else if all_urls {
            DataType::Url
        } else {
            DataType::Text
        }
    }

    fn is_date_like(value: &str) -> bool {
        // Very simplified date detection
        value.contains('/') || value.contains('-') || value.contains('.')
    }

    pub fn get_data_rows(&self, data_file: &TestDataFile, limit: Option<usize>) -> Result<Vec<DataRow>, Box<dyn std::error::Error>> {
        match data_file.file_type {
            DataFileType::Csv => self.read_csv_rows(&data_file.file_path, limit),
            DataFileType::Excel => self.read_excel_rows(&data_file.file_path, limit),
        }
    }

    fn read_csv_rows(&self, file_path: &str, limit: Option<usize>) -> Result<Vec<DataRow>, Box<dyn std::error::Error>> {
        let mut reader = Reader::from_path(file_path)?;
        let headers = reader.headers()?.iter().map(|h| h.to_string()).collect::<Vec<_>>();

        let mut rows = Vec::new();
        let mut row_index = 0;

        for result in reader.records() {
            let record = result?;

            let mut values = HashMap::new();
            for (i, header) in headers.iter().enumerate() {
                if let Some(value) = record.get(i) {
                    values.insert(header.clone(), value.to_string());
                }
            }

            rows.push(DataRow { row_index, values });
            row_index += 1;

            if let Some(limit) = limit {
                if rows.len() >= limit {
                    break;
                }
            }
        }

        Ok(rows)
    }

    fn read_excel_rows(&self, file_path: &str, limit: Option<usize>) -> Result<Vec<DataRow>, Box<dyn std::error::Error>> {
        let mut workbook: Xlsx<_> = open_workbook(file_path)?;
        let sheet_names = workbook.sheet_names();

        if sheet_names.is_empty() {
            return Err("Excel file has no sheets".into());
        }

        let range = match workbook.worksheet_range(&sheet_names[0]) {
            Some(Ok(range)) => range,
            Some(Err(_)) => return Err("Error reading sheet".into()),
            None => return Err("Sheet not found".into()),
        };

        let mut headers = Vec::new();
        let mut rows = Vec::new();
        let mut row_index = 0;

        // Extract headers from first row
        if let Some(first_row) = range.rows().next() {
            for cell in first_row {
                headers.push(cell.to_string());
            }
        }

        // Process data rows
        for (i, row) in range.rows().enumerate() {
            if i == 0 { // Skip header row
                continue;
            }

            let mut values = HashMap::new();
            for (j, header) in headers.iter().enumerate() {
                if let Some(cell) = row.get(j) {
                    values.insert(header.clone(), cell.to_string());
                }
            }

            rows.push(DataRow { row_index, values });
            row_index += 1;

            if let Some(limit) = limit {
                if rows.len() >= limit {
                    break;
                }
            }
        }

        Ok(rows)
    }
}

impl Default for DataManager {
    fn default() -> Self {
        Self::new("storage/data".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_data_manager_creation() {
        let manager = DataManager::new("/tmp/data".to_string());
        assert_eq!(manager.data_directory, "/tmp/data");
    }

    #[test]
    fn test_data_type_inference() {
        // Test boolean detection
        let bool_values = vec!["true".to_string(), "false".to_string(), "yes".to_string()];
        assert!(matches!(DataManager::infer_data_type(&bool_values), DataType::Boolean));

        // Test numeric detection
        let num_values = vec!["123".to_string(), "456.78".to_string(), "-90".to_string()];
        assert!(matches!(DataManager::infer_data_type(&num_values), DataType::Number));

        // Test text detection (default)
        let text_values = vec!["hello".to_string(), "world".to_string()];
        assert!(matches!(DataManager::infer_data_type(&text_values), DataType::Text));
    }
}

#[cfg(test)]
mod base64_fix {
    // Simple base64 module for testing
    pub fn decode(data: &str) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
        Ok(data.as_bytes().to_vec())
    }
}