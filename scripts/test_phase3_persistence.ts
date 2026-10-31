import path from 'path';
import fs from 'fs';
import { PersistentStore } from '../src/lib/db/persistence';
import {
  processInstagramWebhook,
} from '../src/lib/instagram/webhookHandler';
import {
  InstagramGraphApiDispatcher,
  sanitizeLogString,
} from '../src/lib/instagram/graphApi';
import {
  PILOT_ACCOUNT_ID,
  CLINIC_ACCOUNT_ID,
} from '../src/lib/instagram/policy';
import { InstagramWebhookPayload } from '../src/lib/instagram/types';

console.log('================================================================');
console.log('MUSTAFAH-AI — PHASE 3: RELIABILITY & PERSISTENCE VERIFICATION');
console.log('================================================================\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, description: string) {
  totalTests++;
  if (condition) {
    console.log(`✅ [PASS] ${description}`);
    passedTests++;
  } else {
    console.error(`❌ [FAIL] ${description}`);
  }
}

async function runPhase3Tests() {
  const testDataDir = path.resolve(process.cwd(), '.data', 'test_phase3');
  const sharedStorageFile = path.join(testDataDir, 'shared_store.json');

  // Clean test directory before starting
  if (fs.existsSync(testDataDir)) {
    fs.rmSync(testDataDir, { recursive: true, force: true });
  }

  const store1 = new PersistentStore({ storageFilePath: sharedStorageFile });
  const NOW = Date.now();

  // ---------------------------------------------------------------------------
  // 1. PERSISTENT DEDUPLICATION & SERVER RESTARTS
  // ---------------------------------------------------------------------------
  console.log('--- 1. Testing Server Restart & Persistence Recovery ---');
  const mid1 = 'm_mid_restart_test_101';
  const claimed1 = await store1.claimMessageId(mid1, PILOT_ACCOUNT_ID, 'patient_restart_01');
  assert(claimed1 === true, 'Message ID claimed on initial server instance');

  await store1.setTakeover(PILOT_ACCOUNT_ID, 'patient_restart_01', 'طلب التحدث مع دكتور مصطفى');
  assert(
    (await store1.isTakeoverActive(PILOT_ACCOUNT_ID, 'patient_restart_01')) === true,
    'Takeover active on initial instance'
  );

  // SIMULATE SERVER RESTART: Create a brand new independent store instance pointing to the same storage
  const storeRestarted = new PersistentStore({ storageFilePath: sharedStorageFile });

  const claimedAfterRestart = await storeRestarted.claimMessageId(mid1, PILOT_ACCOUNT_ID, 'patient_restart_01');
  assert(claimedAfterRestart === false, 'Duplicate message is blocked after server restart');

  const takeoverAfterRestart = await storeRestarted.isTakeoverActive(PILOT_ACCOUNT_ID, 'patient_restart_01');
  assert(takeoverAfterRestart === true, 'Human takeover persists after server restart');

  // ---------------------------------------------------------------------------
  // 2. CONCURRENT DUPLICATE DELIVERIES
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. Testing Concurrent Duplicate Deliveries ---');
  const concurrentMid = 'm_concurrent_mid_999';
  const concurrentClaims = await Promise.all([
    store1.claimMessageId(concurrentMid, PILOT_ACCOUNT_ID, 'patient_conc'),
    store1.claimMessageId(concurrentMid, PILOT_ACCOUNT_ID, 'patient_conc'),
    store1.claimMessageId(concurrentMid, PILOT_ACCOUNT_ID, 'patient_conc'),
    store1.claimMessageId(concurrentMid, PILOT_ACCOUNT_ID, 'patient_conc'),
    store1.claimMessageId(concurrentMid, PILOT_ACCOUNT_ID, 'patient_conc'),
    store1.claimMessageId(concurrentMid, PILOT_ACCOUNT_ID, 'patient_conc'),
    store1.claimMessageId(concurrentMid, PILOT_ACCOUNT_ID, 'patient_conc'),
    store1.claimMessageId(concurrentMid, PILOT_ACCOUNT_ID, 'patient_conc'),
  ]);

  const successfulClaims = concurrentClaims.filter((c) => c === true).length;
  const rejectedClaims = concurrentClaims.filter((c) => c === false).length;

  assert(successfulClaims === 1, 'Exactly one concurrent delivery succeeds in claiming the message');
  assert(rejectedClaims === 7, 'All other concurrent duplicate deliveries are atomically rejected');

  // ---------------------------------------------------------------------------
  // 3. MULTIPLE APPLICATION INSTANCES
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. Testing Multiple Application Instances Sharing Store ---');
  const instanceA = new PersistentStore({ storageFilePath: sharedStorageFile });
  const instanceB = new PersistentStore({ storageFilePath: sharedStorageFile });

  const clusterMid = 'm_cluster_mid_888';
  const claimA = await instanceA.claimMessageId(clusterMid, PILOT_ACCOUNT_ID, 'patient_multi');
  const claimB = await instanceB.claimMessageId(clusterMid, PILOT_ACCOUNT_ID, 'patient_multi');

  assert(claimA === true, 'Instance A claims message');
  assert(claimB === false, 'Instance B detects message already claimed by Instance A');

  await instanceA.setTakeover(PILOT_ACCOUNT_ID, 'patient_multi_02', 'حالة طوارئ من Instance A');
  const takeoverOnB = await instanceB.isTakeoverActive(PILOT_ACCOUNT_ID, 'patient_multi_02');
  assert(takeoverOnB === true, 'Instance B detects human takeover initiated on Instance A');

  // ---------------------------------------------------------------------------
  // 4. HUMAN TAKEOVER PERSISTENCE & STAFF RELEASE
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. Testing Human Takeover Life Cycle & Staff Release ---');
  const testPatient = 'patient_takeover_flow';
  await store1.setTakeover(PILOT_ACCOUNT_ID, testPatient, 'استفسار مخصص يتطلب طبيب');
  assert((await store1.isTakeoverActive(PILOT_ACCOUNT_ID, testPatient)) === true, 'Takeover initialized as active');

  const activeRecord = await store1.getActiveTakeover(PILOT_ACCOUNT_ID, testPatient);
  assert(activeRecord?.reason === 'استفسار مخصص يتطلب طبيب', 'Stored correct takeover reason');
  assert(activeRecord?.isActive === true, 'Takeover record marked active');

  const released = await store1.releaseTakeover(PILOT_ACCOUNT_ID, testPatient, 'receptionist_zahra');
  assert(released === true, 'Staff successfully released takeover');
  assert((await store1.isTakeoverActive(PILOT_ACCOUNT_ID, testPatient)) === false, 'Takeover is no longer active');

  // ---------------------------------------------------------------------------
  // 5. PERSISTENT RECORDING OF ALL 7 MANDATORY ESCALATION EVENTS
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. Testing Persistent Escalation & CRM Events Recording ---');

  // Event 1: Orthodontic pricing inquiry
  const id1 = await store1.recordEscalation({
    accountId: PILOT_ACCOUNT_ID,
    senderId: 'patient_esc_01',
    eventType: 'orthodontic_pricing_inquiry',
    severity: 'warning',
    rawMessageText: 'شكد سعر التقويم؟',
  });
  assert(Boolean(id1), 'Durable recording: orthodontic_pricing_inquiry');

  // Event 2: Orthodontic installment inquiry
  const id2 = await store1.recordEscalation({
    accountId: PILOT_ACCOUNT_ID,
    senderId: 'patient_esc_02',
    eventType: 'orthodontic_installment_inquiry',
    severity: 'warning',
    rawMessageText: 'شكد الدفعة الأولى ويصير أقساط للتقويم؟',
  });
  assert(Boolean(id2), 'Durable recording: orthodontic_installment_inquiry');

  // Event 3: Medical emergency
  const id3 = await store1.recordEscalation({
    accountId: PILOT_ACCOUNT_ID,
    senderId: 'patient_esc_03',
    eventType: 'medical_emergency',
    severity: 'emergency',
    rawMessageText: 'ألم فظيع وورم بالخد ما اكدر انام',
  });
  assert(Boolean(id3), 'Durable recording: medical_emergency');

  // Event 4: Human agent request
  const id4 = await store1.recordEscalation({
    accountId: PILOT_ACCOUNT_ID,
    senderId: 'patient_esc_04',
    eventType: 'human_agent_requested',
    severity: 'info',
    rawMessageText: 'اريد احجي ويا دكتور مصطفى مباشرة',
  });
  assert(Boolean(id4), 'Durable recording: human_agent_requested');

  // Event 5: Outside 24h window
  const id5 = await store1.recordEscalation({
    accountId: PILOT_ACCOUNT_ID,
    senderId: 'patient_esc_05',
    eventType: 'outside_24h_window',
    severity: 'warning',
    rawMessageText: 'رسالة قديمة بعد انتهاء الـ 24 ساعة',
  });
  assert(Boolean(id5), 'Durable recording: outside_24h_window');

  // Event 6: Outbound dispatch failed
  const id6 = await store1.recordEscalation({
    accountId: PILOT_ACCOUNT_ID,
    senderId: 'patient_esc_06',
    eventType: 'outbound_dispatch_failed',
    severity: 'warning',
    details: { error: 'NETWORK_ERROR', code: 500 },
  });
  assert(Boolean(id6), 'Durable recording: outbound_dispatch_failed');

  // Event 7: Expired or invalid token
  const id7 = await store1.recordEscalation({
    accountId: PILOT_ACCOUNT_ID,
    senderId: 'patient_esc_07',
    eventType: 'token_expired_or_invalid',
    severity: 'critical',
    details: { error: 'TOKEN_EXPIRED', code: 190 },
  });
  assert(Boolean(id7), 'Durable recording: token_expired_or_invalid');

  const allEscalations = await store1.listEscalations({ accountId: PILOT_ACCOUNT_ID });
  assert(allEscalations.length >= 7, 'All 7 mandatory escalation events persisted and retrievable');

  // ---------------------------------------------------------------------------
  // 6. DURABLE WEBHOOK QUEUE & RETRIES
  // ---------------------------------------------------------------------------
  console.log('\n--- 6. Testing Durable Webhook Queue & Retries ---');
  const jobId = await store1.enqueueJob({
    messageId: 'm_queue_test_001',
    accountId: PILOT_ACCOUNT_ID,
    senderId: 'patient_queue_01',
    recipientId: '17841400000000000',
    payload: { text: 'رسالة طابور الانتظار' },
    maxAttempts: 2,
  });
  assert(Boolean(jobId), 'Job enqueued successfully with durable UUID');

  const dequeued1 = await store1.dequeueJob('worker_node_1');
  assert(dequeued1?.id === jobId, 'Dequeued job matches enqueued job');
  assert(dequeued1?.attempts === 1, 'Job attempts incremented to 1');

  await store1.failJob(jobId, 'Transient network failure');
  const failedJob = (await store1.dequeueJob('worker_node_2'));
  assert(failedJob?.attempts === 2, 'Job attempts incremented to 2 on retry');

  await store1.failJob(jobId, 'Second failure hitting max attempts');
  const dataAfterMax = (store1 as any).readData();
  assert(dataAfterMax.jobs[jobId]?.status === 'dead_letter', 'Job moved to dead_letter after exhausting retries');

  // ---------------------------------------------------------------------------
  // 7. META API AUTHENTICATION & MULTI-PRODUCT COMPATIBILITY
  // ---------------------------------------------------------------------------
  console.log('\n--- 7. Testing Meta API Dynamic Hostname & Token Compatibility ---');
  let dispatchedUrl = '';

  const mockHostnameFetch = async (url: string | URL | Request) => {
    dispatchedUrl = url.toString();
    return new Response(JSON.stringify({ recipient_id: '123', message_id: 'm_ok' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const dispatcher = new InstagramGraphApiDispatcher({
    customFetch: mockHostnameFetch as typeof fetch,
  });

  // Test Case A: Facebook Page Access Token (starts with EAAB)
  process.env.DR_MUSTAFA_ACCESS_TOKEN = 'EAAB_facebook_page_token_mock';
  await dispatcher.sendDirectMessage({
    recipientId: 'test_patient_a',
    text: 'Test message A',
    accountId: 'drmustafa_hadi',
    skipWindowCheck: true,
  });
  assert(dispatchedUrl.includes('graph.facebook.com'), 'Facebook Page token routes to graph.facebook.com');

  // Test Case B: Instagram Login User Token (starts with IGAA)
  process.env.DR_MUSTAFA_ACCESS_TOKEN = 'IGAA_instagram_user_token_mock';
  await dispatcher.sendDirectMessage({
    recipientId: 'test_patient_b',
    text: 'Test message B',
    accountId: 'drmustafa_hadi',
    skipWindowCheck: true,
  });
  assert(dispatchedUrl.includes('graph.instagram.com'), 'Instagram Login token routes to graph.instagram.com');

  // ---------------------------------------------------------------------------
  // 8. PERSISTENT WEBHOOK INTEGRATION ROUNDTRIP
  // ---------------------------------------------------------------------------
  console.log('\n--- 8. Testing End-to-End Webhook Pipeline with Persistent Store ---');
  const persistentTestPayload: InstagramWebhookPayload = {
    object: 'instagram',
    entry: [
      {
        id: '17841400000000000',
        time: NOW,
        messaging: [
          {
            sender: { id: 'patient_e2e_persisted' },
            recipient: { id: '17841400000000000' },
            timestamp: NOW,
            message: {
              mid: 'm_mid_e2e_persisted_777',
              text: 'شكد سعر التقويم ويصير تقسيط؟',
            },
          },
        ],
      },
    ],
  };

  const resE2E = await processInstagramWebhook(persistentTestPayload, {
    persistentStore: store1,
    dispatcher,
    now: NOW,
  });

  assert(resE2E.results.length === 1, 'Webhook processed persisted event');
  assert(resE2E.results[0].status === 'SUCCESS_DISPATCHED', 'Message processed and dispatched successfully');

  // Verify that an escalation was durably saved in the persistent store
  const savedEscalations = await store1.listEscalations({ accountId: PILOT_ACCOUNT_ID });
  const orthoEscalation = savedEscalations.find((e) => e.senderId === 'patient_e2e_persisted');
  assert(Boolean(orthoEscalation), 'Ortho price inquiry durably recorded in escalation_events table');
  assert(
    orthoEscalation?.eventType === 'orthodontic_installment_inquiry',
    'Escalation correctly categorized as orthodontic_installment_inquiry'
  );

  // Verify takeover was durably saved
  assert(
    (await store1.isTakeoverActive(PILOT_ACCOUNT_ID, 'patient_e2e_persisted')) === true,
    'Human takeover durably saved in persistent store'
  );

  // Second delivery of same mid to a fresh store instance pointing to same file
  const freshInstance = new PersistentStore({ storageFilePath: sharedStorageFile });
  const resE2EDup = await processInstagramWebhook(persistentTestPayload, {
    persistentStore: freshInstance,
    dispatcher,
    now: NOW,
  });

  assert(resE2EDup.results[0].status === 'IGNORED_DUPLICATE', 'Re-delivery safely blocked by persistent store');
  assert(resE2EDup.results[0].isDuplicate === true, 'Duplicate flag set across store instances');

  // ---------------------------------------------------------------------------
  // 9. CLEANUP & SUMMARY
  // ---------------------------------------------------------------------------
  if (fs.existsSync(testDataDir)) {
    fs.rmSync(testDataDir, { recursive: true, force: true });
  }

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} Passed (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('================================================================');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runPhase3Tests().catch((err) => {
  console.error('Fatal error running Phase 3 tests:', err);
  process.exit(1);
});

