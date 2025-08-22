import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { openDb } from '@/lib/db';

export async function GET(request, { params }) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    const user = await getSessionUser(token);
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const db = await openDb();
    
    // Get report
    const report = await db.get(
      `SELECT * FROM reports WHERE id = ? AND user_id = ?`,
      [params.id, user.id]
    );

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    // Get sources
    const sources = await db.all(
      `SELECT * FROM report_sources WHERE report_id = ? ORDER BY id`,
      [params.id]
    );

    return NextResponse.json({ report, sources });
  } catch (error) {
    console.error('Get report error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
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
    
    // Check if report exists and belongs to user
    const existingReport = await db.get(
      'SELECT id FROM reports WHERE id = ? AND user_id = ?',
      [params.id, user.id]
    );

    if (!existingReport) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    // Start transaction
    await db.run('BEGIN TRANSACTION');
    
    try {
      // Update report
      await db.run(
        `UPDATE reports SET 
          title = ?, report_date = ?, global_tax_rate = ?, default_payoneer_fee = ?,
          total_gross = ?, total_misc_fee = ?, total_tax = ?, total_net = ?,
          subtotal_receivable = ?, global_tax_amount = ?, grand_total_receivable = ?,
          updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          title, reportDate, globalTaxRate, defaultPayoneerFee,
          totals.totalGross, totals.totalMiscFee, totals.totalTax, totals.totalNet,
          totals.subtotalReceivable, totals.globalTaxAmount, totals.grandTotalReceivable,
          params.id
        ]
      );

      // Delete existing sources
      await db.run('DELETE FROM report_sources WHERE report_id = ?', [params.id]);

      // Insert new sources
      for (const source of sources) {
        await db.run(
          `INSERT INTO report_sources (
            report_id, source_type, source_date, gross_amount,
            fiverr_fee, payoneer_fee, conversion_rate, misc_fee,
            tax_rate, tax_amount, net, receivable, percent_of_gross, gross_in_pkr
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            params.id, source.sourceType, source.date, source.grossAmount,
            source.fiverrFee, source.payoneerFee, source.conversionRate, source.miscFee,
            source.taxRate, source.taxAmount, source.net, source.receivable,
            source.percentOfGross, source.grossInPKR
          ]
        );
      }

      await db.run('COMMIT');

      return NextResponse.json({ 
        success: true, 
        message: 'Report updated successfully' 
      });
    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Update report error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    const user = await getSessionUser(token);
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const db = await openDb();
    
    // Check if report exists and belongs to user
    const existingReport = await db.get(
      'SELECT id FROM reports WHERE id = ? AND user_id = ?',
      [params.id, user.id]
    );

    if (!existingReport) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    // Delete report (sources will be deleted automatically due to CASCADE)
    await db.run('DELETE FROM reports WHERE id = ?', [params.id]);

    return NextResponse.json({ 
      success: true, 
      message: 'Report deleted successfully' 
    });
  } catch (error) {
    console.error('Delete report error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}