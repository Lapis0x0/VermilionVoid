package main

import (
	"encoding/json"
	"log"
	"net/http"

	"gosync/ai"
	"gosync/builder"
	"gosync/config"
	"gosync/s3sync"
)

type StatusResponse struct {
	Status  string `json:"status"`
	Message string `json:"message"`
}

func main() {
	cfg := config.LoadConfig()

	syncer, err := s3sync.NewS3Syncer(cfg)
	if err != nil {
		log.Fatalf("Failed to initialize S3 syncer: %v", err)
	}

	aiGenerator := ai.NewGenerator(cfg)
	if cfg.AIApiKey != "" {
		log.Printf("AI: 使用 BaseURL=%s Model=%s（密钥已配置）\n", cfg.AIBaseURL, cfg.AIModel)
	}

	http.HandleFunc("/api/sync", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		if cfg.WebhookSecret != "" {
			reqToken := r.Header.Get("Authorization")
			expected := "Bearer " + cfg.WebhookSecret
			if reqToken == "" || reqToken != expected {
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}
		}

		// Response immediately
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusAccepted)
		json.NewEncoder(w).Encode(StatusResponse{
			Status:  "accepted",
			Message: "Sync task has been queued and is running in the background.",
		})

		go runSyncPipeline(cfg, syncer, aiGenerator)
	})

	port := config.GetEnvOrDefault("PORT", "3001")
	log.Printf("Sync API server is listening on port %s...\n", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatal(err)
	}
}

func runSyncPipeline(cfg *config.Config, syncer *s3sync.S3Syncer, gen *ai.Generator) {
	log.Println(">> Pipeline Start: Syncing from S3")
	syncer.SyncArticles()

	log.Println(">> Pipeline Step: Generating AI Frontmatters")
	gen.ProcessMissingFrontmatters()

	log.Println(">> Pipeline Step: Pushing to Git Deploy Branch")
	if err := builder.PushToGit(cfg); err != nil {
		log.Printf(">> Git push step failed: %v\n", err)
		return
	}

	log.Println(">> Pipeline Complete")
}
