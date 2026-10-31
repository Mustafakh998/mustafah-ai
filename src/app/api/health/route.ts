import { NextResponse } from 'next/server';
import { defaultPersistentStore } from '@/lib/db/persistence';

export async function GET() {
  try {
    const dbStatus = await defaultPersistentStore.validateConnection();
    const verifyTokenConfigured = Boolean(process.env.META_VERIFY_TOKEN);
    const appSecretConfigured = Boolean(process.env.META_APP_SECRET);
    const pilotAccountConfigured = Boolean(
      process.env.DR_MUSTAFA_ACCESS_TOKEN && !process.env.DR_MUSTAFA_ACCESS_TOKEN.includes('your_')
    );
    const failSafeClosed =
      process.env.FAIL_SAFE_CLOSED === 'true' ||
      (process.env.NODE_ENV === 'production' && dbStatus.mode === 'supabase_rest');

    const isHealthy = dbStatus.connected && verifyTokenConfigured;

    return NextResponse.json(
      {
        status: isHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        app: 'MustafaH-AI — Baghdad Edition',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        database: {
          connected: dbStatus.connected,
          latencyMs: dbStatus.latencyMs,
          mode: dbStatus.mode,
          poolerMode: dbStatus.poolerMode,
          databaseUrlConfigured: dbStatus.databaseUrlConfigured,
          serviceRoleConfigured: dbStatus.serviceRoleConfigured,
          error: dbStatus.error,
        },
        failSafePolicy: {
          failSafeClosedActive: failSafeClosed,
          behaviorWhenUnreachable: 'Suppress automated AI replies, acknowledge with 200 OK, escalate to staff',
        },
        meta: {
          verifyTokenConfigured,
          appSecretConfigured,
          pilotAccountConfigured,
          clinicAccountLockedInDemo: true,
          primaryAuthMethod:
            'Instagram Graph API via Facebook Login for Business (Page Access Token)',
          targetAccount: '@drmustafa_hadi',
          isolatedClinicAccount: '@almeswaksmile.iq (DEMO_MODE_LOCKED)',
        },
        policyGuardrails: {
          strictOrthodonticPricingProhibition: 'ENFORCED',
          emergencyEscalationHotline: process.env.NEXT_PUBLIC_CLINIC_PHONE || '07768886667',
          window24HoursEnforced: true,
        },
      },
      { status: isHealthy ? 200 : 503 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Health check failed';
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: message,
      },
      { status: 500 }
    );
  }
}
