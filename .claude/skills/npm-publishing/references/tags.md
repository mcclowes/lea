# Distribution Tags

## Default Tags

```bash
npm publish              # Publishes to "latest" tag
npm install package      # Installs "latest" tag
```

## Common Tags

| Tag | Purpose |
|-----|---------|
| `latest` | Stable production release |
| `next` | Upcoming major version |
| `beta` | Beta testing |
| `alpha` | Alpha testing |
| `canary` | Nightly/continuous builds |
| `legacy` | Old major version |

## Publishing with Tags

```bash
# Publish to a specific tag
npm publish --tag beta

# Publish to next
npm publish --tag next
```

## Installing Specific Tags

```bash
npm install package@beta
npm install package@next
npm install package@legacy
```

## Managing Tags

### Add/Move Tag

```bash
# Add tag to specific version
npm dist-tag add package@1.2.0 beta

# Move tag to new version
npm dist-tag add package@1.3.0 beta
```

### Remove Tag

```bash
npm dist-tag rm package beta
```

### List Tags

```bash
npm dist-tag ls package
# latest: 1.1.0
# beta: 1.2.0-beta.1
```

## Prerelease Versions

Combine with semantic versioning:

```json
{
  "version": "1.2.0-beta.1"
}
```

```bash
npm version prerelease --preid=beta
# 1.2.0 → 1.2.1-beta.0
# 1.2.1-beta.0 → 1.2.1-beta.1
```

## Workflow Example

```bash
# Development cycle
npm version prerelease --preid=alpha
npm publish --tag alpha

# Beta testing
npm version prerelease --preid=beta
npm publish --tag beta

# Release candidate
npm version prerelease --preid=rc
npm publish --tag next

# Stable release
npm version minor  # or major/patch
npm publish  # Goes to "latest"
```

## CI/CD Tag Strategy

```yaml
- name: Determine tag
  id: tag
  run: |
    if [[ "${{ github.ref }}" == refs/tags/v*-beta* ]]; then
      echo "tag=beta" >> $GITHUB_OUTPUT
    elif [[ "${{ github.ref }}" == refs/tags/v*-alpha* ]]; then
      echo "tag=alpha" >> $GITHUB_OUTPUT
    else
      echo "tag=latest" >> $GITHUB_OUTPUT
    fi

- run: npm publish --tag ${{ steps.tag.outputs.tag }}
```
