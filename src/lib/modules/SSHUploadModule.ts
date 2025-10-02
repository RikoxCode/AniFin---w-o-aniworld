import * as fs from 'fs';
import * as path from 'path';
import { ConfigModule } from './ConfigModule';
import { spawn } from "child_process";

function execCmd(
  cmd: string,
  args: string[],
  onOut?: any,
  onErr?: any
) {
  return new Promise<void>((res, rej) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let errBuf = "";
    p.stdout.on("data", d => {
      const s = d.toString();
      s.split(/\r?\n/).forEach((l: any) => l && onOut?.(l));
    });
    p.stderr.on("data", d => {
      const s = d.toString();
      errBuf += s;
      s.split(/\r?\n/).forEach((l: any) => l && onErr?.(`ERROR: ${l}`));
    });
    p.on("close", c => c === 0 ? res() : rej(new Error(`${cmd} failed (${c}): ${errBuf.trim()}`)));
  });
}

function toPosix(p: string) { return p.replace(/\\/g, '/'); }

export class SSHUploadModule {
  private config: ReturnType<ConfigModule['getSSHConfig']>;

  constructor(configModule: ConfigModule) {
    this.config = configModule.getSSHConfig();

    if (!configModule.isSSHConfigured()) {
      throw new Error('SSH not configured. Check .env or SSH is disabled.');
    }
  }

  /**
   * Upload file to remote server via SSH
   */
  async uploadFile(localPath: string, remotePath?: string, enabledDeletionAfterwards: boolean = true): Promise<void> {
    if (!this.config.enabled) throw new Error('SSH upload is disabled');

    // POSIX-Pfad bauen
    const baseRemote = toPosix(this.config.remotePath);
    const targetPath = toPosix(
      remotePath ? remotePath : path.posix.join(baseRemote, path.basename(localPath))
    );
    const remoteDir = path.posix.dirname(targetPath);

    // 1) Zielordner anlegen
    await execCmd(
      "ssh",
      ["-p", String(this.config.port), `${this.config.username}@${this.config.host}`, `mkdir -p "${remoteDir.replace(/"/g, '\\"')}"`]
    );

    // 2) Datei kopieren (keine Extra-Quotes ums Ziel nötig)
    await execCmd(
      "scp",
      ["-P", String(this.config.port), localPath, `${this.config.username}@${this.config.host}:${targetPath}`]
    );

    if(enabledDeletionAfterwards){
      this.delete_local_dir(localPath)
    }
  }


  /**
   * Upload entire directory
   */
  async uploadDirectory(localDir: string, remoteDir?: string): Promise<void> {
    const baseRemote = toPosix(this.config.remotePath);
    const targetDir = toPosix(
      remoteDir ? remoteDir : path.posix.join(baseRemote, path.basename(localDir))
    );

    const files: any[] = fs.readdirSync(localDir, { recursive: true, withFileTypes: true });
    for (const file of files) {
      if (file.isFile()) {
        const localFilePath = path.join(file.path, file.name);
        const relPath = path.relative(localDir, localFilePath).split(path.sep).join("/");
        const remoteFilePath = path.posix.join(targetDir, relPath);
        await this.uploadFile(localFilePath, remoteFilePath, false);
      }
    }

    await this.delete_local_dir(localDir)
  }

  async delete_local_dir(localDir: string) {
    if (fs.existsSync(localDir)) {
      await fs.promises.rm(localDir, { recursive: true, force: true });
    }
  }
}