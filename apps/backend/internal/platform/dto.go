package platform

type UpdateCompanySubscriptionInput struct {
	SubscriptionStatus *string `json:"subscriptionStatus,omitempty"`
	ExtendTrialDays    *int    `json:"extendTrialDays,omitempty"`
	SubscriptionNote   *string `json:"subscriptionNote,omitempty"`
	TrialEndsAt        *string `json:"trialEndsAt,omitempty"`
	CompanyStatus      *string `json:"companyStatus,omitempty"`
	ScheduleAt         *string `json:"scheduleAt,omitempty"`
}

type BroadcastNotificationInput struct {
	Title       string   `json:"title"`
	Message     string   `json:"message"`
	Type        *string  `json:"type,omitempty"`
	Target      string   `json:"target"`
	CompanyIDs  []string `json:"companyIds,omitempty"`
	UserIDs     []string `json:"userIds,omitempty"`
	ScheduledAt *string  `json:"scheduledAt,omitempty"`
}

type UpdateUserStatusInput struct {
	Status *string `json:"status"`
}
