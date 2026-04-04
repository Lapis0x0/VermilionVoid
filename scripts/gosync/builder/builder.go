package builder

import (
	"gosync/config"
	"log"
	"os/exec"
)

func runCommand(dir string, name string, args ...string) error {
	cmd := exec.Command(name, args...)
	cmd.Dir = dir
	output, err := cmd.CombinedOutput()
	if err != nil {
		log.Printf("Command '%s %v' failed: %v\nOutput: %s\n", name, args, err, string(output))
		return err
	}
	return nil
}

func PushToGit(cfg *config.Config) error {
	log.Println("Starting Git Push process to 'deploy' branch...")

	if err := runCommand(cfg.ProjectRootDir, "git", "fetch", "origin"); err != nil {
		return err
	}
	if err := runCommand(cfg.ProjectRootDir, "git", "checkout", "deploy"); err != nil {
		if err2 := runCommand(cfg.ProjectRootDir, "git", "checkout", "-B", "deploy", "origin/deploy"); err2 != nil {
			return err2
		}
	}

	err := runCommand(cfg.ProjectRootDir, "git", "add", "src/content/posts/")
	if err != nil {
		return err
	}

	err = runCommand(cfg.ProjectRootDir, "git", "commit", "-m", "Auto sync Obsidian posts & generate AI frontmatter")
	if err != nil {
		// It's possible there are no changes to commit.
		log.Println("Git commit returned error (possibly no changes). Proceeding anyway.")
	}

	// 远端可能已有新提交（例如 GitHub 上合并）；先 rebase 再推，避免 non-fast-forward
	err = runCommand(cfg.ProjectRootDir, "git", "pull", "--rebase", "origin", "deploy")
	if err != nil {
		return err
	}

	err = runCommand(cfg.ProjectRootDir, "git", "push", "origin", "deploy")
	if err != nil {
		// 并发同步或远端恰有新提交时，再拉一次后重试推一次
		log.Println("Push rejected, retrying after fetch + pull --rebase...")
		if err2 := runCommand(cfg.ProjectRootDir, "git", "fetch", "origin"); err2 != nil {
			return err2
		}
		if err2 := runCommand(cfg.ProjectRootDir, "git", "pull", "--rebase", "origin", "deploy"); err2 != nil {
			return err2
		}
		if err2 := runCommand(cfg.ProjectRootDir, "git", "push", "origin", "deploy"); err2 != nil {
			return err2
		}
	}

	log.Println("Successfully pushed to deploy branch!")
	return nil
}
