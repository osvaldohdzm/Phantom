package parsers

import (
	"encoding/xml"
	"regexp"
	"strings"
)

var (
	gnmapHostRe   = regexp.MustCompile(`Host:\s*([\d.]+)`)
	gnmapPortRe   = regexp.MustCompile(`^(\d+)/(\w+)\s+(\w+)`)
	nmapReportRe  = regexp.MustCompile(`Nmap scan report for (?:.*?\(?([\d.]+)\)?|([\d.]+))`)
	nmapPortLine  = regexp.MustCompile(`^\s*(\d+)/(\w+)\s+(\w+)\s+([\w.-]+)\s*(.*)$`)
)

// ParseNmap parses Nmap XML, gnmap or text output.
func ParseNmap(data []byte, filename string) ([]Draft, error) {
	text := strings.TrimSpace(string(data))
	low := strings.ToLower(filename)

	if strings.HasSuffix(low, ".xml") || strings.HasPrefix(text, "<?xml") || strings.HasPrefix(text, "<nmaprun") {
		if rows := parseNmapXML(text, filename); len(rows) > 0 {
			return rows, nil
		}
	}
	if strings.HasSuffix(low, ".gnmap") || (strings.Contains(text, "Host:") && strings.Contains(text, "Ports:")) {
		if rows := parseGnmap(text, filename); len(rows) > 0 {
			return rows, nil
		}
	}
	if rows := parseNormalNmap(text, filename); len(rows) > 0 {
		return rows, nil
	}
	if strings.Contains(text, "Ports:") {
		return parseGnmap(text, filename), nil
	}
	return nil, nil
}

func nmapDraft(host, portID, proto, service, titulo, desc, raw string) Draft {
	comp := BuildComponenteAfectado(host, portID, proto)
	d := Draft{
		"titulo":              ClampTitle(titulo),
		"descripcion":         desc,
		"severidad":           "Info",
		"host":                host,
		"port":                portID,
		"proto":               proto,
		"tool_source":         "Nmap",
		"tool_vuln_id":        Truncate(service+"/"+portID, 512),
		"raw_tool_output":     Truncate(raw, MaxFieldLen),
	}
	if comp != "" {
		d["componente_afectado"] = comp
	}
	return d
}

func parseGnmap(text, filename string) []Draft {
	var rows []Draft
	for _, line := range strings.Split(text, "\n") {
		if !strings.Contains(line, "Host:") || !strings.Contains(line, "Ports:") {
			continue
		}
		ipM := gnmapHostRe.FindStringSubmatch(line)
		if len(ipM) < 2 {
			continue
		}
		ip := ipM[1]
		portsPart := strings.TrimSpace(strings.SplitN(line, "Ports:", 2)[1])
		for _, entry := range splitCommaPorts(portsPart) {
			parts := strings.Split(entry, "/")
			if len(parts) < 2 {
				continue
			}
			portID := strings.TrimSpace(parts[0])
			state := strings.TrimSpace(parts[1])
			if state != "open" {
				continue
			}
			servicio := "unknown"
			if len(parts) > 4 {
				servicio = strings.TrimSpace(parts[4])
			}
			version := ""
			if len(parts) > 6 {
				version = strings.TrimSpace(parts[6])
			}
			titulo := "Puerto abierto: " + servicio + " en " + ip + ":" + portID
			desc := "Servicio: " + servicio + "\nVersión: " + defaultVer(version) + "\nArchivo: " + filename
			raw := "Host: " + ip + "\nPuerto: " + portID + "\n[Nmap GNMAP] " + Truncate(entry, 4000)
			rows = append(rows, nmapDraft(ip, portID, "tcp", servicio, titulo, desc, raw))
		}
	}
	return rows
}

func splitCommaPorts(s string) []string {
	var parts []string
	var cur strings.Builder
	depth := 0
	for _, ch := range s {
		if ch == '(' {
			depth++
		} else if ch == ')' && depth > 0 {
			depth--
		}
		if ch == ',' && depth == 0 {
			parts = append(parts, strings.TrimSpace(cur.String()))
			cur.Reset()
			continue
		}
		cur.WriteRune(ch)
	}
	if cur.Len() > 0 {
		parts = append(parts, strings.TrimSpace(cur.String()))
	}
	return parts
}

