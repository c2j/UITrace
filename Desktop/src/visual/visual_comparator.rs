use crate::models::VisualDiffResult;
use crate::models::visual_comparison::{ComparisonConfig, ComparisonMetrics, DiffRegion, ImagesCompared};
use crate::visual::config::ScreenshotConfig;
use image::{DynamicImage, ImageFormat, RgbaImage, ImageBuffer, Luma};
use std::path::{Path, PathBuf};
use thirtyfour::prelude::*;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum VisualError {
    #[error("Image processing error: {0}")]
    ImageProcessing(#[from] image::ImageError),
    #[error("WebDriver error: {0}")]
    WebDriver(#[from] WebDriverError),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Image not found: {0}")]
    ImageNotFound(String),
    #[error("Image formats don't match")]
    FormatMismatch,
}

pub struct VisualComparator {
    driver: Option<WebDriver>,
}

impl VisualComparator {
    pub fn new() -> Self {
        Self { driver: None }
    }

    pub async fn take_screenshot(
        &mut self,
        url: &str,
        save_path: &Path,
        config: Option<ScreenshotConfig>,
    ) -> Result<PathBuf, VisualError> {
        let config = config.unwrap_or_default();

        // Initialize driver if needed
        if self.driver.is_none() {
            let caps = DesiredCapabilities::chrome();
            self.driver = Some(WebDriver::new("http://localhost:4444", caps).await?);
        }

        let driver = self.driver.as_ref().unwrap();

        // Navigate to URL
        driver.goto(url).await?;

        // Wait for page load if specified
        if config.wait_time > 0 {
            tokio::time::sleep(tokio::time::Duration::from_millis(config.wait_time)).await;
        }

        // Set window size if specified
        // Note: set_size method not available in thirtyfour v0.31
        // This may need to be implemented differently
        // if let Some((width, height)) = config.window_size {
        //     let window = driver.window().await?;
        //     window.set_size(width, height).await?;
        // }

        // Take screenshot
        let screenshot = driver.screenshot_as_png().await?;

        // Save screenshot
        std::fs::write(save_path, &screenshot)?;

        Ok(save_path.to_path_buf())
    }

    pub async fn compare_images(
        &self,
        image1_path: &Path,
        image2_path: &Path,
        output_path: Option<PathBuf>,
        threshold: Option<f32>,
    ) -> Result<VisualDiffResult, VisualError> {
        // Load images
        let img1 = image::open(image1_path)?;
        let img2 = image::open(image2_path)?;

        // Ensure images have the same dimensions
        let (img1, img2) = self.normalize_images(img1, img2)?;

        // Convert to grayscale for comparison
        let gray1 = img1.to_luma8();
        let gray2 = img2.to_luma8();

        // Create diff image
        let width = gray1.width();
        let height = gray1.height();
        let mut diff_buffer = ImageBuffer::new(width, height);
        let mut diff_pixels = 0;

        for (x, y, pixel) in diff_buffer.enumerate_pixels_mut() {
            let p1 = gray1.get_pixel(x, y)[0];
            let p2 = gray2.get_pixel(x, y)[0];
            let diff = if p1 > p2 { p1 - p2 } else { p2 - p1 };
            *pixel = Luma([diff]);

            if diff > 0 {
                diff_pixels += 1;
            }
        }

        let diff_img = DynamicImage::ImageLuma8(diff_buffer);

        // Calculate metrics
        let total_pixels = (width * height) as u32;
        let similarity_percentage = if total_pixels > 0 {
            1.0 - (diff_pixels as f32 / total_pixels as f32)
        } else {
            1.0
        };

        let metrics = ComparisonMetrics {
            similarity_percentage,
            pixel_difference_count: diff_pixels,
            total_pixels,
            diff_regions: self.extract_diff_regions(&diff_img),
        };

        // Save diff image if output path provided
        let diff_image = if let Some(output_path) = output_path {
            self.save_diff_image(&diff_img, &output_path)?;
            Some(output_path)
        } else {
            None
        };

        // Determine if test passed
        let threshold = threshold.unwrap_or(0.99);
        let passed = metrics.similarity_percentage >= threshold;

        Ok(VisualDiffResult {
            images_compared: ImagesCompared {
                baseline: image1_path.to_path_buf(),
                current: image2_path.to_path_buf(),
            },
            metrics,
            diff_image,
            passed,
        })
    }

    pub async fn generate_diff_report(
        &self,
        image1_path: &Path,
        image2_path: &Path,
        report_path: &Path,
    ) -> Result<(), VisualError> {
        let result = self.compare_images(image1_path, image2_path, None, None).await?;

        // Generate HTML report
        let html = self.generate_html_report(&result)?;

        // Save report
        std::fs::write(report_path, html)?;

        Ok(())
    }

    fn normalize_images(&self, mut img1: DynamicImage, mut img2: DynamicImage) -> Result<(DynamicImage, DynamicImage), VisualError> {
        let (width1, height1) = (img1.width(), img1.height());
        let (width2, height2) = (img2.width(), img2.height());

        // Use the smaller dimensions to avoid out of bounds
        let width = width1.min(width2);
        let height = height1.min(height2);

        img1 = img1.crop(0, 0, width, height);
        img2 = img2.crop(0, 0, width, height);

        Ok((img1, img2))
    }

    fn extract_diff_regions(&self, diff_img: &DynamicImage) -> Vec<DiffRegion> {
        // This is a simplified implementation
        // In a real scenario, you would use a more sophisticated algorithm
        // to identify contiguous regions of differences
        vec![DiffRegion {
            x: 0,
            y: 0,
            width: diff_img.width(),
            height: diff_img.height(),
            intensity: 1.0,
        }]
    }

    fn save_diff_image(&self, diff_img: &DynamicImage, output_path: &Path) -> Result<PathBuf, VisualError> {
        diff_img.save_with_format(output_path, ImageFormat::Png)?;
        Ok(output_path.to_path_buf())
    }

    fn generate_html_report(&self, result: &VisualDiffResult) -> Result<String, VisualError> {
        let html = format!(
            r#"
<!DOCTYPE html>
<html>
<head>
    <title>Visual Comparison Report</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; }}
        .header {{ background: #f5f5f5; padding: 20px; border-radius: 5px; }}
        .metrics {{ margin: 20px 0; }}
        .metric {{ display: inline-block; margin: 10px; padding: 10px; background: #e9ecef; border-radius: 3px; }}
        .passed {{ color: green; font-weight: bold; }}
        .failed {{ color: red; font-weight: bold; }}
        .images {{ display: flex; gap: 20px; margin: 20px 0; }}
        .image-container {{ flex: 1; }}
        .image-container img {{ width: 100%; border: 1px solid #ddd; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>Visual Comparison Report</h1>
        <p class="{status_class}">
            Status: {status}
        </p>
    </div>

    <div class="metrics">
        <div class="metric">Similarity: {similarity:.2}%</div>
        <div class="metric">Different Pixels: {diff_pixels}</div>
        <div class="metric">Total Pixels: {total_pixels}</div>
    </div>

    <div class="images">
        <div class="image-container">
            <h3>Baseline</h3>
            <img src="{baseline}" alt="Baseline image" />
        </div>
        <div class="image-container">
            <h3>Current</h3>
            <img src="{current}" alt="Current image" />
        </div>
    </div>
</body>
</html>
            "#,
            status = if result.passed { "PASSED" } else { "FAILED" },
            status_class = if result.passed { "passed" } else { "failed" },
            similarity = result.metrics.similarity_percentage * 100.0,
            diff_pixels = result.metrics.pixel_difference_count,
            total_pixels = result.metrics.total_pixels,
            baseline = result.images_compared.baseline.display(),
            current = result.images_compared.current.display(),
        );

        Ok(html)
    }
}

impl Default for VisualComparator {
    fn default() -> Self {
        Self::new()
    }
}