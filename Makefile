SHELL := /usr/bin/env bash

REMOTE := trion-org
.DEFAULT_GOAL := help

GREEN  := \033[0;32m
BLUE   := \033[0;34m
YELLOW := \033[0;33m
NC     := \033[0m

.PHONY: help init preview git-sync

help:
	@current_branch="$$(git branch --show-current 2>/dev/null)"; \
	printf "$(BLUE)%s$(NC)\n" "Git Sync Commands"; \
	printf "\n"; \
	printf "%s\n" "Current branch: $${current_branch:-<unknown>}"; \
	printf "%s\n" "Remote: $(REMOTE)"; \
	printf "\n"; \
	printf "$(YELLOW)%s$(NC)\n" "Available targets:"; \
	printf "%s\n" "  make          - Show this help message"; \
	printf "%s\n" "  make init     - Fetch remote and checkout the expected branch in each repo"; \
	printf "%s\n" "  make preview  - Print the git commands that would run on the current branch"; \
	printf "%s\n" "  make git-sync - Run add -> commit(timestamp) -> pull --rebase(if remote branch exists) -> push"; \
	printf "\n"

init:
	@set -e; \
	ensure_checkout() { \
		repo_path="$$1"; \
		branch_name="$$2"; \
		if [ -d "$$repo_path/.git" ]; then \
			echo "Checking out $$branch_name in $$repo_path"; \
			git -C "$$repo_path" fetch "$(REMOTE)" >/dev/null 2>&1 || git -C "$$repo_path" fetch "$(REMOTE)"; \
			if git -C "$$repo_path" ls-remote --exit-code --heads "$(REMOTE)" "$$branch_name" >/dev/null 2>&1; then \
				git -C "$$repo_path" checkout -B "$$branch_name" "$(REMOTE)/$$branch_name"; \
			else \
				git -C "$$repo_path" checkout "$$branch_name"; \
			fi; \
		elif [ -z "$$(ls -A "$$repo_path" 2>/dev/null)" ]; then \
			echo "Cloning $$branch_name into $$repo_path"; \
			git clone --branch "$$branch_name" --single-branch "$$(git remote get-url "$(REMOTE)")" "$$repo_path"; \
		else \
			echo "Skipping $$repo_path: exists and is not empty, but not a git repository."; \
			exit 1; \
		fi; \
	}; \
	ensure_checkout "." "develop"; \
	ensure_checkout "vscode-database-client" "explore/vscode-database-client"; \
	ensure_checkout "zandbox" "chore/zandbox"; \
	ensure_checkout "zed-editor" "explore/zed-editor"

preview:
	@current_branch="$$(git branch --show-current 2>/dev/null)"; \
	if [ -z "$$current_branch" ]; then \
		echo "Could not detect the current branch."; \
		exit 1; \
	fi; \
	echo "Using branch $$current_branch"; \
	echo "git add -A"; \
		if [ -n "$$(git status --porcelain)" ]; then \
		echo "git commit -m \"$$(date '+%Y-%m-%d %H:%M:%S %z')\""; \
	else \
		echo "# No changes to commit."; \
	fi; \
	if git ls-remote --exit-code --heads "$(REMOTE)" "$$current_branch" >/dev/null 2>&1; then \
		echo "git pull --rebase \"$(REMOTE)\" \"$$current_branch\""; \
	else \
		echo "# Remote branch $(REMOTE)/$$current_branch does not exist yet. pull --rebase will be skipped."; \
	fi; \
	echo "git push -u \"$(REMOTE)\" \"$$current_branch\""

git-sync:
	@set -e; \
	sync_repo() { \
		repo_path="$$1"; \
		branch_name="$$2"; \
		if [ ! -d "$$repo_path/.git" ]; then \
			echo "Skipping $$repo_path: not a git repository."; \
			return 0; \
		fi; \
		echo "Syncing $$repo_path on branch $$branch_name"; \
		git -C "$$repo_path" add -A; \
		if ! git -C "$$repo_path" diff --cached --quiet; then \
			git -C "$$repo_path" commit -m "$$(date '+%Y-%m-%d %H:%M:%S %z')"; \
		else \
			echo "No staged changes to commit in $$repo_path."; \
		fi; \
		if git -C "$$repo_path" ls-remote --exit-code --heads "$(REMOTE)" "$$branch_name" >/dev/null 2>&1; then \
			git -C "$$repo_path" pull --rebase "$(REMOTE)" "$$branch_name"; \
		else \
			echo "Remote branch $(REMOTE)/$$branch_name does not exist yet. Skipping pull --rebase for $$repo_path."; \
		fi; \
		git -C "$$repo_path" push -u "$(REMOTE)" "$$branch_name"; \
	}; \
	sync_repo "." "develop"; \
	sync_repo "vscode-database-client" "explore/vscode-database-client"; \
	sync_repo "zandbox" "chore/zandbox"; \
	sync_repo "zed-editor" "explore/zed-editor"
