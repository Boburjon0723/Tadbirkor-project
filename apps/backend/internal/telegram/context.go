package telegram

import (
	"context"
	"strings"
	"sync"
	"time"
)

type botMembership struct {
	CompanyID   string
	CompanyName string
	Role        string
}

type botUser struct {
	ID          string
	FullName    string
	Login       string
	Phone       *string
	Memberships []botMembership
}

type botContext struct {
	mu                 sync.RWMutex
	activeCompanyByChat map[string]string
	linkedUserCache    map[string]cachedBotUser
}

type cachedBotUser struct {
	user      botUser
	expiresAt time.Time
}

const linkedUserCacheTTL = 45 * time.Second

func newBotContext() *botContext {
	return &botContext{
		activeCompanyByChat: map[string]string{},
		linkedUserCache:     map[string]cachedBotUser{},
	}
}

func (c *botContext) invalidateLinkedUser(chatID string) {
	c.mu.Lock()
	delete(c.linkedUserCache, chatID)
	c.mu.Unlock()
}

func (s *Service) findLinkedUser(ctx context.Context, chatID string) (*botUser, error) {
	chatID = strings.TrimSpace(chatID)
	if chatID == "" {
		return nil, nil
	}
	s.botCtx.mu.RLock()
	if cached, ok := s.botCtx.linkedUserCache[chatID]; ok && cached.expiresAt.After(time.Now()) {
		u := cached.user
		s.botCtx.mu.RUnlock()
		return &u, nil
	}
	s.botCtx.mu.RUnlock()

	u, err := s.repo.findLinkedBotUser(ctx, chatID)
	if err != nil || u == nil {
		return u, err
	}
	s.botCtx.mu.Lock()
	s.botCtx.linkedUserCache[chatID] = cachedBotUser{user: *u, expiresAt: time.Now().Add(linkedUserCacheTTL)}
	s.botCtx.mu.Unlock()
	return u, nil
}

func (s *Service) activeCompanyID(chatID string, user *botUser) string {
	if user == nil {
		return ""
	}
	s.botCtx.mu.RLock()
	saved := s.botCtx.activeCompanyByChat[chatID]
	s.botCtx.mu.RUnlock()
	if saved != "" {
		for _, m := range user.Memberships {
			if m.CompanyID == saved {
				return saved
			}
		}
	}
	if len(user.Memberships) > 0 {
		return user.Memberships[0].CompanyID
	}
	return ""
}

func (s *Service) activeMembership(chatID string, user *botUser) *botMembership {
	companyID := s.activeCompanyID(chatID, user)
	if companyID == "" {
		return nil
	}
	for i := range user.Memberships {
		if user.Memberships[i].CompanyID == companyID {
			return &user.Memberships[i]
		}
	}
	return nil
}

func (s *Service) setActiveCompany(chatID, companyID string, user *botUser) bool {
	ok := false
	for _, m := range user.Memberships {
		if m.CompanyID == companyID {
			ok = true
			break
		}
	}
	if !ok {
		return false
	}
	s.botCtx.mu.Lock()
	s.botCtx.activeCompanyByChat[chatID] = companyID
	s.botCtx.mu.Unlock()
	return true
}

func (s *Service) formatProfileBlock(chatID string, user *botUser) string {
	mem := s.activeMembership(chatID, user)
	lines := []string{"👤 " + user.FullName, "Login: " + user.Login}
	if mem != nil {
		lines = append(lines, "Kompaniya: "+mem.CompanyName, "Rol: "+mem.Role)
	}
	if len(user.Memberships) > 1 {
		lines = append(lines, "", "/kompaniya — boshqa kompaniyani tanlash")
	}
	return strings.Join(lines, "\n")
}
