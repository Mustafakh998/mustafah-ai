import fs from 'fs';
import path from 'path';

const migrationsDir = path.resolve(process.cwd(), 'supabase/migrations');
const files = [
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

let consolidated = `-- =============================================================================\n`;
consolidated += `-- MUSTAFAH-AI — CONSOLIDATED PRODUCTION SUPABASE MIGRATION\n`;
consolidated += `-- Project ID: mvokslekhpawkvjwzbos\n`;
consolidated += `-- Execution Order: Phase 0 through Phase 7 (Full Multi-Tenant Foundation)\n`;
consolidated += `-- Generated: ${new Date().toISOString()}\n`;
consolidated += `-- =============================================================================\n\n`;

for (const file of files) {
  const filePath = path.join(migrationsDir, file);
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  consolidated += `-- =============================================================================\n`;
  consolidated += `-- BEGIN MIGRATION: ${file}\n`;
  consolidated += `-- =============================================================================\n\n`;
  consolidated += content;
  consolidated += `\n\n-- =============================================================================\n`;
  consolidated += `-- END MIGRATION: ${file}\n`;
  consolidated += `-- =============================================================================\n\n`;
}

consolidated += `-- =============================================================================\n`;
consolidated += `-- FINAL PRODUCTION ASSERTION: ZERO MIGRATION ANOMALIES\n`;
consolidated += `-- =============================================================================\n`;
consolidated += `SELECT public.fn_assert_zero_migration_anomalies();\n`;

const outputPath = path.resolve(process.cwd(), 'supabase/consolidated_production_migration.sql');
fs.writeFileSync(outputPath, consolidated, 'utf-8');
console.log(`Consolidated migration written successfully to: ${outputPath} (${(consolidated.length / 1024).toFixed(1)} KB)`);

