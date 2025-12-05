use tracing::{info, Level};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

pub fn setup_logging(log_level: &str) {
    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new(format!("uitrace={}", log_level)));

    tracing_subscriber::registry()
        .with(env_filter)
        .with(tracing_subscriber::fmt::layer())
        .init();

    info!("Logging initialized with level: {}", log_level);
}

pub fn setup_logging_with_file(log_level: &str, log_file: &str) -> Result<(), Box<dyn std::error::Error>> {
    use std::fs::File;
    use tracing_subscriber::fmt::writer::MakeWriterExt;

    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new(format!("uitrace={}", log_level)));

    let file = File::create(log_file)?;
    let (non_blocking, _guard) = tracing_appender::non_blocking(file);

    tracing_subscriber::registry()
        .with(env_filter)
        .with(
            tracing_subscriber::fmt::layer()
                .with_writer(non_blocking.with_max_level(Level::INFO))
        )
        .init();

    info!("Logging initialized with level: {} and file: {}", log_level, log_file);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_setup_logging() {
        // This test just ensures setup_logging doesn't panic
        setup_logging("debug");
    }
}