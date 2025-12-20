# Workflow Triggers

## Push Events

```yaml
on:
  push:
    branches:
      - main
      - "release/*"
    branches-ignore:
      - "dependabot/**"
    paths:
      - "src/**"
      - "package.json"
    paths-ignore:
      - "docs/**"
      - "*.md"
    tags:
      - "v*"
```

## Pull Request Events

```yaml
on:
  pull_request:
    branches: [main]
    types:
      - opened
      - synchronize
      - reopened
      - ready_for_review

  pull_request_target:
    # Runs in context of base branch
    # Use for PRs from forks (security sensitive)
```

## Release Events

```yaml
on:
  release:
    types:
      - published    # Most common
      - created
      - edited
      - deleted
      - prereleased
      - released
```

## Schedule (Cron)

```yaml
on:
  schedule:
    # Every day at midnight UTC
    - cron: "0 0 * * *"

    # Every Monday at 9am
    - cron: "0 9 * * 1"

    # Every 6 hours
    - cron: "0 */6 * * *"
```

## Manual Triggers

```yaml
on:
  workflow_dispatch:
    inputs:
      environment:
        description: "Deployment environment"
        required: true
        default: "staging"
        type: choice
        options:
          - staging
          - production
      debug:
        description: "Enable debug mode"
        required: false
        type: boolean
        default: false
```

## Repository Dispatch

```yaml
on:
  repository_dispatch:
    types: [deploy, test]

# Trigger with:
# curl -X POST \
#   -H "Authorization: token $TOKEN" \
#   -d '{"event_type": "deploy"}' \
#   https://api.github.com/repos/OWNER/REPO/dispatches
```

## Workflow Call (Reusable)

```yaml
# Called workflow
on:
  workflow_call:
    inputs:
      node-version:
        required: true
        type: string
    secrets:
      npm-token:
        required: true

# Caller workflow
jobs:
  call-workflow:
    uses: ./.github/workflows/reusable.yml
    with:
      node-version: "20"
    secrets:
      npm-token: ${{ secrets.NPM_TOKEN }}
```

## Conditions

```yaml
jobs:
  deploy:
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'

  skip-draft:
    if: github.event.pull_request.draft == false

  only-main:
    if: github.ref == 'refs/heads/main'

  not-fork:
    if: github.event.pull_request.head.repo.full_name == github.repository
```
