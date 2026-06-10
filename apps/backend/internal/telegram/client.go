package telegram

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

type tgClient struct {
	token string
}

func newTGClient(token string) *tgClient {
	return &tgClient{token: strings.TrimSpace(token)}
}

func (c *tgClient) answerCallbackQuery(ctx context.Context, callbackID, text string) error {
	if c == nil || c.token == "" || callbackID == "" {
		return nil
	}
	payload := map[string]any{"callback_query_id": callbackID}
	if text != "" {
		payload["text"] = text
	}
	body, _ := json.Marshal(payload)
	url := fmt.Sprintf("https://api.telegram.org/bot%s/answerCallbackQuery", c.token)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}

func (c *tgClient) sendMessage(ctx context.Context, chatID string, text string, replyMarkup any) error {
	if c == nil || c.token == "" {
		return fmt.Errorf("telegram bot token yo'q")
	}
	payload := map[string]any{
		"chat_id": chatID,
		"text":    text,
	}
	if replyMarkup != nil {
		payload["reply_markup"] = replyMarkup
	}
	body, _ := json.Marshal(payload)
	url := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", c.token)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("telegram sendMessage %d", resp.StatusCode)
	}
	return nil
}

func contactKeyboard() map[string]any {
	return map[string]any{
		"keyboard": [][]map[string]any{{
			{"text": "📱 Telefon raqamni ulashish", "request_contact": true},
		}},
		"resize_keyboard":   true,
		"one_time_keyboard": true,
	}
}

func removeKeyboard() map[string]any {
	return map[string]any{"remove_keyboard": true}
}
