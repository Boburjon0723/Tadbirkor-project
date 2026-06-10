package platform

type UpdateCompanySubscriptionInput struct {
	SubscriptionStatus *string `json:"subscriptionStatus,omitempty"`
	ExtendTrialDays    *int    `json:"extendTrialDays,omitempty"`
	SubscriptionNote   *string `json:"subscriptionNote,omitempty"`
}

type BroadcastNotificationInput struct {
	Title      string   `json:"title"`
	Message    string   `json:"message"`
	Type       *string  `json:"type,omitempty"`
	Target     string   `json:"target"`
	CompanyIDs []string `json:"companyIds,omitempty"`
	UserIDs    []string `json:"userIds,omitempty"`
}
