package telegram

import (
	"context"
	"encoding/json"
	"log"
	"time"
)

const pollTimeoutSec = 30

// StartPollingIfEnabled — lokal dev: TELEGRAM_UPDATES_ENABLED=true bo'lsa webhook o'rniga polling.
func (s *Service) StartPollingIfEnabled(ctx context.Context) {
	if s.tg == nil {
		return
	}
	if !s.cfg.TelegramUpdatesEnabled {
		log.Printf("telegram: polling o'chiq (lokal uchun TELEGRAM_UPDATES_ENABLED=true)")
		return
	}
	go s.pollLoop(ctx)
}

func (s *Service) pollLoop(ctx context.Context) {
	if err := s.tg.deleteWebhook(ctx); err != nil {
		log.Printf("telegram: deleteWebhook: %v", err)
	}

	offset := 0
	log.Printf("telegram: polling ishga tushdi (lokal dev)")
	for {
		select {
		case <-ctx.Done():
			log.Printf("telegram: polling to'xtatildi")
			return
		default:
		}

		updates, err := s.tg.getUpdates(ctx, offset, pollTimeoutSec)
		if err != nil {
			log.Printf("telegram: getUpdates: %v — 3s dan keyin qayta uriniladi", err)
			time.Sleep(3 * time.Second)
			continue
		}
		for _, upd := range updates {
			if upd.UpdateID >= offset {
				offset = upd.UpdateID + 1
			}
			body, err := json.Marshal(upd)
			if err != nil {
				continue
			}
			s.processUpdateLocally(ctx, body)
		}
	}
}
