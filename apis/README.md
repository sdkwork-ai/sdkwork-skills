# APIs

Skills HTTP contracts for app-api and backend-api surfaces.

- App API: `app-api/skills/skills-app-api.openapi.json`
- Backend API: `backend-api/skills/skills-backend-api.openapi.json`

Both documents are materialized from `tools/skills_openapi_materialize.mjs`; edit that
generator input and re-materialize instead of hand-editing the JSON.

Materialize and validate:

```bash
pnpm api:materialize
pnpm api:check
```

## Catalog view filters

The four catalog list operations accept two additional optional view filters:

- App API: `GET /app/v3/api/skills` and `GET /app/v3/api/skill_packages`.
- Backend API: `GET /backend/v3/api/skills` and `GET /backend/v3/api/skill_packages`.

Their meaning:

- `category_code` - one `skills_category.code` reached through the package's
  `skills_category_binding` row. Omitted or `all` keeps every category.
- `role_codes` - comma-separated IAM role codes of the signed-in caller. An empty
  value is the all-data view; a value keeps the records naming one of those roles
  plus the records open to every role (empty `allowedRoleCodes`).

Neither filter widens tenant or visibility scoping: both narrow the rows the
repository already scoped to the caller, and both are applied inside the list
query so `pageInfo.totalItems` matches the filtered set.

`GET /app/v3/api/skill_categories` and `GET /backend/v3/api/skill_categories`
accept `category_type` (`skill_market` default). The app-api list returns only
visible, active categories; the backend-api admin list keeps returning hidden and
inactive ones.
