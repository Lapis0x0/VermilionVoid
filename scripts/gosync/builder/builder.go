package builder

import (
	"gosync/config"
	"log"
	"os/exec"
	"strings"
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

func gitWorktreeDirty(dir string) bool {
	cmd := exec.Command("git", "status", "--porcelain")
	cmd.Dir = dir
	out, err := cmd.Output()
	if err != nil {
		return true
	}
	return len(strings.TrimSpace(string(out))) > 0
}

func PushToGit(cfg *config.Config) error {
	log.Println("PushToGit: fetch/checkout → add posts → commit → stash-if-dirty → pull --rebase → push (with retry)")

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

	// 未暂存的本地修改（如你在服务器上改过 scripts/gosync）会阻止 pull/rebase，先 stash
	stashed := false
	if gitWorktreeDirty(cfg.ProjectRootDir) {
		log.Println("Worktree has unstaged/untracked changes; stashing before pull --rebase")
		if err := runCommand(cfg.ProjectRootDir, "git", "stash", "push", "-u", "-m", "gosync:auto"); err != nil {
			log.Printf("git stash failed: %v\n", err)
			return err
		}
		stashed = true
	}
	if stashed {
		defer func() {
			if err := runCommand(cfg.ProjectRootDir, "git", "stash", "pop"); err != nil {
				log.Printf("git stash pop failed (请在本机 git stash list 查看): %v\n", err)
			}
		}()
	}

	// 远端可能已有新提交（例如 GitHub 上合并）；先 rebase 再推，避免 non-fast-forward
	err = runCommand(cfg.ProjectRootDir, "git", "pull", "--rebase", "origin", "deploy")
	if err != nil {
		return err
	}
	log.Println("git pull --rebase origin deploy: ok")

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
