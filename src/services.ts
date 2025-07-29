export interface MCPService {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  tools: Array<{
    name: string;
    description: string;
    parameters: any;
  }>;
  endpoint?: string;
}

export const AVAILABLE_SERVICES: MCPService[] = [
  {
    id: "service-a",
    name: "File Operations Service",
    description: "Provides file system operations like reading, writing, and searching files",
    capabilities: ["file_operations", "search"],
    tools: [
      {
        name: "read_file",
        description: "Read contents of a file",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "File path to read" }
          },
          required: ["path"]
        }
      },
      {
        name: "write_file", 
        description: "Write content to a file",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "File path to write" },
            content: { type: "string", description: "Content to write" }
          },
          required: ["path", "content"]
        }
      },
      {
        name: "search_files",
        description: "Search for files matching a pattern",
        parameters: {
          type: "object", 
          properties: {
            pattern: { type: "string", description: "Search pattern" },
            directory: { type: "string", description: "Directory to search in" }
          },
          required: ["pattern"]
        }
      }
    ],
    endpoint: "stdio://file-service"
  },
  {
    id: "service-b", 
    name: "Web Scraping Service",
    description: "Provides web scraping and HTTP request capabilities",
    capabilities: ["web_scraping", "http_requests"],
    tools: [
      {
        name: "fetch_url",
        description: "Fetch content from a URL",
        parameters: {
          type: "object",
          properties: {
            url: { type: "string", description: "URL to fetch" },
            method: { type: "string", enum: ["GET", "POST"], default: "GET" }
          },
          required: ["url"]
        }
      },
      {
        name: "extract_links",
        description: "Extract all links from a webpage",
        parameters: {
          type: "object",
          properties: {
            url: { type: "string", description: "URL to extract links from" }
          },
          required: ["url"]
        }
      },
      {
        name: "scrape_text",
        description: "Extract text content from a webpage",
        parameters: {
          type: "object",
          properties: {
            url: { type: "string", description: "URL to scrape" },
            selector: { type: "string", description: "CSS selector for specific elements" }
          },
          required: ["url"]
        }
      }
    ],
    endpoint: "stdio://web-service"
  },
  {
    id: "service-c",
    name: "Database Operations Service", 
    description: "Provides database query and management capabilities",
    capabilities: ["database", "sql"],
    tools: [
      {
        name: "execute_query",
        description: "Execute a SQL query",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "SQL query to execute" },
            database: { type: "string", description: "Database name" }
          },
          required: ["query"]
        }
      },
      {
        name: "list_tables",
        description: "List all tables in the database",
        parameters: {
          type: "object",
          properties: {
            database: { type: "string", description: "Database name" }
          }
        }
      },
      {
        name: "describe_table",
        description: "Get schema information for a table",
        parameters: {
          type: "object",
          properties: {
            table: { type: "string", description: "Table name" },
            database: { type: "string", description: "Database name" }
          },
          required: ["table"]
        }
      }
    ],
    endpoint: "stdio://db-service"
  }
];

export function findBestService(userQuery: string): MCPService | null {
  const query = userQuery.toLowerCase();
  
  for (const service of AVAILABLE_SERVICES) {
    const keywords = [
      ...service.capabilities,
      ...service.tools.map(t => t.name),
      service.name.toLowerCase(),
      service.description.toLowerCase()
    ];
    
    if (keywords.some(keyword => query.includes(keyword.toLowerCase()))) {
      return service;
    }
  }
  
  return null;
}