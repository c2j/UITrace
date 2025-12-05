use image::{DynamicImage, ImageFormat, GenericImageView};
use tracing::{info, debug};
use std::path::Path;
use chrono::Utc;

pub struct VisualTestingService {
    baseline_directory: String,
    screenshot_directory: String,
    similarity_threshold: f64,
}

#[derive(Debug, Clone)]
pub struct VisualComparisonResult {
    pub similarity_score: f64,
    pub difference_percentage: f64,
    pub passed: bool,
    pub baseline_path: String,
    pub current_path: String,
}

impl VisualTestingService {
    pub fn new(baseline_dir: String, screenshot_dir: String) -> Self {
        Self {
            baseline_directory: baseline_dir,
            screenshot_directory: screenshot_dir,
            similarity_threshold: 0.98, // 98% similarity threshold
        }
    }

    pub fn set_similarity_threshold(&mut self, threshold: f64) {
        self.similarity_threshold = threshold.clamp(0.0, 1.0);
    }

    pub async fn capture_screenshot(
        &self,
        driver: &thirtyfour::WebDriver,
        name: &str,
    ) -> Result<String, Box<dyn std::error::Error>> {
        info!("Capturing screenshot: {}", name);

        let timestamp = Utc::now().format("%Y%m%d_%H%M%S");
        let filename = format!("{}_{}.png", name, timestamp);
        let filepath = format!("{}/{}", self.screenshot_directory, filename);

        // Take screenshot using WebDriver
        let screenshot = driver.screenshot_as_png_base64().await?;

        // Convert base64 to image and save
        let screenshot_bytes = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, &screenshot)?;
        let img = image::load_from_memory(&screenshot_bytes)?;
        img.save_with_format(&filepath, ImageFormat::Png)?;

        info!("Screenshot saved to: {}", filepath);
        Ok(filepath)
    }

    pub fn compare_screenshots(
        &self,
        baseline_path: &str,
        current_path: &str,
    ) -> Result<VisualComparisonResult, Box<dyn std::error::Error>> {
        info!("Comparing screenshots: {} vs {}", baseline_path, current_path);

        // Load images
        let baseline = image::open(baseline_path)?;
        let current = image::open(current_path)?;

        // Ensure images have the same dimensions
        let baseline_dims = (baseline.width(), baseline.height());
        let current_dims = (current.width(), current.height());

        if baseline_dims != current_dims {
            return Err(format!(
                "Image dimensions do not match: baseline {:?} vs current {:?}",
                baseline_dims,
                current_dims
            ).into());
        }

        // Perform comparison using SSIM - create a simple implementation
        let similarity = calculate_ssim(&baseline, &current)?;
        let difference_percentage = (1.0 - similarity) * 100.0;
        let passed = similarity >= self.similarity_threshold;

        let result = VisualComparisonResult {
            similarity_score: similarity,
            difference_percentage,
            passed,
            baseline_path: baseline_path.to_string(),
            current_path: current_path.to_string(),
        };

        info!(
            "Visual comparison complete: {:.2}% similarity (threshold: {:.2}%) - {}",
            similarity * 100.0,
            self.similarity_threshold * 100.0,
            if passed { "PASSED" } else { "FAILED" }
        );

        Ok(result)
    }

    pub fn create_baseline(
        &self,
        screenshot_path: &str,
        baseline_name: &str,
    ) -> Result<String, Box<dyn std::error::Error>> {
        let baseline_path = format!("{}/{}", self.baseline_directory, baseline_name);

        // Copy screenshot to baseline directory
        std::fs::copy(screenshot_path, &baseline_path)?;

        info!("Baseline created: {}", baseline_path);
        Ok(baseline_path)
    }

    pub fn baseline_exists(&self, baseline_name: &str) -> bool {
        let path = format!("{}/{}", self.baseline_directory, baseline_name);
        Path::new(&path).exists()
    }

    pub fn get_baseline_path(&self, baseline_name: &str) -> String {
        format!("{}/{}", self.baseline_directory, baseline_name)
    }

    pub fn list_baselines(&self) -> Result<Vec<String>, Box<dyn std::error::Error>> {
        let mut baselines = Vec::new();

        if Path::new(&self.baseline_directory).exists() {
            for entry in std::fs::read_dir(&self.baseline_directory)? {
                let entry = entry?;
                let filename = entry.file_name().to_string_lossy().to_string();
                if filename.ends_with(".png") {
                    baselines.push(filename);
                }
            }
        }

        baselines.sort();
        Ok(baselines)
    }

    pub fn delete_baseline(&self, baseline_name: &str) -> Result<(), Box<dyn std::error::Error>> {
        let path = format!("{}/{}", self.baseline_directory, baseline_name);

        if Path::new(&path).exists() {
            std::fs::remove_file(&path)?;
            info!("Baseline deleted: {}", path);
        } else {
            return Err(format!("Baseline not found: {}", baseline_name).into());
        }

        Ok(())
    }
}

