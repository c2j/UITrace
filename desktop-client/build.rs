use std::env;

fn main() {
    // Set OUT_DIR if not already set
    if env::var("OUT_DIR").is_err() {
        let out_dir = env::current_dir().unwrap().join("target").join("build");
        env::set_var("OUT_DIR", out_dir);
    }

    // Tell cargo to rerun this build script if tauri.conf.json changes
    println!("cargo:rerun-if-changed=tauri.conf.json");
}