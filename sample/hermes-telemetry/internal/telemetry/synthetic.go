package telemetry

import (
	"context"
	"math"
	"math/rand"
	"time"
)

// Synthetic is a deterministic-ish event generator used when no real upstream
// is available. The brownfield demo wires it up by default so the dashboard
// has something to render out of the box.
type Synthetic struct {
	Channels []string
	Period   time.Duration
	rng      *rand.Rand
}

// NewSynthetic returns a generator emitting `period`-spaced events on each
// of the provided channels.
func NewSynthetic(channels []string, period time.Duration, seed int64) *Synthetic {
	if len(channels) == 0 {
		channels = []string{"voltage", "current", "temperature"}
	}
	if period <= 0 {
		period = 250 * time.Millisecond
	}
	return &Synthetic{
		Channels: channels,
		Period:   period,
		rng:      rand.New(rand.NewSource(seed)),
	}
}

// Run emits events into `buf` until the context is cancelled. Returns the
// total number of events emitted, which is convenient for testing.
func (s *Synthetic) Run(ctx context.Context, buf *Buffer) int {
	t := time.NewTicker(s.Period)
	defer t.Stop()
	count := 0
	tick := 0
	for {
		select {
		case <-ctx.Done():
			return count
		case now := <-t.C:
			for _, ch := range s.Channels {
				buf.Append(Event{
					Timestamp: now,
					Channel:   ch,
					ValueRaw:  s.sample(ch, tick),
					Unit:      unitFor(ch),
				})
				count++
			}
			tick++
		}
	}
}

func (s *Synthetic) sample(ch string, tick int) float64 {
	base := math.Sin(float64(tick)/12) * 1.5
	jitter := s.rng.Float64()*0.4 - 0.2
	switch ch {
	case "voltage":
		return 12.0 + base + jitter
	case "current":
		return 2.4 + base*0.1 + jitter*0.05
	case "temperature":
		return 20.0 + base*2 + jitter
	default:
		return base + jitter
	}
}

func unitFor(ch string) string {
	switch ch {
	case "voltage":
		return "V"
	case "current":
		return "A"
	case "temperature":
		return "°C"
	default:
		return ""
	}
}
