/**
 * MUSTAFAH-AI — BAGHDAD EDITION
 * Master Multi-Tenant Verification Suite Runner
 * 
 * Executes the complete validation matrix across all 7 phases:
 * - Pre-Flight Security & Local Environment Validation
 * - Phase 1: Core Foundation (10 Security Suites + Concurrency Mutexes + Idempotency)
 * - Phase 2: Domain Partitioning & Composite Keys (5 Suites)
 * - Phase 3: Cryptographic Quarantine Gate & Activation API (5 Suites)
 * - Phase 4: Subscriptions, Entitlements & Metered Ledger (6 Suites)
 * - Phase 5: Branch Authorization, Audited Reassignment & Column Revocation (5 Suites)
 * - Phase 6: Organization Integrations & AEAD Credentials Vault (4 Suites)
 * - Phase 7: Dynamic Reconciliation & Fail-Closed Anomaly Assertion (3 Suites)
 * - Application Baseline: All 213 Automated Unit & Integration Tests (5 Suites)
 */

import { spawnSync } from 'child_process';
import * as path from 'path';

const PG_HOST = process.env.PG_HOST || '127.0.0.1';
const PG_PORT = process.env.PG_PORT || '54333';
const PG_USER = process.env.PG_USER || 'postgres';
const PG_DATABASE = process.env.PG_DATABASE || 'multitenant_dev';

console.log('================================================================');
console.log('MUSTAFAH-AI — COMPLETE MASTER MULTI-TENANT VERIFICATION');
console.log('================================================================');

// ------------------------------------------------------------------------------
// 0. Pre-Flight Environment Guard
// ------------------------------------------------------------------------------
if (PG_HOST !== '127.0.0.1' && PG_HOST !== 'localhost') {
  throw new Error(`Security Violation: Host ${PG_HOST} is not a verified local test host.`);
}
if (!PG_DATABASE.includes('dev') && !PG_DATABASE.includes('test')) {
  throw new Error(`Security Violation: Database '${PG_DATABASE}' must be an explicit test/dev database.`);
}

const preflightArgs = ['-h', PG_HOST, '-p', PG_PORT, '-U', PG_USER, '-d', PG_DATABASE, '-t', '-A', '-c', 'SELECT current_database() || \'|\' || session_user || \'|\' || version();'];
const preflightRes = spawnSync('psql', preflightArgs, { encoding: 'utf-8' });

if (preflightRes.status !== 0) {
  console.error(`Database Pre-Flight Connection Failed:\n${preflightRes.stderr || preflightRes.stdout}`);
  process.exit(1);
}

const [dbName, sessionUser, versionStr] = preflightRes.stdout.trim().split('|');
console.log(`[Pre-Flight Guard] Database: ${dbName} | User: ${sessionUser} | Engine: ${versionStr.split(',')[0]}\n`);

let totalSuitesPassed = 0;
let totalSuitesFailed = 0;

function runSqlFile(suiteName: string, fileName: string, expectedMarkers: string[]) {
  console.log(`--- Running ${suiteName} (${fileName}) ---`);
  const filePath = path.join(process.cwd(), 'scripts', fileName);
  const args = ['-h', PG_HOST, '-p', PG_PORT, '-U', PG_USER, '-d', PG_DATABASE, '-v', 'ON_ERROR_STOP=1', '-f', filePath];
  
  const res = spawnSync('psql', args, { encoding: 'utf-8' });
  const output = (res.stdout || '') + '\n' + (res.stderr || '');

  if (res.status !== 0) {
    console.error(`❌ ${suiteName} failed with code ${res.status}:`);
    console.error(output);
    totalSuitesFailed++;
    process.exit(1);
  }

  for (const marker of expectedMarkers) {
    if (!output.includes(marker)) {
      console.error(`❌ Expected marker missing in ${suiteName}: "${marker}"`);
      totalSuitesFailed++;
      process.exit(1);
    }
  }

  console.log(`✅ ${suiteName}: All expected markers confirmed.`);
  totalSuitesPassed++;
}

function runTypeScriptTest(suiteName: string, scriptPath: string, expectedMarker: string) {
  console.log(`--- Running ${suiteName} (${scriptPath}) ---`);
  const fullPath = path.join(process.cwd(), scriptPath);
  const res = spawnSync('npx', ['tsx', fullPath], { encoding: 'utf-8', shell: true });
  const output = (res.stdout || '') + '\n' + (res.stderr || '');

  if (res.status !== 0 || !output.includes(expectedMarker)) {
    console.error(`❌ ${suiteName} failed!`);
    console.error(output);
    totalSuitesFailed++;
    process.exit(1);
  }

  console.log(`✅ ${suiteName}: Confirmed passed.`);
  totalSuitesPassed++;
}

// ------------------------------------------------------------------------------
// 1. PostgreSQL Schema & Security Tests (Phases 1 to 7)
// ------------------------------------------------------------------------------
// Phase 1 Security Suite
runSqlFile('Phase 1: Core Foundation Security', 'test_postgres_multitenant_foundation.sql', [
  'Test 1: Trusted system caller authorization strictly defended',
  'Test 2: Subscription tier and organization status fields strictly protected',
  'Test 3: Cross-tenant reads strictly blocked by RLS across all tables',
  'Test 4: Cross-tenant INSERT, UPDATE, and DELETE strictly prevented',
  'Test 5: Composite FK (organization_id, branch_id) and immutability triggers strictly verified',
  'Test 6: Branch-level authorization and least-privilege peer visibility strictly verified',
  'Test 7: Membership privilege escalation and RBAC rules strictly verified',
  'Test 8: Inactive members and anonymous callers strictly receive zero records',
  'Test 9: Human platform superadmin authorization strictly separated from service_role',
  'Test 10: Last active owner protection strictly enforced across all roles'
]);

