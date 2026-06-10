package companies

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

var ErrCompanyNotFound = errors.New("Kompaniya topilmadi")
var ErrTinTaken = errors.New("Ushbu STIR (TIN) allaqachon boshqa kompaniya tomonidan foydalanilgan")

type UpdateCompanyInput struct {
	Name          *string `json:"name"`
	LegalName     *string `json:"legalName"`
	Tin           *string `json:"tin"`
	Address       *string `json:"address"`
	Phone         *string `json:"phone"`
	BusinessType  *string `json:"businessType"`
	StorefrontURL *string `json:"storefrontUrl"`
}

func (s *Service) FindOne(ctx context.Context, id string) (map[string]any, error) {
	var raw []byte
	err := s.pool.QueryRow(ctx, `SELECT row_to_json(c) FROM "Company" c WHERE id = $1`, id).Scan(&raw)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrCompanyNotFound
	}
	if err != nil {
		return nil, err
	}
	var out map[string]any
	if json.Unmarshal(raw, &out) != nil {
		return nil, err
	}
	return out, nil
}

func (s *Service) Update(ctx context.Context, id string, in UpdateCompanyInput) (map[string]any, error) {
	existing, err := s.FindOne(ctx, id)
	if err != nil {
		return nil, err
	}
	if in.Tin != nil && *in.Tin != "" {
		curTin, _ := existing["tin"].(string)
		if *in.Tin != curTin {
			var otherID string
			err := s.pool.QueryRow(ctx, `SELECT id FROM "Company" WHERE tin = $1 LIMIT 1`, *in.Tin).Scan(&otherID)
			if err == nil && otherID != id {
				return nil, ErrTinTaken
			}
		}
	}
	sets := []string{}
	args := []any{}
	n := 1
	add := func(col string, val any) {
		sets = append(sets, `"`+col+`" = $`+itoa(n))
		args = append(args, val)
		n++
	}
	if in.Name != nil {
		add("name", *in.Name)
	}
	if in.LegalName != nil {
		add("legalName", *in.LegalName)
	}
	if in.Tin != nil {
		add("tin", *in.Tin)
	}
	if in.Address != nil {
		add("address", *in.Address)
	}
	if in.Phone != nil {
		add("phone", *in.Phone)
	}
	if in.BusinessType != nil {
		add("businessType", *in.BusinessType)
	}
	if in.StorefrontURL != nil {
		url := strings.TrimRight(strings.TrimSpace(*in.StorefrontURL), "/")
		add("storefrontUrl", url)
	}
	if len(sets) == 0 {
		return existing, nil
	}
	add("updatedAt", time.Now())
	args = append(args, id)
	_, err = s.pool.Exec(ctx, `UPDATE "Company" SET `+strings.Join(sets, ", ")+` WHERE id = $`+itoa(n), args...)
	if err != nil {
		return nil, err
	}
	s.cache.Del(ctx, s.featuresKey(id))
	return s.FindOne(ctx, id)
}

func (s *Service) RegenerateStorefrontToken(ctx context.Context, companyID string) (map[string]any, error) {
	token := randomHex(24)
	var id, storefrontToken string
	err := s.pool.QueryRow(ctx, `
		UPDATE "Company" SET "storefrontToken" = $1 WHERE id = $2
		RETURNING id, "storefrontToken"
	`, token, companyID).Scan(&id, &storefrontToken)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrCompanyNotFound
	}
	if err != nil {
		return nil, err
	}
	return map[string]any{"id": id, "storefrontToken": storefrontToken}, nil
}

func randomHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func itoa(n int) string {
	return strconv.Itoa(n)
}
