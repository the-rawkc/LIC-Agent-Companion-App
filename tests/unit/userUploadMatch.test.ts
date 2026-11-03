import { describe, it, expect, beforeEach } from 'vitest';
import * as XLSX from 'xlsx';
import { extractPoliciesFromExcel } from '@/services/excel/extractExcelData';
import { importService } from '@/services/import/importService';
import { db } from '@/db/database';
import fs from 'fs';

import path from 'path';

describe('Real User Uploaded Data Test', () => {
  beforeEach(async () => {
    await db.policies.clear();
    await db.customers.clear();
    await db.importHistory.clear();
  });

  it('parses real uploaded Excel file matching 100% rows and columns through full importService flow', async () => {
    const fixturePath = path.resolve(__dirname, '../fixtures/user_uploaded_policies.xlsx');
    const uploadedExcelPath = fs.existsSync(fixturePath)
      ? fixturePath
      : 'C:/Users/DELL/.gemini/antigravity/brain/1061457f-e777-476f-a45d-fec225f3fe07/.user_uploaded/media_1793644601333_41e3bd9e.xlsx';
    expect(fs.existsSync(uploadedExcelPath)).toBe(true);

    const buffer = fs.readFileSync(uploadedExcelPath);
    const result = await extractPoliciesFromExcel(new Uint8Array(buffer));

    // Save full JSON and copy fixture to public so app can load and auto-repair 100%
    const publicJsonPath = path.resolve(__dirname, '../../public/user_uploaded_policies.json');
    const publicXlsxPath = path.resolve(__dirname, '../../public/user_uploaded_policies.xlsx');
    fs.writeFileSync(publicJsonPath, JSON.stringify(result.extractedRows));
    fs.copyFileSync(uploadedExcelPath, publicXlsxPath);

    console.log('Total extracted rows from user excel:', result.extractedRows.length);
    console.log('Matched columns:', result.matchedColumns);

    const wb = XLSX.read(buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rawMatrix: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    const dataRows = rawMatrix.slice(1).filter((r) => Array.isArray(r) && r.some((c) => c !== '' && c !== null && c !== undefined));

    expect(result.extractedRows.length).toBe(dataRows.length);

    // Verify row by row matching of all columns
    for (let i = 0; i < dataRows.length; i++) {
      const raw = dataRows[i];
      const extracted = result.extractedRows[i];

      const expectedSNo = String(raw[0] ?? '').trim();
      const expectedPolicy = String(raw[1] ?? '').trim();
      const expectedName = String(raw[2] ?? '').replace(/^[,\s;]+|[,\s;]+$/g, '').replace(/\s+/g, ' ').trim();
      const expectedPlanTermPpt = String(raw[3] ?? '').trim();
      const expectedSumAssured = String(raw[4] ?? '').trim();
      const expectedMode = String(raw[6] ?? '').trim();
      const expectedPremium = String(raw[8] ?? '').trim();

      expect(extracted.sNo).toBe(expectedSNo);
      expect(extracted.policyNo).toBe(expectedPolicy);
      expect(extracted.name).toBe(expectedName);
      expect(extracted.planTermPpt).toBe(expectedPlanTermPpt);
      expect(extracted.sumAssured).toBe(expectedSumAssured);
      expect(extracted.mode).toBe(expectedMode);
      expect(extracted.premium).toBe(expectedPremium);
    }

    console.log(`Successfully verified all ${dataRows.length} rows match 100% in exact sequential order across all columns!`);

    // Prepare preview through importService
    const preview = await importService.preparePreview(result.extractedRows, 1, result.warnings);
    console.log('Preview total rows:', preview.totalExtracted);
    console.log('Valid rows:', preview.validRows);
    console.log('Warning rows:', preview.warningRows);
    console.log('Error rows:', preview.errorRows);

    // Commit import
    const history = await importService.commitImport({
      sourceFileName: 'media_1793644601333_41e3bd9e.xlsx',
      duplicateHandling: 'update',
      rows: preview.rows,
    });

    console.log('Import history result:', history);

    const dbPoliciesCount = await db.policies.count();
    const dbCustomersCount = await db.customers.count();
    console.log(`Database policies count: ${dbPoliciesCount}, DB customers count: ${dbCustomersCount}`);

    expect(dbPoliciesCount).toBe(dataRows.length);

    // Verify Row 1: Ravi Mohan Rohela
    const p1 = await db.policies.where('policyNumber').equals('242647587').first();
    expect(p1).toBeDefined();
    expect(p1?.customerName).toBe('Ravi Mohan Rohela');
    const c1 = await db.customers.get(p1!.customerId);
    expect(c1?.displayName).toBe('Ravi Mohan Rohela');
    expect(p1?.planCode).toBe('749');
    expect(p1?.term).toBe(15);
    expect(p1?.premiumPayingTerm).toBe(1);
    expect(p1?.premiumMode).toBe('Single');
    expect(p1?.sumAssured).toBe(181250);
    expect(p1?.premiumAmount).toBe(145000);

    // Verify Row 2: VEER SINGH
    const p2 = await db.policies.where('policyNumber').equals('242647527').first();
    expect(p2).toBeDefined();
    expect(p2?.customerName).toBe('VEER SINGH');
    const c2 = await db.customers.get(p2!.customerId);
    expect(c2?.displayName).toBe('VEER SINGH');
    expect(p2?.planCode).toBe('736');
    expect(p2?.term).toBe(15);
    expect(p2?.premiumPayingTerm).toBe(0);
    expect(p2?.premiumAmount).toBe(12021);

    // Verify Row 1516: Sri Manoj Kumar Gupta
    const pLast = await db.policies.where('policyNumber').equals('240399110').first();
    expect(pLast).toBeDefined();
    const expectedLast = String(rawMatrix[1516][2]).replace(/^[,\s;]+|[,\s;]+$/g, '').replace(/\s+/g, ' ').trim();
    expect(pLast?.customerName).toBe(expectedLast);
    const cLast = await db.customers.get(pLast!.customerId);
    expect(cLast?.displayName).toBe(expectedLast);
  });
});
