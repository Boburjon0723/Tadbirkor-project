package main

import (
	"context"
	"fmt"
	"os"

	"github.com/joho/godotenv"
	"github.com/tadbirkor/axis-erp/backend/pkg/db"
)

func main() {
	_ = godotenv.Overload()
	ctx := context.Background()
	pool, err := db.NewPool(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		panic(err)
	}
	defer pool.Close()

	rows, err := pool.Query(ctx, `
		SELECT c.id, c.name, c.phone, u.login, u.phone, u."fullName", cu.role
		FROM "Company" c
		LEFT JOIN "CompanyUser" cu ON cu."companyId" = c.id
		LEFT JOIN "User" u ON u.id = cu."userId"
		ORDER BY c."createdAt" ASC
	`)
	if err != nil {
		panic(err)
	}
	defer rows.Close()
	for rows.Next() {
		var cid, cname string
		var cphone, login, uphone, fullName, role *string
		if err := rows.Scan(&cid, &cname, &cphone, &login, &uphone, &fullName, &role); err != nil {
			panic(err)
		}
		fmt.Printf("COMPANY: %s | %s | phone=%s\n", cid, cname, str(cphone))
		fmt.Printf("  USER: login=%s phone=%s name=%s role=%s\n", str(login), str(uphone), str(fullName), str(role))
	}
}

func str(s *string) string {
	if s == nil {
		return "-"
	}
	return *s
}
