# Secret Management

## Using Secrets

```yaml
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: Deploy
        run: ./deploy.sh
        env:
          API_KEY: ${{ secrets.API_KEY }}
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

## Secret Types

### Repository Secrets

- Scoped to a single repository
- Settings > Secrets and variables > Actions

### Organization Secrets

- Shared across repositories
- Can limit to specific repos
- Organization Settings > Secrets and variables

### Environment Secrets

- Scoped to deployment environments
- Settings > Environments > [env] > Secrets

```yaml
jobs:
  deploy:
    environment: production  # Uses production secrets
    runs-on: ubuntu-latest
```

## GITHUB_TOKEN

Automatically provided, scoped to repository:

```yaml
- uses: actions/checkout@v4
  with:
    token: ${{ secrets.GITHUB_TOKEN }}

- run: gh pr create
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Permissions

```yaml
permissions:
  contents: read
  packages: write
  pull-requests: write
  issues: write
  id-token: write  # For OIDC
```

## OIDC (OpenID Connect)

For cloud providers without long-lived secrets:

```yaml
jobs:
  deploy:
    permissions:
      id-token: write
      contents: read

    steps:
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789:role/GitHubActions
          aws-region: us-east-1
```

## Best Practices

### Avoid Logging Secrets

```yaml
# Bad - might log secret
- run: echo ${{ secrets.API_KEY }}

# Good - masks automatically
- run: ./script.sh
  env:
    API_KEY: ${{ secrets.API_KEY }}
```

### Secrets in Composite Actions

```yaml
# action.yml
inputs:
  token:
    description: "API token"
    required: true

runs:
  using: composite
  steps:
    - run: ./deploy.sh
      env:
        TOKEN: ${{ inputs.token }}
```

### Secrets for Forks

```yaml
# Use pull_request_target for fork PRs
# Secrets available but be careful with code execution
on:
  pull_request_target:
    types: [labeled]

jobs:
  deploy:
    if: github.event.label.name == 'safe-to-test'
```

## Required Secrets for Lea

```yaml
# NPM_TOKEN - For npm publish
# VSCE_TOKEN - For VS Code Marketplace
# CODECOV_TOKEN - For coverage reports
```
