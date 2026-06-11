package platform

import "errors"

var (
	ErrCompanyNotFound = errors.New("Kompaniya topilmadi")
	ErrUserNotFound    = errors.New("Foydalanuvchi topilmadi")
	ErrJobNotFound     = errors.New("Reja topilmadi")
)

type forbiddenError struct{ msg string }

func errForbidden(msg string) error { return forbiddenError{msg: msg} }
func (e forbiddenError) Error() string { return e.msg }
