/**
 * MUSTAFAH-AI — PHASE 1: HARDENED TWO-SESSION POSTGRESQL CONCURRENCY SUITE
 * 
 * Verifies transaction-level concurrency serialization across separate connections:
 * 1. Owner Concurrency: Simultaneous owner demotions serialize via row lock (FOR UPDATE),
 *    asserting that Session 2 unblocks, rechecks owner count, and is rejected with
 *    SQLSTATE P0001 and last-owner error message.
 * 2. Superadmin Concurrency: Two superadmins concurrently attempt to revoke their OWN privileges.
 *    Session A obtains the advisory lock and commits. Session B waits on the lock, unblocks,
 *    passes caller/target checks, and is strictly rejected by the final-superadmin count check (<= 1)
 *    with exact SQLSTATE P0001 and last-superadmin message (NOT an authorization error).
 * 3. Audit Verification: Exactly 1 audit record for the successful transaction; exactly 0 for rejected.
 * 4. Isolation & Cleanup: Dynamically generated UUIDs per run; no colliding fixtures; safe session termination.
 */

import { spawn, spawnSync } from 'child_process';
import * as crypto from 'crypto';

interface PsqlSession {
  process: any;
  send: (sql: string) => Promise<{ stdout: string; stderr: string; combined: string }>;
  close: () => void;
}

function runSqlSync(args: string[]): string {
  const host = process.env.PGHOST || '127.0.0.1';
  const port = process.env.PGPORT || '54333';
  const user = process.env.PGUSER || 'postgres';
  const db = process.env.PGDATABASE || 'multitenant_dev';

  const fullArgs = ['-h', host, '-p', port, '-U', user, '-d', db, ...args];
  const res = spawnSync('psql', fullArgs, { encoding: 'utf-8' });

  if (res.status !== 0) {
    throw new Error(`SQL Execution Failed (exit code ${res.status}):\n${res.stderr || res.stdout}`);
  }
  return (res.stdout || '').trim();
}

