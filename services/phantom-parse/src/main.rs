use axum::{
    extract::DefaultBodyLimit,
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::net::SocketAddr;
use std::time::Instant;

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
    service: &'static str,
}

#[derive(Serialize)]
struct ParseResponse {
    source: &'static str,
    engine: &'static str,
    count: usize,
    duration_ms: u128,
    drafts: Vec<serde_json::Value>,
}

#[derive(Deserialize)]
struct DedupRequest {
    components: Vec<String>,
}

#[derive(Serialize)]
struct DedupResponse {
    normalized: Vec<String>,
    unique_count: usize,
    duration_ms: u128,
}

fn main() {
    let addr: SocketAddr = std::env::var("PARSE_RUST_ADDR")
        .unwrap_or_else(|_| "0.0.0.0:8081".to_string())
        .parse()
        .expect("invalid PARSE_RUST_ADDR");

    let app = Router::new()
        .route("/health", get(health))
        .route("/v1/parse/nessus-targets", post(parse_nessus_targets))
        .route("/v1/dedup/normalize-components", post(normalize_components))
        .layer(DefaultBodyLimit::max(160 * 1024 * 1024));

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("bind failed");
    eprintln!("[phantom-parse] listening on {}", addr);
    axum::serve(listener, app).await.expect("server failed");
}

async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok",
        service: "phantom-parse",
    })
}

async fn parse_nessus_targets(body: axum::body::Bytes) -> Result<Json<ParseResponse>, AppError> {
    let start = Instant::now();
    let drafts = nessus_targets_from_bytes(&body)?;
    Ok(Json(ParseResponse {
        source: "nessus-targets",
        engine: "rust",
        count: drafts.len(),
        duration_ms: start.elapsed().as_millis(),
        drafts,
    }))
}

async fn normalize_components(
    Json(payload): Json<DedupRequest>,
) -> Json<DedupResponse> {
    let start = Instant::now();
    let mut seen = HashSet::new();
    let mut normalized = Vec::new();
    for raw in payload.components {
        let key = normalize_component(&raw);
        if key.is_empty() || seen.contains(&key) {
            continue;
        }
        seen.insert(key.clone());
        normalized.push(key);
    }
    let unique_count = normalized.len();
    Json(DedupResponse {
        normalized,
        unique_count,
        duration_ms: start.elapsed().as_millis(),
    })
}

fn nessus_targets_from_bytes(data: &[u8]) -> Result<Vec<serde_json::Value>, AppError> {
    let text = String::from_utf8_lossy(data);
    let mut reader = csv::ReaderBuilder::new()
        .flexible(true)
        .from_reader(text.as_bytes());

    let headers = reader
        .headers()
        .map_err(|e| AppError::bad_request(e.to_string()))?
        .clone();
    let index = build_header_index(&headers);

    let mut seen = HashSet::new();
    let mut out = Vec::new();

    for result in reader.records() {
        let record = result.map_err(|e| AppError::bad_request(e.to_string()))?;
        let host = get_indexed(&record, &index, &["host", "dns name", "fqdn", "ip"]);
        if host.is_empty() {
            continue;
        }
        let port = get_indexed(&record, &index, &["port", "puerto"]);
        let proto = get_indexed(&record, &index, &["protocol", "protocolo"]);
        let service = get_indexed(&record, &index, &["service", "servicio"]);
        let comp = build_componente(&host, &port, &proto);
        let comp = if comp.is_empty() { host.clone() } else { comp };
        let key = normalize_component(&comp);
        if key.is_empty() || seen.contains(&key) {
            continue;
        }
        seen.insert(key);

        let mut draft = serde_json::json!({
            "host": host,
            "port": port,
            "proto": proto,
            "componente_afectado": comp,
            "tool_source": "Nessus",
            "titulo": format!("Target {}", comp),
        });
        if !service.is_empty() {
            let port_default = if port.is_empty() { "0" } else { port.as_str() };
            draft["servicio"] = serde_json::Value::String(service.clone());
            draft["tool_vuln_id"] = serde_json::Value::String(format!("{}/{}", service, port_default));
        }
        out.push(draft);
    }
    Ok(out)
}

fn norm_header(h: &str) -> String {
    h.trim().to_lowercase().split_whitespace().collect::<Vec<_>>().join(" ")
}

fn build_header_index(headers: &csv::StringRecord) -> std::collections::HashMap<String, usize> {
    let mut out = std::collections::HashMap::new();
    for (i, h) in headers.iter().enumerate() {
        let norm = norm_header(h);
        if !norm.is_empty() {
            out.entry(norm).or_insert(i);
        }
    }
    out
}

fn get_indexed(record: &csv::StringRecord, index: &std::collections::HashMap<String, usize>, keys: &[&str]) -> String {
    for key in keys {
        if let Some(&idx) = index.get(&norm_header(key)) {
            let val = record.get(idx).unwrap_or("").trim();
            if !val.is_empty() {
                return val.to_string();
            }
        }
    }
    String::new()
}

fn build_componente(host: &str, port: &str, proto: &str) -> String {
    let host = host.trim();
    let port = port.trim();
    let proto = proto.trim();
    if host.is_empty() {
        return String::new();
    }
    if !port.is_empty() && port != "0" && port != "none" {
        let suffix = format!(":{}", port);
        let pl = proto.to_lowercase();
        if !proto.is_empty() && pl != "tcp" && pl != "udp" {
            return format!("{}{}/{}", host, suffix, proto);
        }
        return format!("{}{}", host, suffix);
    }
    host.to_string()
}

fn normalize_component(raw: &str) -> String {
    raw.trim().to_lowercase().replace(' ', "").trim_end_matches('/').to_string()
}

struct AppError {
    status: StatusCode,
    detail: String,
}

impl AppError {
    fn bad_request(detail: String) -> Self {
        Self {
            status: StatusCode::BAD_REQUEST,
            detail,
        }
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> axum::response::Response {
        let body = serde_json::json!({ "detail": self.detail });
        (self.status, Json(body)).into_response()
    }
}
