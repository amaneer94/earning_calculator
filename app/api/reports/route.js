import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { openDb } from '@/lib/db';

export async function GET(request) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    const user = await getSessionUser(token);
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const db = await openDb();
    const reports = await db.all(
      `SELECT id, title, report_date, global_tax_rate, default_payoneer_fee,
              total_gross, subtotal_receivable, grand_total_receivable,
              created_at, updated_at
       FROM reports 
       WHERE user_id = ? 
       ORDER BY updated_at DESC`,
      [user.id]
    );

    return NextResponse.json({ reports });
  } catch (error) {
    console.error('Get reports error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    const user = await getSessionUser(token);
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const {
      title,
      reportDate,
      globalTaxRate,
      defaultPayoneerFee,
      sources,
      totals
    } = await request.json();

    const db = await openDb();
    
    // Start transaction
    await db.run('BEGIN TRANSACTION');
    
    try {
      // Insert report
      const reportResult = await db.run(
        `INSERT INTO reports (
          user_id, title, report_date, global_tax_rate, default_payoneer_fee,
          total_gross, total_misc_fee, total_tax, total_net,
          subtotal_receivable, global_tax_amount, grand_total_receivable
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          user.id, title, reportDate, globalTaxRate, defaultPayoneerFee,
          totals.totalGross, totals.totalMiscFee, totals.totalTax, totals.totalNet,
          totals.subtotalReceivable, totals.globalTaxAmount, totals.grandTotalReceivable
        ]
      );

      const reportId = reportResult.lastID;

      // Insert sources
      for (const source of sources) {
        await db.run(
          `INSERT INTO report_sources (
            report_id, source_type, source_date, gross_amount,
            fiverr_fee, payoneer_fee, conversion_rate, misc_fee,
            tax_rate, tax_amount, net, receivable, percent_of_gross, gross_in_pkr
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            reportId, source.sourceType, source.date, source.grossAmount,
            source.fiverrFee, source.payoneerFee, source.conversionRate, source.miscFee,
            source.taxRate, source.taxAmount, source.net, source.receivable,
            source.percentOfGross, source.grossInPKR
          ]
        );
      }

      await db.run('COMMIT');

      return NextResponse.json({ 
        success: true, 
        reportId,
        message: 'Report saved successfully' 
      });
    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Save report error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}