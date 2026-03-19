SHELL := /usr/bin/env bash

REMOTE := trion-org
.DEFAULT_GOAL := help

GREEN  := \033[0;32m
BLUE   := \033[0;34m
YELLOW := \033[0;33m
NC     := \033[0m

.PHONY: help preview git-sync

help:
	@current_branch="$$(git branch --show-current 2>/dev/null)"; \
	printf "$(BLUE)%s$(NC)\n" "Git Sync Commands"; \
	printf "\n"; \
	printf "%s\n" "Current branch: $${current_branch:-<unknown>}"; \
	printf "%s\n" "Remote: $(REMOTE)"; \
	printf "\n"; \
	printf "$(YELLOW)%s$(NC)\n" "Available targets:"; \
	printf "%s\n" "  make          - Show this help message"; \
	printf "%s\n" "  make preview  - Print the git commands that would run on the current branch"; \
	printf "%s\n" "  make git-sync - Run add -> commit(timestamp) -> pull --rebase(if remote branch exists) -> push"; \
	printf "\n"

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
	@current_branch="$$(git branch --show-current 2>/dev/null)"; \
	if [ -z "$$current_branch" ]; then \
		echo "Could not detect the current branch."; \
		exit 1; \
	fi; \
	echo "Using branch $$current_branch"
	@git add -A
	@if ! git diff --cached --quiet; then \
		git commit -m "$$(date '+%Y-%m-%d %H:%M:%S %z')"; \
	else \
		echo "No staged changes to commit."; \
	fi
	@current_branch="$$(git branch --show-current 2>/dev/null)"; \
	if git ls-remote --exit-code --heads "$(REMOTE)" "$$current_branch" >/dev/null 2>&1; then \
		git pull --rebase "$(REMOTE)" "$$current_branch"; \
	else \
		echo "Remote branch $(REMOTE)/$$current_branch does not exist yet. Skipping pull --rebase."; \
	fi
	@current_branch="$$(git branch --show-current 2>/dev/null)"; \
	git push -u "$(REMOTE)" "$$current_branch"
