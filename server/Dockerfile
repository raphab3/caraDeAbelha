FROM golang:1.24-alpine3.22 AS builder

WORKDIR /app

COPY go.mod ./
RUN go mod download

COPY . .
RUN go test ./...
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /bin/cara-de-abelha-server ./cmd/server

FROM alpine:3.22

RUN apk add --no-cache ca-certificates

COPY --from=builder /bin/cara-de-abelha-server /usr/local/bin/cara-de-abelha-server

EXPOSE 8080

ENTRYPOINT ["cara-de-abelha-server"]