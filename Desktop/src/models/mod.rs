pub mod test_step;
pub mod selector;
pub mod script;
pub mod recording;
pub mod test_data;
pub mod execution;
pub mod visual_comparison;

// Create missing model files
pub use test_step::TestStep;
pub use selector::Selector;
pub use script::{TestScript, ScriptMetadata};
pub use recording::Recording;
pub use test_data::{TestData, TestDataRow, TestDataValue};
pub use execution::{ExecutionResult, ExecutionStatus, StepResult};
pub use visual_comparison::{VisualBaseline, VisualDiffResult, ComparisonMetrics};

// Re-export commonly used types for convenience
pub type DataRow = TestDataRow;