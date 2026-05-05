package main

import (
	"context"
	"flag"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/specfleet-samples/hermes-telemetry/internal/dashboard"
	"github.com/specfleet-samples/hermes-telemetry/internal/telemetry"
)

const indexHTML = `<!doctype html>
<meta charset="utf-8">
<title>Hermes telemetry — read-only dashboard</title>
<style>
  body{font-family:system-ui,sans-serif;margin:2rem;color:#222;background:#fafafa}
  h1{margin-top:0}
  table{border-collapse:collapse;width:100%}
  th,td{border:1px solid #ddd;padding:.4rem .6rem;text-align:left;font-variant-numeric:tabular-nums}
  th{background:#eee}
  small{color:#666}
</style>
<h1>Hermes telemetry</h1>
<small id="status">connecting…</small>
<table id="events"><thead><tr><th>time</th><th>channel</th><th>value</th><th>unit</th></tr></thead><tbody></tbody></table>
<script>
async function tick(){
  try{
    const r = await fetch('/api/events',{credentials:'same-origin'});
    if(!r.ok){ document.getElementById('status').textContent='HTTP '+r.status; return; }
    const j = await r.json();
    const tbody = document.querySelector('#events tbody');
    tbody.innerHTML = j.events.slice(-50).reverse().map(e =>
      '<tr><td>'+new Date(e.timestamp).toISOString()+'</td><td>'+e.channel+'</td><td>'+e.value.toFixed(3)+'</td><td>'+e.unit+'</td></tr>'
    ).join('');
    document.getElementById('status').textContent = j.events.length+' events buffered';
  }catch(err){
    document.getElementById('status').textContent = 'error: '+err.message;
  }
}
tick(); setInterval(tick, 1000);
</script>
`

func main() {
	addr := flag.String("addr", ":8080", "listen address")
	originList := flag.String("allowed-origins", "http://localhost:8080,http://127.0.0.1:8080", "comma-separated allow-list of dashboard origins")
	flag.Parse()

	buf := telemetry.NewBuffer(2048)
	gen := telemetry.NewSynthetic(nil, 250*time.Millisecond, time.Now().UnixNano())

	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()
	go gen.Run(ctx, buf)

	allowed := strings.Split(*originList, ",")
	h := dashboard.New(buf, []byte(indexHTML), allowed)

	srv := &http.Server{
		Addr:              *addr,
		Handler:           h,
		ReadHeaderTimeout: 5 * time.Second,
	}
	go func() {
		<-ctx.Done()
		shutdownCtx, c := context.WithTimeout(context.Background(), 5*time.Second)
		defer c()
		_ = srv.Shutdown(shutdownCtx)
	}()
	log.Printf("hermes telemetry dashboard listening on %s (origins: %s)", *addr, *originList)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
}
