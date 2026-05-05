package dashboard

import (
	"encoding/json"
	"net/http"
	"net/url"
	"strings"

	"github.com/specfleet-samples/hermes-telemetry/internal/telemetry"
)

// Handler exposes the dashboard HTTP surface — a static index page plus a
// JSON event endpoint. Built once at startup and reused.
type Handler struct {
	Buf            *telemetry.Buffer
	StaticHTML     []byte
	AllowedOrigins []string
}

// New returns a Handler with the given event buffer and allow-list. The
// allow-list is exact-match — if the dashboard is served from a different
// host (e.g. behind a reverse proxy on a custom domain) it must be added
// here.
func New(buf *telemetry.Buffer, html []byte, allowedOrigins []string) *Handler {
	return &Handler{Buf: buf, StaticHTML: html, AllowedOrigins: allowedOrigins}
}

// ServeHTTP implements http.Handler.
func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	switch r.URL.Path {
	case "/", "/index.html":
		h.serveIndex(w, r)
	case "/api/events":
		h.serveEvents(w, r)
	case "/api/health":
		h.serveHealth(w, r)
	default:
		http.NotFound(w, r)
	}
}

func (h *Handler) serveIndex(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write(h.StaticHTML)
}

func (h *Handler) serveHealth(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write([]byte(`{"status":"ok"}`))
}

func (h *Handler) serveEvents(w http.ResponseWriter, r *http.Request) {
	if !h.OriginAllowed(r.Header.Get("Origin")) {
		http.Error(w, "origin not allowed", http.StatusForbidden)
		return
	}
	w.Header().Set("Access-Control-Allow-Origin", r.Header.Get("Origin"))
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"events": h.Buf.Snapshot(),
	})
}

// OriginAllowed reports whether the supplied Origin header value is on the
// allow-list. An empty Origin is treated as same-origin and always allowed.
//
// spec: origin-allowlist — this method previously did an exact string match
// against the configured list, which broke local development where the
// browser sends `http://localhost:8080` but the operator had typed
// `http://127.0.0.1:8080` in config (or vice-versa). The fix:
//
//  1. compare hosts case-insensitively
//  2. treat `localhost` and `127.0.0.1` as equivalent for any port
func (h *Handler) OriginAllowed(origin string) bool {
	if origin == "" {
		return true
	}
	got, err := url.Parse(origin)
	if err != nil || got.Host == "" {
		return false
	}
	for _, allowed := range h.AllowedOrigins {
		want, err := url.Parse(allowed)
		if err != nil || want.Host == "" {
			continue
		}
		if originsMatch(got, want) {
			return true
		}
	}
	return false
}

func originsMatch(got, want *url.URL) bool {
	if !strings.EqualFold(got.Scheme, want.Scheme) {
		return false
	}
	gotHost, gotPort := splitHostPort(got.Host)
	wantHost, wantPort := splitHostPort(want.Host)
	if gotPort != wantPort {
		return false
	}
	return hostsEquivalent(gotHost, wantHost)
}

func splitHostPort(hp string) (string, string) {
	if i := strings.LastIndex(hp, ":"); i != -1 {
		return strings.ToLower(hp[:i]), hp[i+1:]
	}
	return strings.ToLower(hp), ""
}

func hostsEquivalent(a, b string) bool {
	if a == b {
		return true
	}
	loopback := map[string]bool{"localhost": true, "127.0.0.1": true, "[::1]": true}
	return loopback[a] && loopback[b]
}
