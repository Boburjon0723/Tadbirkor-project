package nestproxy

import (
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
)

// Handler — hali Go'da ko'chirilmagan /api/* so'rovlarni NestJS'ga uzatadi (Strangler Fig).
func Handler(nestBaseURL string) http.Handler {
	target, err := url.Parse(strings.TrimRight(nestBaseURL, "/"))
	if err != nil || target.Scheme == "" {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			http.Error(w, "NESTJS_URL not configured", http.StatusBadGateway)
		})
	}
	proxy := httputil.NewSingleHostReverseProxy(target)
	origDirector := proxy.Director
	proxy.Director = func(r *http.Request) {
		origDirector(r)
		r.Host = target.Host
	}
	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		log.Printf("nestproxy: %s %s: %v", r.Method, r.URL.Path, err)
		http.Error(w, "NestJS proxy xatosi", http.StatusBadGateway)
	}
	return proxy
}
