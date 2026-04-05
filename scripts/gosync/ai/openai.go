package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"gosync/config"

	openai "github.com/sashabaranov/go-openai"
)

var (
	reYAMLTitle     = regexp.MustCompile(`(?m)^title:\s*\S`)
	reYAMLPublished = regexp.MustCompile(`(?m)^published:\s*\S`)
)

// splitFrontmatter 解析首块 YAML（以首行 --- 与下一个换行后的 --- 为界）。
func splitFrontmatter(s string) (fmBlock, body string, ok bool) {
	s = strings.TrimLeft(s, " \t\r\n")
	if !strings.HasPrefix(s, "---") {
		return "", s, false
	}
	rest := s[3:]
	idx := strings.Index(rest, "\n---")
	if idx == -1 {
		return "", s, false
	}
	fmBlock = strings.TrimSpace(rest[:idx])
	body = strings.TrimSpace(rest[idx+4:])
	return fmBlock, body, true
}

func hasCompleteAstroFrontmatter(fmBlock string) bool {
	return reYAMLTitle.MatchString(fmBlock) && reYAMLPublished.MatchString(fmBlock)
}

type Generator struct {
	client *openai.Client
	cfg    *config.Config
}

func NewGenerator(cfg *config.Config) *Generator {
	clientConfig := openai.DefaultConfig(cfg.AIApiKey)
	clientConfig.BaseURL = cfg.AIBaseURL
	return &Generator{
		client: openai.NewClientWithConfig(clientConfig),
		cfg:    cfg,
	}
}

func (g *Generator) ProcessMissingFrontmatters() error {
	files, err := os.ReadDir(g.cfg.LocalPostsDir)
	if err != nil {
		return err
	}

	for _, file := range files {
		if file.IsDir() || !strings.HasSuffix(file.Name(), ".md") {
			continue
		}

		path := filepath.Join(g.cfg.LocalPostsDir, file.Name())
		contentBytes, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		content := string(contentBytes)
		trimmed := strings.TrimLeft(content, " \t\r\n")

		fmBlock, body, hasFM := splitFrontmatter(trimmed)
		if hasFM && hasCompleteAstroFrontmatter(fmBlock) {
			continue
		}

		bodyForAI := trimmed
		if hasFM {
			bodyForAI = body
			if strings.TrimSpace(bodyForAI) == "" {
				bodyForAI = trimmed
			}
		}

		if g.cfg.AIApiKey == "" {
			log.Printf("[%s] 补全默认 frontmatter（未配置 AI_API_KEY）\n", file.Name())
			fmString := buildFmString(&FMResponse{}, file.Name(), path)
			finalContent := fmString + "\n\n" + strings.TrimSpace(bodyForAI)
			if err := os.WriteFile(path, []byte(finalContent), 0644); err != nil {
				log.Printf("write %s: %v\n", file.Name(), err)
			}
			continue
		}

		log.Printf("[%s] 🤖 Processing with AI...\n", file.Name())
		fmData, err := g.generateFrontmatter(file.Name(), bodyForAI)
		if err != nil {
			log.Printf("AI generation failed for %s: %v\n", file.Name(), err)
			continue
		}

		fmString := buildFmString(fmData, file.Name(), path)
		finalContent := fmString + "\n\n" + strings.TrimSpace(bodyForAI)
		if err := os.WriteFile(path, []byte(finalContent), 0644); err != nil {
			log.Printf("write %s: %v\n", file.Name(), err)
		}
	}

	return nil
}

type FMResponse struct {
	Description string   `json:"description"`
	Category    string   `json:"category"`
	Tags        []string `json:"tags"`
}

func (g *Generator) generateFrontmatter(filename, content string) (*FMResponse, error) {
	snippet := content
	if len(snippet) > 6000 {
		snippet = snippet[:6000]
	}

	userPrompt := fmt.Sprintf(userPromptFrontmatterFmt, filename, snippet)

	resp, err := CreateChatCompletionCompat(
		context.TODO(),
		g.client,
		openai.ChatCompletionRequest{
			Model: g.cfg.AIModel,
			Messages: []openai.ChatCompletionMessage{
				{Role: openai.ChatMessageRoleSystem, Content: systemPromptFrontmatter},
				{Role: openai.ChatMessageRoleUser, Content: userPrompt},
			},
			// 不传 temperature / top_p 等：部分 beta/网关模型要求这些参数固定，传 0.3 会整请求被拒。
		},
		defaultChatOutputLimit,
	)
	if err != nil {
		return nil, err
	}

	reply := strings.TrimSpace(resp.Choices[0].Message.Content)
	reply = strings.ReplaceAll(reply, "```json", "")
	reply = strings.ReplaceAll(reply, "```", "")

	start := strings.Index(reply, "{")
	end := strings.LastIndex(reply, "}")
	if start != -1 && end != -1 {
		reply = reply[start : end+1]
	}

	var data FMResponse
	if err := json.Unmarshal([]byte(reply), &data); err != nil {
		return nil, fmt.Errorf("JSON parse error: %w", err)
	}

	return &data, nil
}

func buildFmString(data *FMResponse, filename, fullPath string) string {
	title := strings.TrimSuffix(filename, ".md")
	title = strings.ReplaceAll(title, "\"", "\\\"")
	desc := strings.ReplaceAll(data.Description, "\"", "\\\"")

	tagsJSON, err := json.Marshal(data.Tags)
	if err != nil || string(tagsJSON) == "null" {
		tagsJSON = []byte("[]")
	}

	published := time.Now()
	if info, err := os.Stat(fullPath); err == nil {
		published = info.ModTime()
	}

	lines := []string{
		"---",
		fmt.Sprintf(`title: "%s"`, title),
		fmt.Sprintf(`published: %s`, published.Format("2006-01-02T15:04:05.000Z")),
		fmt.Sprintf(`description: "%s"`, desc),
		fmt.Sprintf(`category: "%s"`, data.Category),
		fmt.Sprintf(`tags: %s`, string(tagsJSON)),
		"---",
	}

	return strings.Join(lines, "\n")
}