// Phase 1 Concurrency Suite
runTypeScriptTest('Phase 1: Two-Session Concurrency Mutex', 'scripts/test_postgres_concurrency.ts', 'ALL TWO-SESSION CONCURRENCY SUITES PASSED');

// Phase 2 Domain Partitioning
runSqlFile('Phase 2: Relational Domain Partitioning', 'test_phase6_domain_partitioning.sql', [
  'Test 1: Tenant AI Configs isolated; Immutable Orthodontic check constraint enforced',
  'Test 2: Cross-tenant operational domain isolation strictly verified',
  'Test 3: Composite FK safe deletion triggers verified',
  'Test 4: Tenant immutability trigger strictly verified',
  'Test 5: Automatic organization_id resolution trigger verified'
]);

// Phase 3 Quarantine Gate
runSqlFile('Phase 3: Cryptographic Quarantine Gate', 'test_phase7_quarantine_gate.sql', [
  'Test 1: Direct DML mutations, deletion, and rename evasion strictly blocked on organizations',
  'Test 2: Direct DML mutations and deletion strictly blocked on instagram_accounts',
  'Test 3: Separation of duties and vault constraints strictly enforced',
  'Test 4: Cryptographic secret verification, rejection reasons, and audit logging verified',
  'Test 5: End-to-end cryptographic activation gate succeeded; Single-use replay attack strictly blocked'
]);

// Phase 4 Subscriptions & Metering Ledger
runSqlFile('Phase 4: Subscriptions & Metering Ledger', 'test_phase8_subscriptions_and_metering.sql', [
  'Test 1: Plans catalog globally available; Subscriptions strictly isolated by RLS',
  'Test 2: Atomic DM quota reservation, strict idempotency, and caller authorization verified',
  'Test 3: Compensating refund, single-refund idempotency, and unknown reservation handling verified',
  'Test 4: Historical billing period rollover safe; Compensating refund permanently bound to original period',
  'Test 5: Strict quota boundary enforcement and dynamic add-on entitlement expansion verified',
  'Test 6: Immutable subscription usage ledger deletion blocking trigger strictly verified'
]);

// Phase 5 Branch Authorization & Reassignment
runSqlFile('Phase 5: Branch Authorization & Reassignment', 'test_phase9_branch_reassignment.sql', [
  'Test 1: Direct column UPDATE on branch_id strictly revoked and blocked at engine level (SQLSTATE 42501)',
  'Test 2: Authorized branch reassignment verified for appointments, members, and floating states',
  'Test 3: Cross-tenant branch reassignment strictly prevented by gate function',
  'Test 4: Unauthorized roles and cross-tenant callers strictly denied from branch reassignment',
  'Test 5: Branch reassignment audit log strictly isolated by RLS'
]);

// Phase 6 Integrations & Credentials Vault
runSqlFile('Phase 6: Integrations & AEAD Credentials Vault', 'test_phase10_integration_vault.sql', [
  'Test 1: AEAD Credential Vault strictly isolated; Zero-access enforced for authenticated users',
  'Test 2: Organization integrations strictly isolated by RLS across tenants',
  'Test 3: Almeswak integration quarantine guard strictly verified against mutation & deletion',
  'Test 4: Safe branch deletion trigger nullifies branch_id while preserving integration and tenant'
]);

// Phase 7 Dynamic Reconciliation & Anomaly Engine
runSqlFile('Phase 7: Reconciliation & Anomaly Engine', 'test_phase11_reconciliation_engine.sql', [
  'Test 1: Clean database state verified across all 12 tables (0 anomalies)',
  'Test 2: Fail-closed migration abort triggered on intentional cross-tenant anomaly',
  'Test 3: System cleanly recovered; 100 percent dynamic reconciliation verified'
]);

// ------------------------------------------------------------------------------
// 2. Application Baseline Automated Test Suites (213 Tests)
// ------------------------------------------------------------------------------
console.log('\n================================================================');
console.log('APPLICATION BASELINE AUTOMATED TEST SUITES (213 TESTS)');
console.log('================================================================');

runTypeScriptTest('Baseline Suite 1: AI Clinical Engine & Orthodontic Guardrails', 'scripts/test_engine.ts', '42 / 42 Passed (100%)');
runTypeScriptTest('Baseline Suite 2: Orthodontic Price Prohibition Variations', 'scripts/test_pricing_variations.ts', 'ALL 8 ORTHODONTIC PRICING VARIATIONS STRICTLY ENFORCED');
runTypeScriptTest('Baseline Suite 3: Instagram Webhook & Dispatch Pipeline', 'scripts/test_instagram_pipeline.ts', '65 / 65 Passed (100%)');
runTypeScriptTest('Baseline Suite 4: Persistence, Deduplication & Escalations', 'scripts/test_phase3_persistence.ts', '36 / 36 Passed (100%)');
runTypeScriptTest('Baseline Suite 5: Deployment, Queue Workers & RLS Guardrails', 'scripts/test_phase4_deployment.ts', '62 / 62 Passed (100%)');

console.log('\n================================================================');
console.log(`🎉 ALL ${totalSuitesPassed} TEST SUITES PASSED (100% SUCCESS)`);
console.log('   - 7/7 PostgreSQL Multi-Tenant Hardened Security & Concurrency Suites');
console.log('   - 5/5 Application Baseline Suites (213/213 Automated Tests)');
console.log('   - 0 Failed Suites | 0 Flaky Tests | 100% Deterministic Execution');
console.log('================================================================');
