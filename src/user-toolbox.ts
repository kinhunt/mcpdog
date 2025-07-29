// 用户工具箱管理系统
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export interface UserService {
  id: string;
  name: string;
  description: string;
  tools: Array<{
    name: string;
    description: string;
    parameters: any;
  }>;
  endpoint: string;
  addedAt: Date;
  usageCount: number;
  lastUsed?: Date;
  userNotes?: string;
}

export class UserToolbox {
  private configDir: string;
  private toolboxPath: string;
  private favoriteServices: Map<string, UserService> = new Map();

  constructor() {
    this.configDir = path.join(os.homedir(), '.mcpdog');
    this.toolboxPath = path.join(this.configDir, 'user-toolbox.json');
    this.initialize();
  }

  private async initialize() {
    try {
      // 确保配置目录存在
      await fs.mkdir(this.configDir, { recursive: true });
      
      // 加载已有的工具箱
      await this.loadFromDisk();
    } catch (error) {
      console.error('Failed to initialize user toolbox:', error);
    }
  }

  private async loadFromDisk() {
    try {
      const data = await fs.readFile(this.toolboxPath, 'utf-8');
      const toolboxData = JSON.parse(data);
      
      this.favoriteServices.clear();
      for (const [id, service] of Object.entries(toolboxData.services || {})) {
        this.favoriteServices.set(id, service as UserService);
      }
    } catch (error) {
      // 文件不存在或格式错误，创建新的工具箱
      console.log('Creating new user toolbox');
      await this.saveToDisk();
    }
  }

  private async saveToDisk() {
    const toolboxData = {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      services: Object.fromEntries(this.favoriteServices),
      metadata: {
        totalServices: this.favoriteServices.size,
        createdAt: new Date().toISOString()
      }
    };

    await fs.writeFile(this.toolboxPath, JSON.stringify(toolboxData, null, 2));
  }

  // 添加服务到工具箱
  async addService(service: UserService): Promise<void> {
    service.addedAt = new Date();
    service.usageCount = 0;
    
    this.favoriteServices.set(service.id, service);
    await this.saveToDisk();
    
    console.log(`Added service ${service.name} to user toolbox`);
  }

  // 从工具箱移除服务
  async removeService(serviceId: string): Promise<boolean> {
    const removed = this.favoriteServices.delete(serviceId);
    if (removed) {
      await this.saveToDisk();
      console.log(`Removed service ${serviceId} from user toolbox`);
    }
    return removed;
  }

  // 获取所有收藏的服务
  getFavoriteServices(): UserService[] {
    return Array.from(this.favoriteServices.values())
      .sort((a, b) => {
        // 按使用频率和最近使用时间排序
        if (a.usageCount !== b.usageCount) {
          return b.usageCount - a.usageCount;
        }
        const aLastUsed = a.lastUsed?.getTime() || 0;
        const bLastUsed = b.lastUsed?.getTime() || 0;
        return bLastUsed - aLastUsed;
      });
  }

  // 查找服务
  findService(serviceId: string): UserService | undefined {
    return this.favoriteServices.get(serviceId);
  }

  // 更新服务使用统计
  async updateUsageStats(serviceId: string, toolName: string) {
    const service = this.favoriteServices.get(serviceId);
    if (service) {
      service.usageCount += 1;
      service.lastUsed = new Date();
      await this.saveToDisk();
    }
  }

  // 生成动态工具列表
  generateUserTools(): Array<{
    name: string;
    description: string;
    inputSchema: any;
    sourceService: string;
  }> {
    const tools: Array<{
      name: string;
      description: string;
      inputSchema: any;
      sourceService: string;
    }> = [];

    for (const service of this.getFavoriteServices()) {
      for (const tool of service.tools) {
        tools.push({
          name: `${service.id}_${tool.name}`,
          description: `${tool.description} (via ${service.name})`,
          inputSchema: tool.parameters,
          sourceService: service.id
        });
      }
    }

    return tools;
  }

  // 获取工具箱统计信息
  getStats(): {
    totalServices: number;
    totalTools: number;
    mostUsedService?: string;
    recentlyAdded: UserService[];
  } {
    const services = this.getFavoriteServices();
    const totalTools = services.reduce((sum, service) => sum + service.tools.length, 0);
    const mostUsedService = services.length > 0 ? services[0].name : undefined;
    const recentlyAdded = services
      .sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime())
      .slice(0, 3);

    return {
      totalServices: services.length,
      totalTools,
      mostUsedService,
      recentlyAdded
    };
  }

  // 导出工具箱配置
  async exportToolbox(): Promise<string> {
    const toolboxData = {
      exportedAt: new Date().toISOString(),
      services: Array.from(this.favoriteServices.values()),
      stats: this.getStats()
    };

    return JSON.stringify(toolboxData, null, 2);
  }

  // 导入工具箱配置
  async importToolbox(configJson: string): Promise<void> {
    try {
      const config = JSON.parse(configJson);
      
      for (const service of config.services || []) {
        await this.addService(service);
      }
      
      console.log(`Imported ${config.services?.length || 0} services to toolbox`);
    } catch (error) {
      throw new Error(`Failed to import toolbox: ${error}`);
    }
  }
}