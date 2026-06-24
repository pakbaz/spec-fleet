package dashboard

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/specfleet-samples/hermes-telemetry/internal/telemetry"
)

func TestServeEventsReturnsBufferContents(t *testing.T) {
	buf := telemetry.NewBuffer(8)
	buf.Append(telemetry.Event{Channel: "voltage", ValueRaw: 12.0, Unit: "V", Timestamp: time.Now()})
	h := New(buf, []byte("<html></html>"), []string{"http://localhost:8080"})

	req := httptest.NewRequest(http.MethodGet, "/api/events", nil)
	req.Header.Set("Origin", "http://localhost:8080")
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rr.Code)
	}
	var body struct {
		Events []telemetry.Event `json:"events"`
	}
	if err := json.NewDecoder(rr.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if len(body.Events) != 1 || body.Events[0].Channel != "voltage" {
		t.Fatalf("unexpected events: %+v", body.Events)
	}
}

func TestServeEventsRejectsForbiddenOrigin(t *testing.T) {
	h := New(telemetry.NewBuffer(8), []byte("<html></html>"), []string{"http://example.com"})

	req := httptest.NewRequest(http.MethodGet, "/api/events", nil)
	req.Header.Set("Origin", "http://evil.example")
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)

	if rr.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want 403", rr.Code)
	}
}

// spec: origin-allowlist — the dashboard must accept both `localhost` and
// `127.0.0.1` (any port) when either is configured, because the two are
// semantically equivalent for loopback development. Pre-fix this case
// returned 403.
func TestOriginAllowedTreatsLocalhostAnd127AsEquivalent(t *testing.T) {
	cases := []struct {
		name, origin, configured string
		want                     bool
	}{
		{"localhost configured, 127 origin", "http://127.0.0.1:8080", "http://localhost:8080", true},
		{"127 configured, localhost origin", "http://localhost:8080", "http://127.0.0.1:8080", true},
		{"different ports must still differ", "http://localhost:9090", "http://localhost:8080", false},
		{"different schemes must differ", "https://localhost:8080", "http://localhost:8080", false},
		{"unrelated host stays denied", "http://evil.example:8080", "http://localhost:8080", false},
		{"case-insensitive host", "http://LocalHost:8080", "http://localhost:8080", true},
		{"empty origin is allowed (same-origin)", "", "http://localhost:8080", true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			h := New(telemetry.NewBuffer(8), nil, []string{tc.configured})
			if got := h.OriginAllowed(tc.origin); got != tc.want {
				t.Errorf("OriginAllowed(%q) = %v, want %v", tc.origin, got, tc.want)
			}
		})
	}
}

func TestServeIndexReturnsHTML(t *testing.T) {
	h := New(telemetry.NewBuffer(0), []byte("<html>hermes</html>"), nil)
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rr.Code)
	}
	if got := rr.Header().Get("Content-Type"); got != "text/html; charset=utf-8" {
		t.Errorf("content-type = %q", got)
	}
}

func TestUnknownPathIs404(t *testing.T) {
	h := New(telemetry.NewBuffer(0), nil, nil)
	req := httptest.NewRequest(http.MethodGet, "/nope", nil)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", rr.Code)
	}
}
