pub mod test_step;
pub mod selector;
pub mod script;
pub mod recording;
pub mod test_data;
pub mod execution;
pub mod visual_comparison;

pub use test_step::TestStep;
pub use selector::Selector;
pub use script::TestScript;
pub use recording::Recording;
pub use test_data::{TestData, TestDataRow};
pub use execution::{ExecutionResult, ExecutionStatus};
pub use visual_comparison::{VisualDiffResult, ComparisonMetrics};