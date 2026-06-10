package users

import "github.com/tadbirkor/axis-erp/backend/internal/permissions"

type RoleCatalogEntry struct {
	Key               string   `json:"key"`
	Label             string   `json:"label"`
	Description       string   `json:"description"`
	Assignable        bool     `json:"assignable"`
	RequiresWarehouse bool     `json:"requiresWarehouse"`
	Permissions       []string `json:"permissions"`
}

var roleCatalog = []RoleCatalogEntry{
	{Key: "OWNER", Label: "Egasi", Description: "Barcha modullar, sozlamalar va xodimlarni boshqaradi.", Assignable: false, RequiresWarehouse: false},
	{Key: "MANAGER", Label: "Menejer", Description: "Mahsulot, buyurtma, hamkor va operatsion jarayonlar.", Assignable: true, RequiresWarehouse: false},
	{Key: "ACCOUNTANT", Label: "Buxgalter", Description: "Qarz, hisobotlar va moliyaviy ko'rinishlar.", Assignable: true, RequiresWarehouse: false},
	{Key: "WAREHOUSE", Label: "Omborchi", Description: "Biriktirilgan omborda kirim, chiqim va qabul qilish.", Assignable: true, RequiresWarehouse: true},
	{Key: "SALES", Label: "Sotuvchi", Description: "Buyurtma, kassa va biriktirilgan do'kon nuqtasi.", Assignable: true, RequiresWarehouse: true},
	{Key: "FIELD_WORKER", Label: "Dala xodimi", Description: "Tashqarida montaj/kuryer: vazifa, tovar qabul va hisobot.", Assignable: true, RequiresWarehouse: true},
	{Key: "WORKER", Label: "Oddiy ishchi", Description: "Ishlab chiqarish yoki umumiy xodim — cheklangan ko'rinish.", Assignable: true, RequiresWarehouse: false},
}

var assignableRoles = map[string]struct{}{
	"MANAGER": {}, "ACCOUNTANT": {}, "WAREHOUSE": {}, "SALES": {}, "FIELD_WORKER": {}, "WORKER": {},
}

var rolesRequiringWarehouse = map[string]struct{}{
	"SALES": {}, "WAREHOUSE": {}, "FIELD_WORKER": {},
}

func (s *Service) GetRolesCatalog() []RoleCatalogEntry {
	out := make([]RoleCatalogEntry, len(roleCatalog))
	for i, r := range roleCatalog {
		out[i] = r
		out[i].Permissions = permissions.Effective(r.Key, nil, nil)
	}
	return out
}

func roleRequiresWarehouse(role string) bool {
	_, ok := rolesRequiringWarehouse[role]
	return ok
}

func isAssignableRole(role string) bool {
	_, ok := assignableRoles[role]
	return ok
}

func SanitizePosOverrides(grant, deny []string) ([]string, []string) {
	return sanitizePosOverrides(grant, deny)
}

func sanitizePosOverrides(grant, deny []string) ([]string, []string) {
	allowed := map[string]struct{}{}
	for _, p := range permissions.Effective("OWNER", nil, nil) {
		allowed[p] = struct{}{}
	}
	filter := func(items []string) []string {
		if items == nil {
			return []string{}
		}
		out := []string{}
		for _, p := range items {
			if _, ok := allowed[p]; ok {
				out = append(out, p)
			}
		}
		return out
	}
	return filter(grant), filter(deny)
}
