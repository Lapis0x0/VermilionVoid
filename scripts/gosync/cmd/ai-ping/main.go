// ai-ping：加载与 gosync 相同的 .env，发一条最小 Chat Completions 请求检测 AI 是否可达。
package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"

	"gosync/ai"
	"gosync/config"

	openai "github.com/sashabaranov/go-openai"
)

func chdirToEnvRoot() {
	wd, err := os.Getwd()
	if err != nil {
		log.Fatal(err)
	}
	dir := wd
	for range 10 {
		if _, err := os.Stat(filepath.Join(dir, ".env")); err == nil {
			if err := os.Chdir(dir); err != nil {
				log.Fatal(err)
			}
			return
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	log.Fatal("未找到 .env：请在仓库根目录执行，或先 cd 到含 .env 的目录")
}

func main() {
	chdirToEnvRoot()
	cfg := config.LoadConfig()

	if cfg.AIApiKey == "" {
		log.Fatal("AI_API_KEY 为空，请在 .env 中配置")
	}

	clientCfg := openai.DefaultConfig(cfg.AIApiKey)
	clientCfg.BaseURL = cfg.AIBaseURL
	client := openai.NewClientWithConfig(clientCfg)

	fmt.Printf("使用 BaseURL=%s Model=%s（密钥已隐藏）\n", cfg.AIBaseURL, cfg.AIModel)

	resp, err := ai.CreateChatCompletionCompat(
		context.Background(),
		client,
		openai.ChatCompletionRequest{
			Model: cfg.AIModel,
			Messages: []openai.ChatCompletionMessage{
				{Role: openai.ChatMessageRoleUser, Content: "只回复一个字：好"},
			},
		},
		8,
	)
	if err != nil {
		log.Fatalf("请求失败: %v", err)
	}
	if len(resp.Choices) == 0 {
		log.Fatal("响应无 choices")
	}
	text := resp.Choices[0].Message.Content
	fmt.Println("连通性 OK，模型回复:", text)
}
