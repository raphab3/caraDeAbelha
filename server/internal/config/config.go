package config

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	HTTPPort        string
	ReadTimeout     time.Duration
	WriteTimeout    time.Duration
	IdleTimeout     time.Duration
	ShutdownTimeout time.Duration
}

func Load() Config {
	return Config{
		HTTPPort:        readString("SERVER_PORT", "8080"),
		ReadTimeout:     readDurationSeconds("SERVER_READ_TIMEOUT_SECONDS", 10),
		WriteTimeout:    readDurationSeconds("SERVER_WRITE_TIMEOUT_SECONDS", 10),
		IdleTimeout:     readDurationSeconds("SERVER_IDLE_TIMEOUT_SECONDS", 60),
		ShutdownTimeout: readDurationSeconds("SERVER_SHUTDOWN_TIMEOUT_SECONDS", 10),
	}
}

func readString(key string, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}

	return value
}

func readDurationSeconds(key string, fallback int) time.Duration {
	value := os.Getenv(key)
	if value == "" {
		return time.Duration(fallback) * time.Second
	}

	seconds, err := strconv.Atoi(value)
	if err != nil {
		return time.Duration(fallback) * time.Second
	}

	return time.Duration(seconds) * time.Second
}
