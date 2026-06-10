package warehouseintake

import (
	"bytes"
	"fmt"
	"strconv"
	"time"

	"github.com/jung-kurt/gofpdf"
)

type NakladnoyLine struct {
	ProductName string
	VariantName string
	Barcode     *string
	SKU         *string
	Unit        string
	Quantity    float64
}

type NakladnoyData struct {
	Reference           string
	Date                time.Time
	CompanyName         string
	CompanyTin          *string
	WarehouseName       string
	WarehouseWorkerName string
	Note                *string
	Lines               []NakladnoyLine
	TotalPositions      int
	TotalUnits          float64
}

func GenerateNakladnoyPDF(data NakladnoyData) ([]byte, error) {
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(10, 10, 10)
	pdf.SetAutoPageBreak(true, 15)
	pdf.AddPage()

	pdf.SetFont("Arial", "B", 14)
	pdf.Cell(0, 7, "AXIS ERP")
	pdf.Ln(7)
	pdf.SetFont("Arial", "", 10)
	pdf.Cell(0, 6, "Omborga kirim nakladnoyi")
	pdf.Ln(8)

	pdf.SetFont("Arial", "B", 12)
	pdf.Cell(0, 6, data.Reference)
	pdf.Ln(6)
	pdf.SetFont("Arial", "", 9)
	pdf.Cell(0, 5, "Sana: "+data.Date.Format("2006-01-02 15:04"))
	pdf.Ln(8)

	pdf.SetFont("Arial", "B", 9)
	pdf.Cell(28, 5, "Tashkilot:")
	pdf.SetFont("Arial", "", 9)
	pdf.Cell(0, 5, data.CompanyName)
	pdf.Ln(5)
	pdf.SetFont("Arial", "B", 9)
	pdf.Cell(28, 5, "STIR:")
	pdf.SetFont("Arial", "", 9)
	if data.CompanyTin != nil && *data.CompanyTin != "" {
		pdf.Cell(0, 5, *data.CompanyTin)
	} else {
		pdf.Cell(0, 5, "-")
	}
	pdf.Ln(5)
	pdf.SetFont("Arial", "B", 9)
	pdf.Cell(28, 5, "Ombor:")
	pdf.SetFont("Arial", "", 9)
	pdf.Cell(0, 5, data.WarehouseName)
	pdf.Ln(7)

	if data.Note != nil && *data.Note != "" {
		pdf.SetFont("Arial", "", 9)
		pdf.MultiCell(0, 5, "Izoh: "+*data.Note, "", "L", false)
		pdf.Ln(1)
	}

	headers := []string{"#", "Mahsulot nomi", "O'lchov", "Miqdor"}
	widths := []float64{10, 118, 22, 40}
	pdf.SetFont("Arial", "B", 9)
	for i := range headers {
		pdf.CellFormat(widths[i], 7, headers[i], "1", 0, "C", false, 0, "")
	}
	pdf.Ln(-1)

	pdf.SetFont("Arial", "", 8)
	for i := range data.Lines {
		line := data.Lines[i]
		title := line.ProductName
		if line.VariantName != "" && line.VariantName != line.ProductName {
			title = line.ProductName + " / " + line.VariantName
		}
		if line.Barcode != nil && *line.Barcode != "" {
			title += " (" + *line.Barcode + ")"
		} else if line.SKU != nil && *line.SKU != "" {
			title += " (" + *line.SKU + ")"
		}
		unit := line.Unit
		if unit == "" {
			unit = "dona"
		}
		qty := strconv.FormatFloat(line.Quantity, 'f', -1, 64)
		pdf.CellFormat(widths[0], 6, strconv.Itoa(i+1), "1", 0, "C", false, 0, "")
		pdf.CellFormat(widths[1], 6, title, "1", 0, "L", false, 0, "")
		pdf.CellFormat(widths[2], 6, unit, "1", 0, "C", false, 0, "")
		pdf.CellFormat(widths[3], 6, qty, "1", 0, "C", false, 0, "")
		pdf.Ln(-1)
	}

	pdf.SetFont("Arial", "B", 9)
	pdf.CellFormat(widths[0]+widths[1]+widths[2], 7, "JAMI", "1", 0, "R", false, 0, "")
	pdf.CellFormat(widths[3], 7, fmt.Sprintf("%d poz / %.4g dona", data.TotalPositions, data.TotalUnits), "1", 0, "C", false, 0, "")
	pdf.Ln(12)

	pdf.SetFont("Arial", "B", 9)
	pdf.Cell(0, 5, "Omborchi (F.I.Sh.)")
	pdf.Ln(6)
	pdf.SetFont("Arial", "", 10)
	pdf.Cell(0, 5, data.WarehouseWorkerName)
	pdf.Ln(8)
	pdf.Line(10, pdf.GetY(), 105, pdf.GetY())
	pdf.Line(115, pdf.GetY(), 200, pdf.GetY())
	pdf.Ln(5)
	pdf.SetFont("Arial", "", 8)
	pdf.Cell(95, 5, "Qo'l qo'yildi")
	pdf.Cell(0, 5, "Qabul qildi (boshqaruv)")

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}
