# PostgreSQL migrations

Add versioned SQL files using `{version}_{name}.up.sql` and optional `{version}_{name}.down.sql`.

- `0001_organization_id_not_null` enforces the `organization_id NOT NULL DEFAULT 0` standard.
- `0002_skill_package_allowed_role_codes` adds `skills_package.allowed_role_codes`, the
  IAM role-code assignment list (`[]` = every role, the default).
