import crypto from 'crypto';
import {
  validateMetaSignature,
  processInstagramWebhook,
} from '../src/lib/instagram/webhookHandler';
import {
  isWithin24HourWindow,
  getElapsedHours,
  resolveTargetAccount,
  HumanTakeoverTracker,
  TWENTY_FOUR_HOURS_MS,
  PILOT_ACCOUNT_ID,
  CLINIC_ACCOUNT_ID,
} from '../src/lib/instagram/policy';
import { MessageDeduplicator } from '../src/lib/instagram/dedup';
import {
  InstagramGraphApiDispatcher,
  sanitizeLogString,
} from '../src/lib/instagram/graphApi';
import { InstagramWebhookPayload } from '../src/lib/instagram/types';

console.log('================================================================');
console.log('MUSTAFAH-AI — PHASE 2: INSTAGRAM PIPELINE AUTOMATED SUITE');
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

async function runTests() {
  const TEST_SECRET = 'test_meta_app_secret_mustafah_2026';
  const NOW = 1730300000000; // Fixed deterministic baseline timestamp

  // ---------------------------------------------------------------------------
  // 1. INBOUND WEBHOOK & VALID MESSAGES
  // ---------------------------------------------------------------------------
  console.log('--- 1. Testing Valid Inbound Webhook Event Parsing ---');
  const validPayload: InstagramWebhookPayload = {
    object: 'instagram',
    entry: [
      {
        id: '17841400000000000',
        time: NOW,
        messaging: [
          {
            sender: { id: 'patient_user_123' },
            recipient: { id: '17841400000000000' },
            timestamp: NOW,
            message: {
              mid: 'm_mid_valid_001',
              text: 'وين مكانكم بالعيادة بالضبط بزيونة؟',
            },
          },
        ],
      },
    ],
  };

  const mockSuccessFetch = async () =>
    new Response(
      JSON.stringify({ recipient_id: 'patient_user_123', message_id: 'm_sent_999' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  const testDispatcher = new InstagramGraphApiDispatcher({
    customFetch: mockSuccessFetch as typeof fetch,
  });

  const dedup1 = new MessageDeduplicator();
  const takeover1 = new HumanTakeoverTracker();

  // Temporarily set pilot access token for testing
  process.env.DR_MUSTAFA_ACCESS_TOKEN = 'EAAB_test_mock_token_for_drmustafa';

  const res1 = await processInstagramWebhook(validPayload, {
    deduplicator: dedup1,
    takeoverTracker: takeover1,
    dispatcher: testDispatcher,
    now: NOW,
  });

  assert(res1.results.length === 1, 'Inbound webhook parsed exactly 1 messaging event');
  assert(res1.results[0].senderId === 'patient_user_123', 'Identified correct sender ID');
  assert(res1.results[0].accountId === PILOT_ACCOUNT_ID, 'Assigned event to Dr. Mustafa pilot account');
  assert(res1.results[0].intent === 'location_and_directions', 'Correctly classified location intent in Iraqi Arabic');
  assert(
    Boolean(res1.results[0].aiReplyText?.includes('زيونة') && res1.results[0].aiReplyText?.includes('07768886667')),
    'Generated Iraqi Arabic response with verified Zayouna clinic location and phone'
  );
  assert(res1.results[0].status === 'SUCCESS_DISPATCHED', 'Successfully completed pipeline and outbound dispatch');

  // ---------------------------------------------------------------------------
  // 2. INVALID WEBHOOK SIGNATURES
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. Testing Webhook Signature Verification ---');
  const testBody = JSON.stringify(validPayload);
  const correctHmac =
    'sha256=' + crypto.createHmac('sha256', TEST_SECRET).update(testBody).digest('hex');
  const invalidHmac = 'sha256=0000000000000000000000000000000000000000000000000000000000000000';

  const validSigCheck = validateMetaSignature(testBody, correctHmac, TEST_SECRET);
  assert(validSigCheck.isValid === true, 'Valid HMAC signature passes verification');

  const invalidSigCheck = validateMetaSignature(testBody, invalidHmac, TEST_SECRET);
  assert(invalidSigCheck.isValid === false, 'Tampered HMAC signature is rejected');

  const missingSigCheck = validateMetaSignature(testBody, null, TEST_SECRET);
  assert(missingSigCheck.isValid === false, 'Missing signature header is rejected');

  const missingSecretCheck = validateMetaSignature(testBody, correctHmac, '');
  assert(missingSecretCheck.isValid === false, 'Missing server app secret is rejected with server config error');

  // ---------------------------------------------------------------------------
  // 3. DUPLICATE WEBHOOK EVENTS
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. Testing Duplicate Webhook Event Deduplication ---');
  const dedup2 = new MessageDeduplicator(10000);
  const eventMid = 'm_mid_dup_test_777';

  assert(dedup2.isDuplicate(eventMid, NOW) === false, 'First occurrence of message ID is marked new');
  assert(dedup2.isDuplicate(eventMid, NOW + 1000) === true, 'Second occurrence of message ID is flagged as duplicate');
  assert(dedup2.isDuplicate(eventMid, NOW + 2000) === true, 'Subsequent retries within TTL are flagged as duplicate');

  // Test full webhook pipeline deduplication
  const dupPayload: InstagramWebhookPayload = {
    object: 'instagram',
    entry: [
      {
        id: '17841400000000000',
        time: NOW,
        messaging: [
          {
            sender: { id: 'patient_dup_1' },
            recipient: { id: '17841400000000000' },
            timestamp: NOW,
            message: { mid: eventMid, text: 'مرحبا دكتور' },
          },
        ],
      },
    ],
  };

  const resDup = await processInstagramWebhook(dupPayload, {
    deduplicator: dedup2,
    takeoverTracker: new HumanTakeoverTracker(),
    dispatcher: testDispatcher,
    now: NOW + 1000,
  });
  assert(resDup.results[0].status === 'IGNORED_DUPLICATE', 'Webhook pipeline safely suppresses duplicate message execution');
  assert(resDup.summary.duplicates === 1, 'Summary metrics record 1 duplicate');

  // ---------------------------------------------------------------------------
  // 4. BOT ECHO SUPPRESSION
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. Testing Bot Echo Prevention ---');
  const echoPayload: InstagramWebhookPayload = {
    object: 'instagram',
    entry: [
      {
        id: '17841400000000000',
        time: NOW,
        messaging: [
          {
            sender: { id: '17841400000000000' },
            recipient: { id: 'patient_user_123' },
            timestamp: NOW,
            message: {
              mid: 'm_mid_echo_001',
              text: 'تدلل عيوني نورتنا',
              is_echo: true,
            },
          },
        ],
      },
    ],
  };

  const resEcho = await processInstagramWebhook(echoPayload, {
    deduplicator: new MessageDeduplicator(),
    takeoverTracker: new HumanTakeoverTracker(),
    dispatcher: testDispatcher,
    now: NOW,
  });
  assert(resEcho.results[0].status === 'IGNORED_ECHO', 'Outbound bot echo event is safely ignored');
  assert(resEcho.results[0].isEcho === true, 'Flag isEcho is set to true');
  assert(resEcho.summary.echoes === 1, 'Summary metrics record 1 echo');

  // ---------------------------------------------------------------------------
  // 5. SUCCESSFUL OUTBOUND DISPATCH (MOCKED GRAPH API)
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. Testing Outbound Graph API Dispatcher ---');
  let capturedHeaders: HeadersInit | undefined;
  let capturedBody: string | undefined;

  const mockCustomFetch = async (_url: string | URL | Request, init?: RequestInit) => {
    capturedHeaders = init?.headers;
    capturedBody = init?.body as string;
    return new Response(
      JSON.stringify({ recipient_id: 'target_patient_123', message_id: 'm_meta_success_456' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };

  const customDispatcher = new InstagramGraphApiDispatcher({
    customFetch: mockCustomFetch as typeof fetch,
  });

  const dispatchResult = await customDispatcher.sendDirectMessage({
    recipientId: 'target_patient_123',
    text: 'أهلاً وسهلاً بيك نورت د. مصطفى هادي',
    accountId: 'drmustafa_hadi',
    incomingMessageTimestamp: NOW,
    now: NOW,
  });

  assert(dispatchResult.success === true, 'Dispatcher returns success: true on HTTP 200');
  if (dispatchResult.success) {
    assert(dispatchResult.messageId === 'm_meta_success_456', 'Dispatcher returns correct Meta message_id');
  }
  const bodyParsed = JSON.parse(capturedBody || '{}');
  assert(bodyParsed.recipient?.id === 'target_patient_123', 'Graph API payload formatted with correct recipient ID');
  assert(bodyParsed.message?.text?.includes('مصطفى هادي'), 'Graph API payload formatted with correct text');

  // ---------------------------------------------------------------------------
  // 6. EXPIRED AND INVALID TOKENS (CODE 190)
  // ---------------------------------------------------------------------------
  console.log('\n--- 6. Testing Expired and Invalid Token Handling ---');
  const mockExpiredTokenFetch = async () =>
    new Response(
      JSON.stringify({
        error: {
          message: 'Error validating access token: Session has expired.',
          type: 'OAuthException',
          code: 190,
          error_subcode: 463,
          fbtrace_id: 'trace_123456',
        },
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );

  const expiredTokenDispatcher = new InstagramGraphApiDispatcher({
    customFetch: mockExpiredTokenFetch as typeof fetch,
    maxRetries: 0,
  });

  const expiredResult = await expiredTokenDispatcher.sendDirectMessage({
    recipientId: 'patient_456',
    text: 'test reply',
    accountId: 'drmustafa_hadi',
    incomingMessageTimestamp: NOW,
    now: NOW,
  });

  assert(expiredResult.success === false, 'Dispatcher detects auth error and returns success: false');
  if (!expiredResult.success) {
    assert(expiredResult.error === 'TOKEN_EXPIRED', 'Dispatcher classifies error as TOKEN_EXPIRED');
    assert(expiredResult.code === 190, 'Dispatcher captures Meta error code 190');
  }

  // Test missing token
  const previousToken = process.env.DR_MUSTAFA_ACCESS_TOKEN;
  delete process.env.DR_MUSTAFA_ACCESS_TOKEN;
  const noTokenResult = await testDispatcher.sendDirectMessage({
    recipientId: 'patient_456',
    text: 'test',
    accountId: 'drmustafa_hadi',
  });
  assert(noTokenResult.success === false, 'Refuses to send when access token is missing');
  if (!noTokenResult.success) {
    assert(noTokenResult.error === 'UNAUTHORIZED_OR_MISSING_TOKEN', 'Identifies UNAUTHORIZED_OR_MISSING_TOKEN');
  }
  process.env.DR_MUSTAFA_ACCESS_TOKEN = previousToken;

  // ---------------------------------------------------------------------------
  // 7. API FAILURES AND RATE LIMIT RETRIES
  // ---------------------------------------------------------------------------
  console.log('\n--- 7. Testing Rate Limits (Code 613/4) and Retries ---');
  let rateLimitAttempts = 0;
  const mockRateLimitFetch = async () => {
    rateLimitAttempts++;
    return new Response(
      JSON.stringify({
        error: {
          message: 'Application request limit reached',
          type: 'OAuthException',
          code: 613,
          fbtrace_id: 'trace_ratelimit_789',
        },
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  };

  const rateLimitDispatcher = new InstagramGraphApiDispatcher({
    customFetch: mockRateLimitFetch as typeof fetch,
    maxRetries: 2,
    initialBackoffMs: 10,
  });

  const rateLimitResult = await rateLimitDispatcher.sendDirectMessage({
    recipientId: 'patient_789',
    text: 'test',
    accountId: 'drmustafa_hadi',
    incomingMessageTimestamp: NOW,
    now: NOW,
  });

  assert(rateLimitResult.success === false, 'Returns success: false when rate limit persists');
  assert(rateLimitAttempts === 3, 'Dispatcher retried 2 times (total 3 attempts) with backoff');
  if (!rateLimitResult.success) {
    assert(rateLimitResult.error === 'RATE_LIMIT_EXCEEDED', 'Classified as RATE_LIMIT_EXCEEDED');
  }

  // ---------------------------------------------------------------------------
  // 8. 24-HOUR MESSAGING WINDOW POLICY
  // ---------------------------------------------------------------------------
  console.log('\n--- 8. Testing Mandatory 24-Hour Messaging Policy ---');
  const insideWindowTimestamp = NOW - 2 * 60 * 60 * 1000; // 2 hours ago
  const outsideWindowTimestamp = NOW - 26 * 60 * 60 * 1000; // 26 hours ago

  assert(isWithin24HourWindow(insideWindowTimestamp, NOW) === true, 'Message from 2 hours ago is INSIDE 24h window');
  assert(isWithin24HourWindow(outsideWindowTimestamp, NOW) === false, 'Message from 26 hours ago is OUTSIDE 24h window');
  assert(getElapsedHours(outsideWindowTimestamp, NOW) === 26, 'Calculates elapsed time accurately as 26 hours');

  // Test Webhook processing outside window
  const outOfWindowPayload: InstagramWebhookPayload = {
    object: 'instagram',
    entry: [
      {
        id: '17841400000000000',
        time: NOW,
        messaging: [
          {
            sender: { id: 'patient_delayed_user' },
            recipient: { id: '17841400000000000' },
            timestamp: outsideWindowTimestamp,
            message: { mid: 'm_mid_delayed_01', text: 'سلام دكتور' },
          },
        ],
      },
    ],
  };

  const resOutOfWindow = await processInstagramWebhook(outOfWindowPayload, {
    deduplicator: new MessageDeduplicator(),
    takeoverTracker: new HumanTakeoverTracker(),
    dispatcher: testDispatcher,
    now: NOW,
  });

  assert(
    resOutOfWindow.results[0].status === 'OUTSIDE_24H_WINDOW_ESCALATED',
    'Out-of-window message is blocked from automated reply and escalated'
  );
  assert(resOutOfWindow.results[0].isWithin24hWindow === false, 'Flag isWithin24hWindow is false');
  assert(resOutOfWindow.results[0].requiresHumanHandoff === true, 'Escalated to human reception');
  assert(
    Boolean(resOutOfWindow.results[0].handoffReason?.includes('24 ساعة')),
    'Handoff reason specifically cites 24-hour Meta messaging policy'
  );

  // ---------------------------------------------------------------------------
  // 9. HUMAN TAKEOVER (SUPPRESSING AUTOMATED AI REPLIES)
  // ---------------------------------------------------------------------------
  console.log('\n--- 9. Testing Human Takeover & AI Suppression ---');
  const takeoverTracker9 = new HumanTakeoverTracker();
  takeoverTracker9.setTakeover('patient_under_takeover', 'المراجع طلب التحدث مباشرة مع د. مصطفى');

  assert(
    takeoverTracker9.isTakeoverActive('patient_under_takeover') === true,
    'Takeover tracker reports active takeover for patient'
  );

  const takeoverPayload: InstagramWebhookPayload = {
    object: 'instagram',
    entry: [
      {
        id: '17841400000000000',
        time: NOW,
        messaging: [
          {
            sender: { id: 'patient_under_takeover' },
            recipient: { id: '17841400000000000' },
            timestamp: NOW,
            message: { mid: 'm_mid_takeover_01', text: 'دكتور وين صرت؟' },
          },
        ],
      },
    ],
  };

  const resTakeover = await processInstagramWebhook(takeoverPayload, {
    deduplicator: new MessageDeduplicator(),
    takeoverTracker: takeoverTracker9,
    dispatcher: testDispatcher,
    now: NOW,
  });

  assert(
    resTakeover.results[0].status === 'HUMAN_TAKEOVER_ACTIVE_NO_AI_REPLY',
    'Automated AI reply is strictly suppressed when human takeover is active'
  );
  assert(resTakeover.results[0].isHandedOverToHuman === true, 'isHandedOverToHuman remains true');

  // ---------------------------------------------------------------------------
  // 10. STRICT ORTHODONTIC PRICING PROHIBITION ON WEBHOOK PATH
  // ---------------------------------------------------------------------------
  console.log('\n--- 10. Testing Strict Orthodontic Pricing Prohibition on Webhook Inbound ---');
  const orthoPriceQueries = [
    'شكد سعر التقويم؟',
    'أريد أقساط للتقويم',
    'orthodontic price',
    'braces cost',
  ];

  for (const query of orthoPriceQueries) {
    const orthoPayload: InstagramWebhookPayload = {
      object: 'instagram',
      entry: [
        {
          id: '17841400000000000',
          time: NOW,
          messaging: [
            {
              sender: { id: 'patient_ortho_inquirer' },
              recipient: { id: '17841400000000000' },
              timestamp: NOW,
              message: { mid: `m_ortho_${Date.now()}_${Math.random()}`, text: query },
            },
          ],
        },
      ],
    };

    const resOrtho = await processInstagramWebhook(orthoPayload, {
      deduplicator: new MessageDeduplicator(),
      takeoverTracker: new HumanTakeoverTracker(),
      dispatcher: testDispatcher,
      now: NOW,
    });

    const reply = resOrtho.results[0].aiReplyText || '';
    assert(
      reply.includes('بالنسبة لأسعار تقويم الأسنان، تختلف حسب الحالة'),
      `Inquiry "${query}" returns approved mandatory policy opening`
    );
    assert(
      !reply.includes('1,000,000') && !reply.includes('1,500,000') && !reply.includes('1,200,000') && !reply.includes('دينار'),
      `Inquiry "${query}" discloses zero prices or currency figures`
    );
    assert(
      resOrtho.results[0].requiresHumanHandoff === true,
      `Inquiry "${query}" strictly mandates human reception handoff`
    );
  }

  // ---------------------------------------------------------------------------
  // 11. PERSONAL / CLINIC ACCOUNT ISOLATION
  // ---------------------------------------------------------------------------
  console.log('\n--- 11. Testing Personal/Clinic Account Workspace Isolation ---');
  const personalAccountCheck = resolveTargetAccount('17841400000000000');
  assert(personalAccountCheck.accountId === PILOT_ACCOUNT_ID, 'Pilot account ID correctly resolved');
  assert(personalAccountCheck.isLiveAllowed === true, 'Pilot account allows live processing');

  const clinicAccountCheck = resolveTargetAccount('17841400000000001');
  assert(clinicAccountCheck.accountId === CLINIC_ACCOUNT_ID, 'Clinic account ID correctly resolved');
  assert(clinicAccountCheck.isClinic === true, 'Identified as clinic account');
  assert(clinicAccountCheck.isLiveAllowed === false, 'Clinic account strictly blocks live processing (Locked in Demo Mode)');

  // Test Webhook event arriving for clinic account
  const clinicPayload: InstagramWebhookPayload = {
    object: 'instagram',
    entry: [
      {
        id: '17841400000000001', // Clinic ID
        time: NOW,
        messaging: [
          {
            sender: { id: 'patient_at_clinic' },
            recipient: { id: '17841400000000001' },
            timestamp: NOW,
            message: { mid: 'm_clinic_01', text: 'مرحبا عيادة المسواك' },
          },
        ],
      },
    ],
  };

  const resClinic = await processInstagramWebhook(clinicPayload, {
    deduplicator: new MessageDeduplicator(),
    takeoverTracker: new HumanTakeoverTracker(),
    dispatcher: testDispatcher,
    now: NOW,
  });

  assert(
    resClinic.results[0].status === 'CLINIC_ACCOUNT_LOCKED',
    'Clinic webhook event is blocked with CLINIC_ACCOUNT_LOCKED'
  );
  assert(resClinic.results[0].accountId === CLINIC_ACCOUNT_ID, 'Retained clinic account ID isolation');
  assert(resClinic.summary.clinicBlocked === 1, 'Summary metrics record 1 clinic blocked event');

  // Test Outbound Dispatch for clinic account is prohibited
  const clinicDispatchAttempt = await testDispatcher.sendDirectMessage({
    recipientId: 'patient_999',
    text: 'Attempt to send from clinic',
    accountId: 'almeswaksmile_iq',
  });
  assert(clinicDispatchAttempt.success === false, 'Outbound dispatcher refuses to dispatch for clinic account');
  if (!clinicDispatchAttempt.success) {
    assert(
      clinicDispatchAttempt.error === 'ACCOUNT_ISOLATION_PROHIBITION',
      'Dispatcher returned ACCOUNT_ISOLATION_PROHIBITION error code'
    );
  }

  // ---------------------------------------------------------------------------
  // 12. SECURITY & LOG SANITIZATION
  // ---------------------------------------------------------------------------
  console.log('\n--- 12. Testing Security & Secret Masking ---');
  const dirtyLog = 'Calling Meta with Authorization: Bearer EAAB_secret_token_12345&app_secret=my_secret_999';
  const cleanLog = sanitizeLogString(dirtyLog);
  assert(!cleanLog.includes('EAAB_secret_token_12345'), 'Bearer access token is masked from logs');
  assert(!cleanLog.includes('my_secret_999'), 'App secret is masked from logs');
  assert(cleanLog.includes('Bearer [MASKED]'), 'Sanitizer replaces token with [MASKED]');

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} Passed (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('================================================================');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal error running pipeline tests:', err);
  process.exit(1);
});
