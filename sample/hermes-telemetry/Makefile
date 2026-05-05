.PHONY: build test vet run

build:
	go build -o bin/hermesd ./cmd/hermesd

test:
	go test ./...

vet:
	go vet ./...

run:
	go run ./cmd/hermesd