impl Default for VisualTestingService {
    fn default() -> Self {
        Self::new(
            "storage/baselines".to_string(),
            "storage/screenshots".to_string(),
        )
    }
}

fn calculate_ssim(img1: &DynamicImage, img2: &DynamicImage) -> Result<f64, Box<dyn std::error::Error>> {
    // Simple similarity calculation based on histogram comparison
    // This is a simplified implementation for demonstration

    let (width, height) = (img1.width(), img1.height());
    if width != img2.width() || height != img2.height() {
        return Err("Images must have the same dimensions".into());
    }

    // Convert to grayscale and calculate simple statistics
    let mut sum1 = 0.0;
    let mut sum2 = 0.0;
    let mut sum1_sq = 0.0;
    let mut sum2_sq = 0.0;
    let mut sum12 = 0.0;
    let pixel_count = (width * height) as f64;

    // Sample every 10th pixel for performance (simplified approach)
    for y in (0..height).step_by(10) {
        for x in (0..width).step_by(10) {
            let rgb1 = img1.get_pixel(x, y).0;
            let rgb2 = img2.get_pixel(x, y).0;

            let gray1 = (rgb1[0] as f64 + rgb1[1] as f64 + rgb1[2] as f64) / (3.0 * 255.0);
            let gray2 = (rgb2[0] as f64 + rgb2[1] as f64 + rgb2[2] as f64) / (3.0 * 255.0);

            sum1 += gray1;
            sum2 += gray2;
            sum1_sq += gray1 * gray1;
            sum2_sq += gray2 * gray2;
            sum12 += gray1 * gray2;
        }
    }

    let sample_count = ((width / 10 + 1) * (height / 10 + 1)) as f64;
    let mean1 = sum1 / sample_count;
    let mean2 = sum2 / sample_count;
    let var1 = (sum1_sq / sample_count) - (mean1 * mean1);
    let var2 = (sum2_sq / sample_count) - (mean2 * mean2);
    let covar = (sum12 / sample_count) - (mean1 * mean2);

    let c1 = 0.01 * 0.01; // small constant to avoid division by zero
    let c2 = 0.03 * 0.03;

    let numerator = (2.0 * mean1 * mean2 + c1) * (2.0 * covar + c2);
    let denominator = (mean1 * mean1 + mean2 * mean2 + c1) * (var1 + var2 + c2);

    if denominator.abs() < f64::EPSILON {
        return Ok(0.0);
    }

    Ok(numerator / denominator)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_visual_service_creation() {
        let service = VisualTestingService::new(
            "/tmp/baselines".to_string(),
            "/tmp/screenshots".to_string(),
        );

        assert_eq!(service.similarity_threshold, 0.98);
    }

    #[test]
    fn test_threshold_setting() {
        let mut service = VisualTestingService::default();

        service.set_similarity_threshold(0.95);
        assert_eq!(service.similarity_threshold, 0.95);

        // Test clamping
        service.set_similarity_threshold(1.5);
        assert_eq!(service.similarity_threshold, 1.0);

        service.set_similarity_threshold(-0.5);
        assert_eq!(service.similarity_threshold, 0.0);
    }
}