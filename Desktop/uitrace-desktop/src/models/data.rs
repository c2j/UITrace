use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestDataFile {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub file_path: String,
    pub file_type: DataFileType,
    pub file_size: u64,
    pub column_headers: Vec<DataColumn>,
    pub row_count: usize,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataColumn {
    pub name: String,
    pub data_type: DataType,
    pub sample_values: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DataType {
    Text,
    Number,
    Boolean,
    Date,
    Email,
    Url,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DataFileType {
    Csv,
    Excel,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataMapping {
    pub id: Uuid,
    pub script_id: Uuid,
    pub data_file_id: Uuid,
    pub variable_mappings: HashMap<String, String>, // variable_name -> column_name
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataRow {
    pub row_index: usize,
    pub values: HashMap<String, String>,
}

impl TestDataFile {
    pub fn new(
        name: String,
        description: Option<String>,
        file_path: String,
        file_type: DataFileType,
        file_size: u64,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            name,
            description,
            file_path,
            file_type,
            file_size,
            column_headers: Vec::new(),
            row_count: 0,
            created_by: None,
            created_at: Utc::now(),
        }
    }

    pub fn validate(&self) -> Result<(), String> {
        if self.name.is_empty() {
            return Err("Data file name cannot be empty".to_string());
        }

        if self.file_size == 0 {
            return Err("File size cannot be zero".to_string());
        }

        if self.row_count == 0 {
            return Err("Data file must contain at least one row".to_string());
        }

        if self.column_headers.is_empty() {
            return Err("Data file must have at least one column".to_string());
        }

        Ok(())
    }

    pub fn get_column_names(&self) -> Vec<String> {
        self.column_headers.iter().map(|c| c.name.clone()).collect()
    }

    pub fn sample_data(&self, max_rows: usize) -> Vec<HashMap<String, String>> {
        let mut samples = Vec::new();
        let rows_to_show = std::cmp::min(max_rows, self.row_count);

        for i in 0..rows_to_show {
            let mut row = HashMap::new();
            for column in &self.column_headers {
                if let Some(sample) = column.sample_values.get(i) {
                    row.insert(column.name.clone(), sample.clone());
                }
            }
            samples.push(row);
        }

        samples
    }
}

impl DataMapping {
    pub fn new(script_id: Uuid, data_file_id: Uuid) -> Self {
        Self {
            id: Uuid::new_v4(),
            script_id,
            data_file_id,
            variable_mappings: HashMap::new(),
            created_by: None,
            created_at: Utc::now(),
        }
    }

    pub fn add_mapping(&mut self, variable_name: String, column_name: String) {
        self.variable_mappings.insert(variable_name, column_name);
    }

    pub fn substitute_variables(&self, text: &str, data_row: &DataRow) -> Result<String, String> {
        let mut result = text.to_string();

        for (variable, column) in &self.variable_mappings {
            let placeholder = format!("${{{}}}", variable);
            if result.contains(&placeholder) {
                if let Some(value) = data_row.values.get(column) {
                    result = result.replace(&placeholder, value);
                } else {
                    return Err(format!("Column '{}' not found in data row", column));
                }
            }
        }

        Ok(result)
    }

    pub fn validate(&self, data_file: &TestDataFile) -> Result<(), String> {
        let available_columns: std::collections::HashSet<_> =
            data_file.get_column_names().into_iter().collect();

        for (variable, column) in &self.variable_mappings {
            if !available_columns.contains(column) {
                return Err(format!(
                    "Column '{}' mapped to variable '{}' does not exist in data file",
                    column, variable
                ));
            }
        }

        Ok(())
    }
}