/**
 * Configuration Audit CLI Commands
 */

import { ConfigManager } from '../../config/config-manager.js';
import { MCPServerConfig } from '../../types/index.js';
import { CLIUtils } from '../cli-utils.js';

export class AuditCommands {
  constructor(private configManager: ConfigManager) {}

  async execute(args: string[], options: Record<string, any>): Promise<void> {
    if (options.help) {
      this.showHelp();
      return;
    }

    const auditType = this.determineAuditType(options);
    
    switch (auditType) {
      case 'performance':
        await this.performanceAudit(options);
        break;
      case 'security':
        await this.securityAudit(options);
        break;
      case 'compliance':
        await this.complianceAudit(options);
        break;
      default:
        await this.fullAudit(options);
    }
  }

  private determineAuditType(options: Record<string, any>): string {
    if (options.performance) return 'performance';
    if (options.security) return 'security';
    if (options.compliance) return 'compliance';
    return 'full';
  }

  private async fullAudit(options: Record<string, any>): Promise<void> {
    CLIUtils.info('🔍 Performing full configuration audit...');

    const servers = Object.values(this.configManager.getServers());
    const config = this.configManager.getConfig();

    // Collect audit information
    const auditResults = {
      timestamp: new Date().toISOString(),
      servers: servers.length,
      enabledServers: servers.filter(s => s.enabled).length,
      protocols: this.analyzeProtocols(servers),
      performance: await this.analyzePerformance(servers),
      security: this.analyzeSecurity(servers, config),
      compliance: this.analyzeCompliance(servers, config),
      recommendations: [] as string[]
    };

    // Generate recommendations
    auditResults.recommendations = this.generateRecommendations(auditResults);

    if (CLIUtils.isJsonMode()) {
      CLIUtils.jsonOutput(auditResults);
      return;
    }

    this.displayAuditReport(auditResults);

    // Export report
    if (options.export) {
      await this.exportReport(auditResults, options.export);
    }
  }

  private async performanceAudit(options: Record<string, any>): Promise<void> {
    CLIUtils.info('⚡ Performing performance audit...');

    const servers = Object.values(this.configManager.getServers());
    const performanceResults = [];

    for (let i = 0; i < servers.length; i++) {
      const server = servers[i];
      CLIUtils.showProgress(i + 1, servers.length, `Analyzing ${server.name}`);

      try {
        const optimization = await this.configManager.optimizeConfig();
        // const protocolAnalysis = await this.configManager.detectConfigProtocol(server);

        performanceResults.push({
          name: server.name,
          currentProtocol: server.transport,
          optimalProtocol: 'N/A', // Placeholder
          confidence: 0, // Placeholder
          optimizations: optimization.length,
          timeoutOptimal: this.isTimeoutOptimal(server),
          performanceScore: 0 // Placeholder
        });

      } catch (error) {
        performanceResults.push({
          name: server.name,
          error: (error as Error).message,
          performanceScore: 0
        });
      }
    }

    if (CLIUtils.isJsonMode()) {
      CLIUtils.jsonOutput({ performanceAudit: performanceResults });
      return;
    }

    console.log(`
${CLIUtils.colorize('⚡ Performance Audit Report:', 'cyan')}
`);

    const headers = ['Server', 'Current Protocol', 'Optimal Protocol', 'Confidence', 'Optimizations', 'Performance Score'];
    const rows = performanceResults.map(result => [
      result.name,
      result.currentProtocol || 'N/A',
      result.optimalProtocol || 'N/A',
      result.confidence ? `${result.confidence}%` : 'N/A',
      result.optimizations?.toString() || '0',
      this.formatPerformanceScore(result.performanceScore || 0)
    ]);

    CLIUtils.printTable(headers, rows);

    // Performance statistics
    const avgScore = performanceResults.reduce((sum, r) => sum + (r.performanceScore || 0), 0) / performanceResults.length;
    const needsOptimization = performanceResults.filter(r => (r.performanceScore || 0) < 80).length;

    console.log(`
${CLIUtils.colorize('📊 Performance Statistics:', 'cyan')}`);
    console.log(`  Average Performance Score: ${this.formatPerformanceScore(Math.round(avgScore))}`);
    console.log(`  Needs Optimization: ${needsOptimization}/${performanceResults.length}`);

    if (needsOptimization > 0) {
      console.log(`
${CLIUtils.colorize('💡 Performance Recommendations:', 'cyan')}`);
      performanceResults.filter(r => (r.performanceScore || 0) < 80).forEach(result => {
        console.log(`  • ${result.name}: Consider switching to ${result.optimalProtocol} protocol`);
      });
    }
  }

