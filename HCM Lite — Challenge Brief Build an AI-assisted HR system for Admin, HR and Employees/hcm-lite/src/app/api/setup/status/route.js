import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import User from '@/models/User';
import CompanySettings from '@/models/CompanySettings';
import { ensureDefaultAdmin } from '@/lib/init-admin';

export async function GET() {
  try {
    await connectDB();
    
    // Automatically provision default admin from environment/config (only once per process)
    if (!global.__hcm_seeded) {
      await ensureDefaultAdmin();
      global.__hcm_seeded = true;
    }

    const adminCount = await User.countDocuments({ role: 'admin' });
    const settings = await CompanySettings.findOne();

    return NextResponse.json({
      isSetupRequired: adminCount === 0,
      companyName: settings ? settings.company_name : 'HCM Lite Technologies',
      hasEnvAdmin: true,
    });
  } catch (err) {
    console.error('Setup status check error:', err);
    return NextResponse.json(
      { error: 'Failed to verify system setup status', details: err.message },
      { status: 500 }
    );
  }
}
