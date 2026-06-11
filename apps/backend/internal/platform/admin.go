package platform

import "github.com/tadbirkor/axis-erp/backend/pkg/middleware"

func isPlatformAdminIdentity(email, login string) bool {
	return middleware.IsPlatformAdminUser(email, login)
}