  private async securityAudit(options: Record<string, any>): Promise<void> {
    CLIUtils.info('🔒 Performing security audit...');

    const servers = Object.values(this.configManager.getServers());
    const config = this.configManager.getConfig();
    
    const securityResults = {
      httpServersWithoutAuth: servers.filter(s => 
        (s.transport === 'http-sse' || s.transport === 'streamable-http') && 
        !s.apiKey && !s.headers?.Authorization
      ).length,
      
      deprecatedProtocols: servers.filter(s => s.transport === 'http-sse').length,
      
      insecureEndpoints: servers.filter(s => 
        s.endpoint && s.endpoint.startsWith('http://') && !s.endpoint.includes('localhost')
      ).length,
      
      weakTimeouts: servers.filter(s => s.timeout && s.timeout > 300000).length,
      
      loggingEnabled: !!config.logging?.level,
      webInterfaceExposed: config.web?.enabled && config.web?.host !== 'localhost'
    };

    if (CLIUtils.isJsonMode()) {
      CLIUtils.jsonOutput({ securityAudit: securityResults });
      return;
    }

    console.log(`
${CLIUtils.colorize('🔒 Security Audit Report:', 'cyan')}
`);

    const securityIssues = [
      {
        issue: 'HTTP servers without authentication',
        count: securityResults.httpServersWithoutAuth,
        severity: 'high',
        description: 'Potential unauthorized access risk'
      },
      {
        issue: 'Using deprecated protocols',
        count: securityResults.deprecatedProtocols,
        severity: 'medium',
        description: 'HTTP+SSE protocol is deprecated, recommended to upgrade'
      },
      {
        issue: 'Insecure endpoints',
        count: securityResults.insecureEndpoints,
        severity: 'high',
        description: 'Using HTTP instead of HTTPS for connection'
      },
      {
        issue: 'Excessive timeout settings',
        count: securityResults.weakTimeouts,
        severity: 'low',
        description: 'May lead to prolonged resource consumption'
      }
    ];

    securityIssues.forEach(issue => {
      if (issue.count > 0) {
        const color = issue.severity === 'high' ? 'red' : issue.severity === 'medium' ? 'yellow' : 'blue';
        console.log(`${CLIUtils.colorize('⚠️', color)} ${issue.issue}: ${issue.count} items`);
        console.log(`   ${issue.description}`);
      }
    });

    const totalIssues = securityIssues.reduce((sum, issue) => sum + issue.count, 0);
    
    if (totalIssues === 0) {
      CLIUtils.success('✅ No security issues found');
    } else {
      console.log(`
${CLIUtils.colorize('📊 Security Score:', 'cyan')} ${this.calculateSecurityScore(securityResults)}%`);
    }
  }

  private async complianceAudit(options: Record<string, any>): Promise<void> {
    CLIUtils.info('📋 Performing compliance audit...');

    const servers = Object.values(this.configManager.getServers());
    const config = this.configManager.getConfig();

    const complianceResults = {
      configurationStandards: {
        allServersNamed: servers.every(s => s.name && s.name.trim().length > 0),
        timeoutsSet: servers.every(s => s.timeout && s.timeout >= 1000),
        retriesReasonable: servers.every(s => !s.retries || (s.retries >= 0 && s.retries <= 10)),
        transportsValid: servers.every(s => ['stdio', 'http-sse', 'streamable-http'].includes(s.transport))
      },
      
      bestPractices: {
        descriptionsProvided: servers.filter(s => s.description).length / Math.max(servers.length, 1),
        modernProtocols: servers.filter(s => s.transport === 'streamable-http').length / Math.max(servers.length, 1),
        reasonableTimeouts: servers.filter(s => s.timeout && s.timeout >= 10000 && s.timeout <= 60000).length / Math.max(servers.length, 1),
        loggingConfigured: !!config.logging?.level
      },
      
      documentation: {
        configFileExists: true,
        serverCount: servers.length,
        enabledServers: servers.filter(s => s.enabled).length
      }
    };

    if (CLIUtils.isJsonMode()) {
      CLIUtils.jsonOutput({ complianceAudit: complianceResults });
      return;
    }

    console.log(`
${CLIUtils.colorize('📋 Compliance Audit Report:', 'cyan')}
`);

    console.log(`${CLIUtils.colorize('📏 Configuration Standards:', 'yellow')}`);
    Object.entries(complianceResults.configurationStandards).forEach(([key, value]) => {
      const label = this.formatComplianceLabel(key);
      console.log(`  ${value ? CLIUtils.colorize('✓', 'green') : CLIUtils.colorize('✗', 'red')} ${label}`);
    });

    console.log(`
${CLIUtils.colorize('⭐ Best Practices:', 'yellow')}`);
    Object.entries(complianceResults.bestPractices).forEach(([key, value]) => {
      const label = this.formatComplianceLabel(key);
      if (typeof value === 'number') {
        const percentage = Math.round(value * 100);
        const color = percentage >= 80 ? 'green' : percentage >= 60 ? 'yellow' : 'red';
        console.log(`  ${CLIUtils.colorize(`${percentage}%`, color)} ${label}`);
      } else {
        console.log(`  ${value ? CLIUtils.colorize('✓', 'green') : CLIUtils.colorize('✗', 'red')} ${label}`);
      }
    });

    const complianceScore = this.calculateComplianceScore(complianceResults);
    console.log(`\n${CLIUtils.colorize('📊 Compliance Score:', 'cyan')} ${this.formatComplianceScore(complianceScore)}`);
  }

