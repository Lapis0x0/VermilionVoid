package ai

import (
	"context"
	"strings"

	openai "github.com/sashabaranov/go-openai"
)

const defaultChatOutputLimit = 500

// CreateChatCompletionCompat 兼容两类 OpenAI 兼容接口：
// 1) 新模型 / 网关只接受 max_completion_tokens；
// 2) 旧接口只接受 max_tokens。
// 优先发 max_completion_tokens，若上游明确不支持再回退 max_tokens。
func CreateChatCompletionCompat(ctx context.Context, client *openai.Client, req openai.ChatCompletionRequest, outputLimit int) (openai.ChatCompletionResponse, error) {
	if outputLimit <= 0 {
		outputLimit = defaultChatOutputLimit
	}

	req.MaxTokens = 0
	req.MaxCompletionTokens = outputLimit
	resp, err := client.CreateChatCompletion(ctx, req)
	if err == nil {
		return resp, nil
	}
	if shouldFallbackToMaxTokens(err) {
		req.MaxCompletionTokens = 0
		req.MaxTokens = outputLimit
		return client.CreateChatCompletion(ctx, req)
	}
	return resp, err
}

func shouldFallbackToMaxTokens(err error) bool {
	e := strings.ToLower(err.Error())
	// 明确要求不要用 max_tokens、改用 max_completion：不应回退
	if strings.Contains(e, "maxtokens") && strings.Contains(e, "maxcompletion") {
		return false
	}
	if strings.Contains(e, "max_tokens") && strings.Contains(e, "max_completion_tokens") && strings.Contains(e, "use") {
		return false
	}
	if strings.Contains(e, "max_completion_tokens") {
		if strings.Contains(e, "not support") || strings.Contains(e, "not supported") ||
			strings.Contains(e, "unknown") || strings.Contains(e, "unexpected") ||
			strings.Contains(e, "invalid") && strings.Contains(e, "parameter") ||
			strings.Contains(e, "extra fields") || strings.Contains(e, "unrecognized") {
			return true
		}
	}
	return false
}
