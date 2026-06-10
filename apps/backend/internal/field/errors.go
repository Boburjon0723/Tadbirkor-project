package field

import "errors"

var (
	ErrTaskNotFound      = errors.New("Vazifa topilmadi")
	ErrWarehouseNotFound = errors.New("Ombor topilmadi")
	ErrForbidden         = errors.New("Bu vazifa sizga tegishli emas")
)

type badRequestError struct{ msg string }

func errBadRequest(msg string) error { return badRequestError{msg: msg} }
func (e badRequestError) Error() string { return e.msg }
