package notifications

// TelegramAction — inline tugma (TelegramActionRecord).
type TelegramAction struct {
	Key        string         `json:"key"`
	Label      string         `json:"label"`
	TargetType string         `json:"targetType"`
	TargetID   string         `json:"targetId"`
	Payload    map[string]any `json:"payload,omitempty"`
}

// TelegramPayload — Telegram orqali yuboriladigan qo'shimcha ma'lumot.
type TelegramPayload struct {
	ModuleKey   string
	EventKey    string
	Details     map[string]any
	TargetRoles []string
	Actions     []TelegramAction
}
