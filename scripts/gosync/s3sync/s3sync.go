package s3sync

import (
	"context"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"gosync/config"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type S3Syncer struct {
	client        *s3.Client
	cfg           *config.Config
	downloadCount int
}

func NewS3Syncer(cfg *config.Config) (*S3Syncer, error) {
	customResolver := aws.EndpointResolverWithOptionsFunc(func(service, region string, options ...interface{}) (aws.Endpoint, error) {
		return aws.Endpoint{
			URL:           cfg.S3Endpoint,
			SigningRegion: cfg.S3Region,
		}, nil
	})

	awsCfg, err := awsconfig.LoadDefaultConfig(context.TODO(),
		awsconfig.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(cfg.S3AccessKey, cfg.S3SecretKey, "")),
		awsconfig.WithRegion(cfg.S3Region),
		awsconfig.WithEndpointResolverWithOptions(customResolver),
	)
	if err != nil {
		return nil, err
	}

	client := s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		o.UsePathStyle = true
	})

	return &S3Syncer{
		client: client,
		cfg:    cfg,
	}, nil
}

func (s *S3Syncer) SyncArticles() error {
	s.downloadCount = 0
	ctx := context.TODO()

	os.MkdirAll(s.cfg.LocalPostsDir, os.ModePerm)

	log.Printf("Starting sync from %s/%s to %s\n", s.cfg.S3BucketName, s.cfg.S3Prefix, s.cfg.LocalPostsDir)

	// 桶内当前存在的 .md 文件名（basename），用于删除已在 Obsidian/S3 侧移除的本地副本
	remoteMD := make(map[string]struct{})

	paginator := s3.NewListObjectsV2Paginator(s.client, &s3.ListObjectsV2Input{
		Bucket: aws.String(s.cfg.S3BucketName),
		Prefix: aws.String(s.cfg.S3Prefix),
	})

	for paginator.HasMorePages() {
		page, err := paginator.NextPage(ctx)
		if err != nil {
			return fmt.Errorf("failed to list objects: %w", err)
		}

		for _, obj := range page.Contents {
			key := aws.ToString(obj.Key)
			if !strings.HasSuffix(key, ".md") {
				continue
			}

			filename := filepath.Base(key)
			remoteMD[filename] = struct{}{}
			localPath := filepath.Join(s.cfg.LocalPostsDir, filename)
			s3MTime := obj.LastModified

			if fileInfo, err := os.Stat(localPath); err == nil {
				localMTime := fileInfo.ModTime()
				if !s3MTime.After(localMTime) {
					continue // Local is newer or equal
				}

				log.Printf("[%s] ♻️  Updating...\n", filename)
				s.downloadAndMerge(ctx, key, localPath)
			} else {
				log.Printf("[%s] 🆕 Downloading new article...\n", filename)
				s.downloadFile(ctx, key, localPath)
			}
		}
	}

	removed := 0
	entries, err := os.ReadDir(s.cfg.LocalPostsDir)
	if err != nil {
		return fmt.Errorf("read posts dir: %w", err)
	}
	for _, e := range entries {
		if e.IsDir() || !strings.EqualFold(filepath.Ext(e.Name()), ".md") {
			continue
		}
		name := e.Name()
		if _, ok := remoteMD[name]; ok {
			continue
		}
		p := filepath.Join(s.cfg.LocalPostsDir, name)
		log.Printf("[%s] 🗑️  Removing (no longer under S3 prefix)...\n", name)
		if err := os.Remove(p); err != nil {
			log.Printf("remove %s: %v\n", name, err)
			continue
		}
		removed++
	}

	log.Printf("Sync completed. Downloaded/updated %d, removed locally %d.\n", s.downloadCount, removed)
	return nil
}

func extractFrontmatter(content string) (fm string, body string) {
	trimmed := strings.TrimLeft(content, " \t\r\n")
	if strings.HasPrefix(trimmed, "---") {
		parts := strings.SplitN(trimmed, "---", 3)
		if len(parts) >= 3 {
			fm = "---" + parts[1] + "---"
			body = strings.TrimLeft(parts[2], " \t\r\n")
			return
		}
	}
	return "", content
}

func (s *S3Syncer) downloadAndMerge(ctx context.Context, key, localPath string) {
	localContentBytes, _ := os.ReadFile(localPath)
	existingFm, _ := extractFrontmatter(string(localContentBytes))

	tempPath := localPath + ".tmp"
	err := s.downloadFileImpl(ctx, key, tempPath)
	if err != nil {
		log.Printf("Failed to download %s: %v\n", key, err)
		return
	}
	defer os.Remove(tempPath)

	newContentBytes, _ := os.ReadFile(tempPath)
	newFm, newBody := extractFrontmatter(string(newContentBytes))

	var finalContent string
	if newFm != "" {
		finalContent = newFm + "\n\n" + newBody
	} else if existingFm != "" {
		finalContent = existingFm + "\n\n" + newBody
	} else {
		finalContent = newBody
	}

	os.WriteFile(localPath, []byte(finalContent), 0644)
	s.downloadCount++
}

func (s *S3Syncer) downloadFile(ctx context.Context, key, localPath string) {
	err := s.downloadFileImpl(ctx, key, localPath)
	if err != nil {
		log.Printf("Failed to download %s: %v\n", key, err)
	} else {
		s.downloadCount++
	}
}

func (s *S3Syncer) downloadFileImpl(ctx context.Context, key, dest string) error {
	out, err := s.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.cfg.S3BucketName),
		Key:    aws.String(key),
	})
	if err != nil {
		return err
	}
	defer out.Body.Close()

	file, err := os.Create(dest)
	if err != nil {
		return err
	}
	defer file.Close()

	_, err = io.Copy(file, out.Body)
	// Apply S3 modification time
	if out.LastModified != nil {
		os.Chtimes(dest, time.Now(), *out.LastModified)
	}

	return err
}