func defaultVer(v string) string {
	if v == "" {
		return "N/A"
	}
	return v
}

type nmapXMLHost struct {
	XMLName xml.Name       `xml:"host"`
	Address []nmapXMLAddr  `xml:"address"`
	Ports   nmapXMLPorts   `xml:"ports"`
}

type nmapXMLAddr struct {
	Addr     string `xml:"addr,attr"`
	AddrType string `xml:"addrtype,attr"`
}

type nmapXMLPorts struct {
	Port []nmapXMLPort `xml:"port"`
}

type nmapXMLPort struct {
	PortID   string         `xml:"portid,attr"`
	Protocol string         `xml:"protocol,attr"`
	State    nmapXMLState   `xml:"state"`
	Service  nmapXMLService `xml:"service"`
}

type nmapXMLState struct {
	State string `xml:"state,attr"`
}

type nmapXMLService struct {
	Name      string `xml:"name,attr"`
	Product   string `xml:"product,attr"`
	Version   string `xml:"version,attr"`
	ExtraInfo string `xml:"extrainfo,attr"`
}

type nmapXMLRun struct {
	XMLName xml.Name      `xml:"nmaprun"`
	Host    []nmapXMLHost `xml:"host"`
}

func parseNmapXML(text, filename string) []Draft {
	var run nmapXMLRun
	if err := xml.Unmarshal([]byte(text), &run); err != nil {
		return nil
	}
	var rows []Draft
	for _, host := range run.Host {
		addr := ""
		for _, a := range host.Address {
			if a.AddrType == "ipv4" && a.Addr != "" {
				addr = a.Addr
				break
			}
		}
		if addr == "" && len(host.Address) > 0 {
			addr = host.Address[0].Addr
		}
		if addr == "" {
			continue
		}
		for _, port := range host.Ports.Port {
			if port.State.State != "open" {
				continue
			}
			portID := port.PortID
			if portID == "" {
				portID = "?"
			}
			name := port.Service.Name
			if name == "" {
				name = "unknown"
			}
			ver := strings.TrimSpace(strings.Join(filterEmpty(port.Service.Product, port.Service.Version, port.Service.ExtraInfo), " "))
			if ver == "" {
				ver = "N/A"
			}
			proto := port.Protocol
			if proto == "" {
				proto = "tcp"
			}
			titulo := "Puerto abierto: " + name + " en " + addr + ":" + portID
			desc := "Servicio: " + name + "\nVersión: " + ver + "\nArchivo: " + filename
			raw := "Host: " + addr + "\nPuerto: " + portID + "\n[Nmap XML] host=" + addr + " port=" + portID + "/" + proto + " service=" + name + " version=" + ver
			rows = append(rows, nmapDraft(addr, portID, proto, name, titulo, desc, raw))
		}
	}
	return rows
}

func filterEmpty(parts ...string) []string {
	var out []string
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

func parseNormalNmap(text, filename string) []Draft {
	var rows []Draft
	currentIP := "Unknown"
	for _, line := range strings.Split(text, "\n") {
		if m := nmapReportRe.FindStringSubmatch(line); len(m) > 0 {
			if m[1] != "" {
				currentIP = m[1]
			} else if m[2] != "" {
				currentIP = m[2]
			}
			continue
		}
		m := nmapPortLine.FindStringSubmatch(line)
		if m == nil {
			continue
		}
		portID, proto, state, svc, rest := m[1], m[2], m[3], m[4], strings.TrimSpace(m[5])
		if state != "open" {
			continue
		}
		titulo := "Puerto abierto: " + svc + " en " + currentIP + ":" + portID
		desc := "Servicio: " + svc + "\nVersión: " + defaultVer(rest) + "\nArchivo: " + filename
		raw := "Host: " + currentIP + "\nPuerto: " + portID + "\n[Nmap texto] " + Truncate(strings.TrimSpace(line), 8000)
		rows = append(rows, nmapDraft(currentIP, portID, proto, svc, titulo, desc, raw))
	}
	return rows
}
