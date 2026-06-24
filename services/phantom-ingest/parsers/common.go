package parsers

import (
	"strconv"
	"strings"
	"time"
	"unicode/utf8"
)

const (
	DefaultNessusMetodo = "Escaneo automatizado con Nessus"
	MaxFieldLen         = 32000
	MaxTitleLen         = 500
)

func NormHeader(h string) string {
	return strings.Join(strings.Fields(strings.ToLower(strings.TrimSpace(h))), " ")
}

func BuildHeaderIndex(fieldnames []string) map[string]string {
	out := make(map[string]string, len(fieldnames))
	for _, name := range fieldnames {
		norm := NormHeader(name)
		if norm != "" {
			if _, ok := out[norm]; !ok {
				out[norm] = name
			}
		}
	}
	return out
}

func GetIndexed(row map[string]string, index map[string]string, candidates ...string) string {
	for _, c := range candidates {
		orig, ok := index[NormHeader(c)]
		if !ok {
			continue
		}
		raw := strings.TrimSpace(row[orig])
		if raw != "" {
			return raw
		}
	}
	return ""
}

func ClampTitle(s string) string {
	t := strings.TrimSpace(strings.ReplaceAll(s, "\n", " "))
	if t == "" {
		return "Sin título"
	}
	runes := []rune(t)
	if len(runes) <= MaxTitleLen {
		return t
	}
	return string(runes[:MaxTitleLen-1]) + "…"
}

func MapScannerSeverity(text string) string {
	if strings.TrimSpace(text) == "" {
		return "Info"
	}
	t := strings.ToLower(strings.TrimSpace(text))
	switch {
	case t == "none", t == "n/a", t == "na", t == "-", t == "0", t == "informational":
		return "Info"
	case strings.Contains(t, "critical"), strings.Contains(t, "critico"), strings.Contains(t, "crítico"),
		strings.Contains(t, "critica"), strings.Contains(t, "crítica"):
		return "Critical"
	case t == "high", t == "alta", t == "alto", (strings.HasPrefix(t, "high") && !strings.Contains(t, "medium")):
		return "High"
	case t == "medium", t == "medio", t == "media", t == "moderate", t == "moderada",
		strings.Contains(t, "medium"), strings.Contains(t, "medio"), strings.Contains(t, "moderate"):
		return "Medium"
	case t == "low", t == "baja", t == "bajo", strings.HasPrefix(t, "low"):
		return "Low"
	case strings.Contains(t, "info"), strings.Contains(t, "informativ"), strings.Contains(t, "best practice"):
		return "Info"
	default:
		return "Medium"
	}
}

func ParseFloatMaybe(val string) *float64 {
	s := strings.TrimSpace(strings.ReplaceAll(val, ",", "."))
	if s == "" {
		return nil
	}
	if f, err := strconv.ParseFloat(s, 64); err == nil {
		return &f
	}
	return nil
}

func ParseDatetimeMaybe(value string) *string {
	raw := strings.TrimSpace(value)
	if raw == "" {
		return nil
	}
	layouts := []string{
		"2006-01-02 15:04:05",
		"2006-01-02T15:04:05",
		"2006-01-02",
		"02/01/2006",
		"02-01-2006",
		"2006/01/02",
	}
	trimmed := raw
	if len(trimmed) > 19 {
		trimmed = trimmed[:19]
	}
	for _, layout := range layouts {
		if t, err := time.Parse(layout, trimmed); err == nil {
			iso := t.UTC().Format(time.RFC3339)
			return &iso
		}
	}
	return nil
}

func BuildComponenteAfectado(host, port, proto string) string {
	host = strings.TrimSpace(host)
	port = strings.TrimSpace(port)
	proto = strings.TrimSpace(proto)
	if host == "" {
		return ""
	}
	if port != "" && port != "0" && port != "none" {
		suffix := ":" + port
		if proto != "" && strings.ToLower(proto) != "tcp" && strings.ToLower(proto) != "udp" {
			return host + suffix + "/" + proto
		}
		return host + suffix
	}
	return host
}

func NormalizeAffectedComponent(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return ""
	}
	return strings.ToLower(strings.ReplaceAll(strings.TrimSuffix(trimmed, "/"), " ", ""))
}

func Truncate(s string, max int) string {
	if max <= 0 || s == "" {
		return s
	}
	runes := []rune(s)
	if len(runes) <= max {
		return s
	}
	return string(runes[:max])
}

func PtrStr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func JoinNonEmpty(parts ...string) string {
	var out []string
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return strings.Join(out, "\n\n")
}

// Draft is the JSON shape consumed by the Python API.
type Draft map[string]interface{}

func ensureUTF8(s string) string {
	if utf8.ValidString(s) {
		return s
	}
	return strings.ToValidUTF8(s, "")
}
