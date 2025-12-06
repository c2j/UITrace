use std::path::PathBuf;

#[derive(Debug, Clone)]
pub enum DataSource {
    Csv(PathBuf),
    Excel(PathBuf),
    Json(PathBuf),
}

impl DataSource {
    pub fn path(&self) -> &PathBuf {
        match self {
            DataSource::Csv(path) => path,
            DataSource::Excel(path) => path,
            DataSource::Json(path) => path,
        }
    }

    pub fn extension(&self) -> Option<String> {
        self.path().extension().and_then(|ext| ext.to_str().map(|s| s.to_lowercase()))
    }
}