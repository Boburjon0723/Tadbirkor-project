package payroll

import "errors"

var ErrNotFound = errors.New("topilmadi")

type badRequestError struct{ msg string }

func (e badRequestError) Error() string { return e.msg }

func errBadRequest(msg string) error { return badRequestError{msg: msg} }

type forbiddenError struct{ msg string }

func (e forbiddenError) Error() string { return e.msg }

func errForbidden(msg string) error { return forbiddenError{msg: msg} }
