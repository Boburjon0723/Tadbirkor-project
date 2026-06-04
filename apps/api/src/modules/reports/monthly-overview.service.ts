import { Injectable } from '@nestjs/common';
import { CompaniesService } from '../companies/companies.service';
import { ExpensesService } from '../expenses/expenses.service';
import { IncomeService } from '../income/income.service';
import { PayrollDataService } from '../payroll/payroll-data.service';
import { PosReportsService } from './pos-reports.service';

type CurrencyBucket = { UZS: number; USD: number };

function initBucket(): CurrencyBucket {
  return { UZS: 0, USD: 0 };
}

function addBucket(target: CurrencyBucket, source: Record<string, number> | undefined) {
  if (!source) return;
  for (const [cur, val] of Object.entries(source)) {
    const key = cur.toUpperCase() === 'USD' ? 'USD' : 'UZS';
    target[key] += Number(val || 0);
  }
}

function monthDateRange(year: number, month: number) {
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { from, to, year, month };
}

@Injectable()
export class MonthlyOverviewService {
  constructor(
    private readonly companiesService: CompaniesService,
    private readonly posReports: PosReportsService,
    private readonly incomeService: IncomeService,
    private readonly expensesService: ExpensesService,
    private readonly payrollData: PayrollDataService,
  ) {}

  async getOverview(companyId: string, query: { year?: number; month?: number }) {
    const now = new Date();
    const year = query.year ?? now.getFullYear();
    const month = query.month ?? now.getMonth() + 1;
    const period = monthDateRange(year, month);

    const [posOn, incomeOn, expensesOn, payrollOn] = await Promise.all([
      this.companiesService.isModuleEnabled(companyId, 'POS'),
      this.companiesService.isModuleEnabled(companyId, 'INCOME'),
      this.companiesService.isModuleEnabled(companyId, 'EXPENSES'),
      this.companiesService.isModuleEnabled(companyId, 'PAYROLL'),
    ]);

    const modules = { pos: posOn, income: incomeOn, expenses: expensesOn, payroll: payrollOn };

    const pos = posOn
      ? await this.posReports.getSummary(companyId, {
          dateFrom: period.from,
          dateTo: period.to,
        })
      : null;

    const income = incomeOn
      ? await this.incomeService.getSummary(companyId, {
          from: period.from,
          to: period.to,
        })
      : null;

    const expenses = expensesOn
      ? await this.expensesService.getSummary(companyId, {
          from: period.from,
          to: period.to,
        })
      : null;

    const payroll = payrollOn
      ? await this.payrollData.getMonthlyCostSummary(companyId, year, month)
      : null;

    const cashIn = initBucket();
    const cashOut = initBucket();

    if (pos) {
      cashIn.UZS += Number(pos.cashSales?.UZS || 0) + Number(pos.cardSales?.UZS || 0);
      cashIn.USD += Number(pos.cashSales?.USD || 0) + Number(pos.cardSales?.USD || 0);
    }
    if (income) {
      addBucket(cashIn, income.totals);
    }

    if (expenses) {
      addBucket(cashOut, expenses.approved);
    }
    if (payroll) {
      cashOut.UZS += Number(payroll.cashOutUZS || 0);
    }

    const netProfitUZS = Math.round(cashIn.UZS - cashOut.UZS);
    const netProfitUSD = Math.round((cashIn.USD - cashOut.USD) * 100) / 100;

    const warnings: string[] = [];
    if (pos && income) {
      warnings.push(
        'POS savdo va Kirimlar daftarini bir xil summani ikki marta kiritmaslik kerak.',
      );
    }

    return {
      period,
      modules,
      mode: 'CASH_FLOW' as const,
      revenue: {
        pos: pos
          ? {
              receiptsCount: pos.receiptsCount,
              itemsSold: pos.itemsSold,
              grossSales: pos.grossSales,
              discounts: pos.discounts,
              netSales: pos.netSales,
              cashSales: pos.cashSales,
              cardSales: pos.cardSales,
              creditSales: pos.creditSales,
            }
          : null,
        income,
      },
      costs: {
        expenses: expenses
          ? {
              approved: expenses.approved,
              pending: expenses.pending,
              rejected: expenses.rejected,
              counts: expenses.counts,
            }
          : null,
        payroll,
      },
      result: {
        cashIn,
        cashOut,
        netProfit: { UZS: netProfitUZS, USD: netProfitUSD },
        status:
          netProfitUZS > 0 ? 'PROFIT' : netProfitUZS < 0 ? 'LOSS' : 'NEUTRAL',
      },
      warnings,
    };
  }
}
