import { parseNessus } from './src/app/(secops)/tools/exposure/parsers';

const sample = `Plugin ID,CVE,CVSS v2.0 Base Score,Risk,Host,Protocol,Port,Name,Synopsis,Description,Solution,See Also,Plugin Output,STIG Severity,CVSS v3.0 Base Score,CVSS v2.0 Temporal Score,CVSS v3.0 Temporal Score,Risk Factor,BID,XREF,MSKB,Plugin Publication Date,Plugin Modification Date,Metasploit,Core Impact,CANVAS
10180,,,None,10.13.128.0,tcp,0,Ping the remote host,"It was possible to identify the status of the remote host (alive or
dead).","Nessus was able to determine if the remote host is alive using one or
more of the following ping types :

  - An ARP ping, provided the host is on the local subnet
    and Nessus is running over Ethernet.",n/a,,"The remote host (10.13.128.0) is considered as dead - not scanning
The remote host (10.13.128.0) did not respond to the following ping methods :
- TCP ping
- ICMP ping
",,,,,None,,,,24/06/1999,25/02/2025,,,
`;

const file = new File([sample], "test.csv", { type: "text/csv" });
parseNessus(file).then(res => console.log(JSON.stringify(res, null, 2))).catch(console.error);
