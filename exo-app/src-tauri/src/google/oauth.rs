use super::types::{GoogleCredentials, TokenResponse};
use std::fs;
use std::path::PathBuf;

const OAUTH_PORT: u16 = 8234;
const AUTH_ENDPOINT: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT: &str = "https://oauth2.googleapis.com/token";
const CALENDAR_SCOPE: &str = "https://www.googleapis.com/auth/calendar";

/// Load Google OAuth credentials from ~/.exo-os/google_credentials.json
pub fn load_credentials() -> Result<GoogleCredentials, String> {
    let path = credentials_path()?;
    if !path.exists() {
        return Err(format!(
            "Google credentials not found. Please create {} with your OAuth client_id and client_secret.",
            path.display()
        ));
    }
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read credentials file: {}", e))?;
    serde_json::from_str(&content)
        .map_err(|e| format!("Invalid credentials JSON: {}", e))
}

fn credentials_path() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    Ok(home.join(".exo-os").join("google_credentials.json"))
}

/// Build the Google OAuth authorization URL
pub fn build_auth_url(client_id: &str) -> String {
    format!(
        "{}?client_id={}&redirect_uri={}&response_type=code&scope={}&access_type=offline&prompt=consent",
        AUTH_ENDPOINT,
        urlencoding(client_id),
        urlencoding(&format!("http://localhost:{}", OAUTH_PORT)),
        urlencoding(CALENDAR_SCOPE),
    )
}

/// Start a one-shot TCP listener on localhost to capture the OAuth redirect
pub async fn wait_for_auth_code() -> Result<String, String> {
    let listener = tokio::net::TcpListener::bind(format!("127.0.0.1:{}", OAUTH_PORT))
        .await
        .map_err(|e| format!("Failed to bind port {}: {}", OAUTH_PORT, e))?;

    let (mut stream, _) = listener
        .accept()
        .await
        .map_err(|e| format!("Failed to accept connection: {}", e))?;

    let mut buf = vec![0u8; 4096];
    let n = tokio::io::AsyncReadExt::read(&mut stream, &mut buf)
        .await
        .map_err(|e| format!("Failed to read request: {}", e))?;

    let request = String::from_utf8_lossy(&buf[..n]);

    // Extract code from "GET /?code=XXXX&scope=... HTTP/1.1"
    let code = extract_code(&request)?;

    // Send success response
    let html = r#"<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Exo OS</title>
<style>body{font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0a0a0f;color:#fff;}
.box{text-align:center;}.ok{color:#00E599;font-size:48px;margin-bottom:16px;}h2{margin:0 0 8px;}p{color:#888;}</style></head>
<body><div class="box"><div class="ok">&#10003;</div><h2>Connexion réussie</h2><p>Tu peux fermer cette fenêtre et revenir à Exo OS.</p></div></body></html>"#;

    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        html.len(),
        html,
    );

    tokio::io::AsyncWriteExt::write_all(&mut stream, response.as_bytes())
        .await
        .map_err(|e| format!("Failed to send response: {}", e))?;

    Ok(code)
}

/// Exchange authorization code for tokens
pub async fn exchange_code(
    client_id: &str,
    client_secret: &str,
    code: &str,
) -> Result<TokenResponse, String> {
    let client = reqwest::Client::new();
    let resp = client
        .post(TOKEN_ENDPOINT)
        .form(&[
            ("code", code),
            ("client_id", client_id),
            ("client_secret", client_secret),
            ("redirect_uri", &format!("http://localhost:{}", OAUTH_PORT)),
            ("grant_type", "authorization_code"),
        ])
        .send()
        .await
        .map_err(|e| format!("Token exchange request failed: {}", e))?;

    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Token exchange failed: {}", body));
    }

    resp.json::<TokenResponse>()
        .await
        .map_err(|e| format!("Failed to parse token response: {}", e))
}

/// Refresh an expired access token
pub async fn refresh_access_token(
    client_id: &str,
    client_secret: &str,
    refresh_token: &str,
) -> Result<TokenResponse, String> {
    let client = reqwest::Client::new();
    let resp = client
        .post(TOKEN_ENDPOINT)
        .form(&[
            ("refresh_token", refresh_token),
            ("client_id", client_id),
            ("client_secret", client_secret),
            ("grant_type", "refresh_token"),
        ])
        .send()
        .await
        .map_err(|e| format!("Token refresh request failed: {}", e))?;

    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Token refresh failed: {}", body));
    }

    resp.json::<TokenResponse>()
        .await
        .map_err(|e| format!("Failed to parse refresh response: {}", e))
}

// === Helpers ===

fn extract_code(request: &str) -> Result<String, String> {
    // Parse "GET /?code=XXXX&... HTTP/1.1"
    let first_line = request.lines().next().unwrap_or("");
    let path = first_line.split_whitespace().nth(1).unwrap_or("");

    if let Some(query) = path.split('?').nth(1) {
        for param in query.split('&') {
            let mut parts = param.splitn(2, '=');
            if parts.next() == Some("code") {
                if let Some(code) = parts.next() {
                    return Ok(code.to_string());
                }
            }
        }
    }

    // Check for error
    if path.contains("error=") {
        return Err(format!("OAuth error: {}", path));
    }

    Err("No authorization code found in redirect".to_string())
}

fn urlencoding(s: &str) -> String {
    s.replace(':', "%3A")
        .replace('/', "%2F")
        .replace('?', "%3F")
        .replace('&', "%26")
        .replace('=', "%3D")
        .replace(' ', "%20")
        .replace('@', "%40")
}
