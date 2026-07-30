import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import net from 'net';
import { writeAuditLog } from '@/lib/audit-logger';


const execAsync = promisify(exec);

export async function POST(request: Request) {
  let tempKeyPath: string | null = null;
  let tempExpectPath: string | null = null;
  try {
    const body = await request.json();
    const { host, port = 22, username, password = '', authType = 'password', privateKey = '', command, timeout = 30 } = body;

    if (!host || !command) {
      return NextResponse.json(
        { error: 'Faltan parámetros requeridos (host, command)' },
        { status: 400 }
      );
    }

    // 1. Real TCP Port Connection Check (Ping/Status check) without any dummy credentials
    if (command === 'CHECK_PORT') {
      return await new Promise<NextResponse>((resolve) => {
        const startTime = Date.now();
        const socket = new net.Socket();
        socket.setTimeout(4000); // 4 seconds timeout

        socket.on('connect', () => {
          const latency = Date.now() - startTime;
          socket.destroy();
          resolve(NextResponse.json({ success: true, latencyMs: latency }));
        });

        socket.on('error', (err) => {
          socket.destroy();
          resolve(NextResponse.json({ error: `Network connection failed: ${err.message}` }, { status: 400 }));
        });

        socket.on('timeout', () => {
          socket.destroy();
          resolve(NextResponse.json({ error: 'Network connection timed out (host unreachable)' }, { status: 400 }));
        });

        socket.connect(port, host);
      });
    }

    if (!username) {
      return NextResponse.json(
        { error: 'Falta parámetro de credenciales: username' },
        { status: 400 }
      );
    }

    const logs: string[] = [];
    logs.push(`[+] [${new Date().toISOString()}] Inicializando conexión SSH hacia ${username}@${host}:${port}...`);

    // Only mock if host is local loopback (development dummy)
    const isMock = host === '127.0.0.1' || host === 'localhost';

    if (isMock) {
      logs.push(`[+] Autenticación exitosa (${authType === 'key' ? 'Llave Pública' : 'Password'}). Sesión de canal SSH establecida.`);
      logs.push(`[+] Ejecutando comando remoto: ${command}`);
      logs.push(`[+] --- INICIO SALIDA TERMINAL ---`);
      
      if (command.toLowerCase().includes('nmap')) {
        logs.push(`Starting Nmap 7.94 ( https://nmap.org ) at ${new Date().toLocaleDateString()}`);
        logs.push(`Nmap scan report for ${host} (${host})`);
        logs.push(`Host is up (0.00045s latency).`);
        logs.push(`PORT     STATE SERVICE VERSION`);
        logs.push(`22/tcp   open  ssh     OpenSSH 8.9p1 (Ubuntu Linux)`);
        logs.push(`80/tcp   open  http    nginx 1.18.0 (Ubuntu)`);
        logs.push(`Nmap done: 1 IP address scanned in 1.45 seconds`);
      } else {
        logs.push(`uid=1001(${username}) gid=1001(${username}) groups=1001(${username})`);
        logs.push(`Linux localhost-dummy-node 5.15.0-generic x86_64 GNU/Linux`);
        logs.push(`SUCCESS_AUTH`);
      }
      logs.push(`[+] --- FIN SALIDA TERMINAL ---`);
      logs.push(`[+] [${new Date().toISOString()}] Conexión SSH cerrada correctamente.`);
      
      writeAuditLog({
        severity: 'INFO',
        category: 'PCI-DSS:10.2.2, ISO-27001:A.12.4.3',
        tenant: 'ClientPortal',
        user: username,
        action: 'MOCK_SSH_COMMAND_EXECUTION',
        target: host,
        status: 'SUCCESS',
        msg: `Mock SSH execution finished successfully for target ${host}:${port}. Command: ${command}`,
      });

      return NextResponse.json({ success: true, logs });
    }

    // Set up SSH command flags
    let sshCmdBase = `ssh -T -p ${port} -o ConnectTimeout=5 -o StrictHostKeyChecking=no`;

    if (authType === 'key') {
      if (!privateKey.trim()) {
        return NextResponse.json({ error: 'La llave privada es requerida para el método Llave Pública.' }, { status: 400 });
      }
      // Create a secure temporary file within the workspace for the private key
      const tempDir = path.join(process.cwd(), 'src/app/api/automation/ssh-run');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      tempKeyPath = path.join(tempDir, `temp_id_rsa_${Date.now()}`);
      
      // Ensure Unix line endings and write key file
      const cleanKey = privateKey.replace(/\r\n/g, '\n').trim() + '\n';
      fs.writeFileSync(tempKeyPath, cleanKey, { mode: 0o600 });
      fs.chmodSync(tempKeyPath, 0o600); // Strict Unix permissions (chmod 600)

      sshCmdBase += ` -i "${tempKeyPath}" -o PreferredAuthentications=publickey`;
    } else {
      sshCmdBase += ` -o PreferredAuthentications=password`;
    }

    // Escape single quotes, command tokens, and Tcl command brackets safely
    const escapedPassword = password.replace(/["\\$`\[\]]/g, '\\$&');
    const escapedCommand = command.replace(/["\\$`\[\]]/g, '\\$&');

    // Expect script that logs stdout or outputs detailed SSH authentication errors
    const expectScript = `
      set timeout ${timeout}
      spawn ${sshCmdBase} ${username}@${host} "${escapedCommand}"
      expect {
        "Are you sure you want to continue connecting" {
          send "yes\\r"
          exp_continue
        }
        "password:" {
          send "${escapedPassword}\\r"
          exp_continue
        }
        "Permission denied" {
          send_user "\\n\\[!\\] ssh: handshake failed: ssh: unable to authenticate user \\[${username}\\] using method \\[${authType === 'key' ? 'publickey' : 'password'}\\]. Handshake error: invalid or unauthorized key/credentials provided.\\n"
          exit 1
        }
        "Connection refused" {
          send_user "\\n\\[!\\] ssh: connection failed: connection refused by remote host on port ${port}.\\n"
          exit 2
        }
        "No route to host" {
          send_user "\\n\\[!\\] ssh: connection failed: no route to host. Check network connectivity or firewall rules.\\n"
          exit 3
        }
        "Connection timed out" {
          send_user "\\n\\[!\\] ssh: connection failed: connection timed out. Check network routing.\\n"
          exit 4
        }
        timeout {
          send_user "\\n\\[!\\] ssh: connection timed out after ${timeout} seconds.\\n"
          exit 5
        }
        eof {
          exit 0
        }
      }
    `;

    try {
      // Create a secure temporary file within the workspace for the expect script
      const tempDir = path.join(process.cwd(), 'src/app/api/automation/ssh-run');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      tempExpectPath = path.join(tempDir, `temp_expect_${Date.now()}.exp`);
      fs.writeFileSync(tempExpectPath, expectScript, { encoding: 'utf8' });

      // Set child process timeout as well to kill any hanging child shells
      const { stdout, stderr } = await execAsync(`expect "${tempExpectPath}"`, { timeout: (timeout + 2) * 1000 });
      
      // Parse output
      const outputLines = (stdout || '').split('\n').map((l) => l.trim()).filter(Boolean);
      
      // Check if error was reported in stdout by our expect script
      const authErrorLine = outputLines.find((l) => l.startsWith('[!] ssh:'));
      if (authErrorLine) {
        return NextResponse.json({ error: authErrorLine.replace('[!] ', '') }, { status: 400 });
      }

      logs.push(`[+] Autenticación SSH real exitosa.`);
      logs.push(`[+] --- INICIO SALIDA TERMINAL ---`);
      outputLines.forEach((l) => {
        if (!l.includes('spawn ssh') && !l.includes('password:') && !l.includes('know_hosts')) {
          logs.push(l);
        }
      });
      if (stderr) {
        logs.push(`[!] Stderr: ${stderr}`);
      }
      logs.push(`[+] --- FIN SALIDA TERMINAL ---`);
      logs.push(`[+] Conexión SSH real finalizada exitosamente.`);
      
      writeAuditLog({
        severity: 'INFO',
        category: 'PCI-DSS:10.2.2, ISO-27001:A.12.4.3',
        tenant: 'ClientPortal',
        user: username,
        action: 'SSH_COMMAND_EXECUTION',
        target: host,
        status: 'SUCCESS',
        msg: `Real SSH command executed successfully on target ${host}:${port}. Command: ${command}`,
      });

      return NextResponse.json({ success: true, logs });
    } catch (err: any) {
      if (err.killed || err.signal === 'SIGTERM') {
        return NextResponse.json(
          { error: `ssh: connection timed out (process killed after ${timeout} seconds to prevent hang).` },
          { status: 400 }
        );
      }

      const output = err.stdout || '';
      const errLine = output.split('\n').find((l: string) => l.includes('[!] ssh:'));
      
      const detailedMessage = errLine 
        ? errLine.replace('[!] ', '').trim()
        : err.message.includes('No route to host')
        ? 'ssh: connection failed: no route to host. Check network connectivity or firewall rules.'
        : err.message.includes('Connection refused')
        ? `ssh: connection failed: connection refused by remote host on port ${port}.`
        : `ssh: connection failed: ${err.message || 'unknown error'}`;

      writeAuditLog({
        severity: 'WARN',
        category: 'PCI-DSS:10.2.2, ISO-27001:A.12.4.3',
        tenant: 'ClientPortal',
        user: username || 'unknown',
        action: 'SSH_COMMAND_EXECUTION',
        target: host || 'N/A',
        status: 'FAILED',
        msg: `SSH connection failed on target ${host || 'N/A'}:${port}. Error: ${detailedMessage}`,
      });

      return NextResponse.json(
        { error: detailedMessage },
        { status: 400 }
      );
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error en el servidor de automatización SSH' },
      { status: 500 }
    );
  } finally {
    // Guaranteed deletion of the temporary key file from disk
    if (tempKeyPath && fs.existsSync(tempKeyPath)) {
      try {
        fs.unlinkSync(tempKeyPath);
      } catch (e) {
        console.error('Failed to delete temp key file:', e);
      }
    }
    // Guaranteed deletion of the temporary expect file from disk
    if (tempExpectPath && fs.existsSync(tempExpectPath)) {
      try {
        fs.unlinkSync(tempExpectPath);
      } catch (e) {
        console.error('Failed to delete temp expect file:', e);
      }
    }
  }
}
