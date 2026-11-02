import fs from 'fs';
import path from 'path';
import { Client } from 'pg';

const connectionString =
  process.env.DIRECT_URL ||
  'postgresql://postgres.mvokslekhpawkvjwzbos:Homiejojie12!@aws-1-eu-central-1.pooler.supabase.com:5432/postgres';

const migrationFiles = [
  '20261030000000_almeswak_schema.sql',
  '20261031000000_phase3_reliability.sql',
  '20261031010000_phase4_rls_and_pooling.sql',
  '20261031020000_multitenant_core_foundation.sql',
  '20261031030000_multitenant_domain_partitioning.sql',
  '20261031040000_almeswak_quarantine_gate.sql',
  '20261031050000_multitenant_subscriptions_and_metering.sql',
  '20261031060000_multitenant_branch_reassignment.sql',
  '20261031070000_multitenant_integration_vault.sql',
  '20261031080000_multitenant_reconciliation_engine.sql',
];

async function applyMigrations() {
  console.log('================================================================');
  console.log('MUSTAFAH-AI — PRODUCTION SUPABASE MIGRATION RUNNER');
  console.log('Target Host: aws-1-eu-central-1.pooler.supabase.com:5432');
  console.log('Target Project: mvokslekhpawkvjwzbos');
  console.log('================================================================\n');

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    statement_timeout: 120000,
  });

  await client.connect();
  console.log('Connected to remote PostgreSQL instance successfully.\n');

  // Set safe timeouts
  await client.query("SET lock_timeout = '10s';");
  await client.query("SET statement_timeout = '120s';");

  for (let i = 0; i < migrationFiles.length; i++) {
    const fileName = migrationFiles[i];
    const filePath = path.resolve(process.cwd(), 'supabase/migrations', fileName);
    console.log(`[${i + 1}/${migrationFiles.length}] Executing migration: ${fileName}...`);

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const sql = fs.readFileSync(filePath, 'utf-8');
    const start = Date.now();

    try {
      await client.query(sql);
      const elapsedMs = Date.now() - start;
      console.log(`  -> Finished in ${elapsedMs}ms [SUCCESS]\n`);
    } catch (err: any) {
      console.error(`\n❌ ERROR in ${fileName}:`);
      console.error(err.message);
      if (err.position) console.error(`Error position: ${err.position}`);
      if (err.detail) console.error(`Detail: ${err.detail}`);
      if (err.hint) console.error(`Hint: ${err.hint}`);
      await client.end();
      process.exit(1);
    }
  }

  console.log('================================================================');
  console.log('ALL MIGRATIONS APPLIED! RUNNING RECONCILIATION & ANOMALY CHECKS');
  console.log('================================================================\n');

  // 1. Run zero-anomaly assertion function
  const assertionRes = await client.query('SELECT public.fn_assert_zero_migration_anomalies() as result;');
  console.log('Anomaly Assertion Result:', assertionRes.rows[0].result);

  // 2. Query anomaly view directly
  const anomalyViewRes = await client.query('SELECT * FROM public.vw_tenant_migration_anomaly_report;');
  console.log('Active Anomaly Records Count:', anomalyViewRes.rowCount);
  if (anomalyViewRes.rowCount === 0) {
    console.log('✅ ZERO ANOMALIES CONFIRMED across all operational tables!');
  } else {
    console.table(anomalyViewRes.rows);
  }

  // 3. Query seeded organizations
  const orgsRes = await client.query(
    'SELECT id, name, slug, status, tier FROM public.organizations ORDER BY created_at ASC;'
  );
  console.log('\nConfigured Organizations in Production:');
  console.table(orgsRes.rows);

  // 4. Query RLS status on public tables
  const rlsRes = await client.query(`
    SELECT tablename, rowsecurity 
    FROM pg_tables 
    WHERE schemaname = 'public' 
    ORDER BY tablename ASC;
  `);
  console.log('\nRow Level Security (RLS) Status on Public Tables:');
  console.table(rlsRes.rows);

  await client.end();
  console.log('\n================================================================');
  console.log('PRODUCTION DATABASE PROVISIONING COMPLETED SUCCESSFULLY!');
  console.log('================================================================');
}

applyMigrations().catch((err) => {
  console.error('Fatal Migration Error:', err);
  process.exit(1);
});
