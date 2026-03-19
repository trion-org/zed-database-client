SHELL := /usr/bin/env bash

BRANCH := explore/vscode-database-client
REMOTE := trion-org
TIMESTAMP_FMT := +%Y-%m-%d\ %H:%M:%S\ %z
.DEFAULT_GOAL := git-sync

.PHONY: git-sync git-branch

git-branch:
	@current_branch="$$(git branch --show-current 2>/dev/null)"; \
	if [ "$$current_branch" = "$(BRANCH)" ]; then \
		echo "Already on $(BRANCH)"; \
	elif git show-ref --verify --quiet "refs/heads/$(BRANCH)"; then \
		git switch "$(BRANCH)"; \
	else \
		git switch -c "$(BRANCH)"; \
	fi

git-sync: git-branch
	@git add -A
	@if ! git diff --cached --quiet; then \
		git commit -m "$$(date "$(TIMESTAMP_FMT)")"; \
	else \
		echo "No staged changes to commit."; \
	fi
	@if git ls-remote --exit-code --heads "$(REMOTE)" "$(BRANCH)" >/dev/null 2>&1; then \
		git pull --rebase "$(REMOTE)" "$(BRANCH)"; \
	else \
		echo "Remote branch $(REMOTE)/$(BRANCH) does not exist yet. Skipping pull --rebase."; \
	fi
