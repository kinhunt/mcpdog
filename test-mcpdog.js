#!/usr/bin/env node

// 测试 MCPDog 2.0 的用户体验
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class MCPDogTester {
  constructor() {
    this.mcpProcess = null;
  }

  async startMCPDog() {
    return new Promise((resolve, reject) => {
      const mcpPath = path.join(__dirname, 'dist', 'index.js');
      this.mcpProcess = spawn('node', [mcpPath], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.mcpProcess.stderr.on('data', (data) => {
        console.log('MCPDog:', data.toString().trim());
        if (data.toString().includes('Ready to fetch')) {
          resolve();
        }
      });

      this.mcpProcess.on('error', reject);
      
      // 5秒超时
      setTimeout(() => {
        if (this.mcpProcess) {
          reject(new Error('MCPDog startup timeout'));
        }
      }, 5000);
    });
  }

  async sendRequest(request) {
    return new Promise((resolve, reject) => {
      const mcpRequest = {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: 'use_mcpdog',
          arguments: {
            user_request: request
          }
        }
      };

      let responseData = '';
      
      const onData = (data) => {
        responseData += data.toString();
        try {
          const response = JSON.parse(responseData);
          this.mcpProcess.stdout.removeListener('data', onData);
          resolve(response);
        } catch (e) {
          // 继续等待更多数据
        }
      };

      this.mcpProcess.stdout.on('data', onData);
      
      this.mcpProcess.stdin.write(JSON.stringify(mcpRequest) + '\n');
      
      // 10秒超时
      setTimeout(() => {
        this.mcpProcess.stdout.removeListener('data', onData);
        reject(new Error('Request timeout'));
      }, 10000);
    });
  }

  async testScenarios() {
    const scenarios = [
      {
        name: "发送邮件场景",
        request: "send email to john@example.com with subject 'Meeting Tomorrow', use mcpdog"
      },
      {
        name: "数据库查询场景", 
        request: "I need to query database for user data, use mcpdog"
      },
      {
        name: "文件处理场景",
        request: "process file data.csv and convert to json, use mcpdog"
      },
      {
        name: "图像处理场景",
        request: "resize image photo.jpg to 800x600, use mcpdog"
      },
      {
        name: "无效请求场景",
        request: "just random text, use mcpdog"
      },
      {
        name: "中文请求场景",
        request: "我要发送邮件给客户，use mcpdog"
      }
    ];

    console.log('\n🧪 开始测试 MCPDog 2.0 用户体验...\n');

    for (const scenario of scenarios) {
      console.log(`\n📋 测试场景: ${scenario.name}`);
      console.log(`📝 用户请求: "${scenario.request}"`);
      console.log('─'.repeat(80));
      
      try {
        const response = await this.sendRequest(scenario.request);
        
        if (response.result && response.result.content) {
          console.log(response.result.content[0].text);
        } else if (response.error) {
          console.log(`❌ 错误: ${response.error.message}`);
        } else {
          console.log('⚠️ 未知响应格式:', JSON.stringify(response, null, 2));
        }
      } catch (error) {
        console.log(`❌ 测试失败: ${error.message}`);
      }
      
      console.log('\n' + '='.repeat(80));
    }
  }

  async cleanup() {
    if (this.mcpProcess) {
      this.mcpProcess.kill();
      console.log('\n🧹 MCPDog 进程已关闭');
    }
  }
}

async function main() {
  const tester = new MCPDogTester();
  
  try {
    console.log('🚀 启动 MCPDog 服务器...');
    await tester.startMCPDog();
    console.log('✅ MCPDog 已启动！\n');
    
    await tester.testScenarios();
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  } finally {
    await tester.cleanup();
  }
}

// 处理 Ctrl+C
process.on('SIGINT', () => {
  console.log('\n👋 测试中断');
  process.exit(0);
});

main().catch(console.error);