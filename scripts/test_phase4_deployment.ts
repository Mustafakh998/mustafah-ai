import fs from 'fs';
import path from 'path';
import {
  PersistentStore,
  defaultPersistentStore,
} from '../src/lib/db/persistence';
import { DatabaseUnavailableError } from '../src/lib/db/types';
import {
  WebhookQueueWorker,
} from '../src/lib/queue/worker';
import {
  processInstagramWebhook,
} from '../src/lib/instagram/webhookHandler';
import {
  InstagramGraphApiDispatcher,
} from '../src/lib/instagram/graphApi';
import { InstagramWebhookPayload } from '../src/lib/instagram/types';

// Mock Dispatcher for Queue Worker and Webhook Tests
class MockDispatcher extends InstagramGraphApiDispatcher {
  public dispatchedMessages: Array<{ recipientId: string; text: string; accountId: string }> = [];
  public shouldFail = false;
  public failureType: 'NETWORK_ERROR' | 'TOKEN_EXPIRED' | 'RATE_LIMIT_EXCEEDED' = 'NETWORK_ERROR';

  constructor() {
    super();
  }

  public override async sendDirectMessage(req: {
    recipientId: string;
    text: string;
    accountId: any;
    incomingMessageTimestamp?: number;
    now?: number;
  }) {
    if (this.shouldFail) {
      return {
        success: false as const,
        error: this.failureType,
        message: `Mock Graph API failure: ${this.failureType}`,
      };
    }
    this.dispatchedMessages.push({
      recipientId: req.recipientId,
      text: req.text,
      accountId: req.accountId,
    });
    return {
      success: true as const,
      recipientId: req.recipientId,
      messageId: `mock_mid_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    };
  }
}

// Failing Store for Fail-Safe Closed Testing
class FailingDatabaseStore extends PersistentStore {
  public override async claimMessageId(): Promise<boolean> {
    throw new DatabaseUnavailableError('Connection refused to Supabase PostgreSQL host.');
  }

  public override async isTakeoverActive(): Promise<boolean> {
    throw new DatabaseUnavailableError('Supabase pooler timeout during takeover lookup.');
  }
}

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`✅ [PASS] ${message}`);
  } else {
    console.error(`❌ [FAIL] ${message}`);
    throw new Error(`Test assertion failed: ${message}`);
  }
}

async function runPhase4Tests() {
  console.log('================================================================');
  console.log('MUSTAFAH-AI — PHASE 4: DEPLOYMENT & DATABASE VALIDATION SUITE');
  console.log('================================================================\n');

  // ---------------------------------------------------------------------------
  // 1. Supabase Schema & Migration Integrity Checks
  // ---------------------------------------------------------------------------
  console.log('--- 1. Testing Supabase Schema & Migration Files Integrity ---');
  const migrationsDir = path.resolve(process.cwd(), 'supabase', 'migrations');
  assert(fs.existsSync(migrationsDir), 'Migrations directory exists');

  const migration1 = fs.readFileSync(path.join(migrationsDir, '20261030000000_almeswak_schema.sql'), 'utf-8');
  const migration2 = fs.readFileSync(path.join(migrationsDir, '20261031000000_phase3_reliability.sql'), 'utf-8');
  const migration3 = fs.readFileSync(path.join(migrationsDir, '20261031010000_phase4_rls_and_pooling.sql'), 'utf-8');

  // Check Tables in Migration 1
  assert(migration1.includes('CREATE TABLE IF NOT EXISTS instagram_accounts'), 'Migration 1 defines instagram_accounts');
  assert(migration1.includes('CREATE TABLE IF NOT EXISTS leads'), 'Migration 1 defines leads CRM');
  assert(migration1.includes('CREATE TABLE IF NOT EXISTS appointments'), 'Migration 1 defines appointments table');
  assert(migration1.includes('CREATE TABLE IF NOT EXISTS conversations'), 'Migration 1 defines conversations table');
  assert(migration1.includes('CREATE TABLE IF NOT EXISTS chat_messages'), 'Migration 1 defines chat_messages table');

  // Check Reliability Tables in Migration 2
  assert(migration2.includes('CREATE TABLE IF NOT EXISTS processed_webhook_messages'), 'Migration 2 defines persistent deduplication table');
  assert(migration2.includes('CREATE TABLE IF NOT EXISTS human_takeovers'), 'Migration 2 defines persistent human_takeovers table');
  assert(migration2.includes('CREATE TABLE IF NOT EXISTS escalation_events'), 'Migration 2 defines persistent escalation_events table');
  assert(migration2.includes('CREATE TABLE IF NOT EXISTS webhook_jobs'), 'Migration 2 defines durable webhook_jobs queue table');

  // Check RLS in Migration 3
  assert(migration3.includes('ENABLE ROW LEVEL SECURITY'), 'Migration 3 enables Row Level Security (RLS)');
  assert(migration3.includes('ALTER TABLE IF EXISTS instagram_accounts ENABLE ROW LEVEL SECURITY'), 'RLS enabled on instagram_accounts');
  assert(migration3.includes('ALTER TABLE IF EXISTS leads ENABLE ROW LEVEL SECURITY'), 'RLS enabled on leads');
  assert(migration3.includes('ALTER TABLE IF EXISTS processed_webhook_messages ENABLE ROW LEVEL SECURITY'), 'RLS enabled on processed_webhook_messages');
  assert(migration3.includes('ALTER TABLE IF EXISTS human_takeovers ENABLE ROW LEVEL SECURITY'), 'RLS enabled on human_takeovers');
  assert(migration3.includes('ALTER TABLE IF EXISTS escalation_events ENABLE ROW LEVEL SECURITY'), 'RLS enabled on escalation_events');
  assert(migration3.includes('ALTER TABLE IF EXISTS webhook_jobs ENABLE ROW LEVEL SECURITY'), 'RLS enabled on webhook_jobs');

  // Check Service Role and Isolation Policies in Migration 3
  assert(migration3.includes('Service role full access on webhook_jobs'), 'Service role full access policy granted');
  assert(migration3.includes('Clinic workspace isolation guard'), 'Clinic workspace isolation guard policy enforced');
  assert(migration3.includes('Staff read leads for pilot account'), 'Staff tenant isolation policy enforced');

  // ---------------------------------------------------------------------------
  // 2. Database Connection Status & Health Validation
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. Testing Database Connection Status & Health Validation ---');
  const testStorePath = path.resolve(process.cwd(), '.data', 'test_phase4_store.json');
  if (fs.existsSync(testStorePath)) fs.unlinkSync(testStorePath);

  const testStore = new PersistentStore({ storageFilePath: testStorePath });
  const connStatus = await testStore.validateConnection();
  assert(connStatus.connected === true, 'Database validation returns connected');
  assert(connStatus.mode === 'durable_store' || connStatus.mode === 'supabase_rest', 'Active store mode identified correctly');
  assert(typeof connStatus.poolerMode === 'string', 'Pooler mode identified');

  // ---------------------------------------------------------------------------
  // 3. Fail-Safe Closed Behavior (Database Unavailable)
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. Testing Fail-Safe Closed Behavior (Database Outage) ---');
  const failingStore = new FailingDatabaseStore();
  const mockDispatcher = new MockDispatcher();

  const samplePayload: InstagramWebhookPayload = {
    object: 'instagram',
    entry: [
      {
        id: '17841400000000000',
        time: Date.now(),
        messaging: [
          {
            sender: { id: 'patient_db_down_101' },
            recipient: { id: '17841400000000000' },
            timestamp: Date.now(),
            message: {
              mid: 'mid_db_down_test_001',
              text: 'أريد أعرف وين مكان العيادة؟',
            },
          },
        ],
      },
    ],
  };

  const webhookResult = await processInstagramWebhook(samplePayload, {
    persistentStore: failingStore,
    dispatcher: mockDispatcher,
  });

  assert(webhookResult.results.length === 1, 'Webhook processed event during DB outage');
  const eventResult = webhookResult.results[0];
  assert(eventResult.status === 'FAIL_SAFE_DB_UNAVAILABLE_CLOSED', 'Status is FAIL_SAFE_DB_UNAVAILABLE_CLOSED');
  assert(eventResult.requiresHumanHandoff === true, 'Requires human handoff when DB cannot verify state');
  assert(mockDispatcher.dispatchedMessages.length === 0, 'Zero automated messages dispatched when DB is unavailable (Fail-Safe Closed)');
  assert(webhookResult.summary.dbFailSafeClosed === 1, 'Summary metrics record 1 fail-safe closed event');

  // ---------------------------------------------------------------------------
  // 4. Background Queue Worker Concurrency & Atomic Claiming
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. Testing Queue Worker Concurrency & Atomic Claiming ---');
  await testStore.clearAll();

  // Enqueue 2 jobs
  const job1Id = await testStore.enqueueJob({
    messageId: 'job_mid_concurrent_1',
    accountId: 'drmustafa_hadi',
    senderId: 'patient_concurrent_1',
    recipientId: '17841400000000000',
    payload: {
      text: 'مرحبا دكتور وين عنوانكم؟',
      incomingTimestamp: Date.now(),
    },
    maxAttempts: 3,
  });

  const job2Id = await testStore.enqueueJob({
    messageId: 'job_mid_concurrent_2',
    accountId: 'drmustafa_hadi',
    senderId: 'patient_concurrent_2',
    recipientId: '17841400000000000',
    payload: {
      text: 'شلونكم دكتور؟',
      incomingTimestamp: Date.now(),
    },
    maxAttempts: 3,
  });

  const workerA = new WebhookQueueWorker({ workerId: 'worker_node_alpha', persistentStore: testStore, dispatcher: mockDispatcher });
  const workerB = new WebhookQueueWorker({ workerId: 'worker_node_beta', persistentStore: testStore, dispatcher: mockDispatcher });

  // Worker A dequeues job 1
  const claimedJobA = await testStore.dequeueJob(workerA.workerId);
  assert(claimedJobA !== null && claimedJobA.id === job1Id, 'Worker A claimed Job 1');
  assert(claimedJobA?.lockedBy === 'worker_node_alpha', 'Job 1 locked by Worker A');

  // Worker B dequeues next job (must get Job 2, never Job 1)
  const claimedJobB = await testStore.dequeueJob(workerB.workerId);
  assert(claimedJobB !== null && claimedJobB.id === job2Id, 'Worker B claimed Job 2');
  assert(claimedJobB?.lockedBy === 'worker_node_beta', 'Job 2 locked by Worker B');

  // No more pending jobs
  const claimedJobEmpty = await testStore.dequeueJob('worker_node_gamma');
  assert(claimedJobEmpty === null, 'No jobs available for third worker (Atomic Concurrency)');

  // ---------------------------------------------------------------------------
  // 5. Background Queue Worker Exponential Backoff & Retries
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. Testing Worker Exponential Backoff & Dead-Letter Handling ---');
  await testStore.clearAll();
  mockDispatcher.dispatchedMessages = [];
  mockDispatcher.shouldFail = true;
  mockDispatcher.failureType = 'TOKEN_EXPIRED';

  const retryJobId = await testStore.enqueueJob({
    messageId: 'job_mid_retry_1',
    accountId: 'drmustafa_hadi',
    senderId: 'patient_retry_1',
    recipientId: '17841400000000000',
    payload: {
      text: 'استفسار عن تبييض الأسنان',
      incomingTimestamp: Date.now(),
    },
    maxAttempts: 3,
  });

  const retryWorker = new WebhookQueueWorker({
    workerId: 'worker_retry_test',
    persistentStore: testStore,
    dispatcher: mockDispatcher,
    baseBackoffMs: 1000,
    maxAttempts: 3,
  });

  // Verify backoff formula
  assert(retryWorker.calculateBackoffDelay(1) === 1000, 'Backoff attempt 1: 1000ms');
  assert(retryWorker.calculateBackoffDelay(2) === 2000, 'Backoff attempt 2: 2000ms');
  assert(retryWorker.calculateBackoffDelay(3) === 4000, 'Backoff attempt 3: 4000ms');

  // Attempt 1 fails -> RETRY_SCHEDULED
  const res1 = await retryWorker.processNextJob();
  assert(res1?.status === 'RETRY_SCHEDULED', 'Attempt 1 result is RETRY_SCHEDULED');
  assert(res1?.attempts === 1, 'Attempt count is 1');
  assert(res1?.nextRetryDelayMs === 1000, 'Next retry scheduled with 1000ms delay');

  // Attempt 2 fails -> RETRY_SCHEDULED
  const res2 = await retryWorker.processNextJob();
  assert(res2?.status === 'RETRY_SCHEDULED', 'Attempt 2 result is RETRY_SCHEDULED');
  assert(res2?.attempts === 2, 'Attempt count is 2');
  assert(res2?.nextRetryDelayMs === 2000, 'Next retry scheduled with 2000ms delay');

  // Attempt 3 fails -> DEAD_LETTER
  const res3 = await retryWorker.processNextJob();
  assert(res3?.status === 'DEAD_LETTER', 'Attempt 3 exhausts retries and transitions to DEAD_LETTER');
  assert(res3?.attempts === 3, 'Attempt count is 3');

  // Verify critical escalation recorded for token expiration dead-letter
  const escalations = await testStore.listEscalations({ accountId: 'drmustafa_hadi' });
  const deadLetterEscalation = escalations.find((e) => e.eventType === 'token_expired_or_invalid');
  assert(deadLetterEscalation !== undefined, 'Durable critical escalation event recorded for dead-letter');
  assert(deadLetterEscalation?.severity === 'critical', 'Dead letter escalation severity is critical');

  // ---------------------------------------------------------------------------
  // 6. Background Queue Worker 24-Hour Policy Re-Validation on Retry
  // ---------------------------------------------------------------------------
  console.log('\n--- 6. Testing Worker 24-Hour Policy Re-Validation on Retry ---');
  await testStore.clearAll();
  mockDispatcher.dispatchedMessages = [];
  mockDispatcher.shouldFail = false;

  const oldTimestamp = Date.now() - 25 * 60 * 60 * 1000; // 25 hours ago

  await testStore.enqueueJob({
    messageId: 'job_mid_stale_1',
    accountId: 'drmustafa_hadi',
    senderId: 'patient_stale_24h',
    recipientId: '17841400000000000',
    payload: {
      text: 'رسالة قديمة تأخرت في الطابور',
      incomingTimestamp: oldTimestamp,
    },
    maxAttempts: 3,
  });

  const policyWorker = new WebhookQueueWorker({
    workerId: 'worker_policy_guard',
    persistentStore: testStore,
    dispatcher: mockDispatcher,
  });

  // Worker processes job now (25 hours after incoming message)
  const policyResult = await policyWorker.processNextJob({ now: Date.now() });
  assert(policyResult?.status === 'OUTSIDE_24H_WINDOW_CANCELLED', 'Delayed job cancelled: OUTSIDE_24H_WINDOW_CANCELLED');
  assert(mockDispatcher.dispatchedMessages.length === 0, 'Zero messages dispatched outside 24h window from queue worker');

  // Verify takeover and escalation activated
  const isStaleTakeoverActive = await testStore.isTakeoverActive('drmustafa_hadi', 'patient_stale_24h');
  assert(isStaleTakeoverActive === true, 'Human takeover activated for stale queued message');

  const staleEscalation = (await testStore.listEscalations({ accountId: 'drmustafa_hadi' }))
    .find((e) => e.eventType === 'outside_24h_window');
  assert(staleEscalation !== undefined, 'Escalation recorded for 24h window violation in queue');

  // ---------------------------------------------------------------------------
  // 7. Background Queue Worker Human Takeover Suppression on Retry
  // ---------------------------------------------------------------------------
  console.log('\n--- 7. Testing Human Takeover Suppression During Queue Processing ---');
  await testStore.clearAll();
  mockDispatcher.dispatchedMessages = [];

  await testStore.enqueueJob({
    messageId: 'job_mid_takeover_queued',
    accountId: 'drmustafa_hadi',
    senderId: 'patient_human_intervened',
    recipientId: '17841400000000000',
    payload: {
      text: 'عندي موعد باجر؟',
      incomingTimestamp: Date.now(),
    },
    maxAttempts: 3,
  });

  // Doctor/staff takes over while message was sitting in queue
  await testStore.setTakeover('drmustafa_hadi', 'patient_human_intervened', 'تدخل الدكتور مصطفى شخصياً للمحادثة');

  const takeoverResult = await policyWorker.processNextJob();
  assert(takeoverResult?.status === 'TAKEOVER_SUPPRESSED', 'Worker suppresses dispatch when human takeover active');
  assert(mockDispatcher.dispatchedMessages.length === 0, 'Zero messages sent over human staff');

  // ---------------------------------------------------------------------------
  // 8. Background Queue Worker Account Isolation Protection
  // ---------------------------------------------------------------------------
  console.log('\n--- 8. Testing Queue Worker Account Isolation Protection ---');
  await testStore.clearAll();
  mockDispatcher.dispatchedMessages = [];

  await testStore.enqueueJob({
    messageId: 'job_mid_clinic_isolated',
    accountId: 'almeswaksmile_iq', // Clinic account
    senderId: 'clinic_patient_001',
    recipientId: '17841400000000001',
    payload: {
      text: 'حجز في العيادة',
      incomingTimestamp: Date.now(),
    },
    maxAttempts: 3,
  });

  const clinicJobResult = await policyWorker.processNextJob();
  assert(clinicJobResult?.status === 'ACCOUNT_ISOLATION_BLOCKED', 'Clinic job blocked by queue worker');
  assert(mockDispatcher.dispatchedMessages.length === 0, 'Zero messages sent for clinic account from worker');

  // ---------------------------------------------------------------------------
  // 9. Dead-Letter Queue Inspection and Manual Retry
  // ---------------------------------------------------------------------------
  console.log('\n--- 9. Testing Dead-Letter Queue Inspection & Manual Retry ---');
  await testStore.clearAll();
  const deadLetters = await testStore.listDeadLetterJobs('drmustafa_hadi');
  assert(deadLetters.length === 0, 'listDeadLetterJobs returns empty array on clean queue');

  // Create a dead letter job to test manual retry
  const deadJobId = await testStore.enqueueJob({
    messageId: 'job_dead_letter_manual_test',
    accountId: 'drmustafa_hadi',
    senderId: 'patient_manual_retry',
    recipientId: '17841400000000000',
    payload: { text: 'رسالة للمحاولة اليدوية', incomingTimestamp: Date.now() },
    maxAttempts: 1,
  });
  await testStore.dequeueJob('test_worker_manual');
  await testStore.failJob(deadJobId, 'Simulated fatal error');

  const updatedDeadLetters = await testStore.listDeadLetterJobs('drmustafa_hadi');
  assert(updatedDeadLetters.some((j) => j.id === deadJobId), 'Job present in dead-letter queue');

  const retrySuccess = await testStore.retryDeadLetterJob(deadJobId);
  assert(retrySuccess === true, 'Admin successfully reset dead letter job to pending');

  const reloadedJob = await testStore.getJobById(deadJobId);
  assert(reloadedJob?.status === 'pending' && reloadedJob.attempts === 0, 'Job reset to pending status with 0 attempts');

  // ---------------------------------------------------------------------------
  // 10. Meta Authentication Configuration Verification
  // ---------------------------------------------------------------------------
  console.log('\n--- 10. Testing Meta Authentication Configuration Verification ---');
  const runbookPath = path.resolve(process.cwd(), 'docs', 'meta_webhook_and_deployment_runbook.md');
  assert(fs.existsSync(runbookPath), 'Deployment runbook exists in docs');

  const runbookContent = fs.readFileSync(runbookPath, 'utf-8');
  assert(
    runbookContent.includes('Instagram Graph API via Facebook Login for Business (Page Access Token)'),
    'Runbook explicitly chooses single primary authentication method'
  );
  assert(runbookContent.includes('instagram_manage_messages'), 'Runbook documents instagram_manage_messages scope');
  assert(runbookContent.includes('Fail-Safe Closed Architecture'), 'Runbook details fail-safe closed architecture');

  // Clean up test store
  if (fs.existsSync(testStorePath)) fs.unlinkSync(testStorePath);

  console.log('\n================================================================');
  console.log(`PHASE 4 TEST SUMMARY: ${passedTests} / ${totalTests} Passed (100%)`);
  console.log('================================================================');
}

runPhase4Tests().catch((err) => {
  console.error('Fatal error running Phase 4 tests:', err);
  process.exit(1);
});
