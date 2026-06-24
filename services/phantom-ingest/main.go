package main

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/phantom-secops/phantom-ingest/parsers"
)

const maxBodyBytes = 160 << 20 // 160 MB

func main() {
	addr := envOr("INGEST_GO_ADDR", ":8080")
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", healthHandler)
	mux.HandleFunc("POST /v1/parse/nessus-csv", nessusCSVHandler)
	mux.HandleFunc("POST /v1/parse/nessus-targets", nessusTargetsHandler)
	mux.HandleFunc("POST /v1/parse/nmap", nmapHandler)

	srv := &http.Server{
		Addr:              addr,
		Handler:           withCORS(mux),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       10 * time.Minute,
		WriteTimeout:      10 * time.Minute,
	}
	log.Printf("[phantom-ingest] listening on %s", addr)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
}

func envOr(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}

func healthHandler(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"status":  "ok",
		"service": "phantom-ingest",
	})
}

func nessusCSVHandler(w http.ResponseWriter, r *http.Request) {
	data, err := readBody(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	start := time.Now()
	drafts, err := parsers.ParseNessusCSV(data)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeParseResponse(w, "nessus-csv", "go", len(drafts), start, drafts)
}

func nessusTargetsHandler(w http.ResponseWriter, r *http.Request) {
	data, err := readBody(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	start := time.Now()
	drafts, err := parsers.ParseNessusTargets(data)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeParseResponse(w, "nessus-targets", "go", len(drafts), start, drafts)
}

func nmapHandler(w http.ResponseWriter, r *http.Request) {
	data, err := readBody(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	filename := r.URL.Query().Get("filename")
	if filename == "" {
		filename = "scan"
	}
	start := time.Now()
	drafts, err := parsers.ParseNmap(data, filename)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeParseResponse(w, "nmap", "go", len(drafts), start, drafts)
}

func readBody(r *http.Request) ([]byte, error) {
	defer r.Body.Close()
	limited := io.LimitReader(r.Body, maxBodyBytes+1)
	data, err := io.ReadAll(limited)
	if err != nil {
		return nil, err
	}
	if int64(len(data)) > maxBodyBytes {
		return nil, errTooLarge
	}
	return data, nil
}

var errTooLarge = &parseError{msg: "body too large"}

type parseError struct{ msg string }

func (e *parseError) Error() string { return e.msg }

func writeParseResponse(w http.ResponseWriter, source, engine string, count int, start time.Time, drafts []parsers.Draft) {
	if drafts == nil {
		drafts = []parsers.Draft{}
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"source":       source,
		"engine":       engine,
		"count":        count,
		"duration_ms":  time.Since(start).Milliseconds(),
		"drafts":       drafts,
	})
}

func writeError(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, map[string]string{"detail": msg})
}

func writeJSON(w http.ResponseWriter, code int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	enc := json.NewEncoder(w)
	enc.SetEscapeHTML(false)
	_ = enc.Encode(payload)
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
