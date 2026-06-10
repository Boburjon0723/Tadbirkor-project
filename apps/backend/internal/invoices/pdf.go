package invoices

import (
	"bytes"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/jung-kurt/gofpdf"
)

type pdfParty struct {
	Name    string
	TIN     string
	Phone   string
	Address string
}

type pdfItem struct {
	ProductName  string
	VariantName  string
	CategoryName string
	Quantity     float64
	Price        float64
	Total        float64
}

func generateInvoicePDF(invoiceNumber string, date time.Time, status string, seller, buyer pdfParty, currency string, items []pdfItem, total float64) ([]byte, error) {
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(15, 15, 15)
	pdf.AddPage()

	pdf.SetFont("Arial", "B", 18)
	pdf.SetTextColor(30, 64, 175)
	pdf.Cell(0, 8, "AXIS ERP")
	pdf.Ln(5)
	pdf.SetFont("Arial", "", 9)
	pdf.SetTextColor(100, 116, 139)
	pdf.Cell(0, 5, "ERP & Logistika Tizimi")
	pdf.Ln(8)

	displayNo := strings.TrimPrefix(strings.ToUpper(invoiceNumber), "INV-")
	pdf.SetXY(120, 15)
	pdf.SetFont("Arial", "B", 14)
	pdf.SetTextColor(0, 0, 0)
	pdf.Cell(0, 7, fmt.Sprintf("BUYURTMA № %s", displayNo))
	pdf.Ln(6)
	pdf.SetX(120)
	pdf.SetFont("Arial", "", 9)
	pdf.SetTextColor(100, 116, 139)
	pdf.Cell(0, 5, fmt.Sprintf("Sana: %s", date.Format("02.01.2006")))
	pdf.Ln(5)
	pdf.SetX(120)
	pdf.Cell(0, 5, fmt.Sprintf("Holat: %s", status))
	pdf.SetY(40)

	pdf.SetTextColor(59, 130, 246)
	pdf.SetFont("Arial", "B", 8)
	pdf.Cell(95, 5, "Yetkazib beruvchi")
	pdf.Cell(0, 5, "Buyurtmachi")
	pdf.Ln(6)
	pdf.SetTextColor(0, 0, 0)
	pdf.SetFont("Arial", "B", 11)
	pdf.Cell(95, 6, seller.Name)
	pdf.Cell(0, 6, buyer.Name)
	pdf.Ln(6)
	pdf.SetFont("Arial", "", 9)
	pdf.SetTextColor(100, 116, 139)
	pdf.Cell(95, 5, fmt.Sprintf("STIR: %s", orDash(seller.TIN)))
	pdf.Cell(0, 5, fmt.Sprintf("STIR: %s", orDash(buyer.TIN)))
	pdf.Ln(5)
	pdf.Cell(95, 5, fmt.Sprintf("Tel: %s", orDash(seller.Phone)))
	pdf.Cell(0, 5, fmt.Sprintf("Tel: %s", orDash(buyer.Phone)))
	pdf.Ln(12)

	pdf.SetTextColor(71, 85, 105)
	pdf.SetFont("Arial", "B", 8)
	pdf.CellFormat(10, 7, "#", "1", 0, "C", false, 0, "")
	pdf.CellFormat(80, 7, "Mahsulot", "1", 0, "L", false, 0, "")
	pdf.CellFormat(25, 7, "Miqdor", "1", 0, "C", false, 0, "")
	pdf.CellFormat(35, 7, "Narxi", "1", 0, "R", false, 0, "")
	pdf.CellFormat(40, 7, "Jami", "1", 1, "R", false, 0, "")

	categories := map[string][]pdfItem{}
	catOrder := []string{}
	for _, item := range items {
		cat := item.CategoryName
		if cat == "" {
			cat = "Boshqa"
		}
		if _, ok := categories[cat]; !ok {
			catOrder = append(catOrder, cat)
		}
		categories[cat] = append(categories[cat], item)
	}
	sort.Strings(catOrder)

	idx := 0
	pdf.SetFont("Arial", "", 9)
	pdf.SetTextColor(0, 0, 0)
	for _, cat := range catOrder {
		pdf.SetFillColor(241, 245, 249)
		pdf.SetFont("Arial", "B", 9)
		pdf.CellFormat(190, 7, cat, "1", 1, "L", true, 0, "")
		pdf.SetFont("Arial", "", 9)
		for _, item := range categories[cat] {
			idx++
			label := item.ProductName
			if strings.TrimSpace(item.VariantName) != "" {
				label += "\n" + item.VariantName
			}
			pdf.CellFormat(10, 8, fmt.Sprintf("%d", idx), "1", 0, "C", false, 0, "")
			pdf.MultiCell(80, 4, label, "1", "L", false)
			y := pdf.GetY() - 8
			pdf.SetXY(105, y)
			pdf.CellFormat(25, 8, fmt.Sprintf("%g", item.Quantity), "1", 0, "C", false, 0, "")
			pdf.CellFormat(35, 8, fmtMoney(item.Price, currency), "1", 0, "R", false, 0, "")
			pdf.CellFormat(40, 8, fmtMoney(item.Total, currency), "1", 1, "R", false, 0, "")
		}
	}

	pdf.Ln(6)
	pdf.SetFont("Arial", "B", 12)
	pdf.SetTextColor(0, 0, 0)
	pdf.Cell(0, 8, fmt.Sprintf("UMUMIY: %s", fmtMoney(total, currency)))
	return pdfBytes(pdf)
}

func orDash(v string) string {
	if strings.TrimSpace(v) == "" {
		return "—"
	}
	return v
}

func fmtMoney(v float64, currency string) string {
	if strings.ToUpper(currency) == "USD" {
		return fmt.Sprintf("%.2f USD", v)
	}
	return fmt.Sprintf("%.0f so'm", v)
}

func pdfBytes(pdf *gofpdf.Fpdf) ([]byte, error) {
	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}
