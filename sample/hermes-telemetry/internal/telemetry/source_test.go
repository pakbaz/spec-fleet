package telemetry

import (
	"context"
	"testing"
	"time"
)

func TestBufferRingBehaviour(t *testing.T) {
	b := NewBuffer(3)
	for i := 0; i < 5; i++ {
		b.Append(Event{Channel: "voltage", ValueRaw: float64(i)})
	}
	if b.Len() != 3 {
		t.Fatalf("expected 3 retained events, got %d", b.Len())
	}
	snap := b.Snapshot()
	// the oldest two should have been dropped (0, 1) → retained 2, 3, 4.
	if snap[0].ValueRaw != 2 || snap[2].ValueRaw != 4 {
		t.Fatalf("unexpected ring contents: %+v", snap)
	}
}

func TestSyntheticEmitsEventsForEachChannel(t *testing.T) {
	buf := NewBuffer(64)
	gen := NewSynthetic([]string{"voltage", "current"}, 5*time.Millisecond, 42)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Millisecond)
	defer cancel()
	emitted := gen.Run(ctx, buf)
	if emitted == 0 {
		t.Fatal("expected at least one tick to fire")
	}
	if emitted%2 != 0 {
		t.Fatalf("emitted should be a multiple of channel count, got %d", emitted)
	}
	for _, e := range buf.Snapshot() {
		if e.Unit == "" {
			t.Errorf("event %+v has no unit", e)
		}
	}
}
