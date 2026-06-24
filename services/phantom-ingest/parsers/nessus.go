package parsers

import (
	"bytes"
	"encoding/csv"
	"io"
	"strings"
)

// ParseNessusCSV parses a Nessus/Tenable export into finding drafts.
func ParseNessusCSV(data []byte) ([]Draft, error) {
	reader := csv.NewReader(bytes.NewReader(data))
	reader.LazyQuotes = true
	reader.FieldsPerRecord = -1

	fieldnames, err := reader.Read()
	if err != nil {
		if err == io.EOF {
			return nil, nil
		}
		return nil, err
	}
	headerIndex := BuildHeaderIndex(fieldnames)
	var out []Draft

	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}
		row := make(map[string]string, len(fieldnames))
		for i, fn := range fieldnames {
			val := ""
			if i < len(record) {
				val = record[i]
			}
			row[fn] = val
		}

		name := GetIndexed(row, headerIndex, "name", "plugin name", "nombre", "vulnerability", "plugin_name")
		if name == "" {
			continue
		}

		risk := GetIndexed(row, headerIndex, "risk", "severity", "riesgo", "criticality", "stig severity")
		synopsis := GetIndexed(row, headerIndex, "synopsis", "sinopsis", "summary")
		desc := GetIndexed(row, headerIndex, "description", "descripcion", "detalle")
		solution := GetIndexed(row, headerIndex, "solution", "solucion", "remediation")
		host := GetIndexed(row, headerIndex, "host", "dns name", "fqdn", "ip")
		port := GetIndexed(row, headerIndex, "port", "puerto")
		proto := GetIndexed(row, headerIndex, "protocol", "protocolo")
		cve := GetIndexed(row, headerIndex, "cve", "cves")
		cwe := GetIndexed(row, headerIndex, "cwe", "cwe id")
		cvssV3 := GetIndexed(row, headerIndex,
			"cvss v3.0 base score", "cvss v3.1 base score", "cvss v3 base score", "cvss base score", "cvss")
		cvssV2 := GetIndexed(row, headerIndex, "cvss v2.0 base score", "cvss v2 base score")
		vector := GetIndexed(row, headerIndex, "cvss v3.0 vector", "cvss v3.1 vector", "cvss v3 vector", "cvss vector")
		pluginOut := GetIndexed(row, headerIndex, "plugin output", "evidence", "output", "datos del plugin")
		pluginID := GetIndexed(row, headerIndex, "plugin id", "plugin_id")
		firstFound := GetIndexed(row, headerIndex, "first found", "first seen", "first_found", "first_seen")
		lastFound := GetIndexed(row, headerIndex, "last found", "last seen", "last_found", "last_seen")

		var cvss *float64
		if v := ParseFloatMaybe(cvssV3); v != nil {
			cvss = v
		} else {
			cvss = ParseFloatMaybe(cvssV2)
		}

		salidas := ""
		if pluginOut != "" {
			salidas = Truncate(ensureUTF8(pluginOut), MaxFieldLen)
		}

		descBody := JoinNonEmpty(synopsis, desc)
		if descBody == "" {
			descBody = "(Sin descripción en export)"
		}

		explicacion := salidas
		if explicacion == "" && desc != "" {
			explicacion = desc
		}

		d := Draft{
			"titulo":              ClampTitle(name),
			"descripcion":         Truncate(descBody, MaxFieldLen),
			"severidad":           MapScannerSeverity(risk),
			"metodo_deteccion":    DefaultNessusMetodo,
			"tool_source":         "Nessus",
			"host":                host,
			"port":                port,
			"proto":               proto,
			"componente_afectado": PtrStr(BuildComponenteAfectado(host, port, proto)),
			"import_context": map[string]interface{}{
				"nessus_plugin_id": strings.TrimSpace(pluginID),
				"synopsis":         Truncate(synopsis, 4000),
				"description_en":   Truncate(desc, 8000),
				"solution_en":      Truncate(solution, 8000),
			},
		}
		if cvss != nil {
			d["cvss_score"] = *cvss
		}
		if vector != "" {
			d["cvss_vector"] = Truncate(vector, 128)
		}
		if cve != "" {
			d["cve"] = Truncate(cve, 32)
		}
		if cwe != "" {
			d["cwe"] = Truncate(cwe, 32)
		}
		if salidas != "" {
			d["raw_tool_output"] = salidas
		}
		if solution != "" {
			d["propuesta_remediacion"] = Truncate(solution, MaxFieldLen)
		}
		if explicacion != "" {
			d["explicacion_tecnica"] = Truncate(explicacion, MaxFieldLen)
		}
		if pluginID != "" {
			pid := strings.TrimSpace(pluginID)
			d["tool_vuln_id"] = pid
			d["nessus_plugin_id"] = pluginID
		}
		if iso := ParseDatetimeMaybe(firstFound); iso != nil {
			d["first_seen"] = *iso
		}
		if iso := ParseDatetimeMaybe(lastFound); iso != nil {
			d["last_seen"] = *iso
		}
		out = append(out, d)
	}
	return out, nil
}

// ParseNessusTargets extracts unique host:port targets from Nessus CSV.
func ParseNessusTargets(data []byte) ([]Draft, error) {
	reader := csv.NewReader(bytes.NewReader(data))
	reader.LazyQuotes = true
	reader.FieldsPerRecord = -1

	fieldnames, err := reader.Read()
	if err != nil {
		if err == io.EOF {
			return nil, nil
		}
		return nil, err
	}
	headerIndex := BuildHeaderIndex(fieldnames)
	seen := make(map[string]struct{})
	var out []Draft

	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}
		row := make(map[string]string, len(fieldnames))
		for i, fn := range fieldnames {
			val := ""
			if i < len(record) {
				val = record[i]
			}
			row[fn] = val
		}

		host := GetIndexed(row, headerIndex, "host", "dns name", "fqdn", "ip")
		if host == "" {
			continue
		}
		port := GetIndexed(row, headerIndex, "port", "puerto")
		proto := GetIndexed(row, headerIndex, "protocol", "protocolo")
		service := GetIndexed(row, headerIndex, "service", "servicio")
		comp := BuildComponenteAfectado(host, port, proto)
		if comp == "" {
			comp = host
		}
		key := NormalizeAffectedComponent(comp)
		if key == "" {
			continue
		}
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}

		d := Draft{
			"host":                host,
			"port":                port,
			"proto":               proto,
			"componente_afectado": comp,
			"tool_source":         "Nessus",
			"titulo":              "Target " + comp,
		}
		if service != "" {
			d["servicio"] = service
			d["tool_vuln_id"] = service + "/" + defaultPort(port)
		}
		out = append(out, d)
	}
	return out, nil
}

func defaultPort(port string) string {
	if port == "" {
		return "0"
	}
	return port
}
