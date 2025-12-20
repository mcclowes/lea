# Scoped Packages

## Creating a Scoped Package

```json
{
  "name": "@yourname/package-name",
  "version": "1.0.0"
}
```

## Publishing Scoped Packages

Scoped packages are private by default:

```bash
# First publish must specify access
npm publish --access public

# Subsequent publishes
npm publish
```

Or configure in package.json:

```json
{
  "name": "@yourname/package",
  "publishConfig": {
    "access": "public"
  }
}
```

## Installing Scoped Packages

```bash
npm install @yourname/package-name
```

## Scope Organizations

### npm Organizations

- Create at npmjs.com/org
- Shared ownership and permissions
- `@orgname/package`

### GitHub Packages

```json
{
  "name": "@owner/package",
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  }
}
```

## Registry Configuration

### Per-Scope Registry

```ini
# .npmrc
@yourscope:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

### In package.json

```json
{
  "publishConfig": {
    "registry": "https://registry.npmjs.org",
    "@yourscope:registry": "https://npm.pkg.github.com"
  }
}
```

## Importing Scoped Packages

```typescript
// Standard import
import { something } from "@yourname/package";

// Subpath import
import { util } from "@yourname/package/utils";
```

## Benefits of Scopes

1. **Namespace protection** - No conflicts with global names
2. **Organization** - Group related packages
3. **Access control** - Private packages with paid plans
4. **Team management** - Shared publishing rights
