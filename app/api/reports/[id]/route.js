import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionUser } from '@/lib/auth';
import { getDatabase } from '@/lib/db';

export async function GET(request, { params }) {
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

    const { id } = params;
    const db = await getDatabase();
    
    const report = await db.get(
      'SELECT * FROM reports WHERE id = ? AND user_id = ?',
      [id, user.id]
    );

    if (!report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    const sources = await db.all(
      'SELECT * FROM report_sources WHERE report_id = ? ORDER BY created_at',
      [id]
    );

    return NextResponse.json({ 
      report: {
        ...report,
        sources,
        financial_metrics: JSON.parse(report.financial_metrics || '{}')
      }
    });
  } catch (error) {
    console.error('Get report error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
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

    const { id } = params;
    const db = await getDatabase();
    
    const result = await db.run(
      'DELETE FROM reports WHERE id = ? AND user_id = ?',
      [id, user.id]
    );

    if (result.changes === 0) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete report error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request, { params }) {
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

    const { id } = params;
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
      // Update report
      const updateResult = await db.run(
        `UPDATE reports 
         SET title = ?, report_date = ?, global_tax_rate = ?, default_payoneer_fee = ?, 
             financial_metrics = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND user_id = ?`,
        [
          title,
          reportDate,
          globalTaxRate,
          defaultPayoneerFee,
          JSON.stringify(results?.totals || {}),
          id,
          user.id
        ]
      );

      if (updateResult.changes === 0) {
        await db.run('ROLLBACK');
        return NextResponse.json(
          { error: 'Report not found' },
          { status: 404 }
        );
      }

      // Delete existing sources
      await db.run('DELETE FROM report_sources WHERE report_id = ?', [id]);

      // Insert updated sources
      for (const source of sources) {
        await db.run(
          `INSERT INTO report_sources 
           (report_id, source_type, source_date, gross_amount, misc_fee, tax_rate, 
            payoneer_fee, conversion_rate) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
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
      
      return NextResponse.json({ success: true });
    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Update report error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}