package telemetry

import (
	"sync"
	"time"
)

// Event represents a single piece of telemetry produced by a synthetic
// instrument or upstream source. Kept deliberately simple — Hermes's real
// payloads are richer, but the brownfield demo only needs three fields to
// exercise the dashboard end-to-end.
type Event struct {
	Timestamp time.Time `json:"timestamp"`
	Channel   string    `json:"channel"`
	ValueRaw  float64   `json:"value"`
	Unit      string    `json:"unit"`
}

// Buffer is a fixed-capacity ring buffer of events. Concurrency-safe.
type Buffer struct {
	mu    sync.RWMutex
	max   int
	items []Event
}

// NewBuffer returns a buffer that retains the most recent `max` events.
func NewBuffer(max int) *Buffer {
	if max <= 0 {
		max = 1024
	}
	return &Buffer{max: max, items: make([]Event, 0, max)}
}

// Append records an event, dropping the oldest when full.
func (b *Buffer) Append(e Event) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if len(b.items) >= b.max {
		copy(b.items, b.items[1:])
		b.items = b.items[:len(b.items)-1]
	}
	b.items = append(b.items, e)
}

// Snapshot returns a copy of the events currently retained, oldest first.
func (b *Buffer) Snapshot() []Event {
	b.mu.RLock()
	defer b.mu.RUnlock()
	out := make([]Event, len(b.items))
	copy(out, b.items)
	return out
}

// Len returns the number of retained events.
func (b *Buffer) Len() int {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return len(b.items)
}
