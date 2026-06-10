package onboarding

type CreateCompanyInput struct {
	Name         string  `json:"name"`
	Tin          *string `json:"tin"`
	Phone        *string `json:"phone"`
	Address      *string `json:"address"`
	BusinessType *string `json:"businessType"`
}

type UpdateCompanyInput struct {
	BusinessType *string `json:"businessType"`
}

type SubmitBusinessAnswersInput struct {
	Answers map[string]string `json:"answers"`
}

type AddTeamMemberInput struct {
	FullName   string  `json:"fullName"`
	Login      string  `json:"login"`
	Role       string  `json:"role"`
	Password   string  `json:"password"`
	Department *string `json:"department"`
}

type ApplyModulesResult struct {
	Success        bool     `json:"success"`
	EnabledModules []string `json:"enabledModules"`
}

type StatusResponse struct {
	IsCompleted        bool   `json:"isCompleted"`
	RequiresOnboarding bool   `json:"requiresOnboarding"`
	NextPath           string `json:"nextPath"`
	HasTin             bool   `json:"hasTin"`
	HasBusinessType    bool   `json:"hasBusinessType"`
	HasModules         bool   `json:"hasModules"`
	HasWarehouse       bool   `json:"hasWarehouse"`
	Role               string `json:"role"`
}

type TeamMemberResponse struct {
	ID       string  `json:"id"`
	FullName string  `json:"fullName"`
	Login    string  `json:"login"`
	Email    *string `json:"email"`
	Phone    *string `json:"phone"`
}