function createPsqlSession(name: string): PsqlSession {
  const host = process.env.PGHOST || '127.0.0.1';
  const port = process.env.PGPORT || '54333';
  const user = process.env.PGUSER || 'postgres';
  const db = process.env.PGDATABASE || 'multitenant_dev';

  const p = spawn('psql', ['-h', host, '-p', port, '-U', user, '-d', db, '-q'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  return {
    process: p,
    send: (sql: string) => {
      return new Promise((resolve, reject) => {
        const marker = `---END_${crypto.randomUUID()}---`;
        let stdout = '';
        let stderr = '';

        const outHandler = (data: Buffer) => {
          stdout += data.toString();
          if (stdout.includes(marker)) {
            cleanup();
            resolve({ stdout, stderr, combined: stdout + '\n' + stderr });
          }
        };

        const errHandler = (data: Buffer) => {
          stderr += data.toString();
        };

        const closeHandler = (code: number | null) => {
          cleanup();
          resolve({ stdout, stderr, combined: stdout + '\n' + stderr + `\n[Process Exited: ${code}]` });
        };

        const cleanup = () => {
          p.stdout.removeListener('data', outHandler);
          p.stderr.removeListener('data', errHandler);
          p.removeListener('close', closeHandler);
        };

        p.stdout.on('data', outHandler);
        p.stderr.on('data', errHandler);
        p.on('close', closeHandler);

        p.stdin.write(`\\set VERBOSITY verbose\n${sql}\n\\echo ${marker}\n`);
      });
    },
    close: () => {
      try {
        p.stdin.write('\\q\n');
        p.stdin.end();
        p.kill();
      } catch (e) {}
    }
  };
}

async function runOwnerConcurrencyTest() {
  console.log('----------------------------------------------------------------');
  console.log('CONCURRENCY TEST 1: Simultaneous Owner Demotion Serialization');
  console.log('----------------------------------------------------------------');

  // Dynamic, collision-free identifiers for isolated testing
  const orgId = crypto.randomUUID();
  const orgSlug = `concur-owner-${crypto.randomUUID().substring(0, 8)}`;
  const owner1 = crypto.randomUUID();
  const owner2 = crypto.randomUUID();

  const trackedUsers = [owner1, owner2];
  const trackedOrgs = [orgId];

  // Seed isolated fixture directly without ON CONFLICT DO UPDATE
  runSqlSync(['-c', `
    INSERT INTO auth.users (id, email) VALUES 
      ('${owner1}', 'owner1_${owner1.substring(0, 6)}@test.iq'),
      ('${owner2}', 'owner2_${owner2.substring(0, 6)}@test.iq');

    INSERT INTO public.organizations (id, slug, name, name_ar, status, tier)
    VALUES ('${orgId}', '${orgSlug}', 'Concurrent Owner Test Clinic', 'عيادة الفحص التزامني', 'active', 'professional');

    INSERT INTO public.organization_members (organization_id, user_id, role, is_active)
    VALUES 
      ('${orgId}', '${owner1}', 'owner', TRUE),
      ('${orgId}', '${owner2}', 'owner', TRUE);
  `]);

  console.log(`✅ Fixture seeded: Isolated Org (${orgSlug}) with 2 active co-owners.`);

  const session1 = createPsqlSession('Session 1 (Owner 1)');
  const session2 = createPsqlSession('Session 2 (Owner 2)');

  try {
    await session1.send(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '${owner1}', false);`);
    await session2.send(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '${owner2}', false);`);

    // Session 1 begins transaction and acquires exclusive row lock
    console.log('Session 1: BEGIN; UPDATE organization_members SET role = \'dentist\' WHERE user_id = Owner 1;');
    await session1.send('BEGIN;');
    await session1.send(`UPDATE public.organization_members SET role = 'dentist' WHERE organization_id = '${orgId}' AND user_id = '${owner1}';`);
    console.log('🔒 Session 1 acquired exclusive row lock on organization table via FOR UPDATE');

    // Session 2 initiates simultaneous transaction and attempts demoting Owner 2
    console.log('Session 2: BEGIN; UPDATE organization_members SET role = \'dentist\' WHERE user_id = Owner 2;');
    await session2.send('BEGIN;');

    let session2Blocked = true;
    let session2Result: any = null;

    const s2Promise = session2.send(`
      UPDATE public.organization_members 
      SET role = 'dentist' 
      WHERE organization_id = '${orgId}' AND user_id = '${owner2}';
    `).then((res) => {
      session2Blocked = false;
      session2Result = res;
    });

    // Wait 350ms to verify Session 2 is actively suspended on Session 1's lock
    await new Promise((resolve) => setTimeout(resolve, 350));

    if (!session2Blocked) {
      throw new Error('FAILED: Session 2 was not blocked by Session 1 row lock!');
    }
    console.log('🔒 VERIFIED: Session 2 is actively BLOCKED waiting for Session 1 lock release.');

    // Session 1 commits
    console.log('Session 1: COMMIT;');
    await session1.send('COMMIT;');

    // Session 2 now unblocks, acquires the lock, rechecks count = 1, and must fail
    await s2Promise;
    await session2.send('ROLLBACK;');

    const s2Combined = session2Result.combined;
    console.log('Session 2 output captured:\n' + s2Combined.trim());

    // Assert specific SQLSTATE P0001 and expected error message
    if (!s2Combined.includes('P0001') && !s2Combined.includes('raise_exception')) {
      throw new Error(`FAILED: Expected SQLSTATE P0001, got:\n${s2Combined}`);
    }

    if (!s2Combined.includes('Cannot demote, deactivate, or remove the final active Owner')) {
      throw new Error(`FAILED: Expected last-owner error message, got:\n${s2Combined}`);
    }
    console.log('✅ VERIFIED: Session 2 failed with exact expected SQLSTATE P0001 and last-owner error message.');

    // Verify final database state: exactly 1 active owner remains
    const ownerCount = runSqlSync(['-t', '-A', '-c', `
      SELECT COUNT(*) FROM public.organization_members 
      WHERE organization_id = '${orgId}' AND role = 'owner' AND is_active = TRUE;
    `]);

    if (ownerCount !== '1') {
      throw new Error(`FAILED: Expected exactly 1 active owner, found ${ownerCount}`);
    }

    console.log('✅ Final state verified: Exactly 1 active owner remains. Organization was NEVER ownerless.\n');

  } finally {
    session1.close();
    session2.close();
    // Clean up ONLY records created by this test run
    try {
      runSqlSync(['-c', `
        SELECT public.api_deprovision_organization('${orgId}', 'Owner concurrency test cleanup');
        DELETE FROM auth.users WHERE id IN ('${owner1}', '${owner2}');
      `]);
    } catch (e) {
      // Fallback cleanup if deprovision failed
      try {
        runSqlSync(['-c', `
          DELETE FROM public.organization_members WHERE organization_id = '${orgId}';
          DELETE FROM public.organizations WHERE id = '${orgId}';
          DELETE FROM auth.users WHERE id IN ('${owner1}', '${owner2}');
        `]);
      } catch (e2) {}
    }
  }
}

async function runSuperadminConcurrencyTest() {
  console.log('----------------------------------------------------------------');
  console.log('CONCURRENCY TEST 2: Concurrent Self-Revocation Mutex Serialization');
  console.log('----------------------------------------------------------------');

  // Dynamic, collision-free identifiers for isolated testing
  const adminA = crypto.randomUUID();
  const adminB = crypto.randomUUID();

  const notesA = `Admin A voluntary stepdown ${adminA.substring(0, 8)}`;
  const notesB = `Admin B voluntary stepdown ${adminB.substring(0, 8)}`;

  // Seed isolated fixture directly without ON CONFLICT DO UPDATE
  runSqlSync(['-c', `
    INSERT INTO auth.users (id, email) VALUES 
      ('${adminA}', 'adminA_${adminA.substring(0, 6)}@platform.iq'),
      ('${adminB}', 'adminB_${adminB.substring(0, 6)}@platform.iq');

    INSERT INTO public.platform_superadmins (user_id, granted_by, notes)
    VALUES 
      ('${adminA}', NULL, 'Concurrency Test Superadmin A'),
      ('${adminB}', NULL, 'Concurrency Test Superadmin B');
  `]);

  console.log('✅ Fixture seeded: Exactly 2 isolated active platform superadmins (Admin A & Admin B).');

  const session1 = createPsqlSession('Session 1 (Admin A)');
  const session2 = createPsqlSession('Session 2 (Admin B)');

  try {
    await session1.send(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '${adminA}', false);`);
    await session2.send(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '${adminB}', false);`);

    // Session 1 begins transaction and attempts self-revocation
    console.log('Session 1 (Admin A): BEGIN; api_manage_platform_superadmin(\'REVOKE\', Admin A);');
    await session1.send('BEGIN;');
    await session1.send(`SELECT public.api_manage_platform_superadmin('REVOKE', '${adminA}', '${notesA}');`);
    console.log('🔒 Session 1 acquired advisory mutex lock on platform_superadmin_mutex');

    // Session 2 begins transaction and simultaneously attempts self-revocation
    console.log('Session 2 (Admin B): BEGIN; api_manage_platform_superadmin(\'REVOKE\', Admin B);');
    await session2.send('BEGIN;');

    let session2Blocked = true;
    let session2Result: any = null;

    const s2Promise = session2.send(`
      SELECT public.api_manage_platform_superadmin('REVOKE', '${adminB}', '${notesB}');
    `).then((res) => {
      session2Blocked = false;
      session2Result = res;
    });

    // Wait 350ms to verify Session 2 is actively suspended on the advisory mutex
    await new Promise((resolve) => setTimeout(resolve, 350));

    if (!session2Blocked) {
      throw new Error('FAILED: Session 2 was not blocked by advisory mutex lock!');
    }
    console.log('🔒 VERIFIED: Session 2 is actively BLOCKED waiting for Session 1 mutex release.');

    // Session 1 commits
    console.log('Session 1: COMMIT;');
    await session1.send('COMMIT;');

    // Session 2 now unblocks, acquires mutex lock, passes caller/target checks, but fails count check
    await s2Promise;
    await session2.send('ROLLBACK;');

    const s2Combined = session2Result.combined;
    console.log('Session 2 output captured:\n' + s2Combined.trim());

    // 1. Assert exact SQLSTATE P0001
    if (!s2Combined.includes('P0001') && !s2Combined.includes('raise_exception')) {
      throw new Error(`FAILED: Expected SQLSTATE P0001, got:\n${s2Combined}`);
    }

    // 2. Assert exact final-superadmin rejection message
    if (!s2Combined.includes('Cannot revoke the final platform superadmin')) {
      throw new Error(`FAILED: Expected final-superadmin count rejection message, got:\n${s2Combined}`);
    }

    // 3. Strict Check: Must NOT fail due to authorization loss
    if (s2Combined.includes('Only authenticated human platform superadmins may manage superadmin privileges')) {
      throw new Error(`FAILED: Session 2 failed on authorization check instead of final-superadmin count check! Output:\n${s2Combined}`);
    }

    console.log('✅ VERIFIED: Session 2 failed with exact expected SQLSTATE P0001 and final-superadmin message (authorization check passed).');

    // Verify remaining active superadmins in database: exactly 1 active superadmin remains (Admin B)
    const remainingCount = runSqlSync(['-t', '-A', '-c', `
      SELECT COUNT(*) FROM public.platform_superadmins 
      WHERE user_id IN ('${adminA}', '${adminB}');
    `]);

    if (remainingCount !== '1') {
      throw new Error(`FAILED: Expected exactly 1 active superadmin remaining, found ${remainingCount}`);
    }

    const remainingAdmin = runSqlSync(['-t', '-A', '-c', `
      SELECT user_id FROM public.platform_superadmins 
      WHERE user_id IN ('${adminA}', '${adminB}');
    `]);

    if (remainingAdmin !== adminB) {
      throw new Error(`FAILED: Expected Admin B (${adminB}) to remain active, found ${remainingAdmin}`);
    }

    console.log(`✅ Final state verified: Exactly 1 active platform superadmin remains (Admin B: ${adminB}).`);

    // -------------------------------------------------------------------------
    // Audit Verification (Requirement 3)
    // -------------------------------------------------------------------------
    // Query audit records for the test targets
    const auditRowsRaw = runSqlSync(['-t', '-A', '-F', '|', '-c', `
      SELECT action, target_user_id, performed_by, notes 
      FROM public.platform_superadmin_audit_log 
      WHERE target_user_id IN ('${adminA}', '${adminB}')
      ORDER BY performed_at ASC;
    `]);

    const auditRows = auditRowsRaw ? auditRowsRaw.split('\n').filter(Boolean) : [];

    // Total matching record count must be EXACTLY 1
    if (auditRows.length !== 1) {
      throw new Error(`FAILED: Expected exactly 1 audit record for test superadmins, found ${auditRows.length}:\n${auditRowsRaw}`);
    }

    const [action, targetUserId, performedBy, notes] = auditRows[0].split('|');

    if (action !== 'REVOKE') {
      throw new Error(`Audit Failure: Expected action 'REVOKE', got '${action}'`);
    }

    if (targetUserId !== adminA) {
      throw new Error(`Audit Failure: Expected target_user_id '${adminA}', got '${targetUserId}'`);
    }

    if (performedBy !== adminA) {
      throw new Error(`Audit Failure: Expected performed_by '${adminA}', got '${performedBy}'`);
    }

    if (notes !== notesA) {
      throw new Error(`Audit Failure: Expected notes '${notesA}', got '${notes}'`);
    }

    // Verify rejected transaction (Admin B) produced zero audit records
    const adminBAuditCount = runSqlSync(['-t', '-A', '-c', `
      SELECT COUNT(*) FROM public.platform_superadmin_audit_log 
      WHERE target_user_id = '${adminB}';
    `]);

    if (adminBAuditCount !== '0') {
      throw new Error(`Audit Failure: Rejected transaction produced false audit record for Admin B (count=${adminBAuditCount})`);
    }

    console.log('✅ Audit log verified: Exactly 1 matching audit record for Session 1 (action=REVOKE, target=Admin A, performed_by=Admin A); 0 for rejected Session 2.\n');

  } finally {
    session1.close();
    session2.close();
    // Clean up ONLY records created by this test run
    try {
      runSqlSync(['-c', `
        DELETE FROM public.platform_superadmin_audit_log WHERE target_user_id IN ('${adminA}', '${adminB}');
        DELETE FROM public.platform_superadmins WHERE user_id IN ('${adminA}', '${adminB}');
        DELETE FROM auth.users WHERE id IN ('${adminA}', '${adminB}');
      `]);
    } catch (e) {}
  }
}

async function main() {
  console.log('================================================================');
  console.log('MUSTAFAH-AI — TWO-SESSION POSTGRESQL CONCURRENCY TEST SUITE');
  console.log('================================================================\n');

  try {
    await runOwnerConcurrencyTest();
    await runSuperadminConcurrencyTest();

    console.log('================================================================');
    console.log('🎉 ALL TWO-SESSION CONCURRENCY SUITES PASSED (100%)');
    console.log('================================================================');
  } catch (err) {
    console.error('❌ CONCURRENCY TEST FAILED:', err);
    process.exit(1);
  }
}

main();
