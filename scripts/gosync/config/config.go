package config

import (
	"log"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"github.com/joho/godotenv"
)

// defaultAIBaseURL 须与 go-openai 约定一致：库会拼接 “/chat/completions”。
const defaultAIBaseURL = "https://api.openai.com/v1"

// CleanEnvString 去掉 BOM、首尾空格及成对引号（systemd / 手写 .env 常把整段值包在引号里）。
func CleanEnvString(s string) string {
	s = strings.TrimSpace(s)
	s = strings.TrimPrefix(s, "\ufeff")
	if len(s) >= 2 {
		f, l := s[0], s[len(s)-1]
		if (f == '"' && l == '"') || (f == '\'' && l == '\'') {
			s = strings.TrimSpace(s[1 : len(s)-1])
		}
	}
	return strings.TrimSpace(s)
}

// NormalizeAIBaseURL 修正常见 .env 错误（首尾空格、多余尾斜杠、只填域名漏 /v1），
// 避免上游返回 “Invalid URL (POST /v1)” 一类 404。
func NormalizeAIBaseURL(raw string) string {
	s := CleanEnvString(raw)
	if s == "" {
		return defaultAIBaseURL
	}
	s = strings.TrimRight(s, "/")
	u, err := url.Parse(s)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		log.Printf("AI_BASE_URL 无效 %q，已回退为 %s", raw, defaultAIBaseURL)
		return defaultAIBaseURL
	}
	if u.Path == "" || u.Path == "/" {
		u.Path = "/v1"
	}
	return strings.TrimRight(u.String(), "/")
}

type Config struct {
	S3Endpoint     string
	S3Region       string
	S3AccessKey    string
	S3SecretKey    string
	S3BucketName   string
	S3Prefix       string
	AIApiKey       string
	AIBaseURL      string
	AIModel        string
	WebhookSecret  string
	LocalPostsDir  string
	ProjectRootDir string
}

func LoadConfig() *Config {
	rootDir := "."
	if _, err := os.Stat(".env"); os.IsNotExist(err) {
		rootDir = "../.."
	}

	envPath := filepath.Join(rootDir, ".env")
	// systemd 的 EnvironmentFile 会在进程启动时先写入环境变量；godotenv.Load 不会覆盖已有变量，
	// 导致磁盘上 .env 的修正永远不生效，且 systemd 对行尾注释、引号的解析与 dotenv 不一致时会出现
	// AI_BASE_URL 损坏（上游报 Invalid URL POST /v1）。Overload 以文件为准覆盖。
	err := godotenv.Overload(envPath)
	if err != nil {
		log.Println("Note: .env file not loaded, using system environment variables only")
	}

	return &Config{
		S3Endpoint:     GetEnvOrDefault("S3_ENDPOINT", "https://s3.cn-north-1.qiniucs.com"),
		S3Region:       GetEnvOrDefault("S3_REGION", "cn-north-1"),
		S3AccessKey:    os.Getenv("S3_ACCESS_KEY"),
		S3SecretKey:    os.Getenv("S3_SECRET_KEY"),
		S3BucketName:   os.Getenv("S3_BUCKET_NAME"),
		S3Prefix:       GetEnvOrDefault("S3_PREFIX", "website/"),
		AIApiKey:       CleanEnvString(os.Getenv("AI_API_KEY")),
		AIBaseURL:      NormalizeAIBaseURL(envCleanOrDefault("AI_BASE_URL", defaultAIBaseURL)),
		AIModel:        envCleanOrDefault("AI_MODEL", "gpt-4o-mini"),
		WebhookSecret:  os.Getenv("WEBHOOK_SECRET"),
		LocalPostsDir:  filepath.Join(rootDir, "src", "content", "posts"),
		ProjectRootDir: rootDir,
	}
}

func GetEnvOrDefault(key, def string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return def
}

func envCleanOrDefault(key, def string) string {
	v := CleanEnvString(os.Getenv(key))
	if v == "" {
		return def
	}
	return v
}
