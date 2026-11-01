# MustafaH-AI — Production Supabase Rollout Runbook
**Baghdad Multi-Clinic Multi-Tenant SaaS Architecture**  
**Target Environment:** Supabase PostgreSQL Engine (Production Deployment)  
**Safety Classification:** Strictly Guarded Production Procedure

---

## 1. Executive Safety Principles & Invariants

Before executing any migration against a live or staging Supabase project, all operators must enforce the following immutable invariants:

1. **Absolute Orthodontic Price Disclosure Prohibition:**
   - Under no circumstances may orthodontic treatment prices, estimates, price ranges, down payment figures, or installment numbers be disclosed through automated channels, chat templates, database defaults, or seed scripts.
   - Enforced by database check constraints: `chk_ai_config_ortho_zero_price` on `public.organization_ai_configs`.

2. **Strict Cryptographic Quarantine for Almeswak Clinic:**
   - Account `@almeswaksmile.iq` (Organization ID: `a0000000-0000-0000-0000-000000000002`) MUST remain in `demo_mode`.
   - Direct DML modifications or deletions are intercepted and blocked by `public.fn_enforce_almeswak_comprehensive_quarantine()`.
   - Live activation is exclusively permitted through `public.api_activate_quarantined_clinic()` requiring a verified cryptographic board resolution token.

3. **Active Pilot Tenant Isolation:**
   - Dr. Mustafa Hadi Dental Clinic (`drmustafa-hadi`, ID: `a0000000-0000-0000-0000-000000000001`) is the designated founding pilot tenant.
   - All historical leads, appointments, and conversations must be mapped to this organization without data loss.

4. **Zero Downtime & Safe Lock Acquisition:**
   - All migrations must execute with bounded lock timeouts to avoid blocking active client webhooks or CRM requests:
     ```sql
     SET lock_timeout = '5s';
     SET statement_timeout = '60s';
     ```

5. **No Destructive Rolled Shortcuts:**
   - `DROP CASCADE` is strictly forbidden.
   - Rollbacks must execute via non-destructive forward migrations.

---

## 2. Pre-Flight Verification Checklist

Execute these checks via `psql` or the Supabase SQL Editor prior to running migrations:

```sql
-- 1. Verify PostgreSQL Version (>= 15.0 required, 17.x recommended)
SELECT version();

-- 2. Verify Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA public;

-- 3. Verify Database Roles Exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_worker') THEN
        CREATE ROLE app_worker NOLOGIN NOINHERIT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_platform_admin') THEN
        CREATE ROLE app_platform_admin NOLOGIN NOINHERIT;
    END IF;
END $$;
```

---

## 3. Ordered Migration Execution Sequence

Apply the migrations in the exact chronological sequence listed below. Each migration is completely self-contained, idempotent, and transactional.

| Step | Migration File | Target Scope |
| :---: | :--- | :--- |
| **01** | `supabase/migrations/20261031020000_multitenant_core_foundation.sql` | `organizations`, `branches`, `organization_members`, `platform_superadmins`, RLS helper functions, last-active owner protection |
| **02** | `supabase/migrations/20261031030000_multitenant_domain_partitioning.sql` | 12 operational domain tables partitioned by `organization_id`, composite foreign keys, auto-resolution triggers |
| **03** | `supabase/migrations/20261031040000_almeswak_quarantine_gate.sql` | `platform_authorizations`, audit logs, cryptographic quarantine triggers, activation gate procedure |
| **04** | `supabase/migrations/20261031050000_multitenant_subscriptions_and_metering.sql` | `plans`, `organization_subscriptions`, atomic `reserve_dm_quota()` procedure, period-consistent refund ledger |
| **05** | `supabase/migrations/20261031060000_multitenant_branch_reassignment.sql` | Column-level privilege revocation on `branch_id`, audited `api_reassign_branch()` procedure |
| **06** | `supabase/migrations/20261031070000_multitenant_integration_vault.sql` | `organization_integrations`, AEAD `integration_credentials` vault with zero authenticated access |
| **07** | `supabase/migrations/20261031080000_multitenant_reconciliation_engine.sql` | Single-source `vw_tenant_migration_anomaly_report`, fail-closed `fn_assert_zero_migration_anomalies()` |

---

## 4. Post-Migration Verification & Smoke Testing

Immediately after applying the migrations, execute the following smoke queries:

### 4.1 Automated Anomaly Assertion
```sql
-- Must execute cleanly with: NOTICE: SUCCESS: All 12 tables passed 100 percent dynamic reconciliation verification without anomalies.
SELECT public.fn_assert_zero_migration_anomalies();
```

### 4.2 Relational Health Report Inspection
```sql
SELECT table_name, total_rows, mapped_rows, unmapped_rows, cross_tenant_violations, invalid_references
FROM public.vw_tenant_migration_anomaly_report
ORDER BY table_name;
```
*Expected Result:* Every table must report `unmapped_rows = 0`, `cross_tenant_violations = 0`, and `invalid_references = 0`.

### 4.3 Almeswak Quarantine Verification
```sql
-- Verify status is locked in demo_mode
SELECT id, slug, status FROM public.organizations WHERE slug = 'almeswak-demo';
SELECT id, handle, status FROM public.instagram_accounts WHERE id = 'almeswaksmile_iq';
```
*Expected Result:* Status must be strictly `'demo_mode'`.

---

## 5. Application Health Check & Smoke Validation

1. Verify Next.js API Health Endpoint:
   ```bash
   curl -s -X GET https://<your-deployed-domain>/api/health | jq .
   ```
   *Expected Response:*
   ```json
   {
     "status": "ok",
     "database": {
       "connected": true,
       "mode": "supabase_rest"
     }
   }
   ```

2. Verify Webhook GET Handshake:
   ```bash
   curl -s -X GET "https://<your-deployed-domain>/api/webhooks/instagram?hub.mode=subscribe&hub.challenge=test_probe&hub.verify_token=mustafah_ai_baghdad_secure_verify_2026"
   ```
   *Expected Response:* `test_probe` (HTTP 200).

---

## 6. Forward Recovery & Incident Protocol

In the event of an unexpected migration failure:
1. **Never use `DROP TABLE ... CASCADE`:** Existing leads, appointments, and clinic conversations must be protected from accidental drops.
2. **Inspect Lock Contention:**
   ```sql
   SELECT pid, query, age(clock_timestamp(), query_start), state
   FROM pg_stat_activity
   WHERE wait_event_type = 'Lock';
   ```
3. **Roll Forward:** Address the specific constraint or index issue by creating a forward migration timestamped sequentially (`20261031090000_...sql`).
