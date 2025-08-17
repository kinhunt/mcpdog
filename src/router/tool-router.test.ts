import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToolRouter } from './tool-router';
import { EventEmitter } from 'events';
import { MCPTool, MCPResponse, ServerAdapter, MCPRequest } from '../types';

// Mock ServerAdapter
class MockAdapter extends EventEmitter implements ServerAdapter {
  name: string;
  config: any;
  isConnected: boolean = false;
  private tools: MCPTool[];

  constructor(name: string, tools: MCPTool[]) {
    super();
    this.name = name;
    this.tools = tools;
    this.config = {};
  }

  connect = vi.fn(async () => {
    this.isConnected = true;
    this.emit('connected');
  });

  disconnect = vi.fn(async () => {
    this.isConnected = false;
    this.emit('disconnected');
  });

  getTools = vi.fn(async () => {
    if (!this.isConnected) throw new Error('Not connected');
    return this.tools;
  });

  callTool = vi.fn(async (toolName: string, args: any): Promise<MCPResponse> => {
    if (!this.isConnected) throw new Error('Not connected');
    return {
      jsonrpc: '2.0',
      id: 1,
      result: { content: `Result from ${this.name}.${toolName}` },
    };
  });

  // Added to satisfy ServerAdapter interface
  sendRequest = vi.fn(async (request: MCPRequest): Promise<MCPResponse> => {
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: { message: 'Mocked sendRequest' }
    };
  });
}

describe('ToolRouter', () => {
  let toolRouter: ToolRouter;

  beforeEach(() => {
    toolRouter = new ToolRouter();
  });

  it('should add an adapter and refresh routes on connect', async () => {
    const mockTools: MCPTool[] = [{ name: 'tool1', description: 'desc1', inputSchema: { type: 'object' } }];
    const adapter = new MockAdapter('server1', mockTools);
    
    toolRouter.addAdapter(adapter);
    await adapter.connect();

    const allTools = await toolRouter.getAllTools();
    expect(allTools).toHaveLength(1);
    expect(allTools[0].name).toBe('tool1');
    expect(toolRouter.getAdapter('server1')).toBe(adapter);
  });

  it('should handle tool name conflicts by prefixing', async () => {
    const tools1: MCPTool[] = [{ name: 'shared_tool', description: 'desc1', inputSchema: { type: 'object' } }];
    const tools2: MCPTool[] = [{ name: 'shared_tool', description: 'desc2', inputSchema: { type: 'object' } }];
    const adapter1 = new MockAdapter('server1', tools1);
    const adapter2 = new MockAdapter('server2', tools2);

    toolRouter.addAdapter(adapter1);
    toolRouter.addAdapter(adapter2);

    await adapter1.connect();
    await adapter2.connect();

    const allTools = await toolRouter.getAllTools();
    expect(allTools).toHaveLength(2);
    
    const toolNames = allTools.map(t => t.name).sort();
    expect(toolNames).toEqual(['server1:shared_tool', 'server2:shared_tool']);
  });

  it('should route a tool call to the correct adapter', async () => {
    const tools1: MCPTool[] = [{ name: 'tool1', description: 'desc1', inputSchema: { type: 'object' } }];
    const tools2: MCPTool[] = [{ name: 'tool2', description: 'desc2', inputSchema: { type: 'object' } }];
    const adapter1 = new MockAdapter('server1', tools1);
    const adapter2 = new MockAdapter('server2', tools2);

    toolRouter.addAdapter(adapter1);
    toolRouter.addAdapter(adapter2);

    await adapter1.connect();
    await adapter2.connect();

    // Need to manually trigger route creation for testing since it happens on 'connect' event
    // @ts-ignore - access private method for test
    await toolRouter.refreshToolRoutes('server1');
    // @ts-ignore
    await toolRouter.refreshToolRoutes('server2');

    const response = await toolRouter.callTool('tool2', {});
    expect(response.result.content).toBe('Result from server2.tool2');
    expect(adapter2.callTool).toHaveBeenCalledWith('tool2', {});
    expect(adapter1.callTool).not.toHaveBeenCalled();
  });

  it('should return an error if a tool is not found', async () => {
    const response = await toolRouter.callTool('non_existent_tool', {});
    expect(response.error).toBeDefined();
    expect(response.error?.code).toBe(-32601);
    expect(response.error?.message).toContain('Tool not found');
  });

  it('should remove routes when an adapter disconnects', async () => {
    const mockTools: MCPTool[] = [{ name: 'tool1', description: 'desc1', inputSchema: { type: 'object' } }];
    const adapter = new MockAdapter('server1', mockTools);
    
    toolRouter.addAdapter(adapter);
    await adapter.connect();

    let allTools = await toolRouter.getAllTools();
    expect(allTools).toHaveLength(1);

    adapter.emit('disconnected');

    const route = toolRouter.findToolRoute('tool1');
    expect(route).toBeUndefined();
  });
});