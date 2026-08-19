# CI/CD Pipeline

## Location
- `azure-pipelines.yml` (root)

## Pipeline Architecture
The CI/CD pipeline is built for **Azure DevOps (ADO)**. It defines a multi-stage Docker build-and-push pipeline targeting Azure Container Registry (ACR).

### Stages
1. **Dev Stage:**
   - Trigger: Commits to the `dev` branch.
   - Action: Builds the Docker image, tags it as `latest` and `$(Build.BuildId)`, and pushes to the `acrDev` registry.
2. **Test Stage:**
   - Trigger: Commits to the `test` branch.
   - Condition: Requires explicit manual approval in ADO UI.
   - Action: Pushes to `acrTest`.
3. **Prod Stage:**
   - Trigger: Commits to the `main` branch.
   - Condition: Requires explicit manual approval in ADO UI.
   - Action: Pushes to `acrProd`.

> [!WARNING]
> **Missing Steps:** The pipeline does **not** include any linting (`npm run lint`), type checking (`tsc --noEmit`), or unit testing (`vitest`) stages before building the Docker image. If a commit breaks the build, it will only fail during the Docker `pnpm build` layer, rather than failing fast in a dedicated test stage.
