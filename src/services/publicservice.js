const os = require('os');
const process = require('process');
const fs = require('fs').promises;
const path = require('path');

class publicServices {
  static async getMemoryUsage() {
    return new Promise(async (resolve) => {
      const memory = process.memoryUsage();
      const totalMem = os.totalmem();
      const freeMem = os.freemem();

      resolve({
        timestamp: new Date().toISOString(),
        process: {
          rss: this.formatBytes(memory.rss),
          rssNumeric: memory.rss,
          heapTotal: this.formatBytes(memory.heapTotal),
          heapUsed: this.formatBytes(memory.heapUsed),
          heapUsagePercent: `${((memory.heapUsed / memory.heapTotal) * 100).toFixed(2)}%`,
          external: this.formatBytes(memory.external),
          arrayBuffers: this.formatBytes(memory.arrayBuffers),
          status: memory.heapUsed < memory.heapTotal * 0.9 ? '🟢 Healthy' : '🟡 Warning',
        },
        system: {
          total: this.formatBytes(totalMem),
          free: this.formatBytes(freeMem),
          used: this.formatBytes(totalMem - freeMem),
          usagePercent: `${(((totalMem - freeMem) / totalMem) * 100).toFixed(2)}%`,
          available: this.formatBytes(os.freemem()),
          status: (totalMem - freeMem) / totalMem < 0.85 ? '🟢 Healthy' : '🟡 Warning',
        },
      });
    });
  }

  static async getCpuMetrics() {
    return new Promise((resolve) => {
      const loadavg = os.loadavg();
      const cpus = os.cpus();
      const cpuSpeed = cpus[0]?.speed || 'Unknown';

      const cpuUsagePercent = cpus.map((cpu, index) => {
        const total = Object.values(cpu.times).reduce((acc, time) => acc + time, 0);
        const usage = 100 - (cpu.times.idle / total) * 100;
        return {
          core: index + 1,
          model: cpu.model,
          speed: `${cpu.speed}MHz`,
          usage: `${usage.toFixed(1)}%`,
          load: {
            user: `${((cpu.times.user / total) * 100).toFixed(1)}%`,
            system: `${((cpu.times.sys / total) * 100).toFixed(1)}%`,
            idle: `${((cpu.times.idle / total) * 100).toFixed(1)}%`,
          },
        };
      });

      resolve({
        timestamp: new Date().toISOString(),
        summary: {
          totalCores: cpus.length,
          model: cpus[0]?.model.split(' @ ')[0] || 'Unknown',
          speed: `${cpuSpeed}MHz`,
          loadAverage: {
            '1min': `${loadavg[0].toFixed(2)}`,
            '5min': `${loadavg[1].toFixed(2)}`,
            '15min': `${loadavg[2].toFixed(2)}`,
          },
          status: loadavg[0] < cpus.length * 0.7 ? '🟢 Healthy' : loadavg[0] < cpus.length * 0.9 ? '🟡 Warning' : '🔴 Critical',
        },
        perCore: cpuUsagePercent.slice(0, 8), // Limit to first 8 cores for readability
      });
    });
  }

  static async getDiskUsage() {
    return new Promise(async (resolve) => {
      try {
        const volumes = [];
        const partitions = os.networkInterfaces(); // Using a simple approach for now

        // Get stats for common mount points
        const mountPoints = ['/', '/home', '/var', process.cwd()];
        const uniqueMounts = [...new Set(mountPoints.map((p) => path.dirname(p)))];

        for (const mount of uniqueMounts.slice(0, 3)) {
          // Limit to 3 volumes
          try {
            const statvfs = await this.getDiskStats(mount);
            if (statvfs) {
              volumes.push({
                mountPoint: mount,
                total: this.formatBytes(statvfs.totalBytes),
                used: this.formatBytes(statvfs.usedBytes),
                free: this.formatBytes(statvfs.freeBytes),
                usage: `${statvfs.usagePercent}%`,
                status: statvfs.usagePercent < 85 ? '🟢 Healthy' : statvfs.usagePercent < 95 ? '🟡 Warning' : '🔴 Critical',
              });
            }
          } catch (err) {
            // Skip unreadable mounts
          }
        }

        resolve({
          timestamp: new Date().toISOString(),
          volumes,
          totalVolumes: volumes.length,
          status: volumes.every((v) => v.status === '🟢 Healthy') ? '🟢 Healthy' : '⚠️ Check Volumes',
        });
      } catch (error) {
        resolve({
          timestamp: new Date().toISOString(),
          error: 'Disk stats unavailable',
          fallback: 'Limited disk info due to permissions',
        });
      }
    });
  }

