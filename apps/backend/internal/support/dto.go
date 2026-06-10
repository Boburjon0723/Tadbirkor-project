package support

type SubmitSupportMessageInput struct {
	Topic   string `json:"topic"`
	Message string `json:"message"`
}

type SubmitPublicSupportMessageInput struct {
	Name    string `json:"name"`
	Contact string `json:"contact"`
	Topic   string `json:"topic"`
	Message string `json:"message"`
}

type PublicConfig struct {
	TelegramUsername *string `json:"telegramUsername"`
	TelegramUrl      *string `json:"telegramUrl"`
	Email            string  `json:"email"`
	Phone            *string `json:"phone"`
	Hours            string  `json:"hours"`
	ChatEnabled      bool    `json:"chatEnabled"`
}

type UserBrief struct {
	ID       string  `json:"id"`
	FullName string  `json:"fullName"`
	Email    *string `json:"email"`
	Phone    *string `json:"phone"`
}

type CompanyBrief struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type ContextResponse struct {
	Config  PublicConfig  `json:"config"`
	User    *UserBrief    `json:"user"`
	Company *CompanyBrief `json:"company"`
}

type SubmitResponse struct {
	Ok                  bool    `json:"ok"`
	DeliveredToTelegram bool    `json:"deliveredToTelegram"`
	TelegramUrl         *string `json:"telegramUrl,omitempty"`
	Message             string  `json:"message"`
}
