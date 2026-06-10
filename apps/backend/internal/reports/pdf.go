package reports

import (
	"bytes"
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/jung-kurt/gofpdf"
)

func (s *Service) ExportStockToPDF(
	ctx context.Context,
	companyID string,
	query ReportQueryInput,
) ([]byte, string, error) {
	report, err := s.GetStockReport(ctx, companyID, query)
	if err != nil {
		return nil, "", err
	}
	rows, _ := report["data"].([]map[string]any)

	pdf := gofpdf.New("L", "mm", "A4", "")
	pdf.SetMargins(8, 10, 8)
	pdf.AddPage()
	pdf.SetFont("Arial", "B", 14)
	pdf.Cell(0, 8, "Stock Report")
	pdf.Ln(10)

	pdf.SetFont("Arial", "B", 9)
	headers := []string{"Ombor", "Mahsulot", "Variant", "SKU", "Miqdor", "Kirim narxi", "Sotuv narxi", "Qiymat"}
	widths := []float64{35, 48, 35, 28, 20, 28, 28, 30}
	for i, h := range headers {
		pdf.CellFormat(widths[i], 7, h, "1", 0, "C", false, 0, "")
	}
	pdf.Ln(-1)

	pdf.SetFont("Arial", "", 8)
	for _, row := range rows {
		values := []string{
			fmt.Sprintf("%v", row["warehouse"]),
			fmt.Sprintf("%v", row["product"]),
			fmt.Sprintf("%v", row["variant"]),
			fmt.Sprintf("%v", row["sku"]),
			fmt.Sprintf("%.2f", anyToFloat(row["quantity"])),
			fmt.Sprintf("%.2f", anyToFloat(row["purchasePrice"])),
			fmt.Sprintf("%.2f", anyToFloat(row["salePrice"])),
			fmt.Sprintf("%.2f", anyToFloat(row["inventoryValue"])),
		}
		for i, v := range values {
			pdf.CellFormat(widths[i], 6, v, "1", 0, "L", false, 0, "")
		}
		pdf.Ln(-1)
	}

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, "", err
	}
	filename := fmt.Sprintf("zaxira-%s.pdf", time.Now().UTC().Format("2006-01-02"))
	return buf.Bytes(), filename, nil
}

func (s *Service) GeneratePartnerBalancePDF(
	ctx context.Context,
	companyID, partnerCompanyID string,
	query ReportQueryInput,
) ([]byte, string, error) {
	data, err := s.GetPartnerDetailedBalance(ctx, companyID, partnerCompanyID, query)
	if err != nil {
		return nil, "", err
	}
	partner, _ := data["partner"].(map[string]any)
	myCompany, _ := data["myCompany"].(map[string]any)
	transactions, _ := data["transactions"].([]map[string]any)

	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(10, 10, 10)
	pdf.AddPage()

	pdf.SetFont("Arial", "B", 13)
	pdf.Cell(0, 8, "Ozaro hisob-kitoblar dalolatnomasi")
	pdf.Ln(10)

	pdf.SetFont("Arial", "B", 10)
	pdf.Cell(95, 6, "Tashkilot")
	pdf.Cell(95, 6, "Hamkor")
	pdf.Ln(6)

	pdf.SetFont("Arial", "", 9)
	pdf.Cell(95, 5, fmt.Sprintf("%v", myCompany["name"]))
	pdf.Cell(95, 5, fmt.Sprintf("%v", partner["name"]))
	pdf.Ln(5)
	pdf.Cell(95, 5, fmt.Sprintf("STIR: %v", myCompany["tin"]))
	pdf.Cell(95, 5, fmt.Sprintf("STIR: %v", partner["tin"]))
	pdf.Ln(10)

	pdf.SetFont("Arial", "B", 8)
	headers := []string{"Sana", "Operatsiya", "Valyuta", "Debet", "Kredit", "Qoldiq"}
	widths := []float64{22, 70, 18, 25, 25, 25}
	for i, h := range headers {
		pdf.CellFormat(widths[i], 7, h, "1", 0, "C", false, 0, "")
	}
	pdf.Ln(-1)

	pdf.SetFont("Arial", "", 8)
	balances := map[string]float64{"UZS": 0, "USD": 0}
	for _, t := range transactions {
		date, _ := t["date"].(time.Time)
		currency := normCurrency(fmt.Sprintf("%v", t["currency"]))
		debit := anyToFloat(t["debit"])
		credit := anyToFloat(t["credit"])
		balances[currency] += debit - credit

		row := []string{
			date.Format("2006-01-02"),
			fmt.Sprintf("%v", t["description"]),
			currency,
			floatCell(debit),
			floatCell(credit),
			fmt.Sprintf("%.2f", balances[currency]),
		}
		for i, v := range row {
			pdf.CellFormat(widths[i], 6, v, "1", 0, "L", false, 0, "")
		}
		pdf.Ln(-1)
	}

	pdf.Ln(4)
	pdf.SetFont("Arial", "B", 9)
	pdf.Cell(0, 6, fmt.Sprintf("Jami UZS qoldiq: %.2f", balances["UZS"]))
	pdf.Ln(6)
	pdf.Cell(0, 6, fmt.Sprintf("Jami USD qoldiq: %.2f", balances["USD"]))

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, "", err
	}

	partnerName := fmt.Sprintf("%v", partner["name"])
	filename := fmt.Sprintf(
		"akt-sverka-%s-%s.pdf",
		safeFileName(strings.ToLower(partnerName)),
		time.Now().UTC().Format("2006-01"),
	)
	return buf.Bytes(), filename, nil
}

func floatCell(v float64) string {
	if v == 0 {
		return ""
	}
	return fmt.Sprintf("%.2f", v)
}
