package partnerledger

import "errors"

var (
	ErrContactNotFound    = errors.New("Hamkor topilmadi")
	ErrOperationNotFound  = errors.New("Operatsiya topilmadi")
	ErrWarehouseNotFound  = errors.New("Ombor topilmadi")
	ErrSaleOrderNotFound  = errors.New("Sotuv buyurtmasi topilmadi")
	ErrTelegramNotLinked  = errors.New("Hamkor Telegramga ulanmagan (telefon orqali botga ulanmagan).")
)

type badRequestError struct{ msg string }

func errBadRequest(msg string) error { return badRequestError{msg: msg} }
func (e badRequestError) Error() string { return e.msg }
