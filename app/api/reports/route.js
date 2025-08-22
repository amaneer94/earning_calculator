import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionUser } from '@/lib/auth';
import { getDatabase } from '@/lib/db';

export async function GET() {
  try {
    const cookieStore = cookies();
    const sessionToken = cookieStore.get('session')?.value;
    const user = await getSessionUser(sessionToken);

    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const db = await getDatabase();
    const reports = await db.all(
      'SELECT * FROM reports WHERE user_id = ? ORDER BY created_at DESC',
      [user.id]
    );

    return NextResponse.json({ reports });
  } catch (error) {
    console.error('Get reports error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const cookieStore = cookies();
    const sessionToken = cookieStore.get('session')?.value;
    const user = await getSessionUser(sessionToken);

    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const {
      title,
      reportDate,
      globalTaxRate,
      defaultPayoneerFee,
      sources,
      results
    } = await request.json();

    const db = await getDatabase();
    
    // Start transaction
    await db.run('BEGIN TRANSACTION');
    
    try {
      // Insert report
      const reportResult = await db.run(
        `INSERT INTO reports 
         (user_id, title, report_date, global_tax_rate, default_payoneer_fee, financial_metrics) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          user.id,
          title,
          reportDate,
          globalTaxRate,
          defaultPayoneerFee,
          JSON.stringify(results?.totals || {})
        ]
      );

      const reportId = reportResult.lastID;

      // Insert sources
      for (const source of sources) {
        await db.run(
          `INSERT INTO report_sources 
           (report_id, source_type, source_date, gross_amount, misc_fee, tax_rate, 
            payoneer_fee, conversion_rate) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            reportId,
            source.sourceType,
            source.sourceDate,
            parseFloat(source.grossAmount) || 0,
            parseFloat(source.miscFee) || 0,
            parseFloat(source.taxRate) || 0,
            parseFloat(source.payoneerFee) || 0,
            parseFloat(source.conversionRate) || 0
          ]
        );
      }

      await db.run('COMMIT');
      
      return NextResponse.json({ success: true, reportId });
    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Create report error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}