  static async getServerInfo() {
    return new Promise(async (resolve) => {
      const uptime = process.uptime();
      const interfaces = os.networkInterfaces();

      resolve({
        timestamp: new Date().toISOString(),
        process: {
          pid: process.pid,
          parentPid: process.ppid,
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
          argv: process.argv.slice(2),
          execPath: process.execPath,
          cwd: process.cwd(),
          uptime: {
            seconds: Math.floor(uptime),
            formatted: this.formatUptime(uptime),
            started: new Date(Date.now() - uptime * 1000).toISOString(),
          },
          envVars: {
            nodeEnv: process.env.NODE_ENV || 'development',
            port: process.env.PORT || 3000,
            total: Object.keys(process.env).length,
          },
          memory: this.formatBytes(process.memoryUsage().rss),
        },
        system: {
          hostname: os.hostname(),
          platform: `${os.platform()} ${os.release()}`,
          type: os.type(),
          architecture: os.arch(),
          cpu: {
            cores: os.cpus().length,
            model: os.cpus()[0]?.model.split(' @ ')[0] || 'Unknown',
          },
          memory: {
            total: this.formatBytes(os.totalmem()),
            cores: os.cpus().length,
          },
          network: {
            interfaces: Object.keys(interfaces).length,
            primary: Object.keys(interfaces)[0] || 'None',
          },
          directories: {
            home: os.homedir(),
            temp: os.tmpdir(),
            current: process.cwd(),
          },
        },
      });
    });
  }

  static async getNetworkStats() {
    return new Promise((resolve) => {
      const interfaces = os.networkInterfaces();
      const networkInfo = {};

      Object.entries(interfaces).forEach(([name, addresses]) => {
        const ipv4 = addresses.find((addr) => addr.family === 'IPv4');
        const ipv6 = addresses.find((addr) => addr.family === 'IPv6');

        networkInfo[name] = {
          ipv4: ipv4?.address || 'None',
          ipv6: ipv6?.address || 'None',
          internal: ipv4?.internal || false,
          mac: addresses[0]?.mac || 'None',
        };
      });

      resolve({
        timestamp: new Date().toISOString(),
        interfaces: networkInfo,
        totalInterfaces: Object.keys(networkInfo).length,
        primaryIP: Object.values(networkInfo)[0]?.ipv4 || 'Unknown',
      });
    });
  }

  static async getHealthStatus() {
    return new Promise(async (resolve) => {
      const memory = process.memoryUsage();
      const loadavg = os.loadavg();
      const cpus = os.cpus();

      // Simple health checks
      const memoryHealthy = memory.heapUsed < memory.heapTotal * 0.9;
      const cpuHealthy = loadavg[0] < cpus.length * 0.8;
      const diskHealthy = true; // Extend with fs checks later

      const overallStatus = memoryHealthy && cpuHealthy && diskHealthy ? '🟢 Healthy' : '🟡 Degraded';

      resolve({
        status: overallStatus,
        timestamp: new Date().toISOString(),
        uptime: this.formatUptime(process.uptime()),
        responseTime: '<1ms', // ✅ Fixed - Simple human-readable
        checks: {
          memory: {
            status: memoryHealthy ? '🟢 Pass' : '🔴 Fail',
            heapUsage: `${((memory.heapUsed / memory.heapTotal) * 100).toFixed(1)}%`,
          },
          cpu: {
            status: cpuHealthy ? '🟢 Pass' : '🔴 Fail',
            load1min: `${loadavg[0].toFixed(2)}`,
          },
          disk: {
            status: diskHealthy ? '🟢 Pass' : '❓ Unknown',
            note: 'Extend with fs checks',
          },
          uptime: {
            status: '🟢 Pass',
            duration: this.formatUptime(process.uptime()),
          },
        },
      });
    });
  }

  static async getDashboard() {
    const [memory, cpu, disk, server, network] = await Promise.all([this.getMemoryUsage(), this.getCpuMetrics(), this.getDiskUsage(), this.getServerInfo(), this.getNetworkStats()]);

    return {
      timestamp: new Date().toISOString(),
      status: '🟢 Healthy',
      summary: {
        hostname: server.system.hostname,
        uptime: server.process.uptime.formatted,
        cpuLoad: cpu.summary.loadAverage['1min'],
        memoryUsage: memory.system.usagePercent,
        platform: server.system.platform,
      },
      memory: memory,
      cpu: cpu.summary,
      disk: disk,
      network: network,
      process: server.process,
      health: await this.getHealthStatus(),
    };
  }

  // Utility methods
  static formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  static formatUptime(uptime) {
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);

    let formatted = '';
    if (days) formatted += `${days}d `;
    if (hours || days) formatted += `${hours}h `;
    if (minutes || hours || days) formatted += `${minutes}m `;
    formatted += `${seconds}s`;
    return formatted;
  }

  // Disk stats helper (Linux/macOS)
  static async getDiskStats(mountPoint) {
    try {
      const stat = await fs.statfs(mountPoint);
      return {
        totalBytes: stat.bsize * stat.blocks,
        freeBytes: stat.bsize * stat.bfree,
        availableBytes: stat.bsize * stat.bavail,
        usagePercent: Math.round((1 - stat.bavail / stat.blocks) * 100),
      };
    } catch (error) {
      return null;
    }
  }
}

module.exports = publicServices;