  private analyzeProtocols(servers: MCPServerConfig[]): any {
    const protocolCounts = servers.reduce((acc, server) => {
      acc[server.transport] = (acc[server.transport] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      distribution: protocolCounts,
      modernProtocolUsage: (protocolCounts['streamable-http'] || 0) / Math.max(servers.length, 1),
      deprecatedProtocols: protocolCounts['http-sse'] || 0
    };
  }

  private async analyzePerformance(servers: MCPServerConfig[]): Promise<any> {
    // Simplified performance analysis
    return {
      averageTimeout: servers.reduce((sum, s) => sum + (s.timeout || 30000), 0) / Math.max(servers.length, 1),
      serversWithOptimalTimeouts: servers.filter(s => 
        s.timeout && s.timeout >= 10000 && s.timeout <= 60000
      ).length,
      totalOptimizationOpportunities: 0 // This should be actual optimization opportunity calculation
    };
  }

  private analyzeSecurity(servers: MCPServerConfig[], config: any): any {
    return {
      authenticationConfigured: servers.filter(s => s.apiKey || s.headers?.Authorization).length,
      secureEndpoints: servers.filter(s => !s.endpoint || s.endpoint.startsWith('https://')).length,
      totalServers: servers.length
    };
  }

  private analyzeCompliance(servers: MCPServerConfig[], config: any): any {
    return {
      properlyConfigured: servers.filter(s => s.name && s.transport).length,
      withDescriptions: servers.filter(s => s.description).length,
      totalServers: servers.length
    };
  }

  private generateRecommendations(auditResults: any): string[] {
    const recommendations = [];

    if (auditResults.protocols.deprecatedProtocols > 0) {
      recommendations.push(`Upgrade ${auditResults.protocols.deprecatedProtocols} deprecated HTTP+SSE protocols to Streamable HTTP`);
    }

    if (auditResults.security.authenticationConfigured < auditResults.security.totalServers) {
      recommendations.push('Configure authentication for HTTP servers to improve security');
    }

    if (auditResults.compliance.withDescriptions < auditResults.compliance.totalServers) {
      recommendations.push('Add description information to all servers to improve maintainability');
    }

    return recommendations;
  }

  private displayAuditReport(results: any): void {
    console.log(`
${CLIUtils.colorize('📊 Configuration Audit Report', 'cyan')}`);
    console.log(`Audit Time: ${new Date(results.timestamp).toLocaleString()}
`);

    console.log(`${CLIUtils.colorize('📋 Basic Information:', 'yellow')}`);
    console.log(`  Total Servers: ${results.servers}`);
    console.log(`  Enabled Servers: ${results.enabledServers}`);
    console.log(`  Modern Protocol Usage: ${Math.round(results.protocols.modernProtocolUsage * 100)}%`);

    if (results.recommendations.length > 0) {
      console.log(`\n${CLIUtils.colorize('💡 Improvement Suggestions:', 'cyan')}`);
      results.recommendations.forEach((rec: string, index: number) => {
        console.log(`  ${index + 1}. ${rec}`);
      });
    }
  }

  private async exportReport(results: any, format: string): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `mcpdog-audit-${timestamp}.${format}`;

    try {
      const { writeFile } = await import('fs/promises');
      
      if (format === 'json') {
        await writeFile(filename, JSON.stringify(results, null, 2));
      } else {
        // Simple text format
        const text = `MCPDog Configuration Audit Report
Audit Time: ${new Date(results.timestamp).toLocaleString()}
Total Servers: ${results.servers}
Enabled Servers: ${results.enabledServers}

Improvement Suggestions:
${results.recommendations.map((r: string, i: number) => `${i + 1}. ${r}`).join('\n')}
`;
        await writeFile(filename, text);
      }

      CLIUtils.success(`📄 Audit report exported: ${filename}`);
    } catch (error) {
      CLIUtils.error(`Export failed: ${(error as Error).message}`);
    }
  }

  private isTimeoutOptimal(server: MCPServerConfig): boolean {
    const timeout = server.timeout || 30000;
    if (server.transport === 'stdio') {
      return timeout >= 30000 && timeout <= 120000;
    }
    return timeout >= 10000 && timeout <= 60000;
  }

  private calculatePerformanceScore(server: MCPServerConfig, optimization: any, protocolAnalysis: any): number {
    let score = 100;

    // Protocol optimization deduction
    if (protocolAnalysis.detected !== server.transport && protocolAnalysis.confidence > 70) {
      score -= 30;
    }

    // Configuration optimization deduction
    score -= optimization.length * 10;

    // Timeout setting deduction
    if (!this.isTimeoutOptimal(server)) {
      score -= 20;
    }

    return Math.max(0, Math.round(score));
  }

  private calculateSecurityScore(results: any): number {
    let score = 100;
    
    score -= results.httpServersWithoutAuth * 20;
    score -= results.deprecatedProtocols * 10;
    score -= results.insecureEndpoints * 25;
    score -= results.weakTimeouts * 5;

    return Math.max(0, Math.round(score));
  }

  private calculateComplianceScore(results: any): number {
    const standards = Object.values(results.configurationStandards);
    const standardsScore = standards.filter(Boolean).length / standards.length;

    const practices = Object.values(results.bestPractices);
    const practicesScore = practices.reduce((sum: number, value: any) => {
      return sum + (typeof value === 'number' ? value : (value ? 1 : 0));
    }, 0) / practices.length;

    return Math.round((standardsScore * 0.6 + practicesScore * 0.4) * 100);
  }

  private formatPerformanceScore(score: number): string {
    if (score >= 90) return CLIUtils.colorize(`${score}%`, 'green');
    if (score >= 70) return CLIUtils.colorize(`${score}%`, 'yellow');
    return CLIUtils.colorize(`${score}%`, 'red');
  }

  private formatComplianceScore(score: number): string {
    if (score >= 80) return CLIUtils.colorize(`${score}% (Excellent)`, 'green');
    if (score >= 60) return CLIUtils.colorize(`${score}% (Good)`, 'yellow');
    return CLIUtils.colorize(`${score}% (Needs Improvement)`, 'red');
  }

  private formatComplianceLabel(key: string): string {
    const labels: Record<string, string> = {
      allServersNamed: 'All servers have names',
      timeoutsSet: 'Timeouts configured reasonably',
      retriesReasonable: 'Retries within reasonable range',
      transportsValid: 'Transport protocols are valid',
      descriptionsProvided: 'Descriptions provided',
      modernProtocols: 'Using modern protocols',
      reasonableTimeouts: 'Timeouts set reasonably',
      loggingConfigured: 'Logging configured'
    };
    
    return labels[key] || key;
  }

  private showHelp(): void {
    console.log(`
${CLIUtils.colorize('mcpdog audit', 'cyan')} - Configuration audit

${CLIUtils.colorize('Usage:', 'yellow')}
  mcpdog audit [options]

${CLIUtils.colorize('Audit Types:', 'yellow')}
  --performance         Performance audit (protocol optimization, timeout config, etc.)
  --security            Security audit (authentication, encryption, endpoint security, etc.)
  --compliance          Compliance audit (config standards, best practices, etc.)
  (no option)           Full audit (includes all types)

${CLIUtils.colorize('Options:', 'yellow')}
  --export <format>     Export audit report (json|txt)

${CLIUtils.colorize('Examples:', 'yellow')}
  mcpdog audit                           # Full audit
  mcpdog audit --performance             # Performance audit
  mcpdog audit --security                # Security audit
  mcpdog audit --compliance              # Compliance audit
  mcpdog audit --export json             # Export JSON report
`);
  }
}