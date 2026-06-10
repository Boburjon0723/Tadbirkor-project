package pos

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"
)

var ErrCustomerNotFound = errors.New("Mijoz topilmadi")

type saleCustomer struct {
	RetailCustomerID      *string
	CustomerNameSnapshot  *string
	CustomerPhoneSnapshot *string
}

func (s *Service) resolveForSale(ctx context.Context, companyID string, retailCustomerID, quickName, quickPhone *string) (saleCustomer, error) {
	if retailCustomerID != nil && strings.TrimSpace(*retailCustomerID) != "" {
		var name string
		var phone *string
		err := s.pool.QueryRow(ctx, `
			SELECT name, phone FROM "RetailCustomer"
			WHERE id = $1 AND "companyId" = $2
		`, strings.TrimSpace(*retailCustomerID), companyID).Scan(&name, &phone)
		if errors.Is(err, pgx.ErrNoRows) {
			return saleCustomer{}, ErrCustomerNotFound
		}
		if err != nil {
			return saleCustomer{}, err
		}
		id := strings.TrimSpace(*retailCustomerID)
		return saleCustomer{
			RetailCustomerID: &id, CustomerNameSnapshot: &name, CustomerPhoneSnapshot: phone,
		}, nil
	}
	name := ""
	if quickName != nil {
		name = strings.TrimSpace(*quickName)
	}
	if name == "" {
		return saleCustomer{}, nil
	}
	var phone *string
	if quickPhone != nil {
		p := strings.TrimSpace(*quickPhone)
		if p != "" {
			phone = &p
		}
	}
	var id string
	err := s.pool.QueryRow(ctx, `
		INSERT INTO "RetailCustomer" (id, "companyId", name, phone, "isGuest", "isPosRegistry", "createdAt", "updatedAt")
		VALUES (gen_random_uuid()::text, $1, $2, $3, false, true, NOW(), NOW())
		RETURNING id
	`, companyID, name, phone).Scan(&id)
	if err != nil {
		return saleCustomer{}, err
	}
	return saleCustomer{
		RetailCustomerID: &id, CustomerNameSnapshot: &name, CustomerPhoneSnapshot: phone,
	}, nil
}

func (s *Service) assertCreditAllowed(ctx context.Context, companyID, userID string) error {
	pctx, err := s.loadPriceContext(ctx, companyID, userID, s.pool)
	if err != nil {
		return err
	}
	hasCredit := false
	for _, p := range pctx.perms {
		if p == "pos.credit" {
			hasCredit = true
			break
		}
	}
	if !hasCredit {
		return errors.New("Nasiya sotuv uchun ruxsat yo'q (Jamoa → rol sozlamalari)")
	}
	var enabled bool
	err = s.pool.QueryRow(ctx, `SELECT "posCreditEnabled" FROM "Company" WHERE id = $1`, companyID).Scan(&enabled)
	if err != nil || !enabled {
		return errors.New("Nasiya sotuv kompaniyada yoqilmagan. Sozlamalar → Kompaniya")
	}
	return nil
}
