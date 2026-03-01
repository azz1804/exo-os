use serde::Serialize;
use std::fs;
use std::io::{BufRead, BufReader};

#[derive(Serialize)]
pub struct LogOutput {
    pub lines: Vec<String>,
    pub file: String,
    pub total_lines: usize,
}

#[tauri::command]
pub fn get_logs(log_type: Option<String>, lines: Option<usize>) -> Result<LogOutput, String> {
    let log_type = log_type.unwrap_or_else(|| "orchestrator".into());
    let max_lines = lines.unwrap_or(150);

    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    let log_dir = home.join("Exo OS").join("logs");

    let file_name = match log_type.as_str() {
        "error" => "error.log",
        _ => "orchestrator.log",
    };

    let log_path = log_dir.join(file_name);

    if !log_path.exists() {
        return Ok(LogOutput {
            lines: vec!["No logs yet.".into()],
            file: file_name.into(),
            total_lines: 0,
        });
    }

    let file = fs::File::open(&log_path).map_err(|e| format!("Cannot read log: {}", e))?;
    let reader = BufReader::new(file);
    let all_lines: Vec<String> = reader.lines().filter_map(|l| l.ok()).collect();

    let total = all_lines.len();
    let start = if total > max_lines {
        total - max_lines
    } else {
        0
    };
    let tail = all_lines[start..].to_vec();

    Ok(LogOutput {
        lines: tail,
        file: file_name.into(),
        total_lines: total,
    })
}
